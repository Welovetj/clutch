"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[color:var(--outline-variant)]/20 bg-[color:var(--surface-low)] md:block">
      <div className="px-6 py-7">
        <p className="soft-label text-[color:var(--primary)]">Clutch</p>
        <h1 className="mt-1 text-lg font-semibold text-[color:var(--on-surface)]">Trading Desk</h1>
      </div>
      <nav className="px-3 pb-6">
        <ul className="space-y-1">
          {dashboardNav.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-xl border px-3 py-2 text-sm transition ${
                    active
                      ? "border-[color:var(--outline-variant)]/40 bg-[color:var(--surface-high)] text-[color:var(--on-surface)]"
                      : "border-transparent text-[color:var(--on-surface-variant)] hover:border-[color:var(--outline-variant)]/20 hover:bg-[color:var(--surface-mid)] hover:text-[color:var(--on-surface)]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-ev-calculator"))}
          className="mt-3 w-full rounded-xl border border-[color:var(--outline-variant)]/20 bg-[color:var(--surface-mid)] px-3 py-2 text-left text-sm text-[color:var(--on-surface-variant)] transition hover:border-[color:var(--primary)]/30 hover:text-[color:var(--primary)]"
        >
          EV Calculator
        </button>
      </nav>
    </aside>
  );
}
