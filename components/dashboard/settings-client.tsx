"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SettingsClientProps = {
  initialName: string;
  initialEmail: string;
  initialAvatarUrl: string;
  userId: string;
};

export function SettingsClient({ initialName, initialEmail, initialAvatarUrl, userId }: SettingsClientProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    try {
      setPending(true);
      setError(null);
      setMessage(null);
      const fullName = String(formData.get("fullName") ?? "").trim();
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "").trim();
      let avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
      const avatarFile = formData.get("avatarFile");
      const supabase = createSupabaseBrowserClient();

      if (avatarFile instanceof File && avatarFile.size > 0) {
        if (!avatarFile.type.startsWith("image/")) {
          throw new Error("Avatar upload must be an image file.");
        }

        const ext = avatarFile.name.includes(".") ? avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg" : "jpg";
        const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
        const objectPath = `${userId}/avatar-${Date.now()}.${safeExt}`;

        const { error: uploadError } = await supabase.storage.from("avatars").upload(objectPath, avatarFile, {
          contentType: avatarFile.type,
          upsert: true,
        });

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(objectPath);

        if (!publicUrl) {
          throw new Error("Unable to get uploaded avatar URL.");
        }

        avatarUrl = publicUrl;
      }

      const updatePayload: { data: { full_name: string; avatar_url: string }; email?: string; password?: string } = {
        data: { full_name: fullName, avatar_url: avatarUrl },
      };

      if (email && email !== initialEmail) {
        updatePayload.email = email;
      }

      if (password) {
        updatePayload.password = password;
      }

      const { error: updateError } = await supabase.auth.updateUser(updatePayload);

      if (updateError) {
        throw updateError;
      }

      setMessage("Account settings updated.");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update settings");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <p className="soft-label text-[color:var(--primary)]">Settings</p>
        <h2 className="mt-2 text-4xl font-semibold">Profile Settings</h2>
        <p className="mt-2 text-sm text-[color:var(--on-surface-variant)]">Upload a real profile photo (JPEG/JPG/PNG/WEBP) or set a URL, then update your account details.</p>
      </section>

      <section className="panel max-w-2xl p-6">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(new FormData(event.currentTarget));
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--on-surface-variant)]">Upload Profile Photo</span>
            <input name="avatarFile" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--on-surface-variant)]">Profile Picture URL</span>
            <input name="avatarUrl" type="url" defaultValue={initialAvatarUrl} placeholder="https://..." className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--on-surface-variant)]">Full Name</span>
            <input name="fullName" defaultValue={initialName} required className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--on-surface-variant)]">Email</span>
            <input name="email" type="email" defaultValue={initialEmail} required className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--on-surface-variant)]">New Password</span>
            <input name="password" type="password" minLength={8} placeholder="Leave blank to keep current password" className="w-full rounded-xl border border-[color:var(--outline-variant)]/28 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none" />
          </label>
          {error && <p className="text-xs text-[color:var(--error)]">{error}</p>}
          {message && <p className="text-xs text-[color:var(--primary)]">{message}</p>}
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </section>
    </main>
  );
}
