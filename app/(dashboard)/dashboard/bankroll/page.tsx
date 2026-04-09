import { redirect } from "next/navigation";
import { BankrollClient } from "@/components/dashboard/bankroll-client";
import { DataSourceNotice } from "@/components/dashboard/data-source-notice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/supabase/queries";

export default async function BankrollPage() {
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
      <BankrollClient bankrollCurve={data.bankrollCurve} exposure={data.exposure} />
    </>
  );
}
