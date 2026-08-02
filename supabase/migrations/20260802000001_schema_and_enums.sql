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
