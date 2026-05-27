grant select on public.platform_links to anon, authenticated;

drop policy if exists "Active platform links are visible" on public.platform_links;

create policy "Active platform links are visible"
on public.platform_links for select
to anon, authenticated
using (active);
