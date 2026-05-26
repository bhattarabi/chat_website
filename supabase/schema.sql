create extension if not exists pgcrypto;

create type public.user_role as enum ('customer', 'admin');
create type public.announcement_status as enum ('draft', 'published');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text not null,
  image_url text,
  button_label text not null default 'Open',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  subject text not null default 'Support',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  image_path text,
  image_url text,
  created_at timestamptz not null default now(),
  constraint message_has_content check (
    nullif(trim(coalesce(body, '')), '') is not null or image_path is not null
  )
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status public.announcement_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index platform_links_active_sort_idx on public.platform_links(active, sort_order);
create index conversations_customer_idx on public.conversations(customer_id);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index announcements_status_created_idx on public.announcements(status, created_at desc);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger platform_links_touch_updated_at
before update on public.platform_links
for each row execute function public.touch_updated_at();

create trigger announcements_touch_updated_at
before update on public.announcements
for each row execute function public.touch_updated_at();

create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_last_message();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id and role = 'admin' and disabled = false
  );
$$;

create or replace function public.user_can_access_conversation(conversation_id uuid, user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations
    where id = conversation_id and customer_id = user_id
  ) or public.is_admin(user_id);
$$;

alter table public.profiles enable row level security;
alter table public.platform_links enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.announcements enable row level security;

create policy "Profiles are visible to self and admins"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid() and disabled = false)
with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "Admins manage profiles"
on public.profiles for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Active platform links are visible"
on public.platform_links for select
to anon, authenticated
using (active or public.is_admin(auth.uid()));

create policy "Admins manage platform links"
on public.platform_links for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Users and admins read conversations"
on public.conversations for select
to authenticated
using (customer_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Customers create their conversation"
on public.conversations for insert
to authenticated
with check (customer_id = auth.uid());

create policy "Admins update conversations"
on public.conversations for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Participants read messages"
on public.messages for select
to authenticated
using (public.user_can_access_conversation(conversation_id, auth.uid()));

create policy "Participants send messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.user_can_access_conversation(conversation_id, auth.uid())
);

create policy "Published announcements are visible"
on public.announcements for select
to authenticated
using (status = 'published' or public.is_admin(auth.uid()));

create policy "Admins manage announcements"
on public.announcements for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

insert into public.platform_links (title, description, url, image_url, button_label, sort_order)
values
  (
    'Main Game Portal',
    'Open the primary customer game platform.',
    'https://example.com/game',
    'https://images.unsplash.com/photo-1606167668584-78701c57f13d?auto=format&fit=crop&w=800&q=80',
    'Access',
    1
  ),
  (
    'Downloads',
    'Install files and setup resources.',
    'https://example.com/downloads',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    'Download',
    2
  ),
  (
    'Account Help',
    'Login and password support resources.',
    'https://example.com/help',
    'https://images.unsplash.com/photo-1611996575749-79a3a250f948?auto=format&fit=crop&w=800&q=80',
    'View',
    3
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Authenticated users upload chat images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'chat-attachments');

create policy "Authenticated users view chat images"
on storage.objects for select
to authenticated
using (bucket_id = 'chat-attachments');
