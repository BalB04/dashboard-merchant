import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "merchant_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  userId: number;
  exp: number;
};

const getSessionSecret = () => {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not set");
  }
  return secret;
};

const toBase64Url = (value: string) => Buffer.from(value, "utf8").toString("base64url");

const fromBase64Url = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string) => {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
};

const encodeToken = (payload: SessionPayload) => {
  const body = toBase64Url(JSON.stringify(payload));
  const signature = sign(body);
  return `${body}.${signature}`;
};

const decodeToken = (token: string): SessionPayload | null => {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expectedSignature = sign(body);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(body)) as SessionPayload;
    if (!payload.userId || !payload.exp) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const createSessionToken = (userId: number) => {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return encodeToken({ userId, exp });
};

export const getSessionUserId = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = decodeToken(token);
  return payload?.userId ?? null;
};

export const sessionCookieConfig = {
  name: COOKIE_NAME,
  maxAge: SESSION_TTL_SECONDS,
};
