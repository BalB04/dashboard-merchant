import { redirect } from "next/navigation";

import { DashboardFilterProvider } from "@/components/dashboard-filter-provider";
import { MerchantShell } from "@/components/merchant-shell";
import { ProgramsContent } from "@/components/programs-content";
import { getSessionUserId } from "@/lib/auth/session";

export default async function ProgramsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  return (
    <DashboardFilterProvider>
      <MerchantShell active="programs">
        <ProgramsContent />
      </MerchantShell>
    </DashboardFilterProvider>
  );
}
