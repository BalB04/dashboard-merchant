"use server";

import { cookies } from "next/headers";

import { sessionCookieConfig } from "@/lib/auth/session";

export async function logoutMerchantAction() {
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieConfig.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return { ok: true as const };
}
