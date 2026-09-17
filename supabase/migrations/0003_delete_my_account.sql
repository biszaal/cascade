-- Let a player delete their own account from inside the app.
--
-- App Store guideline 5.1.1(v): an app that creates accounts must let the player delete theirs
-- in the app, not only by emailing the developer. Every player table references auth.users with
-- on delete cascade, so removing the auth user removes the profile, progress, level results and
-- daily results with it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Supabase's default privileges grant EXECUTE to anon directly (see 0002), so revoking from
-- PUBLIC alone is not enough.
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
