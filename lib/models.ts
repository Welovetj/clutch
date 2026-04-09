export type BetStatus = "won" | "lost" | "pending";
export type BetType = "single" | "parlay";

export type BetLeg = {
  id: string;
  sport: string;
  market: string;
  oddsAmerican: number;
};

export type BetRecord = {
  id: string;
  ticketCode: string;
  placedAt: string;
  sport: string;
  market: string;
  oddsAmerican: number;
  betType: BetType;
  parlayLegsCount: number | null;
  combinedOddsAmerican: number | null;
  stake: number;
  toWin: number;
  book: string;
  status: BetStatus;
  result: number;
  openingLine: number | null;
  bettingLine: number | null;
  closingLine: number | null;
  publicBetPct: number | null;
  publicMoneyPct: number | null;
  tags: string[];
  legs: BetLeg[];
};

export type BankrollSnapshot = {
  date: string;
  value: number;
};

export type ExposureRow = {
  market: string;
  openStake: number;
  share: number;
};

export type Kpi = {
  label: string;
  value: string;
  delta: string;
};

export type TeamWatch = {
  id?: string;
  code: string;
  league: string;
  name: string;
  record: string;
  form: Array<"win" | "loss">;
  reliability: number;
};

export type DashboardDataSource = "supabase" | "schema-missing";

export type LiveUpdate = {
  label: string;
  status: string;
};

export type AnalyticsRow = {
  segment: string;
  roi: number;
  winRate: number;
  clv: number;
  sample: number;
};

export type BookRow = {
  book: string;
  totalBets: number;
  winRate: number;
  roi: number;
  pnl: number;
  avgOdds: number;
};

export type StreakData = {
  currentStreak: number;
  currentStreakType: "win" | "loss" | "none";
  longestWinStreak: number;
  longestLossStreak: number;
  varianceScore: number;
};

export type TagPerformanceRow = {
  tag: string;
  totalBets: number;
  winRate: number;
  roi: number;
  pnl: number;
};

export type RecapDigest = {
  id: string;
  periodType: "daily" | "weekly";
  periodKey: string;
  title: string;
  betsPlaced: number;
  pnl: number;
  bestBet: string;
  worstBet: string;
  insight: string;
  createdAt: string;
};

export type TiltEvent = {
  id: string;
  triggeredAt: string;
  conditionsMet: string[];
  dismissedAt: string | null;
};
