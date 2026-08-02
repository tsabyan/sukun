# 03 — Database

Supabase Postgres. Every table is user-scoped and protected by RLS. Run these as migrations in order.

## Conventions

- Primary keys are `uuid`, **generated on the client** so IndexedDB and Postgres share IDs.
- Every row carries `user_id uuid not null` referencing `auth.users`.
- Every table has `created_at`, `updated_at`, `deleted_at` (soft delete).
- `updated_at` is maintained by a trigger — the sync engine relies on it.
- Timestamps are `timestamptz`. Convert to local time in the client only.
- Local-day boundaries for stats use the user's stored IANA timezone, not the server's.

---

## Migration 001 — extensions, enums, helpers

```sql
create extension if not exists "pgcrypto";

create type priority_level as enum ('low', 'medium', 'high');
create type task_status    as enum ('active', 'completed', 'archived');
create type session_mode   as enum ('focus', 'short_break', 'long_break');
create type day_block      as enum ('morning', 'afternoon', 'evening');

-- keeps updated_at honest for the sync engine
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

---

## Migration 002 — profiles & settings

```sql
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone     text        not null default 'UTC',
  is_pro       boolean     not null default false,
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table settings (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  focus_minutes            int  not null default 25  check (focus_minutes between 1 and 180),
  short_break_minutes      int  not null default 5   check (short_break_minutes between 1 and 60),
  long_break_minutes       int  not null default 15  check (long_break_minutes between 1 and 120),
  sessions_until_long_break int not null default 4   check (sessions_until_long_break between 2 and 12),
  auto_start_breaks        boolean not null default true,
  auto_start_focus         boolean not null default false,
  sound_id                 text    not null default 'chime',
  volume                   real    not null default 0.6 check (volume between 0 and 1),
  notifications_enabled    boolean not null default false,
  haptics_enabled          boolean not null default true,
  theme                    text    not null default 'system' check (theme in ('system','light','dark')),
  default_timer_mode       text    not null default 'ring'   check (default_timer_mode in ('ring','flip')),
  week_starts_on           int     not null default 1 check (week_starts_on between 0 and 6),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger t_profiles_updated before update on profiles
  for each row execute function set_updated_at();
create trigger t_settings_updated before update on settings
  for each row execute function set_updated_at();

-- every new auth user (including anonymous) gets a profile + default settings
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  insert into settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

---

## Migration 003 — tasks, subtasks, tags

```sql
create table tasks (
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
  recurrence           jsonb,          -- { freq:'weekly', days:[1,2,3,4,5] } | null
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,
  deleted_at           timestamptz
);

create index tasks_user_status_idx  on tasks (user_id, status) where deleted_at is null;
create index tasks_user_updated_idx on tasks (user_id, updated_at);
create index tasks_planned_idx      on tasks (user_id, planned_date, planned_block, planned_order)
  where deleted_at is null;

create table subtasks (
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

create index subtasks_task_idx on subtasks (task_id, position) where deleted_at is null;
create index subtasks_user_updated_idx on subtasks (user_id, updated_at);

create table tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table task_tags (
  task_id    uuid not null references tasks(id) on delete cascade,
  tag_id     uuid not null references tags(id)  on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, tag_id)
);

create trigger t_tasks_updated    before update on tasks    for each row execute function set_updated_at();
create trigger t_subtasks_updated before update on subtasks for each row execute function set_updated_at();
create trigger t_tags_updated     before update on tags     for each row execute function set_updated_at();
```

---

## Migration 004 — sessions & achievements

```sql
create table sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  task_id             uuid references tasks(id) on delete set null,
  mode                session_mode not null,
  planned_duration_sec int not null,
  actual_duration_sec  int not null check (actual_duration_sec >= 0),
  started_at          timestamptz not null,
  ended_at            timestamptz not null,
  local_date          date not null,   -- user-local calendar day; drives every stat
  completed           boolean not null default false,  -- ran to zero
  interrupted         boolean not null default false,  -- skipped or reset early
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (ended_at >= started_at)
);

create index sessions_user_date_idx on sessions (user_id, local_date)
  where deleted_at is null and mode = 'focus';
create index sessions_user_updated_idx on sessions (user_id, updated_at);
create index sessions_task_idx on sessions (task_id) where deleted_at is null;

create table achievements (
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,           -- catalog lives in app code
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table waitlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  email      text not null,
  source     text,                     -- 'task_cap' | 'settings' | 'onboarding'
  created_at timestamptz not null default now(),
  unique (email)
);

create trigger t_sessions_updated before update on sessions
  for each row execute function set_updated_at();
```

**Why `local_date` is a stored column:** a session started 23:40 Jakarta time is 16:40 UTC the *same* day, but a session started 07:00 Jakarta is 00:00 UTC — the previous day. Deriving the calendar day from `started_at` server-side gives wrong heatmaps and wrong streaks for anyone outside UTC. The client already knows the user's local day; it writes it down.

---

## Migration 005 — RLS

```sql
alter table profiles     enable row level security;
alter table settings     enable row level security;
alter table tasks        enable row level security;
alter table subtasks     enable row level security;
alter table tags         enable row level security;
alter table task_tags    enable row level security;
alter table sessions     enable row level security;
alter table achievements enable row level security;
alter table waitlist     enable row level security;

-- profiles keys on id, everything else on user_id
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['settings','tasks','subtasks','tags','task_tags','sessions','achievements']
  loop
    execute format($f$
      create policy "own rows" on %I
        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- waitlist: insert-only, no reads from the client
create policy "waitlist insert" on waitlist
  for insert with check (true);
```

Read the waitlist from the Supabase dashboard, never from the app.

**Client path.** `repo.joinWaitlist()` queues the row through the ordinary outbox, so a signup made offline still lands in Postgres when sync first runs. The email is also written to `meta.waitlistEmail` so the app knows not to ask twice. There is no local `waitlist` table — nothing reads it back.

**Pushed with a plain insert, never an upsert.** PostgREST implements upsert as `insert … on conflict do update`, which requires an UPDATE policy as well as an INSERT one. Waitlist has only INSERT, on purpose, so an upsert fails with `42501 violates row-level security` — a message that points at the policy rather than at the operation, and costs an hour to read correctly. The sync engine inserts, and treats `23505` (duplicate email) as success: that address is already on the list, which is the state we wanted.

---

## Migration 006 — stats views

The client computes stats locally from IndexedDB. These views exist for the dashboard, for a future server-rendered share card, and as the reference implementation the client aggregation must match.

```sql
create or replace view daily_focus as
select
  user_id,
  local_date,
  count(*)                                   as sessions,
  sum(actual_duration_sec)                   as focus_seconds,
  count(*) filter (where completed)          as completed_sessions
from sessions
where mode = 'focus' and deleted_at is null
group by user_id, local_date;

create or replace view weekly_focus as
select
  user_id,
  date_trunc('week', local_date)::date       as week_start,
  count(*)                                   as sessions,
  sum(actual_duration_sec)                   as focus_seconds
from sessions
where mode = 'focus' and deleted_at is null
group by user_id, date_trunc('week', local_date);
```

Views inherit RLS from their base tables when created by a non-superuser role. Verify with `select * from daily_focus` as an authenticated user before trusting it.

### Streak definition (must match `lib/stats/aggregate.ts` exactly)

- A day **counts** if it has at least one focus session with `completed = true`.
- **Current streak** = consecutive counting days ending today *or* yesterday. Ending yesterday still counts — the day isn't over, and punishing someone at 00:01 is exactly the anxious-app behavior this product avoids.
- **Longest streak** = longest consecutive run in all history.
- Gaps are calendar days in the user's timezone. No grace days, no freezes.

---

## Local mirror (Dexie)

The IndexedDB schema mirrors Postgres one-to-one, plus two local-only tables.

```ts
// src/lib/db/schema.ts
db.version(1).stores({
  tasks:        'id, status, plannedDate, updatedAt, completedAt, [status+plannedDate]',
  subtasks:     'id, taskId, updatedAt, [taskId+position]',
  tags:         'id, name, updatedAt',
  taskTags:     '[taskId+tagId], taskId, tagId',
  sessions:     'id, localDate, taskId, updatedAt, [mode+localDate]',
  achievements: 'key, unlockedAt',
  settings:     'userId',
  // local only:
  outbox:       'id, table, createdAt',
  meta:         'key',           // lastPulledAt per table, timer runtime, device id
})
```

Two properties of IndexedDB shape this, and both differ from the Postgres side:

- **Index names are camelCase**, matching the stored objects. Dexie indexes property names, and the rows written here are camelCase all the way through — snake_case only exists on the Postgres side of `lib/sync/mappers.ts`.
- **`deletedAt` is not indexed.** IndexedDB cannot index `null`, so a row with `deletedAt: null` is simply absent from that index, which makes "where deletedAt is null" impossible to express as a range query. Live rows are the overwhelming majority, so the repo filters them in JS instead.

`meta` holds the live timer runtime (§3 of [02-architecture.md](02-architecture.md)) so a reload mid-session restores the countdown exactly. It never syncs — a running timer is device-local.

**Adding a settings field later.** IndexedDB stores objects, not columns, so a row written before a field existed simply lacks it — and `undefined` reaching a toggle renders an uncontrolled input. `ensureSettings()` therefore merges `DEFAULT_SETTINGS` under whatever is stored and writes the filled row back once. Add the Postgres column with a `not null default` to match, and nothing else is needed.
