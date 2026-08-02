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
