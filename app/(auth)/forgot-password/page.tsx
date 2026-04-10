"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClientSafe } from "@/lib/supabase/client";
import { toSupabaseErrorMessage } from "@/lib/supabase/errors";

export default function ForgotPasswordPage() {
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState("");

  useEffect(() => {
    const client = createSupabaseBrowserClientSafe();
    setSupabaseReady(Boolean(client));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sent = params.get("sent");
    const email = params.get("email");

    if (email) {
      setEmailValue(email);
    }

    if (sent === "1") {
      setMessage("A reset link was sent. Check your inbox and spam folder.");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const email = emailValue.trim();

      if (!supabaseReady) {
        throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      }

      if (!email) {
        throw new Error("Please enter your email.");
      }

      const supabase = createSupabaseBrowserClientSafe();

      if (!supabase) {
        throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      }

      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (resetError) {
        throw resetError;
      }

      setMessage("If an account exists for that email, a reset link has been sent.");
    } catch (caughtError) {
      setError(toSupabaseErrorMessage(caughtError, "Unable to send reset link"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <section className="panel w-full p-7 sm:p-9">
        <p className="brand-label text-3xl leading-none">CLUTCH</p>
        <p className="soft-label mt-4 text-[color:var(--primary)]">Account Recovery</p>
        <h1 className="mt-2 text-4xl font-semibold">Forgot Password</h1>
        <p className="mt-2 text-sm text-[color:var(--on-surface-variant)]">Enter your account email and we will send a password reset link.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--on-surface-variant)]">Email</span>
            <input
              name="email"
              type="email"
              required
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value)}
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none transition focus:border-[color:var(--primary)]/40"
            />
          </label>
          {error && <p className="text-xs text-[color:var(--error)]">{error}</p>}
          {message && <p className="text-xs text-[color:var(--primary)]">{message}</p>}
          <button type="submit" className="btn-primary w-full" disabled={pending || !supabaseReady}>
            {pending ? "Sending link..." : "Send Reset Link"}
          </button>
          <p className="text-center text-xs text-[color:var(--on-surface-variant)]">
            Remembered your password?{" "}
            <Link href="/login" className="text-[color:var(--primary)] hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
