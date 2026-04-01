create table if not exists users (
  id bigserial primary key,
  email text not null unique,
  username text unique,
  password_hash text not null,
  role text not null check (role in ('merchant')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists merchant_users (
  user_id bigint primary key references users(id) on delete cascade,
  merchant_key uuid not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_key)
);

create index if not exists idx_merchant_users_merchant_key on merchant_users(merchant_key);
