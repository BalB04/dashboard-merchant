import { redirect } from "next/navigation";

import { OperationalContent } from "@/components/operational-content";
import { DashboardFilterProvider } from "@/components/dashboard-filter-provider";
import { MerchantShell } from "@/components/merchant-shell";
import { getSessionUserId } from "@/lib/auth/session";

export default async function OperationalPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  return (
    <DashboardFilterProvider>
      <MerchantShell active="operational">
        <OperationalContent />
      </MerchantShell>
    </DashboardFilterProvider>
  );
}
