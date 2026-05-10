import { redirect } from "next/navigation";

import { OverviewContent } from "@/components/overview-content";
import { DashboardFilterProvider } from "@/components/dashboard-filter-provider";
import { MerchantShell } from "@/components/merchant-shell";
import { getDashboardBootstrap, getOverviewData } from "@/lib/merchant-dashboard/server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const dashboard = await getDashboardBootstrap(resolvedSearchParams);
  if (!dashboard) {
    redirect("/login");
  }

  const overview = await getOverviewData(dashboard.session, dashboard.bootstrap.applied);

  return (
    <DashboardFilterProvider
      initialIdentity={dashboard.bootstrap.identity}
      initialOptions={dashboard.bootstrap.options}
      initialApplied={dashboard.bootstrap.applied}
    >
      <MerchantShell active="overview">
        <OverviewContent initialData={overview} />
      </MerchantShell>
    </DashboardFilterProvider>
  );
}
