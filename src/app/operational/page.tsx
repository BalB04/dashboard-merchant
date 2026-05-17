import { redirect } from "next/navigation";

import { OperationalContent } from "@/components/operational-content";
import { DashboardFilterProvider } from "@/components/dashboard-filter-provider";
import { MerchantShell } from "@/components/merchant-shell";
import { getDashboardBootstrap, getOperationalData } from "@/lib/merchant-dashboard/server";

export default async function OperationalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const dashboard = await getDashboardBootstrap(resolvedSearchParams);
  if (!dashboard) {
    redirect("/login");
  }

  const operational = await getOperationalData(dashboard.session, dashboard.bootstrap.applied);

  return (
    <DashboardFilterProvider
      initialIdentity={dashboard.bootstrap.identity}
      initialOptions={dashboard.bootstrap.options}
      initialApplied={dashboard.bootstrap.applied}
    >
      <MerchantShell active="operational">
        <OperationalContent initialData={operational} />
      </MerchantShell>
    </DashboardFilterProvider>
  );
}
