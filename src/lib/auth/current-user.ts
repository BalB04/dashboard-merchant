import { getSessionUserId } from "@/lib/auth/session";
import { query } from "@/lib/db";

export type MerchantSession = {
  userId: number;
  merchantKey: string;
  scopeType: "account";
  email: string;
};

export const getCurrentMerchantSession = async (): Promise<MerchantSession | null> => {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }

  const result = await query<{
    id: number;
    email: string;
    merchant_key: string;
  }>(
    `
      select
        ua.id,
        ua.email,
        dm.merchant_key
      from user_accounts ua
      join lateral (
        select merchant_key
        from dim_merchant
        where user_account_id = ua.id
        order by merchant_name asc, keyword_code asc
        limit 1
      ) dm on true
      where ua.id = $1
        and ua.is_active = true
      limit 1
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    userId: row.id,
    merchantKey: row.merchant_key,
    scopeType: "account",
    email: row.email,
  };
};
