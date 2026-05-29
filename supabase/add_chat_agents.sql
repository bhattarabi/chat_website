do $$
begin
  alter type public.user_role add value if not exists 'agent';
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.chat_assignment_state (
  id text primary key default 'round_robin',
  last_agent_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint chat_assignment_state_singleton check (id = 'round_robin')
);

create index if not exists conversations_assigned_admin_idx
on public.conversations(assigned_admin_id);

alter table public.messages
drop constraint if exists messages_sender_type_check;

alter table public.messages
add constraint messages_sender_type_check check (
  (sender_type = 'user' and sender_id is not null)
  or (sender_type = 'guest' and sender_id is null)
  or (sender_type = 'system' and sender_id is null)
);

drop trigger if exists chat_assignment_state_touch_updated_at on public.chat_assignment_state;
create trigger chat_assignment_state_touch_updated_at
before update on public.chat_assignment_state
for each row execute function public.touch_updated_at();

create or replace function public.log_chat_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  agent_name text;
begin
  if old.assigned_admin_id is not distinct from new.assigned_admin_id then
    return new;
  end if;

  if new.assigned_admin_id is null then
    insert into public.messages (conversation_id, sender_id, sender_type, body)
    values (new.id, null, 'system', 'Chat reassigned. Waiting for an agent.');
    return new;
  end if;

  select coalesce(nullif(full_name, ''), email)
  into agent_name
  from public.profiles
  where id = new.assigned_admin_id;

  insert into public.messages (conversation_id, sender_id, sender_type, body)
  values (
    new.id,
    null,
    'system',
    'Chat reassigned to ' || coalesce(agent_name, 'an agent') || '.'
  );

  return new;
end;
$$;

drop trigger if exists conversations_log_chat_assignment_change on public.conversations;
create trigger conversations_log_chat_assignment_change
after update of assigned_admin_id on public.conversations
for each row execute function public.log_chat_assignment_change();

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
    where id = user_id and role::text = 'agent' and disabled = false
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
    where profiles.role::text = 'agent'
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

drop trigger if exists conversations_assign_chat_agent on public.conversations;
create trigger conversations_assign_chat_agent
before insert on public.conversations
for each row execute function public.assign_next_chat_agent();

create or replace function public.current_customer_chat()
returns table(
  conversation_id uuid,
  assigned_agent_id uuid,
  assigned_agent_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  chat_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = current_user_id
      and role = 'customer'
      and disabled = false
  ) then
    raise exception 'Customer account required';
  end if;

  select conversations.id
  into chat_id
  from public.conversations
  where customer_id = current_user_id
  order by created_at asc
  limit 1;

  if chat_id is null then
    insert into public.conversations (customer_id)
    values (current_user_id)
    returning id into chat_id;
  end if;

  select
    conversations.assigned_admin_id,
    coalesce(nullif(profiles.full_name, ''), profiles.email)
  into assigned_agent_id, assigned_agent_name
  from public.conversations
  left join public.profiles
    on profiles.id = conversations.assigned_admin_id
  where conversations.id = chat_id;

  conversation_id := chat_id;
  return next;
end;
$$;

grant execute on function public.current_customer_chat() to authenticated;

alter table public.chat_assignment_state enable row level security;

drop policy if exists "Profiles are visible to self and admins" on public.profiles;
create policy "Profiles are visible to self and admins"
on public.profiles for select
to authenticated
using (public.user_can_view_profile(id, auth.uid()));

drop policy if exists "Users and admins read conversations" on public.conversations;
create policy "Users and admins read conversations"
on public.conversations for select
to authenticated
using (public.user_can_access_conversation(id, auth.uid()));

drop policy if exists "Admins manage chat assignment state" on public.chat_assignment_state;
create policy "Admins manage chat assignment state"
on public.chat_assignment_state for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

insert into public.chat_assignment_state (id)
values ('round_robin')
on conflict (id) do nothing;
