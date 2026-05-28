create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'promotional_email_status') then
    create type public.promotional_email_status as enum ('draft', 'sending', 'sent', 'failed');
  end if;
end $$;

create table if not exists public.promo_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  phone text,
  unsubscribe_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.promotional_emails (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  status public.promotional_email_status not null default 'draft',
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  send_error text,
  created_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotional_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  promotional_email_id uuid not null references public.promotional_emails(id) on delete cascade,
  subscriber_id uuid references public.promo_subscribers(id) on delete set null,
  email text not null,
  provider_message_id text,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists promo_subscribers_active_idx
on public.promo_subscribers(unsubscribed_at, subscribed_at desc);

create index if not exists promotional_emails_created_idx
on public.promotional_emails(created_at desc);

create index if not exists promotional_email_deliveries_campaign_idx
on public.promotional_email_deliveries(promotional_email_id);

drop trigger if exists promo_subscribers_touch_updated_at on public.promo_subscribers;
create trigger promo_subscribers_touch_updated_at
before update on public.promo_subscribers
for each row execute function public.touch_updated_at();

drop trigger if exists promotional_emails_touch_updated_at on public.promotional_emails;
create trigger promotional_emails_touch_updated_at
before update on public.promotional_emails
for each row execute function public.touch_updated_at();

alter table public.promo_subscribers enable row level security;
alter table public.promotional_emails enable row level security;
alter table public.promotional_email_deliveries enable row level security;

create or replace function public.subscribe_promo(subscriber_email text, subscriber_phone text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(subscriber_email));
begin
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return false;
  end if;

  insert into public.promo_subscribers (email, phone, unsubscribed_at)
  values (normalized_email, nullif(trim(subscriber_phone), ''), null)
  on conflict (email) do update
  set phone = coalesce(excluded.phone, public.promo_subscribers.phone),
      unsubscribed_at = null;

  return true;
end;
$$;

create or replace function public.unsubscribe_promo(token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  update public.promo_subscribers
  set unsubscribed_at = coalesce(unsubscribed_at, now())
  where unsubscribe_token = token;

  get diagnostics changed_count = row_count;
  return changed_count > 0;
end;
$$;

drop policy if exists "Visitors subscribe to promos" on public.promo_subscribers;
create policy "Visitors subscribe to promos"
on public.promo_subscribers for insert
to anon, authenticated
with check (email = lower(email) and unsubscribed_at is null);

drop policy if exists "Admins manage promo subscribers" on public.promo_subscribers;
create policy "Admins manage promo subscribers"
on public.promo_subscribers for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins manage promotional emails" on public.promotional_emails;
create policy "Admins manage promotional emails"
on public.promotional_emails for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins manage promotional deliveries" on public.promotional_email_deliveries;
create policy "Admins manage promotional deliveries"
on public.promotional_email_deliveries for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
