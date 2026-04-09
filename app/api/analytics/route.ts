import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAnalytics, buildKpis, mapBetRow } from "@/lib/supabase/dashboard-data";

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
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bets = (data ?? []).map(mapBetRow);

  return NextResponse.json({ data: { kpis: buildKpis(bets), segments: buildAnalytics(bets) } });
}
