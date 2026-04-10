"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClientSafe } from "@/lib/supabase/client";
import { toSupabaseErrorMessage } from "@/lib/supabase/errors";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabaseReady, setSupabaseReady] = useState(false);

  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [canReset, setCanReset] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");

  useEffect(() => {
    const client = createSupabaseBrowserClientSafe();
    setSupabaseReady(Boolean(client));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");

    if (email) {
      setRecoveryEmail(email);
    }

    if (errorCode || errorDescription) {
      setError("This reset link is invalid or expired. Request a new one below.");
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClientSafe();
    if (!supabase) {
      return;
    }

    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (session) {
        setCanReset(true);
        setResendMessage(null);
        setMessage("Recovery session verified. Set your new password below.");
      } else {
        setMessage(null);
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setCanReset(true);
        setError(null);
        setResendMessage(null);
        setMessage("Recovery session verified. Set your new password below.");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

      if (!canReset) {
        throw new Error("Open this page from the password reset email link.");
      }

      const formData = new FormData(event.currentTarget);
      const password = String(formData.get("password") ?? "").trim();
      const confirmPassword = String(formData.get("confirmPassword") ?? "").trim();

      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      await supabase.auth.signOut();
      router.replace("/login?reset=success");
      router.refresh();
    } catch (caughtError) {
      setError(toSupabaseErrorMessage(caughtError, "Unable to reset password"));
    } finally {
      setPending(false);
    }
  }

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendPending(true);
    setResendMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClientSafe();
      if (!supabase) {
        throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      }

      const email = recoveryEmail.trim();

      if (!email) {
        throw new Error("Enter your account email to resend the reset link.");
      }

      const redirectTo = `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}`;
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (resendError) {
        throw resendError;
      }

      setResendMessage("If an account exists for that email, a fresh reset link has been sent.");
    } catch (caughtError) {
      setError(toSupabaseErrorMessage(caughtError, "Unable to resend reset link"));
    } finally {
      setResendPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <section className="panel w-full p-7 sm:p-9">
        <p className="brand-label text-3xl leading-none">CLUTCH</p>
        <p className="soft-label mt-4 text-[color:var(--primary)]">Account Recovery</p>
        <h1 className="mt-2 text-4xl font-semibold">Reset Password</h1>
        <p className="mt-2 text-sm text-[color:var(--on-surface-variant)]">Use the link from your email to open this page, then choose a new password.</p>

        {canReset ? (
          <form key="reset-password-form" className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1.5">
              <span className="text-xs text-[color:var(--on-surface-variant)]">New Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none transition focus:border-[color:var(--primary)]/40"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[color:var(--on-surface-variant)]">Confirm New Password</span>
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none transition focus:border-[color:var(--primary)]/40"
              />
            </label>
            {error && <p className="text-xs text-[color:var(--error)]">{error}</p>}
            {message && <p className="text-xs text-[color:var(--primary)]">{message}</p>}
            <button type="submit" className="btn-primary w-full" disabled={pending || !supabaseReady}>
              {pending ? "Updating password..." : "Update Password"}
            </button>
          </form>
        ) : (
          <form key="resend-reset-link-form" className="mt-6 space-y-4" onSubmit={handleResend}>
            <p className="text-xs text-[color:var(--on-surface-variant)]">This page needs a valid recovery link from email. Enter your email to resend a fresh link.</p>
            <label className="block space-y-1.5">
              <span className="text-xs text-[color:var(--on-surface-variant)]">Recovery Email</span>
              <input
                type="email"
                required
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm text-[color:var(--on-surface)] outline-none transition focus:border-[color:var(--primary)]/40"
              />
            </label>
            {error && <p className="text-xs text-[color:var(--error)]">{error}</p>}
            {resendMessage && <p className="text-xs text-[color:var(--primary)]">{resendMessage}</p>}
            <button type="submit" className="btn-primary w-full" disabled={resendPending || !supabaseReady}>
              {resendPending ? "Sending link..." : "Resend Reset Link"}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-xs text-[color:var(--on-surface-variant)]">
          Need another route?{" "}
          <Link href="/forgot-password" className="text-[color:var(--primary)] hover:underline">
            Go to forgot password page
          </Link>
        </p>
      </section>
    </main>
  );
}
