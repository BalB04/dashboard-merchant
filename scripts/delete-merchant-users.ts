import { inArray, sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { dimMerchant, userAccounts } from "../src/lib/db/schema";

const run = async () => {
  const rows = await db.execute<{
    id: number;
    email: string;
    username: string | null;
  }>(sql`
    select distinct
      ua.id,
      ua.email,
      ua.username
    from user_accounts ua
    join dim_merchant dm on dm.user_account_id = ua.id
    order by ua.email
  `);

  if (rows.rows.length === 0) {
    console.log("No merchant users found. Nothing to delete.");
    return;
  }

  console.log(`Found ${rows.rows.length} merchant user(s).`);
  for (const row of rows.rows) {
    console.log(`${row.email}${row.username ? ` (${row.username})` : ""}`);
  }

  const userIds = rows.rows.map((row) => row.id);

  await db.transaction(async (tx) => {
    await tx
      .update(dimMerchant)
      .set({ userAccountId: null })
      .where(inArray(dimMerchant.userAccountId, userIds));

    await tx.delete(userAccounts).where(inArray(userAccounts.id, userIds));
  });

  console.log(`Deleted ${userIds.length} merchant user(s).`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
