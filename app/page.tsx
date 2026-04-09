import Link from "next/link";
import { Bell, BriefcaseMedical, ChartColumnBig, CircleUserRound } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      <header className="top-appbar fixed top-0 z-30 w-full">
        <div className="app-section flex h-16 items-center justify-between px-4 sm:px-6">
          <p className="brand-label reveal text-3xl leading-none">CLUTCH</p>
          <div className="reveal delay-1 flex items-center gap-3 text-[color:var(--on-surface-variant)]">
            <span className="rounded-full p-2 transition hover:bg-[color:var(--surface-high)]">
              <Bell className="h-4 w-4" />
            </span>
            <CircleUserRound className="h-8 w-8" />
          </div>
        </div>
      </header>

      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16 md:pt-20">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[color:var(--primary)]/5 blur-[120px]" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[color:var(--primary)]/5 blur-[120px]" />
        <div className="relative z-10 w-full max-w-5xl text-center">
          <h1 className="reveal text-6xl font-bold tracking-[-0.04em] text-[color:var(--on-surface)] sm:text-8xl md:text-[8.5rem]">CLUTCH</h1>
          <p className="reveal delay-1 mt-6 text-xl uppercase tracking-[0.24em] text-[color:var(--on-surface-variant)] sm:text-2xl">Lock in your edge.</p>
          <div className="reveal delay-2 mt-10 flex flex-wrap items-center justify-center gap-3 md:gap-4">
            <Link href="/login" className="btn-primary px-10 py-3.5 text-base">
              Get started
            </Link>
            <Link href="/signup" className="btn-ghost px-7 py-3 text-sm">
              Create account
            </Link>
            <Link href="/dashboard" className="btn-ghost px-7 py-3 text-sm">
              Preview terminal
            </Link>
          </div>
        </div>

        <div className="pointer-events-none relative mt-24 grid w-full max-w-6xl grid-cols-1 gap-5 opacity-35 md:grid-cols-3 md:gap-6">
          <div className="panel reveal delay-2 h-44 p-6">
            <div className="h-3 w-1/2 rounded bg-[color:var(--outline-variant)]/35" />
            <div className="mt-4 h-8 w-2/3 rounded bg-[color:var(--primary)]/18" />
          </div>
          <div className="panel reveal delay-3 h-44 p-6 md:-translate-y-8">
            <div className="h-3 w-1/2 rounded bg-[color:var(--outline-variant)]/35" />
            <div className="mt-4 h-8 w-2/3 rounded bg-[color:var(--primary)]/18" />
          </div>
          <div className="panel reveal delay-4 h-44 p-6">
            <div className="h-3 w-1/2 rounded bg-[color:var(--outline-variant)]/35" />
            <div className="mt-4 h-8 w-2/3 rounded bg-[color:var(--primary)]/18" />
          </div>
        </div>
      </section>

      <section className="app-section grid gap-6 px-4 py-16 sm:px-6 md:grid-cols-3 md:gap-8">
        <article className="panel reveal p-7">
          <div className="panel-high mb-5 inline-flex h-10 w-10 items-center justify-center text-[color:var(--primary)]">
            <ChartColumnBig className="h-4 w-4" />
          </div>
          <h3 className="text-xl font-bold">Reliability Scoring</h3>
          <p className="mt-3 text-sm text-[color:var(--on-surface-variant)]">Proprietary data models weigh historical outcomes against live market volatility.</p>
        </article>
        <article className="panel reveal delay-1 p-7">
          <div className="panel-high mb-5 inline-flex h-10 w-10 items-center justify-center text-[color:var(--primary)]">
            <Bell className="h-4 w-4" />
          </div>
          <h3 className="text-xl font-bold">Game Day Alerts</h3>
          <p className="mt-3 text-sm text-[color:var(--on-surface-variant)]">Instant notifications for line movement and value opportunities before market correction.</p>
        </article>
        <article className="panel reveal delay-2 p-7">
          <div className="panel-high mb-5 inline-flex h-10 w-10 items-center justify-center text-[color:var(--primary)]">
            <BriefcaseMedical className="h-4 w-4" />
          </div>
          <h3 className="text-xl font-bold">Injury News</h3>
          <p className="mt-3 text-sm text-[color:var(--on-surface-variant)]">Direct-to-terminal reporting on player availability and spread impact.</p>
        </article>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="panel reveal app-section relative mx-auto max-w-2xl p-10 text-center">
          <div className="absolute left-1/2 top-0 h-14 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent to-[color:var(--primary)]/45" />
          <h2 className="text-4xl font-bold">The ultimate terminal for the high-stakes player.</h2>
          <button className="btn-ghost mt-8 px-8 py-3">Join the waitlist</button>
        </div>
      </section>

      <footer className="border-t border-[color:var(--outline-variant)]/14 bg-[color:var(--surface-lowest)]">
        <div className="app-section flex flex-col items-center justify-between gap-6 px-4 py-8 sm:px-6 md:flex-row">
          <p className="brand-label text-3xl leading-none">CLUTCH</p>
          <nav className="flex flex-wrap justify-center gap-8 text-sm text-[color:var(--on-surface-variant)]">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Responsible Gaming</a>
            <a href="#">Support</a>
          </nav>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--on-surface-variant)]">© 2026 Clutch Terminal. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
