-- 012 — constrain the two tables anyone can write to
--
-- `waitlist` and `device_days` are the only tables with an INSERT policy for
-- `anon`, and both policies are `with check (true)` because the writer has no
-- account to key on. That is the correct shape — and it also means anybody
-- with the anon key (which ships in the JavaScript, by design) can insert
-- whatever they like into either one.
--
-- Nothing leaks: neither table has a SELECT policy, and neither carries data
-- belonging to another user. What is at risk is the *numbers*. Day-7 retention
-- is the figure the whole day-30 decision rests on (docs/10-validation.md §1),
-- and a stranger with curl could manufacture it — thousands of device ids,
-- backdated across a month, and the dashboard reads like a hit.
--
-- Column constraints are the only defence available here: a policy cannot rate
-- limit, and an edge function in front of an insert is a server this app
-- deliberately does not have. These do not stop a determined attacker. They
-- stop a bored one, and they stop the accidental garbage that is far likelier.

/* ------------------------------------------------------------- waitlist */

do $$
begin
  -- Shape only. A full RFC 5322 regex is a famous waste of time; this rejects
  -- the things that are obviously not an address and caps the length at the
  -- documented maximum for one.
  if not exists (select 1 from pg_constraint where conname = 'waitlist_email_shape') then
    alter table waitlist add constraint waitlist_email_shape
      check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
             and length(email) between 6 and 254);
  end if;

  -- The app sends one of a fixed set. Anything else is not this app writing.
  if not exists (select 1 from pg_constraint where conname = 'waitlist_source_known') then
    alter table waitlist add constraint waitlist_source_known
      check (source is null or source in ('upsell', 'settings', 'onboarding', 'pro_gate'));
  end if;
end $$;

/* --------------------------------------------------------- device_days */

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'device_days_version_len') then
    alter table device_days add constraint device_days_version_len
      check (app_version is null or length(app_version) <= 32);
  end if;
end $$;

-- The date window is a trigger, not a check constraint. It is written once and
-- reused by device_events (migration 013), which has the same exposure.
--
-- `current_date` is STABLE, not IMMUTABLE. Postgres accepts it inside a CHECK
-- and then the constraint means something different every day — which is fine
-- while rows are being inserted and wrong the moment a dump is restored, where
-- every historical row is re-validated against today. The rule belongs at
-- insert time, so it is written at insert time.
--
-- This is the line that matters for metric integrity: without it, a month of
-- retention history can be fabricated in one INSERT. With it, faking a 30-day
-- cohort means showing up for 30 days.
create or replace function enforce_recent_local_date()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- The past is given room because the outbox holds heartbeats for however
  -- long a device stays offline. The future gets one day, for a device whose
  -- clock runs ahead of the server's.
  if new.local_date < current_date - 30 or new.local_date > current_date + 1 then
    raise exception '%.local_date % is outside the accepted window',
      tg_table_name, new.local_date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists t_device_days_window on device_days;
create trigger t_device_days_window
  before insert on device_days
  for each row execute function enforce_recent_local_date();
