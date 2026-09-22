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
