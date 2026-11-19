-- 0007: Prefix every Cascade object with cascade_, so it cannot collide with another game.
--
-- Since 0006 the cave-helicopter project hosts Cascade too, and both games keep their objects in
-- the public schema. Names like profiles, progress or delete_my_account are exactly what a second
-- game reaches for when it grows accounts or in-app deletion, and a clash there would either fail
-- that game's migration or, worse, quietly reuse Cascade's object. Index and constraint names are
-- unique per schema, not per table, so those are renamed too (renaming a primary-key or unique
-- constraint renames its index with it).
--
-- Renamed rather than recreated: policies, grants, RLS and checks follow a table through a rename,
-- so the audited state of 0002-0005 carries over untouched. Function bodies do not - they are
-- stored as text and resolved when run - so the two that name a table are rewritten below.
--
-- Applied while the tables were empty: no released build had talked to this project yet.

-- Tables ---------------------------------------------------------------------------------------
alter table public.profiles      rename to cascade_profiles;
alter table public.progress      rename to cascade_progress;
alter table public.level_results rename to cascade_level_results;
alter table public.daily_results rename to cascade_daily_results;

-- Constraints (primary keys rename their index) ----------------------------------------------
alter table public.cascade_profiles rename constraint profiles_pkey                to cascade_profiles_pkey;
alter table public.cascade_profiles rename constraint profiles_id_fkey             to cascade_profiles_id_fkey;
alter table public.cascade_profiles rename constraint profiles_display_name_length to cascade_profiles_display_name_length;

alter table public.cascade_progress rename constraint progress_pkey         to cascade_progress_pkey;
alter table public.cascade_progress rename constraint progress_user_id_fkey to cascade_progress_user_id_fkey;

alter table public.cascade_level_results rename constraint level_results_pkey              to cascade_level_results_pkey;
alter table public.cascade_level_results rename constraint level_results_user_id_fkey      to cascade_level_results_user_id_fkey;
alter table public.cascade_level_results rename constraint level_results_best_moves_check   to cascade_level_results_best_moves_check;
alter table public.cascade_level_results rename constraint level_results_best_time_ms_check to cascade_level_results_best_time_ms_check;
alter table public.cascade_level_results rename constraint level_results_stars_check        to cascade_level_results_stars_check;

alter table public.cascade_daily_results rename constraint daily_results_pkey          to cascade_daily_results_pkey;
alter table public.cascade_daily_results rename constraint daily_results_user_id_fkey  to cascade_daily_results_user_id_fkey;
alter table public.cascade_daily_results rename constraint daily_results_moves_check   to cascade_daily_results_moves_check;
alter table public.cascade_daily_results rename constraint daily_results_time_ms_check to cascade_daily_results_time_ms_check;

-- Plain indexes ------------------------------------------------------------------------------
alter index public.level_results_user_idx    rename to cascade_level_results_user_idx;
alter index public.daily_results_ranking_idx rename to cascade_daily_results_ranking_idx;

-- Functions ----------------------------------------------------------------------------------
alter function public.handle_new_user()          rename to cascade_handle_new_user;
alter function public.delete_my_account()        rename to cascade_delete_my_account;
alter function public.daily_leaderboard(date)    rename to cascade_daily_leaderboard;

-- Bodies that name a table. create or replace keeps the grants; they are restated anyway so the
-- intended privileges are readable here without walking back through 0002-0005.
create or replace function public.cascade_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only players Cascade signed in (0006); the project's other games share auth.users.
  if coalesce(new.raw_user_meta_data ->> 'game', '') <> 'cascade' then
    return new;
  end if;

  insert into public.cascade_profiles (id, display_name, avatar_seed)
  values (
    new.id,
    'Player ' || lpad((abs(hashtext(new.id::text)) % 10000)::text, 4, '0'),
    abs(hashtext(new.id::text)) % 1000
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.cascade_daily_leaderboard(for_date date)
returns table (rank bigint, user_id uuid, display_name text, moves int, time_ms bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    row_number() over (order by r.moves asc, r.time_ms asc) as rank,
    r.user_id,
    coalesce(p.display_name, 'Anonymous') as display_name,
    r.moves,
    r.time_ms
  from public.cascade_daily_results r
  left join public.cascade_profiles p on p.id = r.user_id
  where r.date = for_date
  order by r.moves asc, r.time_ms asc
  limit 100;
$$;

revoke execute on function public.cascade_handle_new_user()         from public, anon, authenticated;
revoke execute on function public.cascade_daily_leaderboard(date)   from public, anon;
grant  execute on function public.cascade_daily_leaderboard(date)   to authenticated;
revoke execute on function public.cascade_delete_my_account()       from public, anon;
grant  execute on function public.cascade_delete_my_account()       to authenticated;

-- Trigger on the shared auth.users -----------------------------------------------------------
-- Trigger names are unique per table, and auth.users is the one table every game shares.
-- ALTER TRIGGER ... RENAME needs ownership of auth.users, which Supabase keeps for itself
-- ("must be owner of table users"); dropping and creating a trigger there is permitted.
drop trigger if exists on_auth_user_created on auth.users;
create trigger cascade_on_auth_user_created
  after insert on auth.users
  for each row execute function public.cascade_handle_new_user();
