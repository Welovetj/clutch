"use client";

import { useRef, useState } from "react";
import { FileImage, Sparkles, X } from "lucide-react";

export type SlipData = {
  ticketCode?: string;
  placedAt?: string;
  sport?: string;
  market?: string;
  oddsAmerican?: number;
  stake?: number;
  toWin?: number;
  book?: string;
  status?: "won" | "lost" | "pending";
};

type ParseSlipResponse = {
  data?: SlipData;
  error?: string;
};

type BetSlipImporterProps = {
  onPrefill: (data: SlipData) => void;
};

export function BetSlipImporter({ onPrefill }: BetSlipImporterProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<SlipData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageName(file.name);
    setImageMime(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageBase64(null);
    setImageMime(null);
    setImageName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleParse() {
    if (!text.trim() && !imageBase64) {
      setError("Paste bet slip text or upload a photo first.");
      return;
    }

    try {
      setParsing(true);
      setError(null);
      setReview(null);

      const response = await fetch("/api/ai/parse-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          imageBase64: imageBase64 ?? undefined,
          mimeType: imageMime ?? undefined,
        }),
      });

      const json = (await response.json()) as ParseSlipResponse;

      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Could not parse bet slip.");
      }

      setReview({
        ticketCode: json.data.ticketCode ?? "",
        placedAt: json.data.placedAt ?? "",
        sport: json.data.sport ?? "",
        market: json.data.market ?? "",
        oddsAmerican: Number(json.data.oddsAmerican ?? 0),
        stake: Number(json.data.stake ?? 0),
        toWin: Number(json.data.toWin ?? 0),
        book: json.data.book ?? "",
        status: (json.data.status as SlipData["status"]) ?? "pending",
      });
    } catch (err) {
      setError((err instanceof Error ? err.message : "Parse failed.") + " Please fill the form manually.");
    } finally {
      setParsing(false);
    }
  }

  function updateReview<K extends keyof SlipData>(key: K, value: SlipData[K]) {
    setReview((current) => (current ? { ...current, [key]: value } : current));
  }

  function applyPrefill() {
    if (!review) {
      return;
    }

    onPrefill(review);
    setOpen(false);
    setReview(null);
    setText("");
    clearImage();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-xs font-semibold text-[color:var(--on-surface-variant)] transition hover:border-[color:var(--primary)]/40 hover:text-[color:var(--primary)]"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Scan Slip
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="soft-label text-[color:var(--primary)]">Bet Slip Scanner</p>
            <h3 className="text-2xl font-semibold text-[color:var(--on-surface)]">Scan Slip</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close scanner"
            className="text-[color:var(--on-surface-variant)] hover:text-[color:var(--on-surface)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste raw text from sportsbook confirmation"
            rows={5}
            className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none resize-none"
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-xs font-semibold text-[color:var(--on-surface-variant)] hover:border-[color:var(--primary)]/40 hover:text-[color:var(--primary)]">
              <FileImage className="h-3.5 w-3.5" />
              {imageName ?? "Upload Image (JPEG/PNG)"}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>

            {imageName ? (
              <button
                type="button"
                onClick={clearImage}
                className="text-xs text-[color:var(--on-surface-variant)] hover:text-[color:var(--error)]"
              >
                Remove image
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void handleParse()}
              disabled={parsing}
              className="ml-auto rounded-xl bg-[color:var(--primary)] px-4 py-2 text-xs font-semibold text-[color:var(--surface)] disabled:opacity-60"
            >
              {parsing ? "Parsing..." : "Parse with AI"}
            </button>
          </div>

          {error ? <p className="text-xs text-[color:var(--error)]">{error}</p> : null}

          {review ? (
            <div className="space-y-3 rounded-xl border border-[color:var(--outline-variant)]/24 bg-[color:var(--surface-lowest)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--primary)]">Confirm Parsed Fields</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={review.ticketCode ?? ""} onChange={(event) => updateReview("ticketCode", event.target.value)} placeholder="Ticket code" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-mid)] px-3 py-2 text-sm outline-none" />
                <input value={review.book ?? ""} onChange={(event) => updateReview("book", event.target.value)} placeholder="Sportsbook" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-mid)] px-3 py-2 text-sm outline-none" />
                <input value={review.sport ?? ""} onChange={(event) => updateReview("sport", event.target.value)} placeholder="Sport" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-mid)] px-3 py-2 text-sm outline-none" />
                <input value={review.market ?? ""} onChange={(event) => updateReview("market", event.target.value)} placeholder="Market type" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-mid)] px-3 py-2 text-sm outline-none" />
                <input type="number" value={review.oddsAmerican ?? 0} onChange={(event) => updateReview("oddsAmerican", Number(event.target.value))} placeholder="American odds" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-mid)] px-3 py-2 text-sm outline-none" />
                <input type="number" step="0.01" value={review.stake ?? 0} onChange={(event) => updateReview("stake", Number(event.target.value))} placeholder="Stake" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-mid)] px-3 py-2 text-sm outline-none" />
                <input type="number" step="0.01" value={review.toWin ?? 0} onChange={(event) => updateReview("toWin", Number(event.target.value))} placeholder="Potential payout" className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-mid)] px-3 py-2 text-sm outline-none" />
                <select
                  value={review.status ?? "pending"}
                  onChange={(event) => updateReview("status", event.target.value as SlipData["status"])}
                  title="Bet status"
                  aria-label="Parsed bet status"
                  className="rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-mid)] px-3 py-2 text-sm outline-none"
                >
                  <option value="pending">pending</option>
                  <option value="won">won</option>
                  <option value="lost">lost</option>
                </select>
                <input type="datetime-local" value={(review.placedAt ?? "").slice(0, 16)} onChange={(event) => updateReview("placedAt", event.target.value)} placeholder="Placed date" className="col-span-2 rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-mid)] px-3 py-2 text-sm outline-none" />
              </div>

              <button
                type="button"
                onClick={applyPrefill}
                className="w-full rounded-xl bg-[color:var(--primary)] py-2 text-xs font-semibold text-[color:var(--surface)]"
              >
                Apply to Add Bet Form
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
