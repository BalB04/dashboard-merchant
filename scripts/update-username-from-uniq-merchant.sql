-- Update users.username from dim_merchant.uniq_merchant (via merchant_users + canonical map).
-- Default behavior only fills empty usernames. Review the preview before running.

begin;

-- Preview intended changes:
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
  and btrim(dm.uniq_merchant) <> '';

-- Apply update (only when username is empty/null):
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
  and (u.username is null or btrim(u.username) = '');

commit;
