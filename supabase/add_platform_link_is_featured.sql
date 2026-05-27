alter table public.platform_links
add column if not exists is_featured boolean not null default false;

update public.platform_links
set is_featured = true
where image_url is not null;
