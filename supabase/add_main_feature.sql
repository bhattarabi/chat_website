create table if not exists public.main_feature (
  id text primary key default 'main',
  image_url text,
  link_url text,
  updated_at timestamptz not null default now(),
  constraint main_feature_singleton check (id = 'main')
);

insert into public.main_feature (id)
values ('main')
on conflict (id) do nothing;

alter table public.main_feature enable row level security;

drop policy if exists "Main feature is visible" on public.main_feature;
create policy "Main feature is visible"
on public.main_feature for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage main feature" on public.main_feature;
create policy "Admins manage main feature"
on public.main_feature for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop trigger if exists main_feature_touch_updated_at on public.main_feature;
create trigger main_feature_touch_updated_at
before update on public.main_feature
for each row execute function public.touch_updated_at();
