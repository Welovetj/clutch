import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapBetRow } from "@/lib/supabase/dashboard-data";

type RecapSummary = {
  betsPlaced: number;
  pnl: number;
  bestBet: string;
  worstBet: string;
  insight: string;
};

type RecapRow = {
  id: string;
  period_type: "daily" | "weekly";
  period_key: string;
  title: string;
  summary: RecapSummary;
  created_at: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastCompletedWeekRange(now: Date): { key: string; start: Date; end: Date } {
  const day = now.getUTCDay();
  const thisWeekMondayOffset = (day + 6) % 7;
  const thisWeekMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - thisWeekMondayOffset));
  const start = new Date(thisWeekMonday);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(thisWeekMonday);
  const key = `${ymd(start)}_to_${ymd(new Date(end.getTime() - 1))}`;
  return { key, start, end };
}

function localSummary(periodBets: Array<{ ticketCode: string; result: number; stake: number }>): RecapSummary {
  const betsPlaced = periodBets.length;
  const pnl = periodBets.reduce((sum, bet) => sum + bet.result, 0);
  const sortedByResult = [...periodBets].sort((a, b) => b.result - a.result);
  const best = sortedByResult[0];
  const worst = sortedByResult[sortedByResult.length - 1];
  const totalStake = periodBets.reduce((sum, bet) => sum + bet.stake, 0);
  const roi = totalStake > 0 ? (pnl / totalStake) * 100 : 0;

  return {
    betsPlaced,
    pnl,
    bestBet: best ? `${best.ticketCode} (${best.result >= 0 ? "+" : ""}${best.result.toFixed(2)})` : "No settled bets",
    worstBet: worst ? `${worst.ticketCode} (${worst.result >= 0 ? "+" : ""}${worst.result.toFixed(2)})` : "No settled bets",
    insight: roi >= 0
      ? "You finished positive for this period; protect edge by keeping stake size disciplined."
      : "This period finished negative; review bet selection and avoid chasing with larger stake sizes.",
  };
}

async function aiSummary(
  apiKey: string,
  periodType: "daily" | "weekly",
  periodKey: string,
  periodBets: Array<{ ticketCode: string; sport: string; market: string; result: number; stake: number; oddsAmerican: number }>,
): Promise<RecapSummary | null> {
  const system = [
    "You generate short betting recap summaries.",
    "Return ONLY JSON with keys: betsPlaced, pnl, bestBet, worstBet, insight.",
    "Insight must be one concise recommendation sentence.",
  ].join("\n");

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://clutch.local",
      "X-Title": "Clutch Recap Generator",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({ periodType, periodKey, periodBets }),
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as RecapSummary;
    if (
      typeof parsed.betsPlaced === "number" &&
      typeof parsed.pnl === "number" &&
      typeof parsed.bestBet === "string" &&
      typeof parsed.worstBet === "string" &&
      typeof parsed.insight === "string"
    ) {
      return parsed;
    }
  } catch {
    // ignore malformed AI output and fall back
  }

  return null;
}

async function ensureRecap(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  periodType: "daily" | "weekly",
  periodKey: string,
  title: string,
  start: Date,
  end: Date,
  bets: ReturnType<typeof mapBetRow>[],
  apiKey?: string,
) {
  const { data: existing } = await supabase
    .from("ai_recaps")
    .select("id")
    .eq("user_id", userId)
    .eq("period_type", periodType)
    .eq("period_key", periodKey)
    .maybeSingle();

  if (existing?.id) return;

  const periodBets = bets.filter((bet) => {
    const t = new Date(bet.placedAt.replace(" ", "T")).getTime();
    return t >= start.getTime() && t < end.getTime();
  });

  if (!periodBets.length) return;

  const compact = periodBets.map((bet) => ({
    ticketCode: bet.ticketCode,
    sport: bet.sport,
    market: bet.market,
    result: bet.result,
    stake: bet.stake,
    oddsAmerican: bet.oddsAmerican,
  }));

  const summary = (apiKey ? await aiSummary(apiKey, periodType, periodKey, compact) : null) ?? localSummary(compact);

  await supabase.from("ai_recaps").insert({
    user_id: userId,
    period_type: periodType,
    period_key: periodKey,
    title,
    summary,
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

  const { data: betRows, error: betError } = await supabase
    .from("bets")
    .select("id,ticket_code,placed_at,sport,market,odds_american,bet_type,parlay_legs_count,combined_odds_american,stake,to_win,book,status,result,opening_line,betting_line,closing_line,public_bet_pct,public_money_pct")
    .eq("user_id", user.id)
    .order("placed_at", { ascending: false })
    .limit(500);

  if (betError) {
    return NextResponse.json({ error: betError.message }, { status: 500 });
  }

  const bets = (betRows ?? []).map(mapBetRow);
  const now = new Date();
  const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const week = lastCompletedWeekRange(now);

  const apiKey = process.env.OPENROUTER_API_KEY;

  await ensureRecap(
    supabase,
    user.id,
    "daily",
    ymd(yesterdayStart),
    `Daily Recap - ${ymd(yesterdayStart)}`,
    yesterdayStart,
    todayStart,
    bets,
    apiKey,
  );

  await ensureRecap(
    supabase,
    user.id,
    "weekly",
    week.key,
    `Weekly Recap - ${week.key}`,
    week.start,
    week.end,
    bets,
    apiKey,
  );

  const { data: recaps, error: recapError } = await supabase
    .from("ai_recaps")
    .select("id,period_type,period_key,title,summary,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(24);

  if (recapError) {
    return NextResponse.json({ error: recapError.message }, { status: 500 });
  }

  const response = (recaps ?? []).map((row: RecapRow) => ({
    id: row.id,
    periodType: row.period_type,
    periodKey: row.period_key,
    title: row.title,
    betsPlaced: Number(row.summary?.betsPlaced ?? 0),
    pnl: Number(row.summary?.pnl ?? 0),
    bestBet: String(row.summary?.bestBet ?? ""),
    worstBet: String(row.summary?.worstBet ?? ""),
    insight: String(row.summary?.insight ?? ""),
    createdAt: row.created_at,
  }));

  return NextResponse.json({ data: response });
}
