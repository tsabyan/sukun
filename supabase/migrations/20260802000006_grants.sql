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
