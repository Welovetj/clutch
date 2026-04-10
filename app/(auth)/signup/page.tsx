"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClientSafe } from "@/lib/supabase/client";
import { toSupabaseErrorMessage } from "@/lib/supabase/errors";

export default function SignupPage() {
  const router = useRouter();
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = createSupabaseBrowserClientSafe();
    setSupabaseReady(Boolean(client));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const supabase = createSupabaseBrowserClientSafe();
      if (!supabase) {
        return;
      }

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
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClientSafe();
      if (!supabase) {
        throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      }

      const formData = new FormData(event.currentTarget);
      const fullName = String(formData.get("fullName") ?? "").trim();
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "").trim();

      if (fullName.length < 2) {
        throw new Error("Please enter your full name.");
      }

      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!data.session) {
        setMessage("Account created. Check your email to confirm your account, then sign in.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (caughtError) {
      setError(toSupabaseErrorMessage(caughtError, "Sign up failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <section className="panel w-full p-7 sm:p-9">
        <p className="brand-label text-3xl leading-none">CLUTCH</p>
        <p className="soft-label mt-4 text-[color:var(--primary)]">Create Access</p>
        <h1 className="mt-2 text-4xl font-semibold">Open Account</h1>
        <p className="mt-2 text-sm text-[color:var(--on-surface-variant)]">Create your Supabase-backed account for Clutch Terminal.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--on-surface-variant)]">Full Name</span>
            <input
              name="fullName"
              type="text"
              required
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none transition focus:border-[color:var(--primary)]/40"
            />
          </label>
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
              minLength={8}
              className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none transition focus:border-[color:var(--primary)]/40"
            />
          </label>
          {error && <p className="text-xs text-[color:var(--error)]">{error}</p>}
          {message && <p className="text-xs text-[color:var(--primary)]">{message}</p>}
          <button type="submit" className="btn-primary w-full" disabled={pending || !supabaseReady}>
            {pending ? "Creating account..." : "Create Account"}
          </button>
          <p className="text-center text-xs text-[color:var(--on-surface-variant)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[color:var(--primary)] hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
