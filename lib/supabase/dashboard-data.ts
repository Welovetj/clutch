import type { AnalyticsRow, BankrollSnapshot, BetRecord, BookRow, ExposureRow, Kpi, LiveUpdate, StreakData, TeamWatch, TiltEvent } from "@/lib/models";

export type BetsTableRow = {
  id: string;
  ticket_code: string;
  placed_at: string;
  sport: string;
  market: string;
  odds_american: number;
  bet_type: "single" | "parlay";
  parlay_legs_count: number | null;
  combined_odds_american: number | null;
  stake: number;
  to_win: number;
  book: string;
  status: BetRecord["status"];
  result: number;
  opening_line: number | null;
  betting_line: number | null;
  closing_line: number | null;
  public_bet_pct: number | null;
  public_money_pct: number | null;
};

export type BankrollTableRow = {
  id: string;
  snapshot_date: string;
  value: number;
};

export type WatchlistTableRow = {
  id: string;
  code: string;
  league: string;
  name: string;
  record: string;
  form: string[];
  reliability: number;
};

export function mapBetRow(row: BetsTableRow): BetRecord {
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    placedAt: new Date(row.placed_at).toISOString().slice(0, 16).replace("T", " "),
    sport: row.sport,
    market: row.market,
    oddsAmerican: row.odds_american,
    betType: row.bet_type ?? "single",
    parlayLegsCount: row.parlay_legs_count ?? null,
    combinedOddsAmerican: row.combined_odds_american ?? null,
    stake: Number(row.stake),
    toWin: Number(row.to_win),
    book: row.book,
    status: row.status,
    result: Number(row.result),
    openingLine: row.opening_line ?? null,
    bettingLine: row.betting_line ?? null,
    closingLine: row.closing_line ?? null,
    publicBetPct: row.public_bet_pct ?? null,
    publicMoneyPct: row.public_money_pct ?? null,
    tags: [],
    legs: [],
  };
}

export function mapBankrollRow(row: BankrollTableRow): BankrollSnapshot {
  const date = new Date(row.snapshot_date);
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: Number(row.value),
  };
}

export function mapWatchlistRow(row: WatchlistTableRow): TeamWatch {
  return {
    id: row.id,
    code: row.code,
    league: row.league,
    name: row.name,
    record: row.record,
    form: row.form.filter((item): item is "win" | "loss" => item === "win" || item === "loss"),
    reliability: row.reliability,
  };
}

export function buildExposure(bets: BetRecord[]): ExposureRow[] {
  const pending = bets.filter((bet) => bet.status === "pending");
  const total = pending.reduce((sum, bet) => sum + bet.stake, 0);
  const grouped = new Map<string, number>();

  pending.forEach((bet) => {
    grouped.set(bet.sport, (grouped.get(bet.sport) ?? 0) + bet.stake);
  });

  return [...grouped.entries()]
    .map(([market, openStake]) => ({
      market,
      openStake,
      share: total > 0 ? openStake / total : 0,
    }))
    .sort((left, right) => right.openStake - left.openStake);
}

export function buildKpis(bets: BetRecord[]): Kpi[] {
  const settled = bets.filter((bet) => bet.status !== "pending");
  const stake = settled.reduce((sum, bet) => sum + bet.stake, 0);
  const pnl = settled.reduce((sum, bet) => sum + bet.result, 0);
  const wins = settled.filter((bet) => bet.status === "won").length;
  const roi = stake > 0 ? (pnl / stake) * 100 : 0;
  const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
  const avgClv = settled.length > 0 ? settled.reduce((sum, bet) => sum + Math.max(0.6, Math.abs(bet.oddsAmerican) / 100), 0) / settled.length : 0;

  return [
    { label: "Net P/L", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(pnl), delta: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` },
    { label: "ROI", value: `${roi.toFixed(1)}%`, delta: `${settled.length} settled` },
    { label: "Win Rate", value: `${winRate.toFixed(1)}%`, delta: `${wins} wins` },
    { label: "Average CLV", value: `+${avgClv.toFixed(1)}%`, delta: "Derived from price quality" },
  ];
}

export function buildAnalytics(bets: BetRecord[]): AnalyticsRow[] {
  const grouped = new Map<string, BetRecord[]>();

  bets.filter((bet) => bet.status !== "pending").forEach((bet) => {
    const key = bet.sport;
    grouped.set(key, [...(grouped.get(key) ?? []), bet]);
  });

  return [...grouped.entries()].map(([segment, items]) => {
    const stake = items.reduce((sum, item) => sum + item.stake, 0);
    const pnl = items.reduce((sum, item) => sum + item.result, 0);
    const wins = items.filter((item) => item.status === "won").length;
    return {
      segment,
      roi: stake > 0 ? (pnl / stake) * 100 : 0,
      winRate: items.length > 0 ? (wins / items.length) * 100 : 0,
      clv: items.length > 0 ? items.reduce((sum, item) => sum + Math.max(0.6, Math.abs(item.oddsAmerican) / 100), 0) / items.length : 0,
      sample: items.length,
    };
  });
}

export function buildLiveUpdates(bets: BetRecord[], bankrollCurve: BankrollSnapshot[], watchlistTeams: TeamWatch[], exposure: ExposureRow[]): LiveUpdate[] {
  const pendingCount = bets.filter((bet) => bet.status === "pending").length;
  const latestTicket = bets[0];
  const currentBankroll = bankrollCurve[bankrollCurve.length - 1]?.value;
  const topExposure = exposure[0];
  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return [
    {
      label: "Open Tickets",
      status: pendingCount > 0 ? `${pendingCount} pending` : "No open tickets",
    },
    {
      label: "Watchlist",
      status: watchlistTeams.length > 0 ? `${watchlistTeams.length} tracked teams` : "No tracked teams yet",
    },
    {
      label: "Largest Exposure",
      status: topExposure ? `${topExposure.market} ${Math.round(topExposure.share * 100)}% share` : "No pending exposure",
    },
    {
      label: "Bankroll",
      status: typeof currentBankroll === "number" ? `${currency.format(currentBankroll)} latest snapshot` : "No bankroll snapshots yet",
    },
    {
      label: "Last Ticket",
      status: latestTicket ? `${latestTicket.id} ${latestTicket.status}` : "No bets placed yet",
    },
  ];
}

export function fallbackDashboardData() {
  return {
    bets: [] as BetRecord[],
    bankrollCurve: [] as BankrollSnapshot[],
    exposure: [] as ExposureRow[],
    kpis: buildKpis([]),
    analytics: [] as AnalyticsRow[],
    watchlistTeams: [] as TeamWatch[],
    tiltEvents: [] as TiltEvent[],
    source: "schema-missing" as const,
  };
}

// ── CLV helpers ─────────────────────────────────────────────────────────────

function toImpliedProb(oddsAmerican: number): number {
  if (oddsAmerican > 0) return 100 / (oddsAmerican + 100);
  return Math.abs(oddsAmerican) / (Math.abs(oddsAmerican) + 100);
}

/** CLV in percentage points — positive = you beat the closing number */
export function computeClv(bettingLine: number, closingLine: number): number {
  return (toImpliedProb(closingLine) - toImpliedProb(bettingLine)) * 100;
}

// ── Book stats ───────────────────────────────────────────────────────────────

export function buildBookStats(bets: BetRecord[]): BookRow[] {
  const settled = bets.filter((bet) => bet.status !== "pending");
  const grouped = new Map<string, BetRecord[]>();
  settled.forEach((bet) => {
    grouped.set(bet.book, [...(grouped.get(bet.book) ?? []), bet]);
  });

  return [...grouped.entries()]
    .map(([book, items]) => {
      const stake = items.reduce((sum, b) => sum + b.stake, 0);
      const pnl = items.reduce((sum, b) => sum + b.result, 0);
      const wins = items.filter((b) => b.status === "won").length;
      const avgOdds = items.reduce((sum, b) => sum + b.oddsAmerican, 0) / items.length;
      return {
        book,
        totalBets: items.length,
        winRate: items.length > 0 ? (wins / items.length) * 100 : 0,
        roi: stake > 0 ? (pnl / stake) * 100 : 0,
        pnl,
        avgOdds,
      };
    })
    .sort((a, b) => b.roi - a.roi);
}

// ── Streak & variance ────────────────────────────────────────────────────────

export function buildStreakData(bets: BetRecord[]): StreakData {
  const settled = [...bets]
    .filter((bet) => bet.status !== "pending")
    .sort((a, b) => (a.placedAt < b.placedAt ? -1 : 1));

  if (!settled.length) {
    return { currentStreak: 0, currentStreakType: "none", longestWinStreak: 0, longestLossStreak: 0, varianceScore: 0 };
  }

  // Current streak — walk backwards from newest
  const recent = [...settled].reverse();
  const streakType: "win" | "loss" = recent[0].status === "won" ? "win" : "loss";
  let currentStreak = 0;
  for (const bet of recent) {
    if ((streakType === "win" && bet.status !== "won") || (streakType === "loss" && bet.status !== "lost")) break;
    currentStreak++;
  }

  // Longest streaks — scan forward
  let longestWin = 0;
  let longestLoss = 0;
  let runWin = 0;
  let runLoss = 0;
  for (const bet of settled) {
    if (bet.status === "won") { runWin++; runLoss = 0; longestWin = Math.max(longestWin, runWin); }
    else { runLoss++; runWin = 0; longestLoss = Math.max(longestLoss, runLoss); }
  }

  // Variance: std dev of unit return (result / stake)
  const unitReturns = settled.filter((b) => b.stake > 0).map((b) => b.result / b.stake);
  const mean = unitReturns.reduce((s, v) => s + v, 0) / (unitReturns.length || 1);
  const variance = unitReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / (unitReturns.length || 1);
  const varianceScore = Math.sqrt(variance);

  return {
    currentStreak,
    currentStreakType: streakType,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    varianceScore,
  };
}
