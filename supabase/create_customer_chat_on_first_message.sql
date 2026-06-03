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
    return;
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

create or replace function public.ensure_customer_chat()
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
grant execute on function public.ensure_customer_chat() to authenticated;
