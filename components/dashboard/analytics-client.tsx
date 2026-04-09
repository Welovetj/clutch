"use client";

import { startTransition, useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { currency, percent } from "@/lib/format";
import { americanOdds } from "@/lib/format";
import type { AnalyticsRow, BetRecord, BookRow, TagPerformanceRow, TiltEvent } from "@/lib/models";

type SortKey = "roi" | "winRate" | "clv" | "sample";
type BookSortKey = keyof BookRow;

// ── helpers ─────────────────────────────────────────────────────────────────

function impliedProb(o: number) {
  return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
}
function calcClv(bet: number, close: number) {
  return (impliedProb(close) - impliedProb(bet)) * 100;
}

function buildBookStats(bets: BetRecord[]): BookRow[] {
  const settled = bets.filter((b) => b.status !== "pending");
  const grouped = new Map<string, BetRecord[]>();
  settled.forEach((b) => grouped.set(b.book, [...(grouped.get(b.book) ?? []), b]));
  return [...grouped.entries()]
    .map(([book, items]) => {
      const stake = items.reduce((s, b) => s + b.stake, 0);
      const pnl = items.reduce((s, b) => s + b.result, 0);
      const wins = items.filter((b) => b.status === "won").length;
      return {
        book,
        totalBets: items.length,
        winRate: items.length > 0 ? (wins / items.length) * 100 : 0,
        roi: stake > 0 ? (pnl / stake) * 100 : 0,
        pnl,
        avgOdds: items.reduce((s, b) => s + b.oddsAmerican, 0) / items.length,
      };
    })
    .sort((a, b) => b.roi - a.roi);
}

type ClvPoint = { label: string; clv: number };

type PublicCorrelationStats = {
  sample: number;
  fadeSample: number;
  withPublicSample: number;
  fadeRoi: number;
  withPublicRoi: number;
  edge: number;
  correlation: number;
};

type ParlayStats = {
  parlayWinRate: number;
  singlesWinRate: number;
  parlayRoi: number;
  singlesRoi: number;
  avgLegs: number;
  parlaySample: number;
  singlesSample: number;
};

function buildClvTrend(bets: BetRecord[]): ClvPoint[] {
  return bets
    .filter((b) => b.bettingLine != null && b.closingLine != null && b.status !== "pending")
    .sort((a, b) => (a.placedAt < b.placedAt ? -1 : 1))
    .map((b) => ({
      label: b.placedAt.slice(5, 10),
      clv: calcClv(b.bettingLine!, b.closingLine!),
    }));
}

function computeRoi(items: BetRecord[]): number {
  const stake = items.reduce((sum, bet) => sum + bet.stake, 0);
  const pnl = items.reduce((sum, bet) => sum + bet.result, 0);
  return stake > 0 ? (pnl / stake) * 100 : 0;
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  if (xs.length < 2 || ys.length < 2 || xs.length !== ys.length) {
    return 0;
  }

  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let num = 0;
  let xVar = 0;
  let yVar = 0;

  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    num += dx * dy;
    xVar += dx * dx;
    yVar += dy * dy;
  }

  const denom = Math.sqrt(xVar * yVar);
  return denom > 0 ? num / denom : 0;
}

function buildPublicCorrelation(bets: BetRecord[]): PublicCorrelationStats | null {
  const settled = bets.filter((bet) => bet.status !== "pending" && bet.stake > 0 && bet.publicMoneyPct != null);

  if (!settled.length) {
    return null;
  }

  const fadePublic = settled.filter((bet) => (bet.publicMoneyPct ?? 0) <= 45);
  const withPublic = settled.filter((bet) => (bet.publicMoneyPct ?? 0) >= 55);

  const fadeRoi = computeRoi(fadePublic);
  const withPublicRoi = computeRoi(withPublic);
  const xs = settled.map((bet) => bet.publicMoneyPct as number);
  const ys = settled.map((bet) => bet.result / bet.stake);
  const correlation = pearsonCorrelation(xs, ys);

  return {
    sample: settled.length,
    fadeSample: fadePublic.length,
    withPublicSample: withPublic.length,
    fadeRoi,
    withPublicRoi,
    edge: fadeRoi - withPublicRoi,
    correlation,
  };
}

function buildTagPerformance(bets: BetRecord[]): TagPerformanceRow[] {
  const settled = bets.filter((bet) => bet.status !== "pending" && bet.tags.length > 0);
  const grouped = new Map<string, BetRecord[]>();

  for (const bet of settled) {
    for (const tag of bet.tags) {
      grouped.set(tag, [...(grouped.get(tag) ?? []), bet]);
    }
  }

  return [...grouped.entries()]
    .map(([tag, rows]) => {
      const stake = rows.reduce((sum, item) => sum + item.stake, 0);
      const pnl = rows.reduce((sum, item) => sum + item.result, 0);
      const wins = rows.filter((item) => item.status === "won").length;
      return {
        tag,
        totalBets: rows.length,
        winRate: rows.length > 0 ? (wins / rows.length) * 100 : 0,
        roi: stake > 0 ? (pnl / stake) * 100 : 0,
        pnl,
      };
    })
    .sort((a, b) => b.roi - a.roi);
}

function buildParlayStats(bets: BetRecord[]): ParlayStats | null {
  const settled = bets.filter((bet) => bet.status !== "pending");
  const parlays = settled.filter((bet) => bet.betType === "parlay");
  const singles = settled.filter((bet) => bet.betType !== "parlay");

  if (!parlays.length && !singles.length) {
    return null;
  }

  const calc = (rows: BetRecord[]) => {
    const stake = rows.reduce((sum, row) => sum + row.stake, 0);
    const pnl = rows.reduce((sum, row) => sum + row.result, 0);
    const wins = rows.filter((row) => row.status === "won").length;
    return {
      winRate: rows.length > 0 ? (wins / rows.length) * 100 : 0,
      roi: stake > 0 ? (pnl / stake) * 100 : 0,
    };
  };

  const p = calc(parlays);
  const s = calc(singles);

  return {
    parlayWinRate: p.winRate,
    singlesWinRate: s.winRate,
    parlayRoi: p.roi,
    singlesRoi: s.roi,
    avgLegs: parlays.length ? parlays.reduce((sum, row) => sum + (row.parlayLegsCount ?? row.legs.length), 0) / parlays.length : 0,
    parlaySample: parlays.length,
    singlesSample: singles.length,
  };
}

// ── component ────────────────────────────────────────────────────────────────

type AnalyticsClientProps = {
  analytics: AnalyticsRow[];
  bets: BetRecord[];
  tiltEvents: TiltEvent[];
};

export function AnalyticsClient({ analytics, bets, tiltEvents }: AnalyticsClientProps) {
  const [sortKey, setSortKey] = useState<SortKey>("roi");
  const [selectedSegment, setSelectedSegment] = useState<string>(analytics[0]?.segment ?? "");
  const [bookSortKey, setBookSortKey] = useState<BookSortKey>("roi");
  const [bookSortAsc, setBookSortAsc] = useState(false);

  const sorted = [...analytics].sort((l, r) => r[sortKey] - l[sortKey]);
  const selected = sorted.find((row) => row.segment === selectedSegment) ?? sorted[0];

  const bookStats = buildBookStats(bets);
  const sortedBooks = [...bookStats].sort((a, b) => {
    const diff = (a[bookSortKey] as number) - (b[bookSortKey] as number);
    return bookSortAsc ? diff : -diff;
  });

  const clvTrend = buildClvTrend(bets);
  const publicCorrelation = buildPublicCorrelation(bets);
  const tagPerformance = buildTagPerformance(bets);
  const parlayStats = buildParlayStats(bets);
  const tiltHistory = [...tiltEvents].sort((a, b) => (a.triggeredAt < b.triggeredAt ? 1 : -1));
  const clvMin = Math.min(...clvTrend.map((p) => p.clv), -1);
  const clvMax = Math.max(...clvTrend.map((p) => p.clv), 1);
  const clvRange = clvMax - clvMin || 1;

  function toggleBookSort(key: BookSortKey) {
    startTransition(() => {
      if (bookSortKey === key) setBookSortAsc((v) => !v);
      else { setBookSortKey(key); setBookSortAsc(false); }
    });
  }

  return (
    <main className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="soft-label text-[color:var(--primary)]">Analytics</p>
            <h2 className="mt-2 text-4xl font-semibold">Segment Performance</h2>
            <p className="mt-2 text-sm text-[color:var(--on-surface-variant)]">Sort the board and focus any segment for quality readout.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["roi", "winRate", "clv", "sample"] as SortKey[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => startTransition(() => setSortKey(item))}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${sortKey === item ? "bg-[color:var(--surface-high)] text-[color:var(--primary)]" : "bg-[color:var(--surface-lowest)] text-[color:var(--on-surface-variant)]"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <Card title="Market Segments" subtitle="Click a segment row to inspect it">
          {sorted.length ? (
            <DataTable
              rowKey={(row) => row.segment}
              rows={sorted}
              columns={[
                {
                  key: "segment",
                  header: "Segment",
                  cell: (row) => (
                    <button type="button" onClick={() => setSelectedSegment(row.segment)} className="text-left">
                      {row.segment}
                    </button>
                  ),
                },
                { key: "roi", header: "ROI", cell: (row) => <span className="metric">{percent(row.roi)}</span> },
                { key: "winRate", header: "Win Rate", cell: (row) => <span className="metric">{percent(row.winRate)}</span> },
                { key: "clv", header: "CLV", cell: (row) => <span className="metric">{percent(row.clv)}</span> },
                { key: "sample", header: "Sample", cell: (row) => <span className="metric">{row.sample}</span> },
              ]}
            />
          ) : (
            <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
              Analytics populate after you settle bets and build sample size.
            </div>
          )}
        </Card>

        <Card title="Segment Detail" subtitle="Selected drill-down">
          {selected ? (
            <div className="space-y-3">
              <div className="panel-high p-3">
                <p className="soft-label">Segment</p>
                <p className="mt-1 text-[color:var(--on-surface)]">{selected.segment}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="panel-high p-3">
                  <p className="soft-label">ROI</p>
                  <p className="metric mt-1 text-[color:var(--primary)]">{percent(selected.roi)}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label">Win Rate</p>
                  <p className="metric mt-1 text-[color:var(--on-surface)]">{percent(selected.winRate)}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label">CLV</p>
                  <p className="metric mt-1 text-[color:var(--on-surface)]">{percent(selected.clv)}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label">Sample</p>
                  <p className="metric mt-1 text-[color:var(--on-surface)]">{selected.sample}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
              No live segment is available yet.
            </div>
          )}
        </Card>
      </section>

      {/* CLV Trend */}
      <Card title="CLV Trend" subtitle="Closing line value per settled bet (requires lines logged)">
        {clvTrend.length ? (
          <div className="space-y-3">
            <svg
              viewBox={`0 0 ${Math.max(clvTrend.length * 22, 100)} 80`}
              className="h-28 w-full"
              role="img"
              aria-label="CLV trend chart"
            >
              {/* zero line */}
              <line
                x1={0}
                y1={(clvMax / clvRange) * 80}
                x2={clvTrend.length * 22}
                y2={(clvMax / clvRange) * 80}
                stroke="var(--outline-variant)"
                strokeOpacity={0.4}
                strokeDasharray="3 3"
              />
              {clvTrend.map((point, i) => {
                const positive = point.clv >= 0;
                const barHeight = Math.max(3, Math.abs(point.clv / clvRange) * 80);
                const y = positive
                  ? (clvMax / clvRange) * 80 - barHeight
                  : (clvMax / clvRange) * 80;
                return (
                  <g key={`${point.label}-${i}`}>
                    <title>{`${point.label}: ${point.clv >= 0 ? "+" : ""}${point.clv.toFixed(2)}%`}</title>
                    <rect
                      x={i * 22}
                      y={y}
                      width={14}
                      height={barHeight}
                      rx={2}
                      fill={positive ? "var(--ok)" : "var(--error)"}
                      fillOpacity={0.75}
                    />
                  </g>
                );
              })}
            </svg>
            <div className="flex items-center gap-4 text-xs text-[color:var(--on-surface-variant)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--ok)]" /> Positive CLV
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--error)]" /> Negative CLV
              </span>
              <span className="ml-auto">
                Avg: {(clvTrend.reduce((s, p) => s + p.clv, 0) / clvTrend.length).toFixed(2)}% over {clvTrend.length} bets
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
            Log the betting line and closing line on individual tickets to see CLV trend.
          </div>
        )}
      </Card>

      {/* Sportsbook ROI */}
      <Card title="Sportsbook Performance" subtitle="ROI breakdown by book — click header to sort">
        {sortedBooks.length ? (
          <DataTable
            rowKey={(row) => row.book}
            rows={sortedBooks}
            columns={[
              {
                key: "book",
                header: "Book",
                cell: (row) => <span className="font-medium text-[color:var(--on-surface)]">{row.book}</span>,
              },
              {
                key: "totalBets",
                header: (
                  <button type="button" onClick={() => toggleBookSort("totalBets")} className="hover:text-[color:var(--primary)]">
                    Bets {bookSortKey === "totalBets" ? (bookSortAsc ? "↑" : "↓") : ""}
                  </button>
                ),
                cell: (row) => <span className="metric">{row.totalBets}</span>,
              },
              {
                key: "winRate",
                header: (
                  <button type="button" onClick={() => toggleBookSort("winRate")} className="hover:text-[color:var(--primary)]">
                    Win% {bookSortKey === "winRate" ? (bookSortAsc ? "↑" : "↓") : ""}
                  </button>
                ),
                cell: (row) => <span className="metric">{percent(row.winRate)}</span>,
              },
              {
                key: "roi",
                header: (
                  <button type="button" onClick={() => toggleBookSort("roi")} className="hover:text-[color:var(--primary)]">
                    ROI {bookSortKey === "roi" ? (bookSortAsc ? "↑" : "↓") : ""}
                  </button>
                ),
                cell: (row) => (
                  <span className={`metric ${row.roi >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>
                    {percent(row.roi)}
                  </span>
                ),
              },
              {
                key: "pnl",
                header: (
                  <button type="button" onClick={() => toggleBookSort("pnl")} className="hover:text-[color:var(--primary)]">
                    P/L {bookSortKey === "pnl" ? (bookSortAsc ? "↑" : "↓") : ""}
                  </button>
                ),
                cell: (row) => (
                  <span className={`metric ${row.pnl >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>
                    {currency(row.pnl)}
                  </span>
                ),
              },
              {
                key: "avgOdds",
                header: (
                  <button type="button" onClick={() => toggleBookSort("avgOdds")} className="hover:text-[color:var(--primary)]">
                    Avg Odds {bookSortKey === "avgOdds" ? (bookSortAsc ? "↑" : "↓") : ""}
                  </button>
                ),
                cell: (row) => <span className="metric">{americanOdds(Math.round(row.avgOdds))}</span>,
              },
            ]}
          />
        ) : (
          <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
            Sportsbook breakdown appears after you settle bets.
          </div>
        )}
      </Card>

      <Card title="Public Money Correlation" subtitle="ROI relationship between public money concentration and your results">
        {publicCorrelation ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="panel-high p-3">
                <p className="soft-label">Fade Public ROI</p>
                <p className={`metric mt-1 text-2xl ${publicCorrelation.fadeRoi >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>
                  {percent(publicCorrelation.fadeRoi)}
                </p>
                <p className="mt-1 text-xs text-[color:var(--on-surface-variant)]">{publicCorrelation.fadeSample} bets (public money &lt;= 45%)</p>
              </div>
              <div className="panel-high p-3">
                <p className="soft-label">With Public ROI</p>
                <p className={`metric mt-1 text-2xl ${publicCorrelation.withPublicRoi >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>
                  {percent(publicCorrelation.withPublicRoi)}
                </p>
                <p className="mt-1 text-xs text-[color:var(--on-surface-variant)]">{publicCorrelation.withPublicSample} bets (public money &gt;= 55%)</p>
              </div>
              <div className="panel-high p-3">
                <p className="soft-label">Fade Edge</p>
                <p className={`metric mt-1 text-2xl ${publicCorrelation.edge >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>
                  {publicCorrelation.edge >= 0 ? "+" : ""}{publicCorrelation.edge.toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-[color:var(--on-surface-variant)]">{publicCorrelation.sample} logged bets total</p>
              </div>
            </div>
            <div className="rounded-xl border border-[color:var(--outline-variant)]/24 bg-[color:var(--surface-lowest)] px-4 py-3 text-sm text-[color:var(--on-surface-variant)]">
              Correlation (public money % vs unit return):
              <span className={`ml-1 font-semibold ${publicCorrelation.correlation <= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>
                {publicCorrelation.correlation >= 0 ? "+" : ""}{publicCorrelation.correlation.toFixed(2)}
              </span>
              <span className="ml-2 text-xs">({publicCorrelation.correlation <= 0 ? "lower public money aligns with better returns" : "higher public money aligns with better returns"})</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
            Log Public Money % on settled bets to see fade-the-public correlation.
          </div>
        )}
      </Card>

      <Card title="Tag Performance" subtitle="ROI and win rate by custom bet tag">
        {tagPerformance.length ? (
          <DataTable
            rowKey={(row) => row.tag}
            rows={tagPerformance}
            columns={[
              { key: "tag", header: "Tag", cell: (row) => <span className="font-medium text-[color:var(--primary)]">#{row.tag}</span> },
              { key: "totalBets", header: "Bets", cell: (row) => <span className="metric">{row.totalBets}</span> },
              { key: "winRate", header: "Win Rate", cell: (row) => <span className="metric">{percent(row.winRate)}</span> },
              {
                key: "roi",
                header: "ROI",
                cell: (row) => <span className={`metric ${row.roi >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>{percent(row.roi)}</span>,
              },
              {
                key: "pnl",
                header: "P/L",
                cell: (row) => <span className={`metric ${row.pnl >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>{currency(row.pnl)}</span>,
              },
            ]}
          />
        ) : (
          <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
            Add tags to tickets to unlock per-tag ROI breakdown.
          </div>
        )}
      </Card>

      <Card title="Parlay vs Singles" subtitle="Parlay-specific performance metrics">
        {parlayStats ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="panel-high p-3">
              <p className="soft-label">Parlay Win Rate</p>
              <p className="metric mt-1 text-2xl text-[color:var(--on-surface)]">{percent(parlayStats.parlayWinRate)}</p>
              <p className="mt-1 text-xs text-[color:var(--on-surface-variant)]">{parlayStats.parlaySample} settled parlays</p>
            </div>
            <div className="panel-high p-3">
              <p className="soft-label">Avg Legs</p>
              <p className="metric mt-1 text-2xl text-[color:var(--primary)]">{parlayStats.avgLegs.toFixed(1)}</p>
              <p className="mt-1 text-xs text-[color:var(--on-surface-variant)]">Parlay complexity average</p>
            </div>
            <div className="panel-high p-3">
              <p className="soft-label">ROI (Parlay vs Single)</p>
              <p className={`metric mt-1 text-2xl ${parlayStats.parlayRoi >= parlayStats.singlesRoi ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>
                {percent(parlayStats.parlayRoi)} / {percent(parlayStats.singlesRoi)}
              </p>
              <p className="mt-1 text-xs text-[color:var(--on-surface-variant)]">Singles sample: {parlayStats.singlesSample}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
            Parlay metrics will appear once you settle singles or parlay bets.
          </div>
        )}
      </Card>

      <Card title="Tilt History" subtitle="Recent tilt detections and triggered conditions">
        {tiltHistory.length ? (
          <DataTable
            rowKey={(row) => row.id}
            rows={tiltHistory}
            columns={[
              {
                key: "triggeredAt",
                header: "Triggered",
                cell: (row) => <span className="text-[color:var(--on-surface)]">{new Date(row.triggeredAt).toLocaleString()}</span>,
              },
              {
                key: "conditions",
                header: "Conditions",
                cell: (row) => <span className="text-[color:var(--on-surface-variant)]">{row.conditionsMet.join(" | ")}</span>,
              },
              {
                key: "state",
                header: "State",
                cell: (row) => (
                  <span className={`text-xs font-semibold uppercase tracking-[0.08em] ${row.dismissedAt ? "text-[color:var(--on-surface-variant)]" : "text-[color:var(--error)]"}`}>
                    {row.dismissedAt ? "dismissed" : "active"}
                  </span>
                ),
              },
            ]}
          />
        ) : (
          <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
            No tilt events logged yet.
          </div>
        )}
      </Card>
    </main>
  );
}
