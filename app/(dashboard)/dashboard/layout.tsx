import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { buildLiveUpdates } from "@/lib/supabase/dashboard-data";
import { getDashboardData } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
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

  const data = await getDashboardData(supabase, user.id);
  const statusItems = buildLiveUpdates(data.bets, data.bankrollCurve, data.watchlistTeams, data.exposure);

  const nameFromMetadata = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const avatarFromMetadata = typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : undefined;
  const displayName = nameFromMetadata?.trim() || user.email?.split("@")[0] || "Operator";

  return <AppShell user={{ name: displayName, email: user.email ?? "", avatarUrl: avatarFromMetadata }} statusItems={statusItems}>{children}</AppShell>;
}
