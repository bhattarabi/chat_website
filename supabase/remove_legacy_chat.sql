drop policy if exists "Authenticated users view chat images" on storage.objects;
drop policy if exists "Authenticated users upload chat images" on storage.objects;

-- Supabase blocks direct deletes from storage.objects and storage.buckets.
-- Remove the chat-attachments bucket from the Storage dashboard or Storage API after this runs.

do $$
begin
  if to_regclass('public.messages') is not null then
    drop policy if exists "Participants send messages" on public.messages;
    drop policy if exists "Participants read messages" on public.messages;
    drop trigger if exists messages_touch_conversation on public.messages;
  end if;

  if to_regclass('public.conversations') is not null then
    drop policy if exists "Admins update conversations" on public.conversations;
    drop policy if exists "Customers create their conversation" on public.conversations;
    drop policy if exists "Users and admins read conversations" on public.conversations;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime drop table public.messages;
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime drop table public.conversations;
  end if;
end $$;

drop function if exists public.touch_conversation_last_message();
drop function if exists public.user_can_access_conversation(uuid, uuid);

drop table if exists public.messages;
drop table if exists public.conversations;
