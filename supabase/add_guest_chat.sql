create extension if not exists pgcrypto with schema extensions;

alter table public.conversations
alter column customer_id drop not null;

alter table public.conversations
add column if not exists guest_name text,
add column if not exists guest_email text,
add column if not exists guest_token_hash text;

drop index if exists public.conversations_guest_token_hash_idx;

create unique index conversations_guest_token_hash_idx
on public.conversations(guest_token_hash);

alter table public.conversations
drop constraint if exists conversations_customer_or_guest_check;

alter table public.conversations
add constraint conversations_customer_or_guest_check check (
  customer_id is not null
  or (
    nullif(trim(coalesce(guest_name, '')), '') is not null
    and guest_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and guest_token_hash is not null
  )
);

alter table public.messages
alter column sender_id drop not null;

alter table public.messages
add column if not exists sender_type text not null default 'user';

alter table public.messages
drop constraint if exists messages_sender_type_check;

alter table public.messages
add constraint messages_sender_type_check check (
  (sender_type = 'user' and sender_id is not null)
  or (sender_type = 'guest' and sender_id is null)
  or (sender_type = 'system' and sender_id is null)
);

create or replace function public.guest_token_hash(guest_token text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select encode(extensions.digest(guest_token, 'sha256'), 'hex');
$$;

create or replace function public.start_guest_chat(
  guest_name text,
  guest_email text,
  guest_token text
)
returns table(conversation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(guest_email));
  normalized_name text := trim(guest_name);
  token_hash text := public.guest_token_hash(guest_token);
begin
  if normalized_name = ''
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(guest_token) < 20
  then
    raise exception 'Invalid guest chat details';
  end if;

  insert into public.conversations (guest_name, guest_email, guest_token_hash)
  values (normalized_name, normalized_email, token_hash)
  on conflict (guest_token_hash) do update
  set guest_name = excluded.guest_name,
      guest_email = excluded.guest_email
  returning id into conversation_id;

  return next;
end;
$$;

create or replace function public.guest_chat_messages(
  chat_conversation_id uuid,
  guest_token text
)
returns setof public.messages
language sql
stable
security definer
set search_path = public
as $$
  select messages.*
  from public.messages
  join public.conversations
    on conversations.id = messages.conversation_id
  where messages.conversation_id = chat_conversation_id
    and conversations.guest_token_hash = public.guest_token_hash(guest_token)
    and messages.sender_type <> 'system'
  order by messages.created_at asc;
$$;

create or replace function public.guest_chat_details(
  chat_conversation_id uuid,
  guest_token text
)
returns table(
  conversation_id uuid,
  assigned_agent_id uuid,
  assigned_agent_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    conversations.id,
    conversations.assigned_admin_id,
    coalesce(nullif(profiles.full_name, ''), profiles.email)
  from public.conversations
  left join public.profiles
    on profiles.id = conversations.assigned_admin_id
  where conversations.id = chat_conversation_id
    and conversations.guest_token_hash = public.guest_token_hash(guest_token);
$$;

create or replace function public.send_guest_message(
  chat_conversation_id uuid,
  guest_token text,
  message_body text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  created_message public.messages;
begin
  if nullif(trim(coalesce(message_body, '')), '') is null then
    raise exception 'Message body is required';
  end if;

  if not exists (
    select 1
    from public.conversations
    where id = chat_conversation_id
      and guest_token_hash = public.guest_token_hash(guest_token)
  ) then
    raise exception 'Guest chat not found';
  end if;

  insert into public.messages (conversation_id, sender_id, sender_type, body)
  values (chat_conversation_id, null, 'guest', trim(message_body))
  returning * into created_message;

  return created_message;
end;
$$;

grant execute on function public.start_guest_chat(text, text, text) to anon, authenticated;
grant execute on function public.guest_chat_messages(uuid, text) to anon, authenticated;
grant execute on function public.guest_chat_details(uuid, text) to anon, authenticated;
grant execute on function public.send_guest_message(uuid, text, text) to anon, authenticated;
