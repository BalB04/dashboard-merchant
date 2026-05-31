"use server";

import { cookies } from "next/headers";

import { createSessionToken, sessionCookieConfig } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/security/password";

export type LoginMerchantResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_credentials" | "merchant_account_inactive" | "no_active_merchant_mapping" | "invalid_input";
    };

export async function loginMerchantAction(input: { identifier: string; password: string }): Promise<LoginMerchantResult> {
  try {
    const identifier = input.identifier.trim().toLowerCase();
    const password = input.password;

    if (!identifier || !password) {
      return { ok: false, error: "invalid_input" };
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
    if (!user) {
      return { ok: false, error: "invalid_credentials" };
    }

    if (!user.is_active) {
      return { ok: false, error: "merchant_account_inactive" };
    }

    let passwordIsValid = false;
    try {
      passwordIsValid = verifyPassword(password, user.password_hash);
    } catch (error) {
      console.error("Password verification failed", error);
      passwordIsValid = false;
    }

    if (!passwordIsValid) {
      return { ok: false, error: "invalid_credentials" };
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
      return { ok: false, error: "no_active_merchant_mapping" };
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

    return { ok: true };
  } catch (error) {
    console.error("loginMerchantAction failed", error);
    return { ok: false, error: "invalid_credentials" };
  }
}
