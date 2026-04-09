"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ChartNoAxesColumnIncreasing, Flame, TrendingUp } from "lucide-react";
import { TiltWarningBanner } from "@/components/dashboard/tilt-warning-banner";
import { currency, percent } from "@/lib/format";
import { buildStreakData } from "@/lib/supabase/dashboard-data";
import type { AnalyticsRow, BankrollSnapshot, BetRecord, ExposureRow, RecapDigest, TeamWatch, TiltEvent } from "@/lib/models";

type OverviewClientProps = {
  bets: BetRecord[];
  bankrollCurve: BankrollSnapshot[];
  exposure: ExposureRow[];
  analytics: AnalyticsRow[];
  watchlistTeams: TeamWatch[];
  tiltEvents: TiltEvent[];
};

export function OverviewClient({ bets, bankrollCurve, exposure, analytics, watchlistTeams, tiltEvents }: OverviewClientProps) {
  const router = useRouter();
  const [selectedTeamCode, setSelectedTeamCode] = useState(watchlistTeams[0]?.code ?? "");
  const [recaps, setRecaps] = useState<RecapDigest[]>([]);
  const [recapPeriod, setRecapPeriod] = useState<"daily" | "weekly">("daily");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = watchlistTeams.find((team) => team.code === selectedTeamCode) ?? watchlistTeams[0];
  const pendingBets = bets.filter((bet) => bet.status === "pending");
  const settledBets = bets.filter((bet) => bet.status !== "pending");
  const wonCount = bets.filter((bet) => bet.status === "won").length;
  const lostCount = bets.filter((bet) => bet.status === "lost").length;
  const pendingCount = pendingBets.length;
  const totalBets = bets.length;
  const currentBankroll = bankrollCurve[bankrollCurve.length - 1]?.value ?? 0;
  const openStake = pendingBets.reduce((sum, bet) => sum + bet.stake, 0);
  const avgReliability = watchlistTeams.length > 0 ? watchlistTeams.reduce((sum, team) => sum + team.reliability, 0) / watchlistTeams.length : 0;
  const bestSegments = [...analytics].sort((left, right) => right.roi - left.roi).slice(0, 4);
  const topExposure = exposure.slice(0, 4);
  const streaks = buildStreakData(bets);
  const activeTilt = tiltEvents.find((event) => !event.dismissedAt) ?? null;

  useEffect(() => {
    setSelectedTeamCode((current) => {
      if (!watchlistTeams.length) {
        return "";
      }

      return watchlistTeams.some((team) => team.code === current) ? current : watchlistTeams[0].code;
    });
  }, [watchlistTeams]);

  useEffect(() => {
    let mounted = true;

    async function loadRecaps() {
      try {
        const response = await fetch("/api/ai/recaps");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { data?: RecapDigest[] };
        if (mounted && Array.isArray(payload.data)) {
          setRecaps(payload.data);
        }
      } catch {
        // Leave recaps empty if fetch fails.
      }
    }

    void loadRecaps();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleAddTeam(formData: FormData) {
    try {
      setSaving(true);
      setError(null);

      const code = String(formData.get("code") ?? "").trim().toUpperCase();
      const league = String(formData.get("league") ?? "").trim().toUpperCase();
      const name = String(formData.get("name") ?? "").trim();
      const record = String(formData.get("record") ?? "").trim();
      const reliability = Number(formData.get("reliability") ?? 0);
      const form = String(formData.get("form") ?? "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item): item is "win" | "loss" => item === "win" || item === "loss");

      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, league, name, record, reliability, form }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to add team");
      }

      setSelectedTeamCode(code);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to add team");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveSelected() {
    if (!selectedTeam) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: selectedTeam.code }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to remove team");
      }

      setSelectedTeamCode("");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to remove team");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-8 md:space-y-9">
      {activeTilt ? <TiltWarningBanner event={activeTilt} /> : null}

      <section className="panel reveal relative overflow-hidden p-6 sm:p-8 md:p-9">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[color:var(--primary)]/7 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[color:var(--primary)]" />
              <p className="soft-label">{selectedTeam ? `${selectedTeam.code} Watch` : "Live Portfolio"}</p>
            </div>
            <h1 className="text-5xl font-bold tracking-[-0.03em] text-[color:var(--on-surface)]">
              {selectedTeam ? selectedTeam.name : "Your Board"} <span className="text-[color:var(--outline)]">Live</span>
            </h1>
            <p className="mt-2 max-w-lg text-[color:var(--on-surface-variant)]">
              {selectedTeam
                ? `${selectedTeam.record} profile with ${selectedTeam.reliability}% reliability and ${selectedTeam.form.length} recent tracked results.`
                : totalBets
                  ? `${pendingCount} open tickets, ${settledBets.length} settled tickets, and ${currency(openStake)} currently at risk.`
                  : "Start by adding a bet, bankroll snapshot, or watchlist team. This dashboard only reflects your own live account data."}
            </p>
            <div className="status-pill mt-5">{selectedTeam ? `${selectedTeam.league} focus` : `${watchlistTeams.length} tracked teams`}</div>
          </div>
          <div className="grid min-w-[16rem] grid-cols-2 gap-3 text-left md:text-right">
            <div className="panel-high p-3">
              <p className="soft-label">Bankroll</p>
              <p className="metric mt-1 text-2xl font-bold text-[color:var(--primary)]">{currency(currentBankroll)}</p>
            </div>
            <div className="panel-high p-3">
              <p className="soft-label">Open Stake</p>
              <p className="metric mt-1 text-2xl font-bold text-[color:var(--on-surface)]">{currency(openStake)}</p>
            </div>
            <div className="panel-high p-3">
              <p className="soft-label">Tracked Teams</p>
              <p className="metric mt-1 text-2xl font-bold text-[color:var(--on-surface)]">{watchlistTeams.length}</p>
            </div>
            <div className="panel-high p-3">
              <p className="soft-label">Avg Reliability</p>
              <p className="metric mt-1 text-2xl font-bold text-[color:var(--primary)]">{avgReliability.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </section>

      <section className="reveal delay-1 space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl font-bold">Watchlist Teams</h2>
          <div className="flex items-center gap-3">
            {selectedTeam ? (
              <button type="button" onClick={() => void handleRemoveSelected()} className="text-sm text-[color:var(--primary)] disabled:opacity-60" disabled={saving}>
                {saving ? "Working..." : `Remove ${selectedTeam.code}`}
              </button>
            ) : null}
            <span className="text-sm text-[color:var(--primary)]">Your tracked teams only</span>
          </div>
        </div>
        <div className="no-scrollbar -mx-2 flex snap-x gap-4 overflow-x-auto px-2 pb-2 md:gap-5">
          {watchlistTeams.map((team) => {
            const selected = team.code === selectedTeamCode;
            return (
              <button
                key={team.code}
                type="button"
                onClick={() => setSelectedTeamCode(team.code)}
                className={`panel w-64 shrink-0 snap-start p-5 text-left transition md:w-[17rem] ${selected ? "border-[color:var(--primary)]/30 bg-[color:var(--surface-mid)]" : ""}`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/9 text-lg font-bold text-[color:var(--primary)]">
                    {team.code}
                  </div>
                  <span className="rounded bg-[color:var(--surface-highest)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--on-surface-variant)]">
                    {team.league}
                  </span>
                </div>
                <h3 className="text-3xl font-semibold">{team.name}</h3>
                <p className="mt-1 text-xs text-[color:var(--on-surface-variant)]">Record: {team.record}</p>
                <div className="mt-4 flex gap-1.5">
                  {team.form.map((item, index) => (
                    <span
                      key={`${team.code}-${index}`}
                      className={`h-2.5 w-2.5 rounded-full ${item === "win" ? "bg-[color:var(--ok)]" : "bg-[color:var(--error)]"}`}
                    />
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="soft-label">Reliability</span>
                  <span className="metric text-2xl font-bold text-[color:var(--primary)]">{team.reliability}%</span>
                </div>
              </button>
            );
          })}
          {!watchlistTeams.length ? (
            <div className="panel flex w-full min-w-[18rem] items-center justify-center p-6 text-sm text-[color:var(--on-surface-variant)]">
              No teams tracked yet. Add one below to start your personal watchlist.
            </div>
          ) : null}
        </div>
        <div className="panel-high p-4">
          <form
            className="grid gap-3 md:grid-cols-6"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddTeam(new FormData(event.currentTarget));
              event.currentTarget.reset();
            }}
          >
            <input name="code" maxLength={5} placeholder="Code" required className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
            <input name="league" placeholder="League" required className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
            <input name="name" placeholder="Team name" required className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none md:col-span-2" />
            <input name="record" placeholder="Record" required className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
            <input name="reliability" type="number" min="0" max="100" placeholder="Reliability" required className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
            <input name="form" placeholder="win,loss,win" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none md:col-span-5" />
            <button type="submit" className="btn-primary md:col-span-1" disabled={saving}>
              {saving ? "Saving..." : "Add Team"}
            </button>
          </form>
          {error ? <p className="mt-3 text-xs text-[color:var(--error)]">{error}</p> : null}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="panel reveal p-6 md:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-bold">AI Recap Digest</h3>
            <div className="flex gap-2">
              {(["daily", "weekly"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setRecapPeriod(period)}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${recapPeriod === period ? "bg-[color:var(--surface-high)] text-[color:var(--primary)]" : "bg-[color:var(--surface-lowest)] text-[color:var(--on-surface-variant)]"}`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {recaps.filter((item) => item.periodType === recapPeriod).length ? (
            <div className="space-y-3">
              {recaps
                .filter((item) => item.periodType === recapPeriod)
                .slice(0, 4)
                .map((recap) => (
                  <div key={recap.id} className="rounded-xl border border-[color:var(--outline-variant)]/24 bg-[color:var(--surface-lowest)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[color:var(--on-surface)]">{recap.title}</p>
                      <span className="soft-label">{recap.periodKey}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <p className="text-[color:var(--on-surface-variant)]">Bets: <span className="metric text-[color:var(--on-surface)]">{recap.betsPlaced}</span></p>
                      <p className="text-[color:var(--on-surface-variant)]">P&L: <span className={`metric ${recap.pnl >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>{currency(recap.pnl)}</span></p>
                      <p className="col-span-2 text-[color:var(--on-surface-variant)]">Best: <span className="text-[color:var(--on-surface)]">{recap.bestBet}</span></p>
                      <p className="col-span-2 text-[color:var(--on-surface-variant)]">Worst: <span className="text-[color:var(--on-surface)]">{recap.worstBet}</span></p>
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--primary)]">{recap.insight}</p>
                  </div>
                ))}
            </div>
          ) : (
            <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-6 text-sm text-[color:var(--on-surface-variant)]">
              Recaps generate automatically from your daily and weekly betting activity once there is enough data.
            </div>
          )}
        </article>

        {/* Streaks & Variance */}
        <article className="panel reveal delay-1 p-6 md:p-7">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-2xl font-bold">Streaks &amp; Variance</h3>
            <Flame className={`h-4 w-4 ${
              streaks.currentStreakType === "win" ? "text-[color:var(--ok)]" :
              streaks.currentStreakType === "loss" ? "text-[color:var(--error)]" :
              "text-[color:var(--primary)]"
            }`} />
          </div>
          {settledBets.length ? (
            <div className="space-y-3">
              <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                streaks.currentStreakType === "win"
                  ? "bg-[color:var(--ok)]/10 border border-[color:var(--ok)]/25"
                  : streaks.currentStreakType === "loss"
                  ? "bg-[color:var(--error)]/10 border border-[color:var(--error)]/25"
                  : "bg-[color:var(--surface-lowest)]"
              }`}>
                <div>
                  <p className="soft-label">Current Streak</p>
                  <p className={`mt-0.5 text-xs capitalize ${
                    streaks.currentStreakType === "win" ? "text-[color:var(--ok)]" :
                    streaks.currentStreakType === "loss" ? "text-[color:var(--error)]" :
                    "text-[color:var(--on-surface-variant)]"
                  }`}>{streaks.currentStreakType}</p>
                </div>
                <p className={`metric text-3xl font-bold ${
                  streaks.currentStreakType === "win" ? "text-[color:var(--ok)]" :
                  streaks.currentStreakType === "loss" ? "text-[color:var(--error)]" :
                  "text-[color:var(--on-surface)]"
                }`}>{streaks.currentStreak}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="panel-high p-3">
                  <p className="soft-label text-[10px]">Best Win Run</p>
                  <p className="metric mt-1 text-2xl text-[color:var(--ok)]">{streaks.longestWinStreak}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label text-[10px]">Worst Loss Run</p>
                  <p className="metric mt-1 text-2xl text-[color:var(--error)]">{streaks.longestLossStreak}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label text-[10px]">Variance</p>
                  <p className="metric mt-1 text-2xl text-[color:var(--on-surface)]">{streaks.varianceScore.toFixed(2)}</p>
                  <p className="mt-0.5 text-[10px] text-[color:var(--on-surface-variant)]">σ units</p>
                </div>
              </div>
              <p className="text-[11px] text-[color:var(--on-surface-variant)]">
                {streaks.varianceScore < 1 ? "Low variance — consistent unit sizing." :
                 streaks.varianceScore < 2 ? "Moderate variance — typical for sports betting." :
                 "High variance — consider tighter stake discipline."}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-6 text-sm text-[color:var(--on-surface-variant)]">
              Streak data appears after you settle bets.
            </div>
          )}
        </article>
        <article className="panel reveal delay-2 p-6 md:p-7">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-2xl font-bold">Best Segments</h3>
            <TrendingUp className="h-4 w-4 text-[color:var(--primary)]" />
          </div>
          <div className="space-y-3">
            {bestSegments.length ? (
              bestSegments.map((segment) => (
                <div key={segment.segment} className="flex items-center justify-between rounded-lg bg-[color:var(--surface-lowest)] px-3 py-3">
                  <div>
                    <p>{segment.segment}</p>
                    <p className="text-xs text-[color:var(--on-surface-variant)]">{segment.sample} settled samples</p>
                  </div>
                  <span className="metric text-xl font-bold text-[color:var(--primary)]">{percent(segment.roi)}</span>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-6 text-sm text-[color:var(--on-surface-variant)]">
                Segment analytics will appear after you settle bets.
              </div>
            )}
          </div>
        </article>

        <article className="panel reveal delay-3 p-6 md:p-7">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-2xl font-bold">Ticket Status Mix</h3>
            <ChartNoAxesColumnIncreasing className="h-4 w-4 text-[color:var(--primary)]" />
          </div>
          {totalBets ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="panel-high p-3">
                  <p className="soft-label">Won</p>
                  <p className="metric mt-1 text-2xl text-[color:var(--ok)]">{wonCount}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label">Lost</p>
                  <p className="metric mt-1 text-2xl text-[color:var(--error)]">{lostCount}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label">Pending</p>
                  <p className="metric mt-1 text-2xl text-[color:var(--primary)]">{pendingCount}</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Won", value: wonCount, tone: "text-[color:var(--ok)]" },
                  { label: "Lost", value: lostCount, tone: "text-[color:var(--error)]" },
                  { label: "Pending", value: pendingCount, tone: "text-[color:var(--primary)]" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-lg bg-[color:var(--surface-lowest)] px-3 py-3 text-sm">
                    <span className="text-[color:var(--on-surface-variant)]">{row.label}</span>
                    <div className="text-right">
                      <p className={`metric ${row.tone}`}>{row.value}</p>
                      <p className="text-xs text-[color:var(--on-surface-variant)]">{totalBets > 0 ? percent((row.value / totalBets) * 100) : "0.0%"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-6 text-sm text-[color:var(--on-surface-variant)]">
              No ticket history yet. Add a bet to start the live mix.
            </div>
          )}
          <div className="mt-5 flex items-center gap-2 text-xs text-[color:var(--on-surface-variant)]">
            <Activity className="h-3.5 w-3.5 text-[color:var(--primary)]" />
            <span>{topExposure[0] ? `${topExposure[0].market} currently carries the largest open share.` : "Exposure data appears once you have pending tickets."}</span>
          </div>
        </article>
      </section>
    </main>
  );
}
