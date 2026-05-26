create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  subject text not null default 'Support',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
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

create index if not exists conversations_customer_idx
on public.conversations(customer_id);

create index if not exists messages_conversation_created_idx
on public.messages(conversation_id, created_at);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

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

drop trigger if exists messages_touch_conversation on public.messages;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_last_message();

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

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Users and admins read conversations" on public.conversations;
drop policy if exists "Customers create their conversation" on public.conversations;
drop policy if exists "Admins update conversations" on public.conversations;
drop policy if exists "Participants read messages" on public.messages;
drop policy if exists "Participants send messages" on public.messages;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users upload chat images" on storage.objects;
drop policy if exists "Authenticated users view chat images" on storage.objects;

create policy "Authenticated users upload chat images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'chat-attachments');

create policy "Authenticated users view chat images"
on storage.objects for select
to authenticated
using (bucket_id = 'chat-attachments');
