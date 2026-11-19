-- 0006: Cascade shares the cave-helicopter Supabase project.
--
-- Cascade's own project (wmoqxlksbunenvlyflbw) was lost in November 2026, and the free plan's
-- project limit ruled out a new one, so from 1.1.0 Cascade lives in the same project as Cave
-- Helicopter (dqiwnvfqmexpuzbwjhha, us-east-1). The two games' objects don't overlap:
-- Helicopter has public.leaderboard and public.get_rank; Cascade has the tables and functions in
-- 0001-0005. Each game signs its players in anonymously, so each player has a separate auth user
-- per game.
--
-- The one thing they do share is auth.users, and 0001's trigger gives EVERY new auth user a
-- Cascade profile. In a shared project that would mint a "Player 1234" profile for every
-- Helicopter player too. Cascade now tags its own sign-ups (signInAnonymously with
-- options.data.game = 'cascade', which lands in raw_user_meta_data), and the trigger only acts on
-- those. The tag is client-set and therefore forgeable, but forging it only earns a profile row
-- nobody can see without also posting a daily result, so it guards tidiness, not security.
--
-- Applied to the shared project together with 0001-0005, in one transaction, through
-- `supabase db query --linked --project-ref dqiwnvfqmexpuzbwjhha -f <file>`. Not through `db push`:
-- the project's migration history belongs to the Helicopter repo, and pushing from here would
-- fight over it.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'game', '') <> 'cascade' then
    return new;
  end if;

  insert into public.profiles (id, display_name, avatar_seed)
  values (
    new.id,
    'Player ' || lpad((abs(hashtext(new.id::text)) % 10000)::text, 4, '0'),
    abs(hashtext(new.id::text)) % 1000
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- create or replace keeps grants, but restate 0002's lock-down so this file stands alone.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
