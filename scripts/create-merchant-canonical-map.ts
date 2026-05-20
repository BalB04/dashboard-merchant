import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";

const run = async () => {
  await db.execute(sql`
    with canonical_by_merchant as (
      select
        dm.uniq_merchant,
        (array_agg(dm.merchant_key order by dm.merchant_key::text))[1] as canonical_merchant_key
      from dim_merchant dm
      where dm.uniq_merchant is not null
        and btrim(dm.uniq_merchant) <> ''
      group by dm.uniq_merchant
    )
    insert into merchant_canonical_map (merchant_key, canonical_merchant_key, uniq_merchant)
    select
      dm.merchant_key,
      cb.canonical_merchant_key,
      dm.uniq_merchant
    from dim_merchant dm
    join canonical_by_merchant cb on cb.uniq_merchant = dm.uniq_merchant
    where dm.uniq_merchant is not null
      and btrim(dm.uniq_merchant) <> ''
    on conflict (merchant_key) do update
    set canonical_merchant_key = excluded.canonical_merchant_key,
        uniq_merchant = excluded.uniq_merchant
  `);

  console.log("merchant_canonical_map synced");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
