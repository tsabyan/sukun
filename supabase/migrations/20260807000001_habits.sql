-- 011 — habits: identities, habits, habit_logs
--
-- Identity-based habit tracking, ported from the Tend prototype. Everything
-- lives in the `sukun` schema like the rest of the app. Three tables:
--
--   identities   — "who you want to become" ("A guitarist", "A writer")
--   habits       — the concrete daily proof, scheduled per weekday
--   habit_logs   — one row per (habit, day) the habit was marked done
--
-- All three follow the same local-first sync contract as tasks: user_id for
-- RLS, updated_at for last-write-wins pull, deleted_at for soft delete. Unlike
-- the Tend original, nothing is ever hard-deleted from the app — a toggled-off
-- day sets deleted_at, so it still syncs instead of vanishing silently.

create table if not exists sukun.identities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 120),
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists identities_user_updated_idx
  on sukun.identities (user_id, updated_at);

create table if not exists sukun.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  identity_id uuid not null references sukun.identities(id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 120),
  -- 0 = Sunday … 6 = Saturday. Days the habit is scheduled.
  schedule    smallint[] not null default '{0,1,2,3,4,5,6}',
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists habits_identity_idx
  on sukun.habits (identity_id) where deleted_at is null;
create index if not exists habits_user_updated_idx
  on sukun.habits (user_id, updated_at);

create table if not exists sukun.habit_logs (
  habit_id   uuid not null references sukun.habits(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- the user-local calendar day, written by the client and never recomputed
  day        date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (habit_id, day)
);

create index if not exists habit_logs_user_updated_idx
  on sukun.habit_logs (user_id, updated_at);

-- keep updated_at honest on every UPDATE (function defined in migration 001)
drop trigger if exists t_identities_updated on sukun.identities;
create trigger t_identities_updated before update on sukun.identities
  for each row execute function sukun.set_updated_at();

drop trigger if exists t_habits_updated on sukun.habits;
create trigger t_habits_updated before update on sukun.habits
  for each row execute function sukun.set_updated_at();

drop trigger if exists t_habit_logs_updated on sukun.habit_logs;
create trigger t_habit_logs_updated before update on sukun.habit_logs
  for each row execute function sukun.set_updated_at();

-- ===== RLS — the whole authorization model, same as every other table =====
alter table sukun.identities enable row level security;
alter table sukun.habits     enable row level security;
alter table sukun.habit_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['identities','habits','habit_logs']
  loop
    execute format('drop policy if exists "own rows" on sukun.%I', t);
    execute format($f$
      create policy "own rows" on sukun.%I
        for all
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- Grants: the schema's default privileges (migration 006) already cover tables
-- created here, so no explicit grant block is needed.
