begin;

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

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages"
on public.messages for select
to authenticated
using (
  public.user_can_access_conversation(conversation_id, auth.uid())
  and (
    sender_type <> 'system'
    or public.is_admin(auth.uid())
    or public.is_chat_agent(auth.uid())
  )
);

commit;
