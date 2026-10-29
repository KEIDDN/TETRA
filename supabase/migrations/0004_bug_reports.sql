-- Bug reports from the game (Settings, Report a bug). Anyone can send one;
-- nobody can read them back through the API: they're read in the dashboard.
create table if not exists public.bug_reports (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  kind       text not null check (kind in ('bug', 'visual', 'idea', 'other')),
  message    text not null check (char_length(message) between 3 and 4000),
  steps      text check (steps is null or char_length(steps) <= 4000),
  contact    text check (contact is null or char_length(contact) <= 200),
  version    text check (char_length(version) <= 20),
  details    jsonb check (details is null or pg_column_size(details) < 20000)
);

alter table public.bug_reports enable row level security;

drop policy if exists "anyone reports bugs" on public.bug_reports;
create policy "anyone reports bugs" on public.bug_reports
  for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
