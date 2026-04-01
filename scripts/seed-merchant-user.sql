-- Run after creating tables in lib/db/migrations/001_auth_tables.sql
-- Replace placeholders before execution.
-- Use canonical merchant_key (one key per brand/uniq_merchant).

insert into users (email, username, password_hash, role, is_active)
values (
  'merchant.larissamlg@example.com',
  'larissa mlg',
  '42357226da794c4a9aa8e9cd70abf2c1:def290eddd501e07ead4ebbd60f19dcbce2da34c39f1f156fd7a48b7f3f7353f0e6611716697a850305cac6d0e9e8a00e6745e23543c1520296779c445c7178f
',
  'merchant',
  true
)
on conflict (email)
  do update set
    username = excluded.username,
    password_hash = excluded.password_hash,
    role = excluded.role,
    is_active = true,
    updated_at = now();

insert into merchant_users (user_id, merchant_key, is_active)
select u.id, 'c670d687-2b27-5382-8888-57db91d31f68'::uuid, true
from users u
where u.email = 'merchant.larissamlg@example.com'
on conflict (user_id)
do update set
  merchant_key = excluded.merchant_key,
  is_active = true,
  updated_at = now();
