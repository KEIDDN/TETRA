-- Keep rows to a sane size so nobody can use the database as free storage.
alter table public.player_data drop constraint if exists player_data_size;
alter table public.player_data add constraint player_data_size check (pg_column_size(data) < 1048576);
alter table public.player_data drop constraint if exists player_data_name;
alter table public.player_data add constraint player_data_name check (name is null or char_length(name) <= 40);
alter table public.scores drop constraint if exists scores_name;
alter table public.scores add constraint scores_name check (name is null or char_length(name) <= 40);
alter table public.scores drop constraint if exists scores_mode;
alter table public.scores add constraint scores_mode check (char_length(mode) <= 40);
