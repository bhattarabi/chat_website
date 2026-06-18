create table if not exists public.game_room_rules (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_room_rules_category_check check (category in ('redemption', 'payment')),
  constraint game_room_rules_category_body_key unique (category, body)
);

create index if not exists game_room_rules_category_sort_idx
on public.game_room_rules(category, sort_order);

alter table public.game_room_rules enable row level security;

drop policy if exists "Game room rules are visible" on public.game_room_rules;
create policy "Game room rules are visible"
on public.game_room_rules for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage game room rules" on public.game_room_rules;
create policy "Admins manage game room rules"
on public.game_room_rules for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop trigger if exists game_room_rules_touch_updated_at on public.game_room_rules;
create trigger game_room_rules_touch_updated_at
before update on public.game_room_rules
for each row execute function public.touch_updated_at();

insert into public.game_room_rules (category, body, sort_order)
values
  ('redemption', 'Live Agent 24/7', 0),
  ('redemption', 'Redeem Hours 12pm- 11pm Eastern Time Zone', 1),
  ('redemption', '$500 max per day / until your balance is fully redeemed, (personal or business)', 2),
  ('redemption', '2 Redeems allowed per day', 3),
  ('redemption', '$Minimum redeem is $50', 4),
  ('payment', 'Cashapp,', 0),
  ('payment', 'Venmo,', 1),
  ('payment', 'Paypal,', 2),
  ('payment', 'Chime', 3),
  ('payment', 'Apple Pay', 4),
  ('payment', 'BinPay (Accept major, Debit & Credit Cards)', 5),
  ('payment', 'Pandora (Accept Gpay, Min $20)', 6)
on conflict (category, body) do nothing;
