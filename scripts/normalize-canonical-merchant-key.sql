-- Canonical merchant_key normalization using dim_merchant.uniq_merchant
--
-- Goal:
-- - Keep authentication/session logic unchanged (single session.merchant_key).
-- - Ensure each merchant brand (uniq_merchant) uses one canonical merchant_key.
-- - Remap transactional/rule/auth mapping tables to the canonical merchant_key.
--
-- Run this script manually in PostgreSQL after reviewing the preview section.
-- It is safe to run multiple times.

begin;

-- 1) Build remap set: old_key -> canonical_key for brands that currently have >1 merchant_key.
drop table if exists tmp_merchant_key_remap;
create temporary table tmp_merchant_key_remap as
with merchant_with_active_user as (
  select distinct mu.merchant_key
  from merchant_users mu
  where mu.is_active = true
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
where dm.merchant_key <> cb.canonical_merchant_key;

-- Optional preview (execute standalone before commit if you want to inspect details):
-- select * from tmp_merchant_key_remap order by uniq_merchant, old_merchant_key;

-- 2) merchant_users:
-- Insert canonical mapping for any user currently mapped to an old key, then remove old-key rows.
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
on conflict (user_id, merchant_key) do update
set
  is_active = merchant_users.is_active or excluded.is_active,
  updated_at = now();

delete from merchant_users mu
using tmp_merchant_key_remap r
where mu.merchant_key = r.old_merchant_key;

-- 3) dim_rule:
update dim_rule dr
set rule_merchant = r.canonical_merchant_key
from tmp_merchant_key_remap r
where dr.rule_merchant = r.old_merchant_key;

-- 4) fact_transaction:
update fact_transaction ft
set merchant_key = r.canonical_merchant_key
from tmp_merchant_key_remap r
where ft.merchant_key = r.old_merchant_key;

commit;

-- Post-migration verification (run after commit):
--
-- A) No brand should have >1 key in active reporting tables:
-- select dm.uniq_merchant, count(distinct dr.rule_merchant) as key_count
-- from dim_rule dr
-- join dim_merchant dm on dm.merchant_key = dr.rule_merchant
-- group by dm.uniq_merchant
-- having count(distinct dr.rule_merchant) > 1;
--
-- select dm.uniq_merchant, count(distinct ft.merchant_key) as key_count
-- from fact_transaction ft
-- join dim_merchant dm on dm.merchant_key = ft.merchant_key
-- group by dm.uniq_merchant
-- having count(distinct ft.merchant_key) > 1;
--
-- B) merchant_users should use canonical keys only:
-- select mu.*
-- from merchant_users mu
-- join tmp_merchant_key_remap r on r.old_merchant_key = mu.merchant_key;
