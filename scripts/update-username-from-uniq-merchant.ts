import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { hasApplyFlag } from "./_helpers";

const baseQuery = sql`
  select
    ua.id,
    ua.email,
    ua.username as current_username,
    min(dm.uniq_merchant) as new_username
  from user_accounts ua
  join dim_merchant dm on dm.user_account_id = ua.id
  where dm.uniq_merchant is not null
    and btrim(dm.uniq_merchant) <> ''
    and (ua.username is null or btrim(ua.username) = '')
  group by ua.id, ua.email, ua.username
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
    console.log("Preview only. Re-run with --apply to update user_accounts.username.");
    return;
  }

  await db.execute(sql`
    update user_accounts ua
    set username = target.new_username,
        updated_at = now()
    from (
      select
        dm.user_account_id,
        min(dm.uniq_merchant) as new_username
      from dim_merchant dm
      where dm.user_account_id is not null
        and dm.uniq_merchant is not null
        and btrim(dm.uniq_merchant) <> ''
      group by dm.user_account_id
    ) target
    where ua.id = target.user_account_id
      and (ua.username is null or btrim(ua.username) = '')
  `);

  console.log(`Updated ${preview.rows.length} username(s).`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
