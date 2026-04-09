"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TiltEvent } from "@/lib/models";

type TiltWarningBannerProps = {
  event: TiltEvent;
};

export function TiltWarningBanner({ event }: TiltWarningBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);

  if (dismissed) {
    return null;
  }

  async function handleDismiss() {
    try {
      setPending(true);
      const response = await fetch("/api/tilt-events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });

      if (!response.ok) {
        return;
      }

      setDismissed(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const reason = event.conditionsMet.join(" and ");

  return (
    <div className="rounded-xl border border-[color:var(--error)]/30 bg-[color:var(--error)]/10 px-4 py-3 text-sm text-[color:var(--on-surface)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p>
          <span className="font-semibold text-[color:var(--error)]">Tilt warning:</span>{" "}
          You have {reason} - consider stepping back.
        </p>
        <button
          type="button"
          onClick={() => void handleDismiss()}
          disabled={pending}
          className="self-start rounded-lg border border-[color:var(--error)]/35 px-3 py-1 text-xs font-semibold text-[color:var(--error)] disabled:opacity-60"
        >
          {pending ? "Dismissing..." : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
