-- Take public.progress off the API.
--
-- 0001 created this table as a cloud mirror of the chapter, star total and hint count, but
-- the app has never read or written it: sync goes through level_results, and hints are a
-- per-device courtesy that was never meant to follow a player between phones. Nothing
-- reaches it except the REST endpoint, where any anonymous session could fill its own row
-- with whatever it liked. A table nobody uses should not be a place anyone can write.
--
-- The table and its rows stay. delete_my_account still clears them through the cascade from
-- auth.users, which does not go through these privileges. RLS stays enabled with no
-- policies left, so a grant restored by mistake still returns nothing: whatever uses this
-- table next has to write its policies deliberately.
revoke all on public.progress from anon, authenticated;
drop policy if exists "own progress read"   on public.progress;
drop policy if exists "own progress write"  on public.progress;
drop policy if exists "own progress update" on public.progress;
