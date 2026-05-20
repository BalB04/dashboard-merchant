"use server";

import { cookies } from "next/headers";

import { createSessionToken, sessionCookieConfig } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/security/password";

export async function loginMerchantAction(input: { identifier: string; password: string }) {
  const identifier = input.identifier.trim().toLowerCase();
  const password = input.password;

  if (!identifier || !password) {
    throw new Error("Identifier and password are required");
  }

  const result = await query<{
    id: number;
    password_hash: string;
    is_active: boolean;
  }>(
    `
      select id, password_hash, is_active
      from user_accounts
      where lower(email) = $1 or lower(username) = $1
      limit 1
    `,
    [identifier],
  );

  const user = result.rows[0];
  if (!user || !user.is_active) {
    throw new Error("Invalid credentials");
  }

  if (!verifyPassword(password, user.password_hash)) {
    throw new Error("Invalid credentials");
  }

  const mapping = await query<{ merchant_key: string }>(
    `
      select merchant_key
      from dim_merchant
      where user_account_id = $1
      limit 1
    `,
    [user.id],
  );

  if (!mapping.rows[0]) {
    throw new Error("No active merchant mapping");
  }

  const token = createSessionToken(user.id);
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieConfig.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookieConfig.maxAge,
  });

  return { ok: true as const };
}
