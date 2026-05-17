import { getSessionUserId } from "@/lib/auth/session";
import { query } from "@/lib/db";

export type MerchantSession = {
  userId: number;
  role: "merchant";
  merchantKey: string;
  scopeType: "merchant" | "canonical";
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
    scope_type: "merchant" | "canonical";
  }>(
    `
      select
        u.id,
        u.role,
        u.email,
        case
          when mu.scope_type = 'canonical' then coalesce(mcm.canonical_merchant_key, mu.merchant_key)
          else mu.merchant_key
        end as merchant_key,
        mu.scope_type
      from users u
      join merchant_users mu on mu.user_id = u.id
      left join merchant_canonical_map mcm on mcm.merchant_key = mu.merchant_key
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
    scopeType: row.scope_type,
    email: row.email,
  };
};
