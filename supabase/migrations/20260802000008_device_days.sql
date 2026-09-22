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
