"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setResetStatus(params.get("reset"));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted && session) {
        router.replace("/dashboard");
        router.refresh();
      }
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "").trim();

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        throw signInError;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <section className="panel w-full p-7 sm:p-9">
        <p className="brand-label text-3xl leading-none">CLUTCH</p>
        <p className="soft-label mt-4 text-[color:var(--primary)]">Clutch Access</p>
        <h1 className="mt-2 text-4xl font-semibold">Operator Sign In</h1>
        <p className="mt-2 text-sm text-[color:var(--on-surface-variant)]">Sign in with your Supabase account. New operators can create an account below.</p>
        {resetStatus === "success" && <p className="mt-4 text-xs text-[color:var(--primary)]">Password updated. Sign in with your new password.</p>}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--on-surface-variant)]">Email</span>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none transition focus:border-[color:var(--primary)]/40"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--on-surface-variant)]">Password</span>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none transition focus:border-[color:var(--primary)]/40"
            />
          </label>
          <p className="text-right text-xs">
            <Link href="/forgot-password" className="text-[color:var(--primary)] hover:underline">
              Forgot password?
            </Link>
          </p>
          {error && <p className="text-xs text-[color:var(--error)]">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? "Authenticating..." : "Enter Desk"}
          </button>
          <p className="text-center text-xs text-[color:var(--on-surface-variant)]">
            Need an account?{" "}
            <Link href="/signup" className="text-[color:var(--primary)] hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
