create table if not exists public.chat_read_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

create index if not exists chat_read_states_conversation_idx
on public.chat_read_states(conversation_id);

drop trigger if exists chat_read_states_touch_updated_at on public.chat_read_states;
create trigger chat_read_states_touch_updated_at
before update on public.chat_read_states
for each row execute function public.touch_updated_at();

alter table public.chat_read_states enable row level security;

drop policy if exists "Users manage their chat read states" on public.chat_read_states;
create policy "Users manage their chat read states"
on public.chat_read_states for all
to authenticated
using (
  user_id = auth.uid()
  and public.user_can_access_conversation(conversation_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.user_can_access_conversation(conversation_id, auth.uid())
);
