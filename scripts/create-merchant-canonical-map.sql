-- Canonical merchant mapping table to group multiple merchant_key values
-- under one brand (uniq_merchant). Safe to re-run.

begin;

create table if not exists merchant_canonical_map (
  merchant_key uuid primary key,
  canonical_merchant_key uuid not null,
  uniq_merchant text not null,
  created_at timestamp without time zone default now()
);

insert into merchant_canonical_map (merchant_key, canonical_merchant_key, uniq_merchant)
select
  dm.merchant_key,
  (array_agg(dm2.merchant_key order by dm2.merchant_key::text) over (partition by dm.uniq_merchant))[1] as canonical_merchant_key,
  dm.uniq_merchant
from dim_merchant dm
join dim_merchant dm2 on dm2.uniq_merchant = dm.uniq_merchant
where dm.uniq_merchant is not null and btrim(dm.uniq_merchant) <> ''
on conflict (merchant_key) do update
set canonical_merchant_key = excluded.canonical_merchant_key,
    uniq_merchant = excluded.uniq_merchant;

commit;
