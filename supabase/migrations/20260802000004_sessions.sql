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
