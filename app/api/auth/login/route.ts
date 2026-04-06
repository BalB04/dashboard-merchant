import { NextResponse } from "next/server";

import { sessionCookieConfig, createSessionToken } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/security/password";

type LoginBody = {
  identifier?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    let body: LoginBody;

    try {
      body = (await request.json()) as LoginBody;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const identifier = body.identifier?.trim().toLowerCase();
    const password = body.password;

    if (!identifier || !password) {
      return NextResponse.json({ error: "Identifier and password are required" }, { status: 400 });
    }

    const result = await query<{
      id: number;
      password_hash: string;
      role: string;
      is_active: boolean;
    }>(
      `
        select id, password_hash, role, is_active
        from users
        where lower(email) = $1 or lower(username) = $1
        limit 1
      `,
      [identifier],
    );

    const user = result.rows[0];
    if (!user || !user.is_active || user.role !== "merchant") {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const validPassword = verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const mapping = await query<{ merchant_key: string }>(
      `
        select merchant_key
        from merchant_users
        where user_id = $1
          and is_active = true
        limit 1
      `,
      [user.id],
    );

    if (!mapping.rows[0]) {
      return NextResponse.json({ error: "No active merchant mapping" }, { status: 403 });
    }

    const token = createSessionToken(user.id);
    const response = NextResponse.json({ ok: true });

    response.cookies.set(sessionCookieConfig.name, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookieConfig.maxAge,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
