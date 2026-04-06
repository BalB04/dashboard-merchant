import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { hasApplyFlag } from "./_helpers";

const run = async () => {
  const preview = await db.execute<{
    uniq_merchant: string;
    old_merchant_key: string;
    canonical_merchant_key: string;
  }>(sql`
    with merchant_with_active_user as (
      select distinct merchant_key
      from merchant_users
      where is_active = true
    ),
    canonical_by_brand as (
      select
        dm.uniq_merchant,
        coalesce(
          (array_agg(dm.merchant_key order by dm.merchant_key::text) filter (
            where dm.merchant_key in (select merchant_key from merchant_with_active_user)
          ))[1],
          (array_agg(dm.merchant_key order by dm.merchant_key::text))[1]
        ) as canonical_merchant_key
      from dim_merchant dm
      where dm.uniq_merchant is not null
        and btrim(dm.uniq_merchant) <> ''
      group by dm.uniq_merchant
      having count(distinct dm.merchant_key) > 1
    )
    select
      dm.uniq_merchant,
      dm.merchant_key as old_merchant_key,
      cb.canonical_merchant_key
    from dim_merchant dm
    join canonical_by_brand cb on cb.uniq_merchant = dm.uniq_merchant
    where dm.merchant_key <> cb.canonical_merchant_key
    order by dm.uniq_merchant, dm.merchant_key
  `);

  if (preview.rows.length === 0) {
    console.log("No merchant key remap needed.");
    return;
  }

  console.table(preview.rows);

  if (!hasApplyFlag()) {
    console.log("Preview only. Re-run with --apply to update merchant_users, dim_rule, and fact_transaction.");
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`drop table if exists tmp_merchant_key_remap`);
    await tx.execute(sql`
      create temporary table tmp_merchant_key_remap as
      with merchant_with_active_user as (
        select distinct merchant_key
        from merchant_users
        where is_active = true
      ),
      canonical_by_brand as (
        select
          dm.uniq_merchant,
          coalesce(
            (array_agg(dm.merchant_key order by dm.merchant_key::text) filter (
              where dm.merchant_key in (select merchant_key from merchant_with_active_user)
            ))[1],
            (array_agg(dm.merchant_key order by dm.merchant_key::text))[1]
          ) as canonical_merchant_key
        from dim_merchant dm
        where dm.uniq_merchant is not null
          and btrim(dm.uniq_merchant) <> ''
        group by dm.uniq_merchant
        having count(distinct dm.merchant_key) > 1
      )
      select
        dm.uniq_merchant,
        dm.merchant_key as old_merchant_key,
        cb.canonical_merchant_key
      from dim_merchant dm
      join canonical_by_brand cb on cb.uniq_merchant = dm.uniq_merchant
      where dm.merchant_key <> cb.canonical_merchant_key
    `);

    await tx.execute(sql`
      insert into merchant_users (user_id, merchant_key, is_active, created_at, updated_at)
      select
        mu.user_id,
        r.canonical_merchant_key,
        bool_or(mu.is_active) as is_active,
        min(mu.created_at) as created_at,
        now() as updated_at
      from merchant_users mu
      join tmp_merchant_key_remap r on r.old_merchant_key = mu.merchant_key
      group by mu.user_id, r.canonical_merchant_key
      on conflict (user_id) do update
      set
        merchant_key = excluded.merchant_key,
        is_active = merchant_users.is_active or excluded.is_active,
        updated_at = now()
    `);

    await tx.execute(sql`
      delete from merchant_users mu
      using tmp_merchant_key_remap r
      where mu.merchant_key = r.old_merchant_key
    `);

    await tx.execute(sql`
      update dim_rule dr
      set rule_merchant = r.canonical_merchant_key
      from tmp_merchant_key_remap r
      where dr.rule_merchant = r.old_merchant_key
    `);

    await tx.execute(sql`
      update fact_transaction ft
      set merchant_key = r.canonical_merchant_key
      from tmp_merchant_key_remap r
      where ft.merchant_key = r.old_merchant_key
    `);
  });

  console.log("Merchant keys normalized to canonical merchant_key.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
