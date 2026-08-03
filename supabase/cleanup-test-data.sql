-- Removes the rows created while verifying the schema.
--
-- NOT a migration. Run it once, by hand, in the SQL editor, and then only if
-- the app has never been deployed — every statement below assumes the only
-- data in the database is test data. After launch, delete by app_version or
-- by explicit id instead.
--
-- Run section 1 first and read the output. Nothing here is reversible.

-- ============================================================
-- 1. LOOK BEFORE DELETING
-- ============================================================

select 'device_days' as table, count(*) as rows from sukun.device_days
union all select 'waitlist', count(*) from sukun.waitlist
union all select 'tasks', count(*) from sukun.tasks
union all select 'sessions', count(*) from sukun.sessions
union all select 'subtasks', count(*) from sukun.subtasks
union all select 'tags', count(*) from sukun.tags
union all select 'achievements', count(*) from sukun.achievements
union all select 'profiles', count(*) from sukun.profiles
union all select 'anonymous auth users',
       count(*) from auth.users where email is null;

-- Anything with a real email address is NOT test data. Expect zero rows.
select id, email, created_at from auth.users where email is not null;

-- ============================================================
-- 2. DELETE
-- ============================================================

-- Heartbeats. All of them: the probes, the E2E runs and the Lighthouse audits.
delete from sukun.device_days;

-- Waitlist probes only, matched on the address used during verification.
delete from sukun.waitlist where email like 'probe-%@example.com';

-- The anonymous users created while testing RLS. Their profiles, settings,
-- tasks, subtasks, tags, sessions and achievements all cascade from here, so
-- this one statement clears everything they own.
--
-- `email is null` is the guard: a real account always has one. Re-read the
-- second query in section 1 before running this.
delete from auth.users where email is null;

-- ============================================================
-- 3. CONFIRM
-- ============================================================

select 'device_days' as table, count(*) as rows from sukun.device_days
union all select 'waitlist', count(*) from sukun.waitlist
union all select 'tasks', count(*) from sukun.tasks
union all select 'sessions', count(*) from sukun.sessions
union all select 'anonymous auth users',
       count(*) from auth.users where email is null;

select * from sukun.device_totals;
