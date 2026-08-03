-- Sukun — full schema, generated from supabase/migrations/*.sql
-- Paste into the Supabase SQL editor and run once. Idempotent.

-- ============================================================
-- 20260802000001_schema_and_enums.sql
-- ============================================================
-- 001 — the sukun schema, extensions, enums, helpers
--
-- Everything this app owns lives in its own schema. The project's database is
-- shared with other applications, so `public` is not ours to take: an app that
-- scatters tables called "tasks" and "sessions" across a shared public schema
-- will collide with a neighbour eventually, and the collision surfaces as a
-- confusing RLS failure rather than an obvious error.
--
-- Consequences of not being in `public`, all handled below or in doc 08:
--   1. PostgREST does not expose the schema until it is listed in
--      Settings → API → Exposed schemas. Without that, every query 404s.
--   2. Supabase's default grants only cover `public`, so usage and table
--      privileges have to be granted explicitly — including default
--      privileges, or the next table added is invisible to the API.
--   3. The client must be created with `db: { schema: 'sukun' }`.

create schema if not exists sukun;

create extension if not exists "pgcrypto";

-- Enums live in the app's schema too, so a neighbouring app can define its own
-- `priority_level` without a fight.
do $$
begin
  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'priority_level' and n.nspname = 'sukun') then
    create type sukun.priority_level as enum ('low', 'medium', 'high');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'task_status' and n.nspname = 'sukun') then
    create type sukun.task_status as enum ('active', 'completed', 'archived');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'session_mode' and n.nspname = 'sukun') then
    create type sukun.session_mode as enum ('focus', 'short_break', 'long_break');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'day_block' and n.nspname = 'sukun') then
    create type sukun.day_block as enum ('morning', 'afternoon', 'evening');
  end if;
end $$;

-- Keeps updated_at honest; the sync engine's pull step depends on it.
create or replace function sukun.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 20260802000002_profiles_settings.sql
-- ============================================================
-- 002 — profiles and settings

create table if not exists sukun.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone     text        not null default 'UTC',
  is_pro       boolean     not null default false,
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists sukun.settings (
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

drop trigger if exists t_profiles_updated on sukun.profiles;
create trigger t_profiles_updated before update on sukun.profiles
  for each row execute function sukun.set_updated_at();

drop trigger if exists t_settings_updated on sukun.settings;
create trigger t_settings_updated before update on sukun.settings
  for each row execute function sukun.set_updated_at();

-- Every new auth user gets a profile and a settings row — including anonymous
-- ones, which is the whole point: an anonymous user is a real auth.uid() and
-- owns real rows from their first second.
--
-- search_path is pinned to sukun for the same reason it is always pinned in a
-- security definer function: without it the function resolves names using the
-- caller's search_path, which is a privilege escalation waiting to happen.
create or replace function sukun.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = sukun, pg_temp
as $$
begin
  insert into sukun.profiles (id) values (new.id) on conflict do nothing;
  insert into sukun.settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

-- Named for this app: a shared database may carry other on_auth_user_created
-- triggers, and Postgres allows several on the same table.
drop trigger if exists on_auth_user_created_sukun on auth.users;
create trigger on_auth_user_created_sukun
  after insert on auth.users
  for each row execute function sukun.handle_new_user();

-- ============================================================
-- 20260802000003_tasks.sql
-- ============================================================
-- 003 — tasks, subtasks, tags

create table if not exists sukun.tasks (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 200),
  description          text,
  icon                 text not null default 'circle-dashed',
  color                text not null default 'sage',
  category             text,
  priority             sukun.priority_level not null default 'medium',
  status               sukun.task_status    not null default 'active',
  estimated_pomodoros  int  not null default 1 check (estimated_pomodoros between 0 and 50),
  completed_pomodoros  int  not null default 0,
  due_date             date,
  planned_date         date,
  planned_block        sukun.day_block,
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
  on sukun.tasks (user_id, status) where deleted_at is null;
create index if not exists tasks_user_updated_idx
  on sukun.tasks (user_id, updated_at);
create index if not exists tasks_planned_idx
  on sukun.tasks (user_id, planned_date, planned_block, planned_order)
  where deleted_at is null;

create table if not exists sukun.subtasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references sukun.tasks(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  priority   sukun.priority_level not null default 'medium',
  is_done    boolean not null default false,
  position   int     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists subtasks_task_idx
  on sukun.subtasks (task_id, position) where deleted_at is null;
create index if not exists subtasks_user_updated_idx
  on sukun.subtasks (user_id, updated_at);

create table if not exists sukun.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table if not exists sukun.task_tags (
  task_id    uuid not null references sukun.tasks(id) on delete cascade,
  tag_id     uuid not null references sukun.tags(id)  on delete cascade,
  user_id    uuid not null references auth.users(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, tag_id)
);

drop trigger if exists t_tasks_updated on sukun.tasks;
create trigger t_tasks_updated before update on sukun.tasks
  for each row execute function sukun.set_updated_at();

drop trigger if exists t_subtasks_updated on sukun.subtasks;
create trigger t_subtasks_updated before update on sukun.subtasks
  for each row execute function sukun.set_updated_at();

drop trigger if exists t_tags_updated on sukun.tags;
create trigger t_tags_updated before update on sukun.tags
  for each row execute function sukun.set_updated_at();

-- ============================================================
-- 20260802000004_sessions.sql
-- ============================================================
-- 004 — sessions, achievements, waitlist

create table if not exists sukun.sessions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  task_id              uuid references sukun.tasks(id) on delete set null,
  mode                 sukun.session_mode not null,
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
  on sukun.sessions (user_id, local_date)
  where deleted_at is null and mode = 'focus';
create index if not exists sessions_user_updated_idx
  on sukun.sessions (user_id, updated_at);
create index if not exists sessions_task_idx
  on sukun.sessions (task_id) where deleted_at is null;

create table if not exists sukun.achievements (
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists sukun.waitlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  email      text not null,
  source     text,
  created_at timestamptz not null default now(),
  unique (email)
);

drop trigger if exists t_sessions_updated on sukun.sessions;
create trigger t_sessions_updated before update on sukun.sessions
  for each row execute function sukun.set_updated_at();

-- ============================================================
-- 20260802000005_rls.sql
-- ============================================================
-- 005 — row level security
--
-- RLS is the entire authorization model. There is no server-side privileged
-- path in this app and the service_role key never leaves a password manager,
-- so if a policy is wrong, it is wrong for everybody.

alter table sukun.profiles     enable row level security;
alter table sukun.settings     enable row level security;
alter table sukun.tasks        enable row level security;
alter table sukun.subtasks     enable row level security;
alter table sukun.tags         enable row level security;
alter table sukun.task_tags    enable row level security;
alter table sukun.sessions     enable row level security;
alter table sukun.achievements enable row level security;
alter table sukun.waitlist     enable row level security;

-- profiles key on id; everything else on user_id
drop policy if exists "own profile" on sukun.profiles;
create policy "own profile" on sukun.profiles
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

-- Waitlist is insert-only from the app. Nothing reads it back; the list is
-- read from the Supabase dashboard.
drop policy if exists "waitlist insert" on sukun.waitlist;
create policy "waitlist insert" on sukun.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- ============================================================
-- 20260802000006_grants.sql
-- ============================================================
-- 006 — grants for a non-public schema
--
-- Supabase's out-of-the-box grants only cover `public`. A table in any other
-- schema is invisible to PostgREST until usage and table privileges are handed
-- to the API roles explicitly — the symptom is a 404 or "permission denied for
-- schema", which reads nothing like a missing grant.
--
-- These are broad on purpose: RLS is what restricts rows, and a GRANT without
-- RLS would be the actual mistake. Every table above has RLS enabled.

grant usage on schema sukun to anon, authenticated, service_role;

grant all on all tables    in schema sukun to anon, authenticated, service_role;
grant all on all routines  in schema sukun to anon, authenticated, service_role;
grant all on all sequences in schema sukun to anon, authenticated, service_role;

-- Without these, the next table added in a later migration is unreachable
-- until someone remembers to re-run the grants above.
alter default privileges in schema sukun
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema sukun
  grant all on routines to anon, authenticated, service_role;
alter default privileges in schema sukun
  grant all on sequences to anon, authenticated, service_role;

-- ============================================================
-- 20260802000007_views.sql
-- ============================================================
-- 007 — stats views
--
-- The client computes every figure locally from IndexedDB. These exist as the
-- reference implementation that lib/stats/aggregate.ts must agree with, and
-- for dashboard queries.
--
-- security_invoker makes the view run with the querying user's rights, so it
-- inherits RLS from the base tables. Without it a view is owned by the creator
-- and happily returns everyone's rows.

create or replace view sukun.daily_focus
with (security_invoker = true) as
select
  user_id,
  local_date,
  count(*)                          as sessions,
  sum(actual_duration_sec)          as focus_seconds,
  count(*) filter (where completed) as completed_sessions
from sukun.sessions
where mode = 'focus' and deleted_at is null
group by user_id, local_date;

create or replace view sukun.weekly_focus
with (security_invoker = true) as
select
  user_id,
  date_trunc('week', local_date)::date as week_start,
  count(*)                             as sessions,
  sum(actual_duration_sec)             as focus_seconds
from sukun.sessions
where mode = 'focus' and deleted_at is null
group by user_id, date_trunc('week', local_date);

grant select on sukun.daily_focus, sukun.weekly_focus to anon, authenticated;

-- ============================================================
-- 20260802000008_device_days.sql
-- ============================================================
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

create table if not exists sukun.device_days (
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

create index if not exists device_days_date_idx on sukun.device_days (local_date);

alter table sukun.device_days enable row level security;

-- Insert-only from the app, exactly like the waitlist. Nothing reads this back
-- in the client; the numbers are read from the Supabase dashboard.
drop policy if exists "device heartbeat insert" on sukun.device_days;
create policy "device heartbeat insert" on sukun.device_days
  for insert
  to anon, authenticated
  with check (true);

grant insert on sukun.device_days to anon, authenticated;
grant all on sukun.device_days to service_role;

-- Convenience for the dashboard. security_invoker is deliberately NOT set:
-- these are aggregate counts with no per-user rows, read by the owner via the
-- SQL editor, and the base table has no select policy at all.
create or replace view sukun.daily_active_devices as
select
  local_date,
  count(distinct device_id)                                    as devices,
  count(distinct device_id) filter (where user_id is not null) as registered,
  count(distinct device_id) filter (where user_id is null)     as guests
from sukun.device_days
group by local_date
order by local_date desc;

create or replace view sukun.device_totals as
with first_seen as (
  select device_id, min(local_date) as joined_on, max(local_date) as last_seen,
         bool_or(user_id is not null) as has_account
  from sukun.device_days
  group by device_id
)
select
  count(*)                                    as total_devices,
  count(*) filter (where has_account)         as registered_devices,
  count(*) filter (where not has_account)     as guest_devices,
  count(*) filter (where last_seen >= current_date - 7)  as active_last_7_days,
  count(*) filter (where joined_on >= current_date - 7)  as new_last_7_days
from first_seen;

