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
