-- Goti: initial schema.
--
-- Local storage on the device is the source of truth. Everything here is a mirror that
-- makes progress survive a reinstall and makes the daily leaderboard possible. Players
-- sign in anonymously, so a row here is never tied to an email address.

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null default 'Anonymous',
  avatar_seed  int         not null default 0,
  country      text,
  created_at   timestamptz not null default now()
);

create table if not exists public.progress (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  chapter         int         not null default 1,
  highest_level   int         not null default 1,
  total_stars     int         not null default 0,
  hints_remaining int         not null default 5,
  hints_reset_at  date        not null default current_date,
  updated_at      timestamptz not null default now()
);

create table if not exists public.level_results (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  level_id     int         not null,
  best_moves   int         not null check (best_moves > 0),
  stars        int         not null check (stars between 0 and 3),
  best_time_ms bigint      not null check (best_time_ms >= 0),
  completed_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

create index if not exists level_results_user_idx on public.level_results (user_id);

-- There is deliberately no daily_challenges table. The day's board is derived from the
-- UTC date by the same seed function on every device, so the puzzle needs no server round
-- trip and works offline. Storing it here would be a second source of truth for something
-- already deterministic.

create table if not exists public.daily_results (
  date      date        not null,
  user_id   uuid        not null references auth.users (id) on delete cascade,
  moves     int         not null check (moves > 0),
  time_ms   bigint      not null check (time_ms >= 0),
  solved_at timestamptz not null default now(),
  primary key (date, user_id)
);

-- Fewest moves wins; time breaks the tie. Matches the ordering the leaderboard uses.
create index if not exists daily_results_ranking_idx
  on public.daily_results (date, moves asc, time_ms asc);

-- Row level security ------------------------------------------------------------------
-- Every table is locked to the owning user. Nothing here lets one player read another's
-- rows; the leaderboard is served by the security definer function below instead, which
-- is the single audited place that returns anyone else's data.

alter table public.profiles        enable row level security;
alter table public.progress        enable row level security;
alter table public.level_results   enable row level security;
alter table public.daily_results   enable row level security;

create policy "own profile read"   on public.profiles      for select using (auth.uid() = id);
create policy "own profile write"  on public.profiles      for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles      for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "own progress read"   on public.progress     for select using (auth.uid() = user_id);
create policy "own progress write"  on public.progress     for insert with check (auth.uid() = user_id);
create policy "own progress update" on public.progress     for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own results read"   on public.level_results for select using (auth.uid() = user_id);
create policy "own results write"  on public.level_results for insert with check (auth.uid() = user_id);
create policy "own results update" on public.level_results for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own daily read"   on public.daily_results   for select using (auth.uid() = user_id);
create policy "own daily write"  on public.daily_results   for insert with check (auth.uid() = user_id);
create policy "own daily update" on public.daily_results   for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Give every new user a profile row so the leaderboard always has a name to show.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Leaderboard -------------------------------------------------------------------------
-- Security definer so it can read across users, with a fixed search_path and a hard row
-- cap. This is deliberately the only way anyone reads another player's result.
create or replace function public.daily_leaderboard(for_date date)
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
  from public.daily_results r
  left join public.profiles p on p.id = r.user_id
  where r.date = for_date
  order by r.moves asc, r.time_ms asc
  limit 100;
$$;

revoke all on function public.daily_leaderboard(date) from public;
grant execute on function public.daily_leaderboard(date) to authenticated;
