import { redirect } from "next/navigation";
import { BetsClient } from "@/components/dashboard/bets-client";
import { DataSourceNotice } from "@/components/dashboard/data-source-notice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/supabase/queries";

export default async function BetsLogPage() {
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
      <BetsClient bets={data.bets} tiltEvents={data.tiltEvents} />
    </>
  );
}
