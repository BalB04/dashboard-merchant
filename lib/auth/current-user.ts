import { getSessionUserId } from "@/lib/auth/session";
import { query } from "@/lib/db";

export type MerchantSession = {
  userId: number;
  role: "merchant";
  merchantKey: string;
  email: string;
};

export const getCurrentMerchantSession = async (): Promise<MerchantSession | null> => {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }

  const result = await query<{
    id: number;
    role: string;
    email: string;
    merchant_key: string;
  }>(
    `
      select u.id, u.role, u.email, mu.merchant_key
      from users u
      join merchant_users mu on mu.user_id = u.id
      where u.id = $1
        and u.is_active = true
        and mu.is_active = true
      limit 1
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row || row.role !== "merchant") {
    return null;
  }

  return {
    userId: row.id,
    role: "merchant",
    merchantKey: row.merchant_key,
    email: row.email,
  };
};
