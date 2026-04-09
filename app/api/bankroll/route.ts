import { NextResponse } from "next/server";
import { buildExposure, mapBankrollRow, mapBetRow } from "@/lib/supabase/dashboard-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const [curveResponse, betsResponse] = await Promise.all([
    supabase.from("bankroll_snapshots").select("id,snapshot_date,value").eq("user_id", user.id).order("snapshot_date", { ascending: true }),
    supabase.from("bets").select("id,ticket_code,placed_at,sport,market,odds_american,bet_type,parlay_legs_count,combined_odds_american,stake,to_win,book,status,result,opening_line,betting_line,closing_line,public_bet_pct,public_money_pct").eq("user_id", user.id),
  ]);

  if (curveResponse.error || betsResponse.error) {
    return NextResponse.json({ error: curveResponse.error?.message ?? betsResponse.error?.message }, { status: 500 });
  }

  const curve = (curveResponse.data ?? []).map(mapBankrollRow);
  const exposure = buildExposure((betsResponse.data ?? []).map(mapBetRow));

  return NextResponse.json({ data: { curve, exposure } });
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

  const body = (await request.json()) as { snapshotDate?: string; value?: number };

  const { error } = await supabase.from("bankroll_snapshots").upsert({
    user_id: user.id,
    snapshot_date: body.snapshotDate,
    value: body.value,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
