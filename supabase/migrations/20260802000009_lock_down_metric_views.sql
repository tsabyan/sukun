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
