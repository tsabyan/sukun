-- 001 — extensions, enums, helpers
--
-- Ajeg has its own Supabase project, so everything lives in `public`. The
-- earlier `sukun` schema existed because the database was shared with other
-- applications; a dedicated project removes that reason, and with it three
-- silent failure modes: the Exposed-schemas setting, the explicit grant block,
-- and `db: { schema }` on every client.
--
-- The trade is that `public` grants anon and authenticated broadly by default,
-- so a table created without RLS is world-readable the moment it exists. RLS
-- is the authorization model either way (005) — this just makes forgetting it
-- louder. Every new table needs `enable row level security` in the same
-- migration that creates it.
--
-- Local storage names are unaffected and stay `sukun` on purpose: the Dexie
-- database and the `sukun.*` localStorage keys are the identity of data
-- already on people's devices. See CLAUDE.md rule 12.

create extension if not exists "pgcrypto";

-- Enum types, created idempotently: `create type` has no IF NOT EXISTS, so a
-- re-run would abort the whole migration without this guard.
do $$
begin
  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'priority_level' and n.nspname = 'public') then
    create type priority_level as enum ('low', 'medium', 'high');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'task_status' and n.nspname = 'public') then
    create type task_status as enum ('active', 'completed', 'archived');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'session_mode' and n.nspname = 'public') then
    create type session_mode as enum ('focus', 'short_break', 'long_break');
  end if;

  if not exists (select 1 from pg_type t
                 join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'day_block' and n.nspname = 'public') then
    create type day_block as enum ('morning', 'afternoon', 'evening');
  end if;
end $$;

-- Keeps updated_at honest; the sync engine's pull step depends on it.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
