-- Close two API holes 0001 left open.
--
-- Supabase's default privileges grant EXECUTE on every new public function to the anon and
-- authenticated roles directly. Revoking from PUBLIC, as 0001 does, therefore did not stop a
-- caller holding only the publishable key - and never signed in - from reading the daily
-- leaderboard, including every entrant's user id. Only signed-in players (anonymous sessions
-- carry the authenticated role) may read it.
revoke execute on function public.daily_leaderboard(date) from anon;
grant execute on function public.daily_leaderboard(date) to authenticated;

-- handle_new_user is a trigger function that runs as security definer. It exists to fire on
-- auth.users inserts and has no business being callable through the API by anyone. Revoking
-- EXECUTE does not affect the trigger: Postgres checks that privilege when a trigger is
-- created, not each time it fires.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
