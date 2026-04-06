import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { hasApplyFlag } from "./_helpers";

const baseQuery = sql`
  select
    u.id,
    u.email,
    u.username as current_username,
    dm.uniq_merchant as new_username
  from users u
  join merchant_users mu on mu.user_id = u.id and mu.is_active = true
  left join merchant_canonical_map mcm on mcm.merchant_key = mu.merchant_key
  left join dim_merchant dm on dm.merchant_key = coalesce(mcm.canonical_merchant_key, mu.merchant_key)
  where dm.uniq_merchant is not null
    and btrim(dm.uniq_merchant) <> ''
    and (u.username is null or btrim(u.username) = '')
`;

const run = async () => {
  const preview = await db.execute<{
    id: number;
    email: string;
    current_username: string | null;
    new_username: string;
  }>(baseQuery);

  if (preview.rows.length === 0) {
    console.log("No usernames need to be backfilled.");
    return;
  }

  console.table(preview.rows);

  if (!hasApplyFlag()) {
    console.log("Preview only. Re-run with --apply to update users.username.");
    return;
  }

  await db.execute(sql`
    update users u
    set username = dm.uniq_merchant,
        updated_at = now()
    from merchant_users mu
    left join merchant_canonical_map mcm on mcm.merchant_key = mu.merchant_key
    left join dim_merchant dm on dm.merchant_key = coalesce(mcm.canonical_merchant_key, mu.merchant_key)
    where u.id = mu.user_id
      and mu.is_active = true
      and dm.uniq_merchant is not null
      and btrim(dm.uniq_merchant) <> ''
      and (u.username is null or btrim(u.username) = '')
  `);

  console.log(`Updated ${preview.rows.length} username(s).`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
