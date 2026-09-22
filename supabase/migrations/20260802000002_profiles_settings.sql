-- 002 — profiles and settings

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone     text        not null default 'UTC',
  is_pro       boolean     not null default false,
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists settings (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  focus_minutes             int  not null default 25  check (focus_minutes between 1 and 180),
  short_break_minutes       int  not null default 5   check (short_break_minutes between 1 and 60),
  long_break_minutes        int  not null default 15  check (long_break_minutes between 1 and 120),
  sessions_until_long_break int  not null default 4   check (sessions_until_long_break between 2 and 12),
  auto_start_breaks         boolean not null default true,
  auto_start_focus          boolean not null default false,
  sound_id                  text    not null default 'chime',
  volume                    real    not null default 0.6 check (volume between 0 and 1),
  notifications_enabled     boolean not null default false,
  haptics_enabled           boolean not null default true,
  theme                     text    not null default 'system' check (theme in ('system','light','dark')),
  default_timer_mode        text    not null default 'ring'   check (default_timer_mode in ('ring','flip')),
  week_starts_on            int     not null default 1 check (week_starts_on between 0 and 6),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

drop trigger if exists t_profiles_updated on profiles;
create trigger t_profiles_updated before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists t_settings_updated on settings;
create trigger t_settings_updated before update on settings
  for each row execute function set_updated_at();

-- Every new auth user gets a profile and a settings row. Sign-in is always
-- deliberate here (anonymous sign-ins are disabled — doc 08 §2), so this fires
-- on the Google or magic-link upgrade, not on first run.
--
-- search_path is pinned for the same reason it is always pinned in a security
-- definer function: without it the function resolves names using the caller's
-- search_path, which is a privilege escalation waiting to happen.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  insert into settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

-- The old name from the shared-database era is dropped too, so a project that
-- ever ran the `sukun` migrations does not end up firing both.
drop trigger if exists on_auth_user_created_sukun on auth.users;
drop trigger if exists on_auth_user_created_ajeg on auth.users;
create trigger on_auth_user_created_ajeg
  after insert on auth.users
  for each row execute function handle_new_user();
