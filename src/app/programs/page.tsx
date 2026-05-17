import { redirect } from "next/navigation";

import { DashboardFilterProvider } from "@/components/dashboard-filter-provider";
import { MerchantShell } from "@/components/merchant-shell";
import { ProgramsContent } from "@/components/programs-content";
import { getDashboardBootstrap, getProgramsData } from "@/lib/merchant-dashboard/server";

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const dashboard = await getDashboardBootstrap(resolvedSearchParams);
  if (!dashboard) {
    redirect("/login");
  }

  const programs = await getProgramsData(dashboard.session, dashboard.bootstrap.applied);

  return (
    <DashboardFilterProvider
      initialIdentity={dashboard.bootstrap.identity}
      initialOptions={dashboard.bootstrap.options}
      initialApplied={dashboard.bootstrap.applied}
    >
      <MerchantShell active="programs">
        <ProgramsContent initialData={programs} />
      </MerchantShell>
    </DashboardFilterProvider>
  );
}
