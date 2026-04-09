import { Radio } from "lucide-react";
import type { LiveUpdate } from "@/lib/models";

type StatusStripProps = {
  items: LiveUpdate[];
};

export function StatusStrip({ items }: StatusStripProps) {
  return (
    <footer className="fixed bottom-0 z-20 w-full border-t border-[color:var(--outline-variant)]/18 bg-[color:var(--surface-lowest)]/92 backdrop-blur-md">
      <div className="app-section no-scrollbar flex items-center gap-5 overflow-x-auto px-4 py-3 sm:px-6 md:gap-7">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Radio className="h-3.5 w-3.5 text-[color:var(--primary)]" />
          <span className="soft-label">Live Account Feed</span>
        </div>
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 whitespace-nowrap border-l border-[color:var(--outline-variant)]/20 pl-6">
            <span className="text-xs font-semibold text-[color:var(--on-surface)]">{item.label}</span>
            <span className="text-xs text-[color:var(--primary)]">{item.status}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
