import { redirect } from "next/navigation";

import { DashboardFilterProvider } from "@/components/dashboard-filter-provider";
import { FeedbackContent } from "@/components/feedback-content";
import { MerchantShell } from "@/components/merchant-shell";
import { getSessionUserId } from "@/lib/auth/session";

export default async function FeedbackPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  return (
    <DashboardFilterProvider>
      <MerchantShell active="feedback">
        <FeedbackContent />
      </MerchantShell>
    </DashboardFilterProvider>
  );
}
