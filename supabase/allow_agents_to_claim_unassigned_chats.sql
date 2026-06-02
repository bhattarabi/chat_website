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
        where (assigned_admin_id is null or assigned_admin_id = user_id)
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
          (assigned_admin_id is null or assigned_admin_id = user_id)
          and public.is_chat_agent(user_id)
        )
      )
  ) or public.is_admin(user_id);
$$;

create or replace function public.claim_unassigned_chat_on_agent_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_type = 'user' and public.is_chat_agent(new.sender_id) then
    update public.conversations
    set assigned_admin_id = new.sender_id
    where id = new.conversation_id
      and assigned_admin_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_claim_unassigned_chat_on_agent_reply on public.messages;
create trigger messages_claim_unassigned_chat_on_agent_reply
before insert on public.messages
for each row execute function public.claim_unassigned_chat_on_agent_reply();

drop trigger if exists conversations_assign_chat_agent on public.conversations;

drop policy if exists "Agents release their conversations" on public.conversations;
create policy "Agents release their conversations"
on public.conversations for update
to authenticated
using (
  assigned_admin_id = auth.uid()
  and public.is_chat_agent(auth.uid())
)
with check (
  assigned_admin_id is null
  and public.is_chat_agent(auth.uid())
);
