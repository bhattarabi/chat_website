drop index if exists public.platform_links_active_sort_idx;

alter table public.platform_links
  drop column if exists description,
  drop column if exists button_label,
  drop column if exists is_featured,
  drop column if exists sort_order;

create index if not exists platform_links_active_idx
on public.platform_links(active);
