create extension if not exists pgcrypto;

create type public.user_role as enum ('customer', 'agent', 'admin');
create type public.announcement_status as enum ('draft', 'published');
create type public.promotional_email_status as enum ('draft', 'sending', 'sent', 'failed');

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
  is_featured boolean not null default false,
  button_label text not null default 'Open',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete cascade,
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  guest_name text,
  guest_email text,
  guest_token_hash text,
  subject text not null default 'Support',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_customer_or_guest_check check (
    customer_id is not null
    or (
      nullif(trim(coalesce(guest_name, '')), '') is not null
      and guest_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and guest_token_hash is not null
    )
  )
);

create table public.chat_assignment_state (
  id text primary key default 'round_robin',
  last_agent_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint chat_assignment_state_singleton check (id = 'round_robin')
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  sender_type text not null default 'user',
  body text,
  image_path text,
  image_url text,
  created_at timestamptz not null default now(),
  constraint messages_sender_type_check check (
    (sender_type = 'user' and sender_id is not null)
    or (sender_type = 'guest' and sender_id is null)
  ),
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

create table public.promo_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  phone text,
  unsubscribe_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.promotional_emails (
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

create table public.promotional_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  promotional_email_id uuid not null references public.promotional_emails(id) on delete cascade,
  subscriber_id uuid references public.promo_subscribers(id) on delete set null,
  email text not null,
  provider_message_id text,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now()
);

create table public.main_feature (
  id text primary key default 'main',
  image_url text,
  link_url text,
  updated_at timestamptz not null default now(),
  constraint main_feature_singleton check (id = 'main')
);

create index profiles_role_idx on public.profiles(role);
create index platform_links_active_sort_idx on public.platform_links(active, sort_order);
create index conversations_assigned_admin_idx on public.conversations(assigned_admin_id);
create index conversations_customer_idx on public.conversations(customer_id);
create unique index conversations_guest_token_hash_idx
on public.conversations(guest_token_hash);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index announcements_status_created_idx on public.announcements(status, created_at desc);
create index promo_subscribers_active_idx on public.promo_subscribers(unsubscribed_at, subscribed_at desc);
create index promotional_emails_created_idx on public.promotional_emails(created_at desc);
create index promotional_email_deliveries_campaign_idx on public.promotional_email_deliveries(promotional_email_id);

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

create trigger chat_assignment_state_touch_updated_at
before update on public.chat_assignment_state
for each row execute function public.touch_updated_at();

create trigger platform_links_touch_updated_at
before update on public.platform_links
for each row execute function public.touch_updated_at();

create trigger announcements_touch_updated_at
before update on public.announcements
for each row execute function public.touch_updated_at();

create trigger promo_subscribers_touch_updated_at
before update on public.promo_subscribers
for each row execute function public.touch_updated_at();

create trigger promotional_emails_touch_updated_at
before update on public.promotional_emails
for each row execute function public.touch_updated_at();

create trigger main_feature_touch_updated_at
before update on public.main_feature
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

create or replace function public.is_chat_agent(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id and role = 'agent' and disabled = false
  );
$$;

create or replace function public.user_can_view_profile(profile_id uuid, user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select profile_id = user_id
    or public.is_admin(user_id)
    or (
      public.is_chat_agent(user_id)
      and exists (
        select 1
        from public.conversations
        where assigned_admin_id = user_id
          and (customer_id = profile_id or assigned_admin_id = profile_id)
      )
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
    where id = conversation_id
      and (
        customer_id = user_id
        or (
          assigned_admin_id = user_id
          and public.is_chat_agent(user_id)
        )
      )
  ) or public.is_admin(user_id);
$$;

create or replace function public.assign_next_chat_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_agent_id uuid;
begin
  if new.assigned_admin_id is not null then
    return new;
  end if;

  insert into public.chat_assignment_state (id)
  values ('round_robin')
  on conflict (id) do nothing;

  perform 1
  from public.chat_assignment_state
  where id = 'round_robin'
  for update;

  with active_agents as (
    select
      profiles.id,
      row_number() over (order by profiles.created_at, profiles.id) as position
    from public.profiles
    where profiles.role = 'agent'
      and profiles.disabled = false
  ),
  last_position as (
    select coalesce(
      (
        select active_agents.position
        from active_agents
        join public.chat_assignment_state
          on chat_assignment_state.last_agent_id = active_agents.id
        where chat_assignment_state.id = 'round_robin'
      ),
      0
    ) as position
  )
  select active_agents.id
  into next_agent_id
  from active_agents, last_position
  order by
    case when active_agents.position > last_position.position then 0 else 1 end,
    active_agents.position
  limit 1;

  if next_agent_id is not null then
    new.assigned_admin_id = next_agent_id;

    update public.chat_assignment_state
    set last_agent_id = next_agent_id
    where id = 'round_robin';
  end if;

  return new;
end;
$$;

create trigger conversations_assign_chat_agent
before insert on public.conversations
for each row execute function public.assign_next_chat_agent();

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
  order by messages.created_at asc;
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

alter table public.profiles enable row level security;
alter table public.chat_assignment_state enable row level security;
alter table public.platform_links enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.announcements enable row level security;
alter table public.promo_subscribers enable row level security;
alter table public.promotional_emails enable row level security;
alter table public.promotional_email_deliveries enable row level security;
alter table public.main_feature enable row level security;

create policy "Profiles are visible to self and admins"
on public.profiles for select
to authenticated
using (public.user_can_view_profile(id, auth.uid()));

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
using (active);

create policy "Admins manage platform links"
on public.platform_links for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Users and admins read conversations"
on public.conversations for select
to authenticated
using (public.user_can_access_conversation(id, auth.uid()));

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
  and sender_type = 'user'
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

create policy "Visitors subscribe to promos"
on public.promo_subscribers for insert
to anon, authenticated
with check (email = lower(email) and unsubscribed_at is null);

create policy "Admins manage promo subscribers"
on public.promo_subscribers for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Admins manage promotional emails"
on public.promotional_emails for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Admins manage promotional deliveries"
on public.promotional_email_deliveries for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Main feature is visible"
on public.main_feature for select
to anon, authenticated
using (true);

create policy "Admins manage main feature"
on public.main_feature for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Admins manage chat assignment state"
on public.chat_assignment_state for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant execute on function public.start_guest_chat(text, text, text) to anon, authenticated;
grant execute on function public.guest_chat_messages(uuid, text) to anon, authenticated;
grant execute on function public.send_guest_message(uuid, text, text) to anon, authenticated;

insert into public.main_feature (id)
values ('main');

insert into public.chat_assignment_state (id)
values ('round_robin');

insert into public.platform_links (title, description, url, image_url, is_featured, button_label, sort_order)
values
  (
    'Main Game Portal',
    'Open the primary customer game platform.',
    'https://example.com/game',
    'https://images.unsplash.com/photo-1606167668584-78701c57f13d?auto=format&fit=crop&w=800&q=80',
    true,
    'Access',
    1
  ),
  (
    'Downloads',
    'Install files and setup resources.',
    'https://example.com/downloads',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    true,
    'Download',
    2
  ),
  (
    'Account Help',
    'Login and password support resources.',
    'https://example.com/help',
    'https://images.unsplash.com/photo-1611996575749-79a3a250f948?auto=format&fit=crop&w=800&q=80',
    true,
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
