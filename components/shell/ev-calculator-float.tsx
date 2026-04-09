"use client";

import { useEffect, useState } from "react";
import { Calculator, X } from "lucide-react";

function impliedProbability(oddsAmerican: number): number {
  if (oddsAmerican > 0) return 100 / (oddsAmerican + 100);
  return Math.abs(oddsAmerican) / (Math.abs(oddsAmerican) + 100);
}

function decimalOdds(oddsAmerican: number): number {
  return oddsAmerican > 0 ? 1 + oddsAmerican / 100 : 1 + 100 / Math.abs(oddsAmerican);
}

export function EvCalculatorFloat() {
  const [open, setOpen] = useState(false);
  const [probability, setProbability] = useState("");
  const [odds, setOdds] = useState("");

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-ev-calculator", handler);
    return () => window.removeEventListener("open-ev-calculator", handler);
  }, []);

  const p = Number(probability) / 100;
  const o = Number(odds);
  const valid = Number.isFinite(p) && Number.isFinite(o) && p > 0 && p < 1 && o !== 0;

  const implied = valid ? impliedProbability(o) * 100 : 0;
  const evPct = valid ? (p * (decimalOdds(o) - 1) - (1 - p)) * 100 : 0;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 left-4 z-40 inline-flex items-center gap-2 rounded-xl border border-[color:var(--outline-variant)]/30 bg-[color:var(--surface-mid)] px-3 py-2 text-xs font-semibold text-[color:var(--on-surface)] shadow-lg md:left-6"
        >
          <Calculator className="h-4 w-4" />
          EV Tool
        </button>
      ) : null}

      {open ? (
        <aside id="ev-calculator" className="fixed bottom-24 left-4 z-50 w-[20rem] rounded-2xl border border-[color:var(--outline-variant)]/30 bg-[color:var(--surface-low)] p-4 shadow-2xl md:left-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--on-surface)]">EV Calculator</p>
            <button type="button" onClick={() => setOpen(false)} className="text-[color:var(--on-surface-variant)]" aria-label="Close EV calculator">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="number"
              step="0.1"
              placeholder="True probability % (e.g. 57.5)"
              value={probability}
              onChange={(event) => setProbability(event.target.value)}
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none"
            />
            <input
              type="number"
              placeholder="American odds (e.g. -110)"
              value={odds}
              onChange={(event) => setOdds(event.target.value)}
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none"
            />

            {valid ? (
              <div className="space-y-2 rounded-xl bg-[color:var(--surface-lowest)] p-3">
                <div className="flex items-center justify-between text-xs text-[color:var(--on-surface-variant)]">
                  <span>Implied Probability</span>
                  <span className="metric">{implied.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[color:var(--on-surface-variant)]">
                  <span>Your Estimate</span>
                  <span className="metric">{(p * 100).toFixed(2)}%</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-[color:var(--on-surface-variant)]">Expected Value</span>
                  <span className={`metric text-lg ${evPct >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>
                    {evPct >= 0 ? "+" : ""}{evPct.toFixed(2)}%
                  </span>
                </div>
                <p className={`text-[11px] ${evPct >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--error)]"}`}>
                  {evPct >= 0 ? "+EV bet" : "-EV bet"}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-[color:var(--on-surface-variant)]">Enter true probability and American odds to evaluate EV.</p>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}
