drop trigger if exists conversations_log_chat_assignment_change on public.conversations;
drop trigger if exists conversations_assign_chat_agent on public.conversations;
drop trigger if exists messages_claim_unassigned_chat_on_agent_reply on public.messages;

drop function if exists public.log_chat_assignment_change();
drop function if exists public.assign_next_chat_agent();
drop function if exists public.claim_unassigned_chat_on_agent_reply();
drop function if exists public.current_customer_chat();
drop function if exists public.ensure_customer_chat();
drop function if exists public.guest_chat_details(uuid, text);

drop policy if exists "Admins update conversations" on public.conversations;
drop policy if exists "Agents release their conversations" on public.conversations;

do $$
begin
  if to_regclass('public.chat_assignment_state') is not null then
    drop policy if exists "Admins manage chat assignment state" on public.chat_assignment_state;
  end if;
end;
$$;

drop table if exists public.chat_assignment_state;
drop index if exists conversations_assigned_admin_idx;

alter table public.conversations
drop column if exists assigned_admin_id;

create or replace function public.user_can_view_profile(profile_id uuid, user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select profile_id = user_id
    or public.is_admin(user_id)
    or public.is_chat_agent(user_id);
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
        or public.is_chat_agent(user_id)
      )
  ) or public.is_admin(user_id);
$$;

create or replace function public.current_customer_chat()
returns table(conversation_id uuid)
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
    return;
  end if;

  conversation_id := chat_id;
  return next;
end;
$$;

create or replace function public.ensure_customer_chat()
returns table(conversation_id uuid)
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

  conversation_id := chat_id;
  return next;
end;
$$;

grant execute on function public.current_customer_chat() to authenticated;
grant execute on function public.ensure_customer_chat() to authenticated;
