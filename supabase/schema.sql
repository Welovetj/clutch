create extension if not exists pgcrypto;

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_code text not null,
  placed_at timestamptz not null default now(),
  sport text not null,
  market text not null,
  odds_american integer not null,
  bet_type text not null default 'single' check (bet_type in ('single', 'parlay')),
  parlay_legs_count integer,
  combined_odds_american integer,
  stake numeric(12,2) not null,
  to_win numeric(12,2) not null,
  book text not null,
  status text not null check (status in ('won', 'lost', 'pending')),
  result numeric(12,2) not null default 0,
  opening_line integer,
  betting_line integer,
  closing_line integer,
  public_bet_pct integer,
  public_money_pct integer,
  created_at timestamptz not null default now()
);

-- Line movement migration (run if table already exists)
alter table if exists public.bets add column if not exists opening_line integer;
alter table if exists public.bets add column if not exists betting_line integer;
alter table if exists public.bets add column if not exists closing_line integer;
alter table if exists public.bets add column if not exists public_bet_pct integer;
alter table if exists public.bets add column if not exists public_money_pct integer;
alter table if exists public.bets add column if not exists bet_type text not null default 'single';
alter table if exists public.bets add column if not exists parlay_legs_count integer;
alter table if exists public.bets add column if not exists combined_odds_american integer;

create table if not exists public.bet_parlay_legs (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  market text not null,
  odds_american integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bet_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.bet_tag_links (
  bet_id uuid not null references public.bets(id) on delete cascade,
  tag_id uuid not null references public.bet_tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bet_id, tag_id)
);

create table if not exists public.ai_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('daily', 'weekly')),
  period_key text not null,
  title text not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, period_type, period_key)
);

create table if not exists public.tilt_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  conditions_met text[] not null default '{}',
  dismissed_at timestamptz
);

create table if not exists public.bankroll_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  value numeric(12,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create table if not exists public.watchlist_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  league text not null,
  name text not null,
  record text not null,
  form text[] not null default '{}',
  reliability integer not null default 50,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  mode text not null default 'default' check (mode in ('default', 'prediction')),
  content text not null,
  prediction jsonb,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.bets enable row level security;
alter table public.bankroll_snapshots enable row level security;
alter table public.watchlist_teams enable row level security;
alter table public.ai_chat_messages enable row level security;
alter table public.bet_parlay_legs enable row level security;
alter table public.bet_tags enable row level security;
alter table public.bet_tag_links enable row level security;
alter table public.ai_recaps enable row level security;
alter table public.tilt_events enable row level security;

drop policy if exists "bets_select_own" on public.bets;
drop policy if exists "bets_insert_own" on public.bets;
drop policy if exists "bets_update_own" on public.bets;
drop policy if exists "bets_delete_own" on public.bets;

create policy "bets_select_own"
  on public.bets for select
  to authenticated
  using (auth.uid() = user_id);

create policy "bets_insert_own"
  on public.bets for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "bets_update_own"
  on public.bets for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bets_delete_own"
  on public.bets for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bankroll_select_own" on public.bankroll_snapshots;
drop policy if exists "bankroll_insert_own" on public.bankroll_snapshots;
drop policy if exists "bankroll_update_own" on public.bankroll_snapshots;
drop policy if exists "bankroll_delete_own" on public.bankroll_snapshots;

create policy "bankroll_select_own"
  on public.bankroll_snapshots for select
  to authenticated
  using (auth.uid() = user_id);

create policy "bankroll_insert_own"
  on public.bankroll_snapshots for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "bankroll_update_own"
  on public.bankroll_snapshots for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bankroll_delete_own"
  on public.bankroll_snapshots for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "watchlist_select_own" on public.watchlist_teams;
drop policy if exists "watchlist_insert_own" on public.watchlist_teams;
drop policy if exists "watchlist_update_own" on public.watchlist_teams;
drop policy if exists "watchlist_delete_own" on public.watchlist_teams;

create policy "watchlist_select_own"
  on public.watchlist_teams for select
  to authenticated
  using (auth.uid() = user_id);

create policy "watchlist_insert_own"
  on public.watchlist_teams for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "watchlist_update_own"
  on public.watchlist_teams for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "watchlist_delete_own"
  on public.watchlist_teams for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "ai_chat_select_own" on public.ai_chat_messages;
drop policy if exists "ai_chat_insert_own" on public.ai_chat_messages;
drop policy if exists "ai_chat_update_own" on public.ai_chat_messages;
drop policy if exists "ai_chat_delete_own" on public.ai_chat_messages;

create policy "ai_chat_select_own"
  on public.ai_chat_messages for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_chat_insert_own"
  on public.ai_chat_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ai_chat_update_own"
  on public.ai_chat_messages for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_chat_delete_own"
  on public.ai_chat_messages for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "parlay_legs_select_own" on public.bet_parlay_legs;
drop policy if exists "parlay_legs_insert_own" on public.bet_parlay_legs;
drop policy if exists "parlay_legs_update_own" on public.bet_parlay_legs;
drop policy if exists "parlay_legs_delete_own" on public.bet_parlay_legs;

create policy "parlay_legs_select_own"
  on public.bet_parlay_legs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "parlay_legs_insert_own"
  on public.bet_parlay_legs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "parlay_legs_update_own"
  on public.bet_parlay_legs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "parlay_legs_delete_own"
  on public.bet_parlay_legs for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bet_tags_select_own" on public.bet_tags;
drop policy if exists "bet_tags_insert_own" on public.bet_tags;
drop policy if exists "bet_tags_update_own" on public.bet_tags;
drop policy if exists "bet_tags_delete_own" on public.bet_tags;

create policy "bet_tags_select_own"
  on public.bet_tags for select
  to authenticated
  using (auth.uid() = user_id);

create policy "bet_tags_insert_own"
  on public.bet_tags for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "bet_tags_update_own"
  on public.bet_tags for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bet_tags_delete_own"
  on public.bet_tags for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bet_tag_links_select_own" on public.bet_tag_links;
drop policy if exists "bet_tag_links_insert_own" on public.bet_tag_links;
drop policy if exists "bet_tag_links_update_own" on public.bet_tag_links;
drop policy if exists "bet_tag_links_delete_own" on public.bet_tag_links;

create policy "bet_tag_links_select_own"
  on public.bet_tag_links for select
  to authenticated
  using (auth.uid() = user_id);

create policy "bet_tag_links_insert_own"
  on public.bet_tag_links for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "bet_tag_links_update_own"
  on public.bet_tag_links for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bet_tag_links_delete_own"
  on public.bet_tag_links for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "ai_recaps_select_own" on public.ai_recaps;
drop policy if exists "ai_recaps_insert_own" on public.ai_recaps;
drop policy if exists "ai_recaps_update_own" on public.ai_recaps;
drop policy if exists "ai_recaps_delete_own" on public.ai_recaps;

create policy "ai_recaps_select_own"
  on public.ai_recaps for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_recaps_insert_own"
  on public.ai_recaps for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ai_recaps_update_own"
  on public.ai_recaps for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_recaps_delete_own"
  on public.ai_recaps for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "tilt_events_select_own" on public.tilt_events;
drop policy if exists "tilt_events_insert_own" on public.tilt_events;
drop policy if exists "tilt_events_update_own" on public.tilt_events;
drop policy if exists "tilt_events_delete_own" on public.tilt_events;

create policy "tilt_events_select_own"
  on public.tilt_events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "tilt_events_insert_own"
  on public.tilt_events for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "tilt_events_update_own"
  on public.tilt_events for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tilt_events_delete_own"
  on public.tilt_events for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "avatar_select_own" on storage.objects;
drop policy if exists "avatar_insert_own" on storage.objects;
drop policy if exists "avatar_update_own" on storage.objects;
drop policy if exists "avatar_delete_own" on storage.objects;

create policy "avatar_select_own"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

create policy "avatar_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

create policy "avatar_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text)
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

create policy "avatar_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
