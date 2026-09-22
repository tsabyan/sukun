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
