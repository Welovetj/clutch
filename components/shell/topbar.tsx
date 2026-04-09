"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { dashboardNav } from "@/lib/nav";
import { LogoutButton } from "@/components/shell/logout-button";

type TopbarProps = {
  user: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
};

export function Topbar({ user }: TopbarProps) {
  const pathname = usePathname();
  const initials = user.name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="top-appbar sticky top-0 z-20">
      <div className="app-section flex h-16 items-center gap-3 px-4 sm:px-6">
        <Link href="/dashboard" className="brand-label reveal text-3xl leading-none">
          CLUTCH
        </Link>
        <div className="min-w-0 flex-1" />
        <div className="reveal delay-1 hidden items-center gap-3 md:flex">
          <button className="h-10 w-10 rounded-full text-[color:var(--on-surface-variant)] transition hover:bg-[color:var(--surface-high)]" aria-label="Notifications">
            <Bell className="mx-auto h-4 w-4" />
          </button>
          <div className="text-right">
            <p className="text-xs font-semibold text-[color:var(--on-surface)]">{user.name}</p>
            <p className="text-[10px] text-[color:var(--on-surface-variant)]">{user.email}</p>
          </div>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={`${user.name} avatar`} className="h-8 w-8 rounded-full border border-[color:var(--outline-variant)]/25 object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--outline-variant)]/25 bg-[color:var(--surface-high)] text-[10px] font-semibold text-[color:var(--primary)]">
              {initials || "OP"}
            </div>
          )}
        </div>
      </div>
      <div className="app-section hidden items-center gap-2 px-4 pb-3 sm:px-6 md:flex">
        {dashboardNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`reveal delay-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
              pathname === item.href
                ? "bg-[color:var(--surface-high)] text-[color:var(--primary)]"
                : "text-[color:var(--on-surface-variant)] hover:bg-[color:var(--surface-mid)] hover:text-[color:var(--on-surface)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
