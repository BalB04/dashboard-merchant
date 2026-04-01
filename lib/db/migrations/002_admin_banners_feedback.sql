-- Expand user roles to allow admin and add tables for banners + feedback.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'users'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table users drop constraint %I', constraint_name);
  end loop;
end $$;

alter table users
  add constraint users_role_check check (role in ('merchant', 'admin'));

create table if not exists provider_banners (
  id bigserial primary key,
  image_key text not null,
  title text not null,
  subtitle text not null,
  cta text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_banners_active on provider_banners(is_active);
create index if not exists idx_provider_banners_sort on provider_banners(sort_order);

create table if not exists merchant_feedback (
  id bigserial primary key,
  merchant_key uuid not null,
  user_id bigint not null references users(id) on delete cascade,
  type text not null check (type in ('report', 'critic', 'suggestion')),
  category text not null,
  title text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_merchant_feedback_merchant on merchant_feedback(merchant_key);
create index if not exists idx_merchant_feedback_user on merchant_feedback(user_id);
create index if not exists idx_merchant_feedback_status on merchant_feedback(status);
