import { redirect } from "next/navigation";

import { DashboardFilterProvider } from "@/components/dashboard-filter-provider";
import { FeedbackContent } from "@/components/feedback-content";
import { MerchantShell } from "@/components/merchant-shell";
import { getDashboardBootstrap, getFeedbackHistory } from "@/lib/merchant-dashboard/server";

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const dashboard = await getDashboardBootstrap(resolvedSearchParams);
  if (!dashboard) {
    redirect("/login");
  }

  const history = await getFeedbackHistory(dashboard.session);

  return (
    <DashboardFilterProvider
      initialIdentity={dashboard.bootstrap.identity}
      initialOptions={dashboard.bootstrap.options}
      initialApplied={dashboard.bootstrap.applied}
    >
      <MerchantShell active="feedback">
        <FeedbackContent initialHistory={history} />
      </MerchantShell>
    </DashboardFilterProvider>
  );
}
