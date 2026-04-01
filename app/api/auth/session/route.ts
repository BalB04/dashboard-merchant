import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";

export async function GET() {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: session.userId,
      email: session.email,
      role: session.role,
      merchantKey: session.merchantKey,
    },
  });
}
