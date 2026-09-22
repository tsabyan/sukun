-- Ajeg — full schema, generated from supabase/migrations/*.sql

-- 20260802000001_schema_and_enums.sql
-- 001 — extensions, enums, helpers
--
-- Ajeg has its own Supabase project, so everything lives in `public`. The
-- earlier `sukun` schema existed because the database was shared with other
-- applications; a dedicated project removes that reason, and with it three
-- silent failure modes: the Exposed-schemas setting, the explicit grant block,
-- and `db: { schema }` on every client.
--
-- The trade is that `public` grants anon and authenticated broadly by default,
-- so a table created without RLS is world-readable the moment it exists. RLS
-- is the authorization model either way (005) — this just makes forgetting it
-- louder. Every new table needs `enable row level security` in the same
-- migration that creates it.
--
-- Local storage names are unaffected and stay `sukun` on purpose: the Dexie
-- database and the `sukun.*` localStorage keys are the identity of data
-- already on people's devices. See CLAUDE.md rule 12.

create extension if not exists "pgcrypto";

-- Enum types, created idempotently: `create type` has no IF NOT EXISTS, so a
-- re-run would abort the whole migration without this guard.
do $$
begin
  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'priority_level' and n.nspname = 'public') then
    create type priority_level as enum ('low', 'medium', 'high');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'task_status' and n.nspname = 'public') then
    create type task_status as enum ('active', 'completed', 'archived');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'session_mode' and n.nspname = 'public') then
    create type session_mode as enum ('focus', 'short_break', 'long_break');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'day_block' and n.nspname = 'public') then
    create type day_block as enum ('morning', 'afternoon', 'evening');
  end if;
end $$;

-- Keeps updated_at honest; the sync engine's pull step depends on it.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 20260802000002_profiles_settings.sql
-- 002 — profiles and settings

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone     text        not null default 'UTC',
  is_pro       boolean     not null default false,
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists settings (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  focus_minutes             int  not null default 25  check (focus_minutes between 1 and 180),
  short_break_minutes       int  not null default 5   check (short_break_minutes between 1 and 60),
  long_break_minutes        int  not null default 15  check (long_break_minutes between 1 and 120),
  sessions_until_long_break int  not null default 4   check (sessions_until_long_break between 2 and 12),
  auto_start_breaks         boolean not null default true,
  auto_start_focus          boolean not null default false,
  sound_id                  text    not null default 'chime',
  volume                    real    not null default 0.6 check (volume between 0 and 1),
  notifications_enabled     boolean not null default false,
  haptics_enabled           boolean not null default true,
  theme                     text    not null default 'system' check (theme in ('system','light','dark')),
  default_timer_mode        text    not null default 'ring'   check (default_timer_mode in ('ring','flip')),
  week_starts_on            int     not null default 1 check (week_starts_on between 0 and 6),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

drop trigger if exists t_profiles_updated on profiles;
create trigger t_profiles_updated before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists t_settings_updated on settings;
create trigger t_settings_updated before update on settings
  for each row execute function set_updated_at();

-- Every new auth user gets a profile and a settings row. Sign-in is always
-- deliberate here (anonymous sign-ins are disabled — doc 08 §2), so this fires
-- on the Google or magic-link upgrade, not on first run.
--
-- search_path is pinned for the same reason it is always pinned in a security
-- definer function: without it the function resolves names using the caller's
-- search_path, which is a privilege escalation waiting to happen.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  insert into settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

-- The old name from the shared-database era is dropped too, so a project that
-- ever ran the `sukun` migrations does not end up firing both.
drop trigger if exists on_auth_user_created_sukun on auth.users;
drop trigger if exists on_auth_user_created_ajeg on auth.users;
create trigger on_auth_user_created_ajeg
  after insert on auth.users
  for each row execute function handle_new_user();

-- 20260802000003_tasks.sql
-- 003 — tasks, subtasks, tags

create table if not exists tasks (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 200),
  description          text,
  icon                 text not null default 'circle-dashed',
  color                text not null default 'sage',
  category             text,
  priority             priority_level not null default 'medium',
  status               task_status    not null default 'active',
  estimated_pomodoros  int  not null default 1 check (estimated_pomodoros between 0 and 50),
  completed_pomodoros  int  not null default 0,
  due_date             date,
  planned_date         date,
  planned_block        day_block,
  planned_order        int  not null default 0,
  -- local-only in spirit, but synced so a hand-placed task stays pinned on
  -- every device rather than being re-planned by the next Auto-plan elsewhere
  planned_manually     boolean not null default false,
  recurrence           jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,
  deleted_at           timestamptz
);

create index if not exists tasks_user_status_idx
  on tasks (user_id, status) where deleted_at is null;
create index if not exists tasks_user_updated_idx
  on tasks (user_id, updated_at);
create index if not exists tasks_planned_idx
  on tasks (user_id, planned_date, planned_block, planned_order)
  where deleted_at is null;

create table if not exists subtasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references tasks(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  priority   priority_level not null default 'medium',
  is_done    boolean not null default false,
  position   int     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists subtasks_task_idx
  on subtasks (task_id, position) where deleted_at is null;
create index if not exists subtasks_user_updated_idx
  on subtasks (user_id, updated_at);

create table if not exists tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table if not exists task_tags (
  task_id    uuid not null references tasks(id) on delete cascade,
  tag_id     uuid not null references tags(id)  on delete cascade,
  user_id    uuid not null references auth.users(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, tag_id)
);

drop trigger if exists t_tasks_updated on tasks;
create trigger t_tasks_updated before update on tasks
  for each row execute function set_updated_at();

drop trigger if exists t_subtasks_updated on subtasks;
create trigger t_subtasks_updated before update on subtasks
  for each row execute function set_updated_at();

drop trigger if exists t_tags_updated on tags;
create trigger t_tags_updated before update on tags
  for each row execute function set_updated_at();

-- 20260802000004_sessions.sql
-- 004 — sessions, achievements, waitlist

create table if not exists sessions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  task_id              uuid references tasks(id) on delete set null,
  mode                 session_mode not null,
  planned_duration_sec int not null,
  actual_duration_sec  int not null check (actual_duration_sec >= 0),
  started_at           timestamptz not null,
  ended_at             timestamptz not null,
  -- The user's local calendar day, decided on the client at the moment the
  -- session started. Deriving it from started_at server-side gives the wrong
  -- day to everyone outside UTC: 23:40 in Jakarta and 07:00 in Jakarta fall on
  -- opposite sides of a UTC date boundary.
  local_date           date not null,
  completed            boolean not null default false,
  interrupted          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  check (ended_at >= started_at)
);

create index if not exists sessions_user_date_idx
  on sessions (user_id, local_date)
  where deleted_at is null and mode = 'focus';
create index if not exists sessions_user_updated_idx
  on sessions (user_id, updated_at);
create index if not exists sessions_task_idx
  on sessions (task_id) where deleted_at is null;

create table if not exists achievements (
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  email      text not null,
  source     text,
  created_at timestamptz not null default now(),
  unique (email)
);

drop trigger if exists t_sessions_updated on sessions;
create trigger t_sessions_updated before update on sessions
  for each row execute function set_updated_at();

-- 20260802000005_rls.sql
-- 005 — row level security
--
-- RLS is the entire authorization model. There is no server-side privileged
-- path in this app and the service_role key never leaves a password manager,
-- so if a policy is wrong, it is wrong for everybody.

alter table profiles     enable row level security;
alter table settings     enable row level security;
alter table tasks        enable row level security;
alter table subtasks     enable row level security;
alter table tags         enable row level security;
alter table task_tags    enable row level security;
alter table sessions     enable row level security;
alter table achievements enable row level security;
alter table waitlist     enable row level security;

-- profiles key on id; everything else on user_id
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array[
    'settings','tasks','subtasks','tags','task_tags','sessions','achievements'
  ]
  loop
    execute format('drop policy if exists "own rows" on %I', t);
    execute format($f$
      create policy "own rows" on %I
        for all
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- Waitlist is insert-only from the app. Nothing reads it back; the list is
-- read from the Supabase dashboard.
drop policy if exists "waitlist insert" on waitlist;
create policy "waitlist insert" on waitlist
  for insert
  to anon, authenticated
  with check (true);

-- 20260802000006_grants.sql
-- 006 — grants, stated explicitly
--
-- On a dedicated project everything is in `public`, which Supabase already
-- grants to the API roles out of the box. This migration is therefore mostly a
-- restatement — kept, not deleted, for two reasons.
--
-- First, it is the file that says what the grant policy *is*: broad on
-- purpose, because RLS is what restricts rows and a grant without RLS would be
-- the actual mistake. Every table created by these migrations has RLS enabled.
--
-- Second, the `alter default privileges` lines below are the lever migration
-- 009 narrows to take the metric views back off the public API. Without an
-- explicit default here, 009 would be adjusting a default it does not own.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Without these, the next table added in a later migration is unreachable
-- until someone remembers to re-run the grants above.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- 20260802000007_views.sql
-- 007 — stats views
--
-- The client computes every figure locally from IndexedDB. These exist as the
-- reference implementation that lib/stats/aggregate.ts must agree with, and
-- for dashboard queries.
--
-- security_invoker makes the view run with the querying user's rights, so it
-- inherits RLS from the base tables. Without it a view is owned by the creator
-- and happily returns everyone's rows.

create or replace view daily_focus
with (security_invoker = true) as
select
  user_id,
  local_date,
  count(*)                          as sessions,
  sum(actual_duration_sec)          as focus_seconds,
  count(*) filter (where completed) as completed_sessions
from sessions
where mode = 'focus' and deleted_at is null
group by user_id, local_date;

create or replace view weekly_focus
with (security_invoker = true) as
select
  user_id,
  date_trunc('week', local_date)::date as week_start,
  count(*)                             as sessions,
  sum(actual_duration_sec)             as focus_seconds
from sessions
where mode = 'focus' and deleted_at is null
group by user_id, date_trunc('week', local_date);

grant select on daily_focus, weekly_focus to anon, authenticated;

-- 20260802000008_device_days.sql
-- 008 — counting people who never sign in
--
-- The app is usable with no account, which is the point, and it means
-- auth.users answers the wrong question: it counts people who signed up, not
-- people who use the thing. Day-7 retention is the number the whole validation
-- plan rests on (docs/10-validation.md §1), and it has to include guests.
--
-- One row per device per local day. That single shape answers all of it:
--   total ever   count(distinct device_id)
--   new today    devices whose earliest local_date is today
--   active today count(distinct device_id) where local_date = today
--   registered   count(distinct device_id) where user_id is not null
--   retention    self-join a cohort's first day against later days
--
-- Insert-only, so no UPDATE policy exists to abuse, and the primary key makes
-- a repeat insert on the same day a harmless duplicate-key error rather than
-- something the client has to coordinate.

create table if not exists device_days (
  -- A random uuid generated on the device. Not derived from anything: no
  -- fingerprint, no IP, no account. It identifies an install, not a person.
  device_id   uuid not null,
  local_date  date not null,
  -- Set once the device has an account, so guest and registered are the same
  -- funnel rather than two disconnected numbers.
  user_id     uuid references auth.users(id) on delete set null,
  app_version text,
  created_at  timestamptz not null default now(),
  primary key (device_id, local_date)
);

create index if not exists device_days_date_idx on device_days (local_date);

alter table device_days enable row level security;

-- Insert-only from the app, exactly like the waitlist. Nothing reads this back
-- in the client; the numbers are read from the Supabase dashboard.
drop policy if exists "device heartbeat insert" on device_days;
create policy "device heartbeat insert" on device_days
  for insert
  to anon, authenticated
  with check (true);

grant insert on device_days to anon, authenticated;
grant all on device_days to service_role;

-- Convenience for the dashboard. security_invoker is deliberately NOT set:
-- these are aggregate counts with no per-user rows, read by the owner via the
-- SQL editor, and the base table has no select policy at all.
create or replace view daily_active_devices as
select
  local_date,
  count(distinct device_id)                                    as devices,
  count(distinct device_id) filter (where user_id is not null) as registered,
  count(distinct device_id) filter (where user_id is null)     as guests
from device_days
group by local_date
order by local_date desc;

create or replace view device_totals as
with first_seen as (
  select device_id, min(local_date) as joined_on, max(local_date) as last_seen,
         bool_or(user_id is not null) as has_account
  from device_days
  group by device_id
)
select
  count(*)                                    as total_devices,
  count(*) filter (where has_account)         as registered_devices,
  count(*) filter (where not has_account)     as guest_devices,
  count(*) filter (where last_seen >= current_date - 7)  as active_last_7_days,
  count(*) filter (where joined_on >= current_date - 7)  as new_last_7_days
from first_seen;

-- 20260802000009_lock_down_metric_views.sql
-- 009 — take the metric views back off the public API
--
-- Migration 006 grants broadly on purpose: RLS is what restricts rows, and a
-- grant without RLS would be the mistake. That reasoning holds for tables. It
-- does NOT hold for these two views.
--
-- `daily_active_devices` and `device_totals` aggregate over device_days, which
-- has no SELECT policy at all. A plain view runs with its owner's privileges,
-- so the view sails past that and returns the counts to anyone — and the anon
-- key is public by design, sitting in the client bundle. Verified: an anon
-- request returned total_devices, guests and daily actives.
--
-- No user data leaks, but how many people use the product is not something to
-- hand out with the JavaScript. These are dashboard numbers; the dashboard and
-- the SQL editor run as service_role or postgres, neither of which is affected
-- by this.
--
-- security_invoker is not the fix here. It would make the view obey RLS, and
-- since device_days has no SELECT policy the answer would always be zero rows.
-- The view is meant to be privileged; it just should not be public.

revoke all on daily_active_devices from anon, authenticated;
revoke all on device_totals       from anon, authenticated;

grant select on daily_active_devices to service_role;
grant select on device_totals       to service_role;

-- Migration 006's default privileges would re-grant these to anon on any view
-- added later, so narrow them to tables only from here on. Existing grants are
-- untouched; daily_focus and weekly_focus keep theirs and stay safe, because
-- they are security_invoker and therefore return only the caller's own rows.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- 20260802000010_exclude_dev_from_metrics.sql
-- 010 — keep development out of the launch numbers
--
-- Every local run, E2E pass and Lighthouse audit loads the app, and the app
-- writes a heartbeat. Those rows are indistinguishable from real installs
-- until something marks them, which is how the first reading of
-- device_totals ended up counting the person who built it.
--
-- The client now tags non-production builds `-dev` (lib/db/repo.ts). These
-- views drop them. The rows are deliberately kept rather than blocked at
-- insert: a dev heartbeat arriving is proof the whole path works, which is
-- worth more than a perfectly clean table.

create or replace view daily_active_devices as
select
  local_date,
  count(distinct device_id)                                    as devices,
  count(distinct device_id) filter (where user_id is not null) as registered,
  count(distinct device_id) filter (where user_id is null)     as guests
from device_days
where app_version is null or app_version not like '%-dev'
group by local_date
order by local_date desc;

create or replace view device_totals as
with first_seen as (
  select device_id,
         min(local_date) as joined_on,
         max(local_date) as last_seen,
         bool_or(user_id is not null) as has_account
  from device_days
  where app_version is null or app_version not like '%-dev'
  group by device_id
)
select
  count(*)                                              as total_devices,
  count(*) filter (where has_account)                   as registered_devices,
  count(*) filter (where not has_account)               as guest_devices,
  count(*) filter (where last_seen >= current_date - 7) as active_last_7_days,
  count(*) filter (where joined_on >= current_date - 7) as new_last_7_days
from first_seen;

-- create or replace preserves the grants from 009, but state it so a future
-- reader does not have to check.
revoke all on daily_active_devices from anon, authenticated;
revoke all on device_totals       from anon, authenticated;
grant select on daily_active_devices to service_role;
grant select on device_totals       to service_role;

-- 20260807000001_habits.sql
-- 011 — habits: identities, habits, habit_logs
--
-- Identity-based habit tracking, ported from the Tend prototype. Three tables:
--
--   identities   — "who you want to become" ("A guitarist", "A writer")
--   habits       — the concrete daily proof, scheduled per weekday
--   habit_logs   — one row per (habit, day) the habit was marked done
--
-- All three follow the same local-first sync contract as tasks: user_id for
-- RLS, updated_at for last-write-wins pull, deleted_at for soft delete. Unlike
-- the Tend original, nothing is ever hard-deleted from the app — a toggled-off
-- day sets deleted_at, so it still syncs instead of vanishing silently.

create table if not exists identities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 120),
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists identities_user_updated_idx
  on identities (user_id, updated_at);

create table if not exists habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  identity_id uuid not null references identities(id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 120),
  -- 0 = Sunday … 6 = Saturday. Days the habit is scheduled.
  schedule    smallint[] not null default '{0,1,2,3,4,5,6}',
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists habits_identity_idx
  on habits (identity_id) where deleted_at is null;
create index if not exists habits_user_updated_idx
  on habits (user_id, updated_at);

create table if not exists habit_logs (
  habit_id   uuid not null references habits(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- the user-local calendar day, written by the client and never recomputed
  day        date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (habit_id, day)
);

create index if not exists habit_logs_user_updated_idx
  on habit_logs (user_id, updated_at);

-- keep updated_at honest on every UPDATE (function defined in migration 001)
drop trigger if exists t_identities_updated on identities;
create trigger t_identities_updated before update on identities
  for each row execute function set_updated_at();

drop trigger if exists t_habits_updated on habits;
create trigger t_habits_updated before update on habits
  for each row execute function set_updated_at();

drop trigger if exists t_habit_logs_updated on habit_logs;
create trigger t_habit_logs_updated before update on habit_logs
  for each row execute function set_updated_at();

-- ===== RLS — the whole authorization model, same as every other table =====
alter table identities enable row level security;
alter table habits     enable row level security;
alter table habit_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['identities','habits','habit_logs']
  loop
    execute format('drop policy if exists "own rows" on %I', t);
    execute format($f$
      create policy "own rows" on %I
        for all
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- Grants: the schema's default privileges (migration 006) already cover tables
-- created here, so no explicit grant block is needed.

-- 20260922000001_harden_anon_inserts.sql
-- 012 — constrain the two tables anyone can write to
--
-- `waitlist` and `device_days` are the only tables with an INSERT policy for
-- `anon`, and both policies are `with check (true)` because the writer has no
-- account to key on. That is the correct shape — and it also means anybody
-- with the anon key (which ships in the JavaScript, by design) can insert
-- whatever they like into either one.
--
-- Nothing leaks: neither table has a SELECT policy, and neither carries data
-- belonging to another user. What is at risk is the *numbers*. Day-7 retention
-- is the figure the whole day-30 decision rests on (docs/10-validation.md §1),
-- and a stranger with curl could manufacture it — thousands of device ids,
-- backdated across a month, and the dashboard reads like a hit.
--
-- Column constraints are the only defence available here: a policy cannot rate
-- limit, and an edge function in front of an insert is a server this app
-- deliberately does not have. These do not stop a determined attacker. They
-- stop a bored one, and they stop the accidental garbage that is far likelier.

/* ------------------------------------------------------------- waitlist */

do $$
begin
  -- Shape only. A full RFC 5322 regex is a famous waste of time; this rejects
  -- the things that are obviously not an address and caps the length at the
  -- documented maximum for one.
  if not exists (select 1 from pg_constraint where conname = 'waitlist_email_shape') then
    alter table waitlist add constraint waitlist_email_shape
      check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
             and length(email) between 6 and 254);
  end if;

  -- The app sends one of a fixed set. Anything else is not this app writing.
  if not exists (select 1 from pg_constraint where conname = 'waitlist_source_known') then
    alter table waitlist add constraint waitlist_source_known
      check (source is null or source in ('upsell', 'settings', 'onboarding', 'pro_gate'));
  end if;
end $$;

/* --------------------------------------------------------- device_days */

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'device_days_version_len') then
    alter table device_days add constraint device_days_version_len
      check (app_version is null or length(app_version) <= 32);
  end if;
end $$;

-- The date window is a trigger, not a check constraint. It is written once and
-- reused by device_events (migration 013), which has the same exposure.
--
-- `current_date` is STABLE, not IMMUTABLE. Postgres accepts it inside a CHECK
-- and then the constraint means something different every day — which is fine
-- while rows are being inserted and wrong the moment a dump is restored, where
-- every historical row is re-validated against today. The rule belongs at
-- insert time, so it is written at insert time.
--
-- This is the line that matters for metric integrity: without it, a month of
-- retention history can be fabricated in one INSERT. With it, faking a 30-day
-- cohort means showing up for 30 days.
create or replace function enforce_recent_local_date()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- The past is given room because the outbox holds heartbeats for however
  -- long a device stays offline. The future gets one day, for a device whose
  -- clock runs ahead of the server's.
  if new.local_date < current_date - 30 or new.local_date > current_date + 1 then
    raise exception '%.local_date % is outside the accepted window',
      tg_table_name, new.local_date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists t_device_days_window on device_days;
create trigger t_device_days_window
  before insert on device_days
  for each row execute function enforce_recent_local_date();

-- 20260922000002_device_events.sql
-- 013 — measuring use, not opens
--
-- `device_days` answers "how many people opened the app". It cannot answer
-- "how many people used it", and that is the question the whole validation
-- plan turns on: a guest's sessions live in IndexedDB and never leave the
-- device, so `sessions` only ever describes the minority who signed in.
--
-- This table closes that gap without an analytics vendor and without a new
-- dependency. One row per (device, day, event, occurrence). Event *names*
-- only: no task titles, no notes, no tag names, no durations that could
-- identify a person's routine. CLAUDE.md rule 10.
--
-- Insert-only, exactly like device_days and waitlist — there is no UPDATE
-- policy to abuse, and `seq` (a per-day counter the client keeps in its own
-- meta table) makes a retried push a harmless duplicate-key error rather than
-- a double count.

create table if not exists device_events (
  -- Same random install id as device_days, so the two join. Not a fingerprint.
  device_id   uuid not null,
  local_date  date not null,
  event       text not null,
  -- 1 for the first occurrence of that event on that day, 2 for the second.
  -- Capped: nobody completes 200 pomodoros in a day, and the cap is what stops
  -- one device writing unbounded rows.
  seq         smallint not null default 1,
  user_id     uuid references auth.users(id) on delete set null,
  app_version text,
  created_at  timestamptz not null default now(),

  primary key (device_id, local_date, event, seq),

  -- An allowlist rather than free text. It documents the vocabulary in the one
  -- place that can enforce it, and a typo in the client fails loudly instead of
  -- quietly creating a ninth event nobody queries.
  constraint device_events_known check (event in (
    'app_opened',
    'onboarding_done',
    'task_created',
    'task_completed',
    'session_started',
    'session_completed',
    'session_skipped',
    'autoplan_run',
    'habit_checked',
    'flip_entered',
    'pro_gate_hit',
    'waitlist_submitted',
    'account_linked',
    'pwa_installed'
  )),
  constraint device_events_seq_range check (seq between 1 and 200),
  constraint device_events_version_len check (app_version is null or length(app_version) <= 32)
);

create index if not exists device_events_date_idx  on device_events (local_date);
create index if not exists device_events_event_idx on device_events (event, local_date);

alter table device_events enable row level security;

drop policy if exists "device event insert" on device_events;
create policy "device event insert" on device_events
  for insert
  to anon, authenticated
  with check (true);

-- Same reasoning as migration 012: the window belongs at insert time, and a
-- CHECK containing current_date would re-validate history on every restore.
drop trigger if exists t_device_events_window on device_events;
create trigger t_device_events_window
  before insert on device_events
  for each row execute function enforce_recent_local_date();

grant insert on device_events to anon, authenticated;
grant all    on device_events to service_role;

/* ------------------------------------------------------------- the views */
--
-- Dashboard only. Like the device_days views these are deliberately NOT
-- security_invoker — they are privileged aggregates over a table with no
-- SELECT policy — and like them they are revoked from anon at the bottom of
-- this file. Migration 009 is the story of what happens when that is forgotten.
--
-- Every view filters `-dev` builds, for the reason in migration 010.

-- Funnel 1 from docs/10-validation.md §3. Read the columns left to right; the
-- step where the number falls off a cliff is the screen that is broken.
create or replace view activation_funnel as
select
  count(distinct device_id)                                            as opened,
  count(distinct device_id) filter (where event = 'onboarding_done')   as onboarded,
  count(distinct device_id) filter (where event = 'task_created')      as created_a_task,
  count(distinct device_id) filter (where event = 'session_started')   as started_a_session,
  count(distinct device_id) filter (where event = 'session_completed') as completed_a_session,
  count(distinct device_id) filter (where event = 'pwa_installed')     as installed_to_home_screen,
  count(distinct device_id) filter (where event = 'account_linked')    as signed_in,
  count(distinct device_id) filter (where event = 'autoplan_run')      as ran_autoplan,
  count(distinct device_id) filter (where event = 'flip_entered')      as used_flip_mode,
  count(distinct device_id) filter (where event = 'pro_gate_hit')      as hit_the_pro_gate,
  count(distinct device_id) filter (where event = 'waitlist_submitted') as joined_waitlist
from device_events
where app_version is null or app_version not like '%-dev';

-- One row per install. `activated` is the honest definition of "actually used
-- it": a focus phase run to its end, not an open and not a start.
create or replace view device_engagement as
with ev as (
  select * from device_events
  where app_version is null or app_version not like '%-dev'
),
first_seen as (
  select device_id, min(local_date) as first_day from ev group by device_id
),
done as (
  select device_id, local_date, count(*) as sessions
  from ev where event = 'session_completed'
  group by device_id, local_date
)
select
  f.device_id,
  f.first_day,
  coalesce(sum(d.sessions), 0)                                              as sessions_completed,
  count(d.local_date)                                                        as days_with_a_session,
  max(d.local_date)                                                          as last_session_on,
  coalesce(sum(d.sessions) filter (where d.local_date <= f.first_day + 7), 0) as sessions_first_week,
  coalesce(sum(d.sessions), 0) > 0                                           as activated,
  coalesce(sum(d.sessions) filter (where d.local_date <= f.first_day + 7), 0) >= 3 as engaged
from first_seen f
left join done d on d.device_id = f.device_id
group by f.device_id, f.first_day;

-- THE number — docs/10-validation.md §1. Of the devices that completed a
-- session on some day, how many completed another one in the seven days after.
--
-- Cohorts newer than seven days are still filling up; read them as incomplete
-- rather than as a drop.
create or replace view retention_d7 as
with ev as (
  select * from device_events
  where app_version is null or app_version not like '%-dev'
),
activated as (
  select device_id, min(local_date) as activated_on
  from ev where event = 'session_completed'
  group by device_id
),
marked as (
  select
    a.device_id,
    a.activated_on,
    exists (
      select 1 from ev e
      where e.device_id = a.device_id
        and e.event = 'session_completed'
        and e.local_date between a.activated_on + 1 and a.activated_on + 7
    ) as returned
  from activated a
)
select
  activated_on                                   as cohort,
  count(*)                                       as activated_devices,
  count(*) filter (where returned)               as returned_within_7d,
  round(100.0 * count(*) filter (where returned) / nullif(count(*), 0), 1) as pct,
  activated_on + 7 <= current_date               as cohort_complete
from marked
group by activated_on
order by activated_on desc;

-- Raw counts per day, for when a funnel number looks wrong and you want to see
-- what actually arrived.
create or replace view daily_events as
select local_date, event, count(*) as occurrences, count(distinct device_id) as devices
from device_events
where app_version is null or app_version not like '%-dev'
group by local_date, event
order by local_date desc, occurrences desc;

revoke all on activation_funnel  from anon, authenticated;
revoke all on device_engagement  from anon, authenticated;
revoke all on retention_d7       from anon, authenticated;
revoke all on daily_events       from anon, authenticated;

grant select on activation_funnel, device_engagement, retention_d7, daily_events
  to service_role;
