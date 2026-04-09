import { redirect } from "next/navigation";
import { AnalyticsClient } from "@/components/dashboard/analytics-client";
import { DataSourceNotice } from "@/components/dashboard/data-source-notice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/supabase/queries";

export default async function AnalyticsPage() {
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

  return (
    <>
      <DataSourceNotice source={data.source} />
      <AnalyticsClient analytics={data.analytics} bets={data.bets} tiltEvents={data.tiltEvents} />
    </>
  );
}
