import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/dashboard/settings-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : user.email?.split("@")[0] ?? "Operator";
  const avatarUrl = typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "";

  return <SettingsClient initialName={fullName} initialEmail={user.email ?? ""} initialAvatarUrl={avatarUrl} userId={user.id} />;
}
