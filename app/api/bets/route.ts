import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapBetRow } from "@/lib/supabase/dashboard-data";

type TiltBetRow = {
  placed_at: string;
  status: "won" | "lost" | "pending";
  stake: number;
};

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function normalizeTags(input: string[] | undefined): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

function normalizeLegs(
  input: Array<{ sport?: string; market?: string; oddsAmerican?: number }> | undefined,
): Array<{ sport: string; market: string; oddsAmerican: number }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((leg) => ({
      sport: String(leg.sport ?? "").trim(),
      market: String(leg.market ?? "").trim(),
      oddsAmerican: Number(leg.oddsAmerican ?? 0),
    }))
    .filter((leg) => leg.sport && leg.market && Number.isFinite(leg.oddsAmerican) && leg.oddsAmerican !== 0)
    .slice(0, 12);
}

async function syncBetTags(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  betId: string,
  tagNames: string[],
) {
  const tags = normalizeTags(tagNames);

  await supabase.from("bet_tag_links").delete().eq("user_id", userId).eq("bet_id", betId);

  if (!tags.length) {
    return;
  }

  await supabase.from("bet_tags").upsert(
    tags.map((name) => ({ user_id: userId, name })),
    { onConflict: "user_id,name" },
  );

  const { data: createdTags } = await supabase
    .from("bet_tags")
    .select("id,name")
    .eq("user_id", userId)
    .in("name", tags);

  if (!createdTags?.length) {
    return;
  }

  await supabase.from("bet_tag_links").insert(
    createdTags.map((tag) => ({
      user_id: userId,
      bet_id: betId,
      tag_id: tag.id,
    })),
  );
}

function toDate(input: string | undefined): Date {
  if (!input) return new Date();
  const value = new Date(input);
  return Number.isNaN(value.getTime()) ? new Date() : value;
}

async function runTiltDetection(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  latestStake: number,
  latestPlacedAt?: string,
) {
  const [betsResponse, bankrollResponse] = await Promise.all([
    supabase.from("bets").select("placed_at,status,stake").eq("user_id", userId).order("placed_at", { ascending: false }).limit(500),
    supabase.from("bankroll_snapshots").select("value").eq("user_id", userId).order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (betsResponse.error) {
    return;
  }

  const bets = (betsResponse.data ?? []) as TiltBetRow[];
  const conditions: string[] = [];

  const settledNewest = bets.filter((bet) => bet.status !== "pending");
  let lossStreak = 0;
  for (const bet of settledNewest) {
    if (bet.status !== "lost") {
      break;
    }
    lossStreak += 1;
  }
  if (lossStreak >= 3) {
    conditions.push(`lost ${lossStreak} in a row`);
  }

  const placedAt = toDate(latestPlacedAt);
  const windowStart = placedAt.getTime() - 2 * 60 * 60 * 1000;
  const recentCount = bets.filter((bet) => {
    const t = new Date(bet.placed_at).getTime();
    return !Number.isNaN(t) && t >= windowStart && t <= placedAt.getTime();
  }).length;
  if (recentCount >= 3) {
    conditions.push(`placed ${recentCount} bets in the last 2 hours`);
  }

  const stakes = bets.map((bet) => Number(bet.stake)).filter((stake) => Number.isFinite(stake) && stake > 0);
  const averageStake = stakes.length ? stakes.reduce((sum, stake) => sum + stake, 0) / stakes.length : 0;
  if (averageStake > 0 && latestStake > averageStake * 2) {
    conditions.push(`staked ${latestStake.toFixed(2)}, over 2x average stake (${averageStake.toFixed(2)})`);
  }

  const openStake = bets.filter((bet) => bet.status === "pending").reduce((sum, bet) => sum + Number(bet.stake), 0);
  const currentBankroll = Number(bankrollResponse.data?.value ?? 0);
  if (currentBankroll > 0 && openStake > currentBankroll * 0.2) {
    conditions.push(`open stake ${openStake.toFixed(2)} exceeds 20% of bankroll (${currentBankroll.toFixed(2)})`);
  }

  if (!conditions.length) {
    return;
  }

  await supabase.from("tilt_events").insert({
    user_id: userId,
    conditions_met: conditions,
  });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bets")
    .select("id,ticket_code,placed_at,sport,market,odds_american,bet_type,parlay_legs_count,combined_odds_american,stake,to_win,book,status,result,opening_line,betting_line,closing_line,public_bet_pct,public_money_pct")
    .eq("user_id", user.id)
    .order("placed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [tagLinksResponse, tagsResponse, legsResponse] = await Promise.all([
    supabase.from("bet_tag_links").select("bet_id,tag_id").eq("user_id", user.id),
    supabase.from("bet_tags").select("id,name").eq("user_id", user.id),
    supabase.from("bet_parlay_legs").select("id,bet_id,sport,market,odds_american").eq("user_id", user.id),
  ]);

  const tagNameById = new Map((tagsResponse.data ?? []).map((tag) => [tag.id, tag.name]));
  const tagsByBet = new Map<string, string[]>();
  for (const link of tagLinksResponse.data ?? []) {
    const tagName = tagNameById.get(link.tag_id);
    if (!tagName) continue;
    tagsByBet.set(link.bet_id, [...(tagsByBet.get(link.bet_id) ?? []), tagName]);
  }

  const legsByBet = new Map<string, Array<{ id: string; sport: string; market: string; oddsAmerican: number }>>();
  for (const leg of legsResponse.data ?? []) {
    legsByBet.set(leg.bet_id, [
      ...(legsByBet.get(leg.bet_id) ?? []),
      { id: leg.id, sport: leg.sport, market: leg.market, oddsAmerican: leg.odds_american },
    ]);
  }

  const bets = (data ?? []).map(mapBetRow).map((bet) => ({
    ...bet,
    tags: tagsByBet.get(bet.id) ?? [],
    legs: legsByBet.get(bet.id) ?? [],
    parlayLegsCount: bet.parlayLegsCount ?? (bet.betType === "parlay" ? (legsByBet.get(bet.id) ?? []).length : null),
  }));

  return NextResponse.json({ data: bets });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    ticketCode?: string;
    placedAt?: string;
    sport?: string;
    market?: string;
    oddsAmerican?: number;
    betType?: "single" | "parlay";
    combinedOddsAmerican?: number | null;
    stake?: number;
    toWin?: number;
    book?: string;
    status?: "won" | "lost" | "pending";
    result?: number;
    publicBetPct?: number | null;
    publicMoneyPct?: number | null;
    tags?: string[];
    legs?: Array<{ sport?: string; market?: string; oddsAmerican?: number }>;
  };

  const betType = body.betType === "parlay" ? "parlay" : "single";
  const legs = normalizeLegs(body.legs);

  if (betType === "parlay" && legs.length < 2) {
    return NextResponse.json({ error: "Parlay bets require at least 2 legs." }, { status: 400 });
  }

  const { data: insertedBet, error } = await supabase.from("bets").insert({
    user_id: user.id,
    ticket_code: body.ticketCode,
    placed_at: body.placedAt,
    sport: body.sport,
    market: body.market,
    odds_american: body.oddsAmerican,
    bet_type: betType,
    parlay_legs_count: betType === "parlay" ? legs.length : null,
    combined_odds_american: betType === "parlay" ? (body.combinedOddsAmerican ?? body.oddsAmerican ?? null) : null,
    stake: body.stake,
    to_win: body.toWin,
    book: body.book,
    status: body.status,
    result: body.result ?? 0,
    public_bet_pct: body.publicBetPct == null ? null : clampPct(body.publicBetPct),
    public_money_pct: body.publicMoneyPct == null ? null : clampPct(body.publicMoneyPct),
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (insertedBet?.id && legs.length) {
    const { error: legsError } = await supabase.from("bet_parlay_legs").insert(
      legs.map((leg) => ({
        user_id: user.id,
        bet_id: insertedBet.id,
        sport: leg.sport,
        market: leg.market,
        odds_american: leg.oddsAmerican,
      })),
    );

    if (legsError) {
      return NextResponse.json({ error: legsError.message }, { status: 500 });
    }
  }

  if (insertedBet?.id) {
    await syncBetTags(supabase, user.id, insertedBet.id, body.tags ?? []);
  }

  try {
    await runTiltDetection(supabase, user.id, Number(body.stake ?? 0), body.placedAt);
  } catch {
    // Bet creation should succeed even if tilt analysis fails.
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    betId?: string;
    status?: "won" | "lost" | "pending";
    result?: number;
    openingLine?: number | null;
    bettingLine?: number | null;
    closingLine?: number | null;
    publicBetPct?: number | null;
    publicMoneyPct?: number | null;
    tags?: string[];
  };

  if (!body.betId) {
    return NextResponse.json({ error: "betId is required" }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {
    status: body.status,
    result: body.result ?? 0,
  };
  if ("openingLine" in body) updatePayload.opening_line = body.openingLine ?? null;
  if ("bettingLine" in body) updatePayload.betting_line = body.bettingLine ?? null;
  if ("closingLine" in body) updatePayload.closing_line = body.closingLine ?? null;
  if ("publicBetPct" in body) updatePayload.public_bet_pct = body.publicBetPct == null ? null : clampPct(body.publicBetPct);
  if ("publicMoneyPct" in body) updatePayload.public_money_pct = body.publicMoneyPct == null ? null : clampPct(body.publicMoneyPct);

  const { error } = await supabase
    .from("bets")
    .update(updatePayload)
    .eq("user_id", user.id)
    .eq("id", body.betId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if ("tags" in body) {
    await syncBetTags(supabase, user.id, body.betId, body.tags ?? []);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    betId?: string;
  };

  if (!body.betId) {
    return NextResponse.json({ error: "betId is required" }, { status: 400 });
  }

  const { error } = await supabase.from("bets").delete().eq("user_id", user.id).eq("id", body.betId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
