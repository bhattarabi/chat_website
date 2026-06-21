create table if not exists public.social_links (
  id text primary key default 'main',
  telegram_url text,
  facebook_url text,
  updated_at timestamptz not null default now(),
  constraint social_links_singleton check (id = 'main')
);

insert into public.social_links (id)
values ('main')
on conflict (id) do nothing;

alter table public.social_links enable row level security;

drop policy if exists "Social links are visible" on public.social_links;
create policy "Social links are visible"
on public.social_links for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage social links" on public.social_links;
create policy "Admins manage social links"
on public.social_links for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop trigger if exists social_links_touch_updated_at on public.social_links;
create trigger social_links_touch_updated_at
before update on public.social_links
for each row execute function public.touch_updated_at();
