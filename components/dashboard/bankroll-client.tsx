"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { currency } from "@/lib/format";
import type { BankrollSnapshot, ExposureRow } from "@/lib/models";
import { KellyCalculator } from "@/components/dashboard/kelly-calculator";

type RangeKey = "3d" | "5d" | "all";

type BankrollClientProps = {
  bankrollCurve: BankrollSnapshot[];
  exposure: ExposureRow[];
};

export function BankrollClient({ bankrollCurve, exposure }: BankrollClientProps) {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>("all");
  const [selectedDate, setSelectedDate] = useState(bankrollCurve[bankrollCurve.length - 1]?.date ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const visibleCurve =
    range === "3d" ? bankrollCurve.slice(-3) : range === "5d" ? bankrollCurve.slice(-5) : bankrollCurve;

  const current = visibleCurve[visibleCurve.length - 1]?.value ?? 0;
  const opening = visibleCurve[0]?.value ?? 0;
  const growth = opening > 0 ? ((current - opening) / opening) * 100 : 0;
  const maxValue = Math.max(...visibleCurve.map((point) => point.value), 1);
  const selectedPoint = visibleCurve.find((point) => point.date === selectedDate) ?? visibleCurve[visibleCurve.length - 1];

  async function handleAddSnapshot(formData: FormData) {
    try {
      setSaving(true);
      setSaveError(null);
      const response = await fetch("/api/bankroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotDate: String(formData.get("snapshotDate") ?? ""),
          value: Number(formData.get("value") ?? 0),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to save snapshot");
      }

      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save snapshot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="soft-label text-[color:var(--primary)]">Bankroll</p>
            <h2 className="mt-2 text-4xl font-semibold">Capital Discipline</h2>
            <p className="mt-2 text-sm text-[color:var(--on-surface-variant)]">Switch ranges and inspect each bankroll point interactively.</p>
          </div>
          <div className="flex gap-2">
            {(["3d", "5d", "all"] as RangeKey[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => startTransition(() => setRange(item))}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${range === item ? "bg-[color:var(--surface-high)] text-[color:var(--primary)]" : "bg-[color:var(--surface-lowest)] text-[color:var(--on-surface-variant)]"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card title="Current" subtitle="Latest curve point">
          <p className="metric text-4xl font-semibold text-[color:var(--on-surface)]">{currency(current)}</p>
        </Card>
        <Card title="Opening" subtitle="Visible range start">
          <p className="metric text-4xl font-semibold text-[color:var(--on-surface)]">{currency(opening)}</p>
        </Card>
        <Card title="Growth" subtitle="Visible range delta">
          <p className="metric text-4xl font-semibold text-[color:var(--primary)]">{growth.toFixed(2)}%</p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card title="Bankroll Curve" subtitle="Click any point for detail">
          {visibleCurve.length ? (
            <div className="space-y-3">
              <svg viewBox={`0 0 ${visibleCurve.length * 22} 100`} className="h-36 w-full" role="img" aria-label="Bankroll curve chart">
                {visibleCurve.map((point, index) => {
                  const active = point.date === selectedPoint?.date;
                  const height = Math.max(8, Math.round((point.value / maxValue) * 100));
                  const x = index * 22;
                  const y = 100 - height;
                  return (
                    <g key={point.date}>
                      <title>{`${point.date}: ${currency(point.value)}`}</title>
                      <rect x={x} y={y} width="14" height={height} rx="3" fill={active ? "var(--primary)" : "color-mix(in srgb, var(--primary) 32%, transparent)"} />
                    </g>
                  );
                })}
              </svg>
              <div className="grid gap-2 sm:grid-cols-3">
                {visibleCurve.map((point) => {
                  const active = point.date === selectedPoint?.date;
                  return (
                    <button
                      key={point.date}
                      type="button"
                      onClick={() => setSelectedDate(point.date)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${active ? "border-[color:var(--primary)]/40 bg-[color:var(--surface-mid)]" : "border-[color:var(--outline-variant)]/20 bg-[color:var(--surface-lowest)]"}`}
                    >
                      <p className="soft-label">{point.date}</p>
                      <p className="metric mt-1 text-[color:var(--on-surface)]">{currency(point.value)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
              No bankroll history yet. Add your first snapshot to start the live curve.
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Selected Point" subtitle="Focused datapoint">
            {selectedPoint ? (
              <div className="space-y-3">
                <div className="panel-high p-3">
                  <p className="soft-label">Date</p>
                  <p className="mt-1 text-[color:var(--on-surface)]">{selectedPoint.date}</p>
                </div>
                <div className="panel-high p-3">
                  <p className="soft-label">Value</p>
                  <p className="metric mt-1 text-2xl text-[color:var(--primary)]">{currency(selectedPoint.value)}</p>
                </div>
              </div>
            ) : null}
          </Card>

          <Card title="Add Snapshot" subtitle="Persist a new bankroll point">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddSnapshot(new FormData(event.currentTarget));
              }}
            >
              <input name="snapshotDate" type="date" title="Snapshot date" required className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
              <input name="value" type="number" step="0.01" required placeholder="Bankroll value" className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
              {saveError && <p className="text-xs text-[color:var(--error)]">{saveError}</p>}
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving..." : "Add Snapshot"}
              </button>
            </form>
          </Card>
        </div>
      </section>

      <Card title="Open Exposure by Market" subtitle="Stake distribution">
        {exposure.length ? (
          <DataTable
            rowKey={(row) => row.market}
            rows={exposure}
            columns={[
              { key: "market", header: "Market", cell: (row) => row.market },
              { key: "stake", header: "Open Stake", cell: (row) => <span className="metric">{currency(row.openStake)}</span> },
              { key: "share", header: "Share", cell: (row) => <span className="metric">{(row.share * 100).toFixed(1)}%</span> },
            ]}
          />
        ) : (
          <div className="rounded-lg bg-[color:var(--surface-lowest)] px-4 py-8 text-sm text-[color:var(--on-surface-variant)]">
            Open exposure appears automatically once you have pending bets.
          </div>
        )}
      </Card>

      <KellyCalculator currentBankroll={current} />
    </main>
  );
}
