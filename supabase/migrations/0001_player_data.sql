-- TETRA accounts: one row per player with everything they keep
-- (name, level, XP, playtime, records, history, trophies, settings).
-- Run once in Supabase → SQL Editor.

create table if not exists public.player_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_data enable row level security;

drop policy if exists "read own data" on public.player_data;
create policy "read own data" on public.player_data
  for select using (auth.uid() = user_id);

drop policy if exists "insert own data" on public.player_data;
create policy "insert own data" on public.player_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own data" on public.player_data;
create policy "update own data" on public.player_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Prepared for leaderboards (not used by the app yet).
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text,
  mode       text not null,
  value      double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists scores_mode_value on public.scores (mode, value);

alter table public.scores enable row level security;

drop policy if exists "anyone reads scores" on public.scores;
create policy "anyone reads scores" on public.scores
  for select using (true);

drop policy if exists "insert own scores" on public.scores;
create policy "insert own scores" on public.scores
  for insert with check (auth.uid() = user_id);
