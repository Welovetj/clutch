"use client";

import { startTransition, useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { TiltWarningBanner } from "@/components/dashboard/tilt-warning-banner";
import { americanOdds, currency } from "@/lib/format";
import type { BetRecord, BetStatus, TiltEvent } from "@/lib/models";
import { BetSlipImporter } from "@/components/dashboard/bet-slip-importer";
import type { SlipData } from "@/components/dashboard/bet-slip-importer";

function toDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function calcClv(bettingLine: number, closingLine: number): number {
  const imp = (o: number) => o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
  return (imp(closingLine) - imp(bettingLine)) * 100;
}

function americanToDecimal(oddsAmerican: number): number {
  return oddsAmerican > 0 ? 1 + oddsAmerican / 100 : 1 + 100 / Math.abs(oddsAmerican);
}

function decimalToAmerican(decimalOdds: number): number {
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100);
  }
  return -Math.round(100 / (decimalOdds - 1));
}

type BetsClientProps = {
  bets: BetRecord[];
  tiltEvents: TiltEvent[];
};

const statuses: Array<BetStatus | "all"> = ["all", "won", "lost", "pending"];

export function BetsClient({ bets, tiltEvents }: BetsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BetStatus | "all">("all");
  const [sport, setSport] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string>(bets[0]?.id ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [prefill, setPrefill] = useState<SlipData | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [showPublicMoneyColumn, setShowPublicMoneyColumn] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [newBetType, setNewBetType] = useState<"single" | "parlay">("single");
  const deferredSearch = useDeferredValue(search);

  function handlePrefill(data: SlipData) {
    setPrefill(data);
    setFormKey((k) => k + 1);
  }
  const allTags = [...new Set(bets.flatMap((bet) => bet.tags))].sort((a, b) => a.localeCompare(b));
  const sports = ["all", ...new Set(bets.map((bet) => bet.sport))];

  const filtered = bets.filter((bet) => {
    const matchesSearch = `${bet.ticketCode} ${bet.market} ${bet.book}`.toLowerCase().includes(deferredSearch.toLowerCase());
    const matchesStatus = status === "all" || bet.status === status;
    const matchesSport = sport === "all" || bet.sport === sport;
    const matchesTag = tagFilter === "all" || bet.tags.includes(tagFilter);
    return matchesSearch && matchesStatus && matchesSport && matchesTag;
  });

  const selectedBet = filtered.find((bet) => bet.id === selectedId) ?? filtered[0] ?? bets[0];
  const activeTilt = tiltEvents.find((event) => !event.dismissedAt) ?? null;

  async function handleCreateBet(formData: FormData) {
    try {
      setSaving(true);
      setSaveError(null);
      const stake = Number(formData.get("stake") ?? 0);
      const oddsAmerican = Number(formData.get("oddsAmerican") ?? 0);
      const publicBetPctRaw = String(formData.get("publicBetPct") ?? "").trim();
      const publicMoneyPctRaw = String(formData.get("publicMoneyPct") ?? "").trim();
      const toWinRaw = String(formData.get("toWin") ?? "").trim();
      const tagsRaw = String(formData.get("tags") ?? "").trim();
      const betType = String(formData.get("betType") ?? "single") === "parlay" ? "parlay" : "single";
      const legsRaw = String(formData.get("parlayLegs") ?? "").trim();
      const legs = legsRaw
        .split("\n")
        .map((line) => line.split("|").map((piece) => piece.trim()))
        .filter((parts) => parts.length === 3)
        .map((parts) => ({
          sport: parts[0],
          market: parts[1],
          oddsAmerican: Number(parts[2]),
        }))
        .filter((leg) => leg.sport && leg.market && Number.isFinite(leg.oddsAmerican) && leg.oddsAmerican !== 0);

      if (betType === "parlay" && legs.length < 2) {
        throw new Error("Parlay requires at least 2 legs. Use one leg per line: sport | market | odds");
      }

      const combinedOddsAmerican =
        betType === "parlay" && legs.length >= 2
          ? decimalToAmerican(legs.reduce((product, leg) => product * americanToDecimal(leg.oddsAmerican), 1))
          : oddsAmerican;

      const computedToWin = combinedOddsAmerican > 0
        ? stake * (combinedOddsAmerican / 100)
        : stake / (Math.abs(combinedOddsAmerican) / 100);
      const toWin = toWinRaw !== "" ? Number(toWinRaw) : computedToWin;

      const response = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketCode: String(formData.get("ticketCode") ?? "").trim(),
          placedAt: String(formData.get("placedAt") ?? "").trim(),
          sport: String(formData.get("sport") ?? "").trim(),
          market: String(formData.get("market") ?? "").trim(),
          oddsAmerican: combinedOddsAmerican,
          betType,
          combinedOddsAmerican: betType === "parlay" ? combinedOddsAmerican : null,
          stake,
          toWin: Number(toWin.toFixed(2)),
          book: String(formData.get("book") ?? "").trim(),
          status: String(formData.get("status") ?? "pending") as BetStatus,
          result: Number(formData.get("result") ?? 0),
          publicBetPct: publicBetPctRaw !== "" ? Number(publicBetPctRaw) : null,
          publicMoneyPct: publicMoneyPctRaw !== "" ? Number(publicMoneyPctRaw) : null,
          tags: tagsRaw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          legs,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to create bet");
      }

      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to create bet");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSelected(formData: FormData) {
    if (!selectedBet) {
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      const openingRaw = String(formData.get("openingLine") ?? "").trim();
      const bettingRaw = String(formData.get("bettingLine") ?? "").trim();
      const closingRaw = String(formData.get("closingLine") ?? "").trim();
      const publicBetPctRaw = String(formData.get("updatePublicBetPct") ?? "").trim();
      const publicMoneyPctRaw = String(formData.get("updatePublicMoneyPct") ?? "").trim();
      const tagsRaw = String(formData.get("updateTags") ?? "").trim();

      const response = await fetch("/api/bets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betId: selectedBet.id,
          status: String(formData.get("updateStatus") ?? selectedBet.status),
          result: Number(formData.get("updateResult") ?? selectedBet.result),
          openingLine: openingRaw !== "" ? Number(openingRaw) : null,
          bettingLine: bettingRaw !== "" ? Number(bettingRaw) : null,
          closingLine: closingRaw !== "" ? Number(closingRaw) : null,
          publicBetPct: publicBetPctRaw !== "" ? Number(publicBetPctRaw) : null,
          publicMoneyPct: publicMoneyPctRaw !== "" ? Number(publicMoneyPctRaw) : null,
          tags: tagsRaw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to update bet");
      }

      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to update bet");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedBet) {
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      const response = await fetch("/api/bets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betId: selectedBet.id }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to delete bet");
      }

      setSelectedId("");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to delete bet");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-6">
      {activeTilt ? <TiltWarningBanner event={activeTilt} /> : null}

      <section className="panel p-5 sm:p-6">
        <p className="soft-label text-[color:var(--primary)]">Bets Log</p>
        <h2 className="mt-2 text-4xl font-semibold">Ticket Ledger</h2>
        <p className="mt-2 text-sm text-[color:var(--on-surface-variant)]">Search, filter, and inspect tickets interactively.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.7fr_0.9fr]">
        <Card title="Recent Bets" subtitle={`${filtered.length} tickets in current view`}>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--on-surface-variant)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ticket, market, or book"
                className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] py-2 pl-9 pr-3 text-sm text-[color:var(--on-surface)] outline-none transition focus:border-[color:var(--primary)]/40"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {statuses.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => startTransition(() => setStatus(item))}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${status === item ? "bg-[color:var(--surface-high)] text-[color:var(--primary)]" : "bg-[color:var(--surface-lowest)] text-[color:var(--on-surface-variant)]"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowPublicMoneyColumn((prev) => !prev)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${showPublicMoneyColumn ? "bg-[color:var(--surface-high)] text-[color:var(--primary)]" : "bg-[color:var(--surface-lowest)] text-[color:var(--on-surface-variant)]"}`}
            >
              Public Money
            </button>
            <select
              value={sport}
              onChange={(event) => startTransition(() => setSport(event.target.value))}
              aria-label="Filter bets by sport"
              className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none"
            >
              {sports.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All sports" : item}
                </option>
              ))}
            </select>
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              aria-label="Filter bets by tag"
              className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none"
            >
              <option value="all">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
          <DataTable
            rowKey={(row) => row.id}
            rows={filtered}
            columns={[
              {
                key: "id",
                header: "Ticket",
                cell: (row) => (
                  <button type="button" className="metric text-left" onClick={() => setSelectedId(row.id)}>
                    {row.ticketCode}
                  </button>
                ),
              },
              { key: "placedAt", header: "Placed", cell: (row) => row.placedAt },
              { key: "market", header: "Market", cell: (row) => row.market },
              { key: "odds", header: "Odds", cell: (row) => <span className="metric">{americanOdds(row.oddsAmerican)}</span> },
              { key: "stake", header: "Stake", cell: (row) => <span className="metric">{currency(row.stake)}</span> },
              { key: "result", header: "Result", cell: (row) => <span className="metric">{currency(row.result)}</span> },
              {
                key: "status",
                header: "Status",
                cell: (row) => (
                  <span className="rounded-md border border-[color:var(--outline-variant)]/35 bg-[color:var(--surface-mid)] px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--on-surface-variant)]">
                    {row.status}
                  </span>
                ),
              },
              ...(showPublicMoneyColumn
                ? [
                    {
                      key: "publicMoneyPct",
                      header: "Public Money",
                      cell: (row: BetRecord) => (
                        <span className="metric">
                          {row.publicMoneyPct != null ? `${row.publicMoneyPct}%` : "-"}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          {!bets.length ? <p className="mt-4 text-sm text-[color:var(--on-surface-variant)]">No bets yet. Add your first ticket to start tracking your own history.</p> : null}
        </Card>

        <div className="space-y-4">
          <Card title="Add Bet" subtitle="Persist directly to Supabase">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-[color:var(--outline-variant)]/24 bg-[color:var(--surface-lowest)] px-3 py-2">
              <p className="text-xs text-[color:var(--on-surface-variant)]">Scan a slip image or paste confirmation text.</p>
              <BetSlipImporter onPrefill={handlePrefill} />
            </div>
            <form
              key={formKey}
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateBet(new FormData(event.currentTarget));
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <input name="ticketCode" placeholder="Ticket code" required defaultValue={prefill?.ticketCode ?? ""} className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <input name="book" placeholder="Book" required defaultValue={prefill?.book ?? ""} className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <input name="sport" placeholder="Sport" required defaultValue={prefill?.sport ?? ""} className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <input name="market" placeholder="Market" required defaultValue={prefill?.market ?? ""} className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <input name="placedAt" type="datetime-local" title="Placed at" required defaultValue={prefill?.placedAt ? toDatetimeLocal(prefill.placedAt) : ""} className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <select name="betType" value={newBetType} onChange={(event) => setNewBetType(event.target.value === "parlay" ? "parlay" : "single")} title="Bet type" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none">
                  <option value="single">single</option>
                  <option value="parlay">parlay</option>
                </select>
                <select name="status" title="Ticket status" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none">
                  <option value={prefill?.status ?? "pending"}>{prefill?.status ?? "pending"}</option>
                  {(prefill?.status ?? "pending") !== "pending" ? <option value="pending">pending</option> : null}
                  {(prefill?.status ?? "pending") !== "won" ? <option value="won">won</option> : null}
                  {(prefill?.status ?? "pending") !== "lost" ? <option value="lost">lost</option> : null}
                </select>
                <input name="oddsAmerican" type="number" placeholder="Odds" required defaultValue={prefill?.oddsAmerican ?? ""} className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <input name="stake" type="number" step="0.01" placeholder="Stake" required defaultValue={prefill?.stake ?? ""} className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <input name="toWin" type="number" step="0.01" placeholder="Potential payout" defaultValue={prefill?.toWin ?? ""} className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <input name="publicBetPct" type="number" min="0" max="100" placeholder="Public Bets % (optional)" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <input name="publicMoneyPct" type="number" min="0" max="100" placeholder="Public Money % (optional)" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
              </div>
              <input name="tags" placeholder="Tags (comma-separated, optional)" className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
              {newBetType === "parlay" ? (
                <textarea
                  name="parlayLegs"
                  rows={4}
                  placeholder="Parlay legs (one per line): sport | market | odds"
                  className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none"
                />
              ) : null}
              <input name="result" type="number" step="0.01" placeholder="Result" className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
              {saveError && <p className="text-xs text-[color:var(--error)]">{saveError}</p>}
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving..." : "Create Bet"}
              </button>
            </form>
          </Card>

          <Card title="Ticket Detail" subtitle="Selection-driven panel">
          {selectedBet ? (
            <div className="space-y-4 text-sm text-[color:var(--on-surface-variant)]">
              <div>
                <p className="soft-label">Ticket</p>
                <p className="metric mt-1 text-2xl text-[color:var(--on-surface)]">{selectedBet.ticketCode}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[color:var(--on-surface-variant)]">{selectedBet.betType}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="panel-high p-3">
                  <p className="soft-label">Book</p>
                  <p className="mt-1 text-[color:var(--on-surface)]">{selectedBet.book}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label">Sport</p>
                  <p className="mt-1 text-[color:var(--on-surface)]">{selectedBet.sport}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label">Stake</p>
                  <p className="metric mt-1 text-[color:var(--on-surface)]">{currency(selectedBet.stake)}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label">To Win</p>
                  <p className="metric mt-1 text-[color:var(--primary)]">{currency(selectedBet.toWin)}</p>
                </div>
              </div>
              <div className="panel-high p-3">
                <p className="soft-label">Market</p>
                <p className="mt-1 text-[color:var(--on-surface)]">{selectedBet.market}</p>
              </div>

              {selectedBet.betType === "parlay" && selectedBet.legs.length ? (
                <div className="panel-high p-3">
                  <p className="soft-label">Parlay Legs ({selectedBet.legs.length})</p>
                  <div className="mt-2 space-y-2 text-xs">
                    {selectedBet.legs.map((leg) => (
                      <div key={leg.id} className="rounded-lg bg-[color:var(--surface-lowest)] px-3 py-2">
                        <p className="text-[color:var(--on-surface)]">{leg.sport} | {leg.market}</p>
                        <p className="metric mt-1 text-[color:var(--primary)]">{leg.oddsAmerican > 0 ? "+" : ""}{leg.oddsAmerican}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="panel-high p-3">
                <p className="soft-label">Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedBet.tags.length ? selectedBet.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[color:var(--surface-lowest)] px-2 py-1 text-xs text-[color:var(--primary)]">
                      #{tag}
                    </span>
                  )) : <span className="text-xs text-[color:var(--on-surface-variant)]">No tags</span>}
                </div>
              </div>

              <div className="panel-high p-3">
                <p className="soft-label">Public Sentiment</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[color:var(--surface-lowest)] px-3 py-2">
                    <p className="soft-label">Public Bets</p>
                    <p className="metric mt-1 text-[color:var(--on-surface)]">{selectedBet.publicBetPct != null ? `${selectedBet.publicBetPct}%` : "-"}</p>
                  </div>
                  <div className="rounded-lg bg-[color:var(--surface-lowest)] px-3 py-2">
                    <p className="soft-label">Public Money</p>
                    <p className="metric mt-1 text-[color:var(--on-surface)]">{selectedBet.publicMoneyPct != null ? `${selectedBet.publicMoneyPct}%` : "-"}</p>
                  </div>
                </div>
              </div>

              {/* Line Movement */}
              <div className="space-y-2">
                <p className="soft-label text-[10px] uppercase tracking-widest text-[color:var(--primary)]">Line Movement</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {([
                    { key: "openingLine" as const, label: "Opening" },
                    { key: "bettingLine" as const, label: "Your Line" },
                    { key: "closingLine" as const, label: "Closing" },
                  ]).map(({ key, label }) => (
                    <div key={key} className="panel-high p-2">
                      <p className="soft-label">{label}</p>
                      <p className="metric mt-1 text-[color:var(--on-surface)]">
                        {selectedBet[key] != null
                          ? `${selectedBet[key]! > 0 ? "+" : ""}${selectedBet[key]}`
                          : <span className="text-[color:var(--on-surface-variant)]">—</span>}
                      </p>
                    </div>
                  ))}
                </div>
                {selectedBet.bettingLine != null && selectedBet.closingLine != null ? (
                  (() => {
                    const clv = calcClv(selectedBet.bettingLine, selectedBet.closingLine);
                    return (
                      <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                        clv >= 0
                          ? "bg-[color:var(--ok)]/10 border border-[color:var(--ok)]/25"
                          : "bg-[color:var(--error)]/10 border border-[color:var(--error)]/25"
                      }`}>
                        <p className="text-xs text-[color:var(--on-surface-variant)]">CLV</p>
                        <p className={`metric text-sm font-bold ${
                          clv >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"
                        }`}>
                          {clv >= 0 ? "+" : ""}{clv.toFixed(2)}%
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-[11px] text-[color:var(--on-surface-variant)]">Log your line and the closing line to calculate CLV.</p>
                )}
              </div>

              <form
                key={selectedBet.id}
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleUpdateSelected(new FormData(event.currentTarget));
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <select name="updateStatus" title="Update ticket status" defaultValue={selectedBet.status} className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none">
                    <option value="pending">pending</option>
                    <option value="won">won</option>
                    <option value="lost">lost</option>
                  </select>
                  <input
                    name="updateResult"
                    type="number"
                    step="0.01"
                    defaultValue={selectedBet.result}
                    title="Update ticket result"
                    className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none"
                  />
                </div>
                <p className="soft-label text-[10px] uppercase tracking-widest">Log Lines (American odds)</p>
                <div className="grid grid-cols-3 gap-2">
                  <input name="openingLine" type="number" placeholder="Open" defaultValue={selectedBet.openingLine ?? ""} title="Opening line" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                  <input name="bettingLine" type="number" placeholder="Bet at" defaultValue={selectedBet.bettingLine ?? ""} title="Your betting line" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                  <input name="closingLine" type="number" placeholder="Close" defaultValue={selectedBet.closingLine ?? ""} title="Closing line" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                </div>
                <p className="soft-label text-[10px] uppercase tracking-widest">Public Percentages</p>
                <div className="grid grid-cols-2 gap-2">
                  <input name="updatePublicBetPct" type="number" min="0" max="100" placeholder="Public Bets %" defaultValue={selectedBet.publicBetPct ?? ""} title="Public bets percentage" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                  <input name="updatePublicMoneyPct" type="number" min="0" max="100" placeholder="Public Money %" defaultValue={selectedBet.publicMoneyPct ?? ""} title="Public money percentage" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                </div>
                <input name="updateTags" placeholder="Update tags (comma-separated)" defaultValue={selectedBet.tags.join(", ")} className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
                <button type="submit" className="btn-ghost w-full" disabled={saving}>
                  Update Ticket
                </button>
                <button type="button" onClick={() => void handleDeleteSelected()} className="w-full rounded-xl border border-[color:var(--error)]/35 px-4 py-2 text-sm font-semibold text-[color:var(--error)] disabled:opacity-60" disabled={saving}>
                  Delete Ticket
                </button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-[color:var(--on-surface-variant)]">No bet matches the current filter.</p>
          )}
          </Card>
        </div>
      </section>
    </main>
  );
}
