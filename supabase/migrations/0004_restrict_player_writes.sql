-- Close two write holes 0001 left open.
--
-- 0001 gave every table a matching pair of "own row" insert/update policies, on the
-- assumption that a player writing only their own row is harmless. That holds for
-- level_results, which nobody else can read. It does not hold for the two tables whose
-- contents reach other players through public.daily_leaderboard.
--
-- Anyone can hold the publishable key and sign in anonymously, so "the app never sends
-- that" is not a control - the REST endpoint is the control.

-- 1. profiles.display_name -------------------------------------------------------------
-- display_name is shown to every player on the daily leaderboard, and the client could
-- PATCH /rest/v1/profiles?id=eq.<self> to set it to anything: another player's name, abuse
-- aimed at whoever opens the board, or a megabyte of text. The app never writes this table
-- at all - handle_new_user fills it in on signup - so the client needs no write privilege
-- on it. Revoking the privilege is what stops the write; the policies are dropped because a
-- policy guarding a privilege nobody holds only reads as though the write were intended.
revoke insert, update on public.profiles from anon, authenticated;
drop policy if exists "own profile write"  on public.profiles;
drop policy if exists "own profile update" on public.profiles;

-- handle_new_user is security definer and owned by the migration role, so it keeps writing
-- profiles regardless. Belt and braces for whatever writes this next: a name that reaches
-- other people's screens gets a length it cannot exceed.
alter table public.profiles drop constraint if exists profiles_display_name_length;
-- A name may already have been set out of range - that is the hole being closed - and
-- ADD CONSTRAINT would abort the migration rather than fix it.
-- display_name is NOT NULL, so a blank one has to land back on the default rather than
-- on the NULL that trimming it would produce.
update public.profiles
   set display_name = coalesce(left(nullif(btrim(display_name), ''), 24), 'Anonymous')
 where display_name is distinct from coalesce(left(nullif(btrim(display_name), ''), 24), 'Anonymous');
alter table public.profiles
  add constraint profiles_display_name_length
  check (char_length(display_name) between 1 and 24);

-- 2. daily_results.date -----------------------------------------------------------------
-- "auth.uid() = user_id" checks who the row belongs to and nothing about which day it
-- claims. A player could therefore insert a row for any date at all - back-filling every
-- past board with moves = 1 to own the historical leaderboard, or staking out days that
-- have not happened yet. A result may now only be filed for the day it was played.
--
-- The client stamps toISOString()'s UTC date, so the bound is written against UTC rather
-- than current_date, which would follow the database's own timezone and reject every
-- submission outright if that were ever set to something else. The two clocks are still
-- read seconds apart, so yesterday stays writable to absorb a board finished on the stroke
-- of midnight - which is far short of an open date field.
drop policy if exists "own daily write"  on public.daily_results;
drop policy if exists "own daily update" on public.daily_results;

create policy "own daily write" on public.daily_results
  for insert
  with check (
    auth.uid() = user_id
    and daily_results.date between (now() at time zone 'utc')::date - 1
                               and (now() at time zone 'utc')::date
  );

create policy "own daily update" on public.daily_results
  for update
  using (
    auth.uid() = user_id
    and daily_results.date between (now() at time zone 'utc')::date - 1
                               and (now() at time zone 'utc')::date
  )
  with check (
    auth.uid() = user_id
    and daily_results.date between (now() at time zone 'utc')::date - 1
                               and (now() at time zone 'utc')::date
  );
