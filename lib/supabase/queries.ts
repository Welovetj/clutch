import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsRow, BankrollSnapshot, BetRecord, DashboardDataSource, ExposureRow, Kpi, TeamWatch, TiltEvent } from "@/lib/models";
import { buildAnalytics, buildExposure, buildKpis, fallbackDashboardData, mapBankrollRow, mapBetRow, mapWatchlistRow } from "@/lib/supabase/dashboard-data";

export async function getDashboardData(supabase: SupabaseClient, userId: string): Promise<{
  bets: BetRecord[];
  bankrollCurve: BankrollSnapshot[];
  exposure: ExposureRow[];
  kpis: Kpi[];
  analytics: AnalyticsRow[];
  watchlistTeams: TeamWatch[];
  tiltEvents: TiltEvent[];
  source: DashboardDataSource;
}> {
  const [betsResponse, bankrollResponse, watchlistResponse, tagLinksResponse, tagsResponse, legsResponse, tiltResponse] = await Promise.all([
    supabase.from("bets").select("id,ticket_code,placed_at,sport,market,odds_american,bet_type,parlay_legs_count,combined_odds_american,stake,to_win,book,status,result,opening_line,betting_line,closing_line,public_bet_pct,public_money_pct").eq("user_id", userId).order("placed_at", { ascending: false }),
    supabase.from("bankroll_snapshots").select("id,snapshot_date,value").eq("user_id", userId).order("snapshot_date", { ascending: true }),
    supabase.from("watchlist_teams").select("id,code,league,name,record,form,reliability").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("bet_tag_links").select("bet_id,tag_id").eq("user_id", userId),
    supabase.from("bet_tags").select("id,name").eq("user_id", userId),
    supabase.from("bet_parlay_legs").select("id,bet_id,sport,market,odds_american").eq("user_id", userId),
    supabase.from("tilt_events").select("id,triggered_at,conditions_met,dismissed_at").eq("user_id", userId).order("triggered_at", { ascending: false }).limit(100),
  ]);

  if (betsResponse.error || bankrollResponse.error || watchlistResponse.error || tagLinksResponse.error || tagsResponse.error || legsResponse.error) {
    return fallbackDashboardData();
  }

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
      {
        id: leg.id,
        sport: leg.sport,
        market: leg.market,
        oddsAmerican: leg.odds_american,
      },
    ]);
  }

  const bets = (betsResponse.data ?? []).map(mapBetRow).map((bet) => {
    const legs = legsByBet.get(bet.id) ?? [];
    return {
      ...bet,
      tags: tagsByBet.get(bet.id) ?? [],
      legs,
      parlayLegsCount: bet.parlayLegsCount ?? (bet.betType === "parlay" ? legs.length : null),
    };
  });
  const bankrollCurve = (bankrollResponse.data ?? []).map(mapBankrollRow);
  const watchlistTeams = (watchlistResponse.data ?? []).map(mapWatchlistRow);
  const tiltEvents: TiltEvent[] = ((tiltResponse.error ? [] : tiltResponse.data) ?? []).map((item) => ({
    id: item.id,
    triggeredAt: item.triggered_at,
    conditionsMet: Array.isArray(item.conditions_met) ? item.conditions_met : [],
    dismissedAt: item.dismissed_at,
  }));

  return {
    bets,
    bankrollCurve,
    exposure: buildExposure(bets),
    kpis: buildKpis(bets),
    analytics: buildAnalytics(bets),
    watchlistTeams,
    tiltEvents,
    source: "supabase",
  };
}
