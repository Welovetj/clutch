"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { currency } from "@/lib/format";

type KellyResult = {
  fullKelly: number;
  halfKelly: number;
  quarterKelly: number;
  fullDollars: number;
  halfDollars: number;
  quarterDollars: number;
  exceedsWarning: boolean;
};

function computeKelly(
  edgePct: number,
  oddsAmerican: number,
  bankroll: number
): KellyResult | null {
  if (!oddsAmerican || bankroll <= 0) return null;

  // b = profit per unit staked (decimal odds minus 1)
  const b =
    oddsAmerican > 0
      ? oddsAmerican / 100
      : 100 / Math.abs(oddsAmerican);

  // Implied win probability from the offered price
  const impliedProb =
    oddsAmerican > 0
      ? 100 / (oddsAmerican + 100)
      : Math.abs(oddsAmerican) / (Math.abs(oddsAmerican) + 100);

  // True win probability = implied + user's edge
  const p = Math.min(0.99, Math.max(0.01, impliedProb + edgePct / 100));
  const q = 1 - p;

  // Kelly criterion: f* = (b·p − q) / b
  const fullKelly = Math.max(0, ((b * p - q) / b) * 100);
  const halfKelly = fullKelly / 2;
  const quarterKelly = fullKelly / 4;

  return {
    fullKelly,
    halfKelly,
    quarterKelly,
    fullDollars: (fullKelly / 100) * bankroll,
    halfDollars: (halfKelly / 100) * bankroll,
    quarterDollars: (quarterKelly / 100) * bankroll,
    exceedsWarning: fullKelly > 5,
  };
}

type KellyCalculatorProps = {
  currentBankroll?: number;
};

export function KellyCalculator({ currentBankroll = 0 }: KellyCalculatorProps) {
  const [edge, setEdge] = useState("");
  const [odds, setOdds] = useState("");
  const [bankroll, setBankroll] = useState(
    currentBankroll > 0 ? String(currentBankroll) : ""
  );

  const edgeNum = parseFloat(edge);
  const oddsNum = parseInt(odds, 10);
  const bankrollNum = parseFloat(bankroll);

  const result =
    edge !== "" && odds !== "" && bankroll !== "" && !isNaN(edgeNum) && !isNaN(oddsNum) && !isNaN(bankrollNum)
      ? computeKelly(edgeNum, oddsNum, bankrollNum)
      : null;

  const tiers = result
    ? [
        {
          label: "Full Kelly",
          pct: result.fullKelly,
          dollars: result.fullDollars,
          accent: true,
          warn: result.exceedsWarning,
        },
        {
          label: "½ Kelly",
          pct: result.halfKelly,
          dollars: result.halfDollars,
          accent: false,
          warn: false,
        },
        {
          label: "¼ Kelly",
          pct: result.quarterKelly,
          dollars: result.quarterDollars,
          accent: false,
          warn: false,
        },
      ]
    : [];

  return (
    <Card title="Kelly Criterion" subtitle="Optimal stake sizing calculator">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="soft-label text-[10px]">Your Edge %</p>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 3.5"
              value={edge}
              onChange={(e) => setEdge(e.target.value)}
              aria-label="Edge percentage"
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="space-y-1">
            <p className="soft-label text-[10px]">American Odds</p>
            <input
              type="number"
              placeholder="e.g. -110"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              aria-label="American odds"
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="space-y-1">
            <p className="soft-label text-[10px]">Bankroll ($)</p>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 5000"
              value={bankroll}
              onChange={(e) => setBankroll(e.target.value)}
              aria-label="Bankroll amount"
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        {result ? (
          <div className="space-y-3">
            {result.exceedsWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-[color:var(--error)]/30 bg-[color:var(--error)]/8 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--error)]" />
                <p className="text-xs text-[color:var(--error)]">
                  Full Kelly exceeds 5% of bankroll — consider fractional Kelly
                  to reduce variance and risk of ruin.
                </p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {tiers.map(({ label, pct, dollars, accent, warn }) => (
                <div
                  key={label}
                  className={`rounded-xl p-3 ${
                    accent && warn
                      ? "border border-[color:var(--error)]/30 bg-[color:var(--error)]/8"
                      : "panel-high"
                  }`}
                >
                  <p className="soft-label text-[10px]">{label}</p>
                  <p
                    className={`metric mt-1 text-2xl font-semibold ${
                      accent && !warn
                        ? "text-[color:var(--primary)]"
                        : accent
                        ? "text-[color:var(--error)]"
                        : "text-[color:var(--on-surface)]"
                    }`}
                  >
                    {pct.toFixed(2)}%
                  </p>
                  <p className="mt-0.5 text-xs text-[color:var(--on-surface-variant)]">
                    {currency(dollars)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[color:var(--on-surface-variant)]">
              Formula: f* = (b·p − q) / b &nbsp;·&nbsp; Edge {edgeNum > 0 ? "+" : ""}{edgeNum}% over implied {(
                (oddsNum > 0
                  ? 100 / (oddsNum + 100)
                  : Math.abs(oddsNum) / (Math.abs(oddsNum) + 100)) * 100
              ).toFixed(1)}% win probability
            </p>
          </div>
        ) : (
          <p className="text-xs text-[color:var(--on-surface-variant)]">
            Enter your edge %, the American odds, and your bankroll to compute
            full, half, and quarter Kelly stakes.
          </p>
        )}
      </div>
    </Card>
  );
}
