-- ============================================================================
-- Sukun — one month of demo data for a single account
--
-- Paste into the Supabase SQL editor and run. Everything is scoped to the one
-- user id below; nothing outside their rows is touched.
--
-- Re-runnable: the first block deletes this user's existing sukun rows, so a
-- second run replaces the data rather than doubling it. If that is not what
-- you want, delete the "wipe" block before running.
--
-- Dates are relative to the day you run it, so the app always opens on a
-- month that ends today.
-- ============================================================================

do $$
declare
  uid          uuid := 'ca912d21-25aa-479c-820d-f67ba5e04a2e';
  today        date := current_date;
  start_day    date := current_date - 29;   -- 30 days inclusive

  tag_work     uuid := gen_random_uuid();
  tag_learning uuid := gen_random_uuid();
  tag_health   uuid := gen_random_uuid();
  tag_admin    uuid := gen_random_uuid();

  t_proposal   uuid := gen_random_uuid();
  t_login      uuid := gen_random_uuid();
  t_docs       uuid := gen_random_uuid();
  t_reviews    uuid := gen_random_uuid();
  t_timer      uuid := gen_random_uuid();
  t_settings   uuid := gen_random_uuid();
  t_standup    uuid := gen_random_uuid();
  t_inbox      uuid := gen_random_uuid();
  t_onboard    uuid := gen_random_uuid();
  t_deepwork   uuid := gen_random_uuid();

  id_engineer  uuid := gen_random_uuid();
  id_mover     uuid := gen_random_uuid();
  id_reader    uuid := gen_random_uuid();

  h_spec       uuid := gen_random_uuid();
  h_ship       uuid := gen_random_uuid();
  h_walk       uuid := gen_random_uuid();
  h_stretch    uuid := gen_random_uuid();
  h_pages      uuid := gen_random_uuid();

  d            date;
  n            int;
  i            int;
  slot         int;
  started      timestamptz;
  dur          int;
  ok           boolean;
  task         uuid;
begin
  -- ------------------------------------------------------------------ wipe
  delete from sukun.habit_logs  where user_id = uid;
  delete from sukun.habits      where user_id = uid;
  delete from sukun.identities  where user_id = uid;
  delete from sukun.sessions    where user_id = uid;
  delete from sukun.task_tags   where user_id = uid;
  delete from sukun.subtasks    where user_id = uid;
  delete from sukun.tasks       where user_id = uid;
  delete from sukun.tags        where user_id = uid;
  delete from sukun.achievements where user_id = uid;

  -- --------------------------------------------------------------- profile
  -- Pro, so the ten-task free limit does not get in the way of adding more.
  insert into sukun.profiles (id, display_name, timezone, is_pro, onboarded_at)
  values (uid, 'Tsaqib', 'Asia/Jakarta', true, now() - interval '30 days')
  on conflict (id) do update
    set display_name = excluded.display_name,
        timezone     = excluded.timezone,
        is_pro       = true,
        onboarded_at = coalesce(sukun.profiles.onboarded_at, excluded.onboarded_at);

  insert into sukun.settings (user_id) values (uid)
  on conflict (user_id) do nothing;

  -- ------------------------------------------------------------------ tags
  insert into sukun.tags (id, user_id, name, color) values
    (tag_work,     uid, 'work',     'sage'),
    (tag_learning, uid, 'learning', 'iris'),
    (tag_health,   uid, 'health',   'moss'),
    (tag_admin,    uid, 'admin',    'slate');

  -- ----------------------------------------------------------------- tasks
  -- Six active (two planned for today), four already done across the month.
  insert into sukun.tasks
    (id, user_id, title, icon, color, priority, status,
     estimated_pomodoros, completed_pomodoros,
     due_date, planned_date, planned_block, planned_order,
     created_at, completed_at)
  values
    (t_proposal, uid, 'Complete Q1 proposal',       'file-text',         'sage',    'high',   'active', 4, 3,
      today + 1, today, 'morning',   0, now() - interval '12 days', null),
    (t_login,    uid, 'Fix login bug',              'bug',               'clay',    'high',   'active', 2, 1,
      today,     today, 'morning',   1, now() - interval '5 days',  null),
    (t_docs,     uid, 'Update API documentation',   'book-open',         'iris',    'medium', 'active', 3, 1,
      null,      today, 'afternoon', 0, now() - interval '9 days',  null),
    (t_reviews,  uid, 'Review pull requests',       'git-pull-request',  'slate',   'medium', 'active', 2, 0,
      null,      null,  null,        0, now() - interval '3 days',  null),
    (t_timer,    uid, 'Learn the timer internals',  'brain',             'plum',    'low',    'active', 4, 2,
      null,      null,  null,        0, now() - interval '18 days', null),
    (t_settings, uid, 'Refactor the settings module','wrench',           'fog',     'low',    'active', 3, 0,
      null,      null,  null,        0, now() - interval '2 days',  null),
    (t_standup,  uid, 'Prepare team standup',       'users',             'apricot', 'medium', 'completed', 1, 1,
      null,      null,  null,        0, now() - interval '20 days', now() - interval '20 days'),
    (t_inbox,    uid, 'Clear the inbox',            'mail',              'slate',   'low',    'completed', 1, 1,
      null,      null,  null,        0, now() - interval '15 days', now() - interval '15 days'),
    (t_onboard,  uid, 'Write the onboarding copy',  'edit',              'moss',    'high',   'completed', 3, 3,
      null,      null,  null,        0, now() - interval '11 days', now() - interval '8 days'),
    (t_deepwork, uid, 'Read Deep Work',             'book-open',         'iris',    'low',    'completed', 2, 2,
      null,      today, 'evening',   0, now() - interval '25 days', now() - interval '4 days');

  insert into sukun.task_tags (task_id, tag_id, user_id) values
    (t_proposal, tag_work,     uid),
    (t_login,    tag_work,     uid),
    (t_docs,     tag_work,     uid),
    (t_reviews,  tag_work,     uid),
    (t_timer,    tag_learning, uid),
    (t_deepwork, tag_learning, uid),
    (t_settings, tag_admin,    uid),
    (t_standup,  tag_admin,    uid),
    (t_inbox,    tag_admin,    uid),
    (t_onboard,  tag_work,     uid);

  -- -------------------------------------------------------------- subtasks
  insert into sukun.subtasks (user_id, task_id, title, priority, is_done, position) values
    (uid, t_proposal, 'Outline the three options',  'high',   true,  0),
    (uid, t_proposal, 'Cost each one',              'medium', true,  1),
    (uid, t_proposal, 'Write the recommendation',   'high',   false, 2),
    (uid, t_proposal, 'Send for review',            'low',    false, 3),
    (uid, t_docs,     'Auth endpoints',             'medium', true,  0),
    (uid, t_docs,     'Webhook payloads',           'medium', false, 1),
    (uid, t_docs,     'Error codes',                'low',    false, 2),
    (uid, t_reviews,  'Backlog from last week',     'medium', false, 0),
    (uid, t_reviews,  'The timer refactor',         'high',   false, 1);

  -- -------------------------------------------------------------- sessions
  -- Three to five focus sessions on most weekdays, one or two at weekends,
  -- a scattering of interrupted ones, and two days off. Roughly 90 rows —
  -- enough for a heat grid and a streak, not so much that it reads as fake.
  d := start_day;
  while d <= today loop
    -- deterministic pseudo-randomness, so a re-run looks the same
    n := case
           when extract(isodow from d) in (6, 7) then (extract(day from d)::int % 2) + 1
           else 3 + (extract(day from d)::int % 3)
         end;

    -- two days off in the middle of the month, so the streak has a real break
    if d = start_day + 11 or d = start_day + 12 then
      n := 0;
    end if;

    i := 0;
    while i < n loop
      -- 09:00, 10:00, 11:00, 14:00, 15:00 local
      slot := case i when 0 then 9 when 1 then 10 when 2 then 11 when 3 then 14 else 15 end;
      started := (d + make_interval(hours => slot, mins => (extract(day from d)::int * 7) % 45))
                 at time zone 'Asia/Jakarta';

      -- roughly one session in nine is cut short
      ok  := ((extract(day from d)::int + i) % 9) <> 0;
      dur := case when ok then 1500 else 480 + ((extract(day from d)::int * 37 + i * 11) % 600) end;

      task := case (extract(day from d)::int + i) % 6
                when 0 then t_proposal
                when 1 then t_login
                when 2 then t_docs
                when 3 then t_timer
                when 4 then t_onboard
                else        t_deepwork
              end;

      insert into sukun.sessions
        (user_id, task_id, mode, planned_duration_sec, actual_duration_sec,
         started_at, ended_at, local_date, completed, interrupted)
      values
        (uid, task, 'focus', 1500, dur,
         started, started + make_interval(secs => dur), d, ok, not ok);

      -- the break that followed, except after the last session of the day
      if i < n - 1 then
        insert into sukun.sessions
          (user_id, task_id, mode, planned_duration_sec, actual_duration_sec,
           started_at, ended_at, local_date, completed, interrupted)
        values
          (uid, null,
           case when i = 3 then 'long_break' else 'short_break' end::sukun.session_mode,
           case when i = 3 then 900 else 300 end,
           case when i = 3 then 900 else 300 end,
           started + make_interval(secs => dur),
           started + make_interval(secs => dur + case when i = 3 then 900 else 300 end),
           d, true, false);
      end if;

      i := i + 1;
    end loop;

    d := d + 1;
  end loop;

  -- ------------------------------------------------------------ identities
  insert into sukun.identities (id, user_id, name, position, created_at) values
    (id_engineer, uid, 'A focused engineer', 0, now() - interval '30 days'),
    (id_mover,    uid, 'Someone who moves',  1, now() - interval '28 days'),
    (id_reader,   uid, 'A calm reader',      2, now() - interval '21 days');

  -- schedule: 0 = Sunday … 6 = Saturday
  insert into sukun.habits (id, user_id, identity_id, name, schedule, position, created_at) values
    (h_spec,    uid, id_engineer, 'Read one spec',        '{1,2,3,4,5}',   0, now() - interval '30 days'),
    (h_ship,    uid, id_engineer, 'Ship something small', '{1,2,3,4,5}',   1, now() - interval '30 days'),
    (h_walk,    uid, id_mover,    'Morning walk',         '{0,1,2,3,4,5,6}', 0, now() - interval '28 days'),
    (h_stretch, uid, id_mover,    'Stretch before bed',   '{1,3,5}',       1, now() - interval '28 days'),
    (h_pages,   uid, id_reader,   'Ten pages',            '{0,1,2,3,4,5,6}', 0, now() - interval '21 days');

  -- ------------------------------------------------------------ habit logs
  -- Each habit keeps its own rhythm: the walk is nearly perfect, shipping is
  -- patchy, and reading only starts three weeks ago.
  d := start_day;
  while d <= today loop
    if extract(dow from d)::int = any (array[1,2,3,4,5])
       and (extract(day from d)::int % 5) <> 0 then
      insert into sukun.habit_logs (habit_id, user_id, day)
      values (h_spec, uid, d) on conflict do nothing;
    end if;

    if extract(dow from d)::int = any (array[1,2,3,4,5])
       and (extract(day from d)::int % 3) <> 0 then
      insert into sukun.habit_logs (habit_id, user_id, day)
      values (h_ship, uid, d) on conflict do nothing;
    end if;

    if (extract(day from d)::int % 8) <> 0 then
      insert into sukun.habit_logs (habit_id, user_id, day)
      values (h_walk, uid, d) on conflict do nothing;
    end if;

    if extract(dow from d)::int = any (array[1,3,5])
       and (extract(day from d)::int % 4) <> 0 then
      insert into sukun.habit_logs (habit_id, user_id, day)
      values (h_stretch, uid, d) on conflict do nothing;
    end if;

    if d >= today - 20 and (extract(day from d)::int % 7) <> 0 then
      insert into sukun.habit_logs (habit_id, user_id, day)
      values (h_pages, uid, d) on conflict do nothing;
    end if;

    d := d + 1;
  end loop;

  -- ---------------------------------------------------------- achievements
  -- Only the ones a month of this data actually earns. The app re-evaluates
  -- after every session, so anything missed here is picked up on its own.
  insert into sukun.achievements (user_id, key, unlocked_at) values
    (uid, 'first-session',  now() - interval '29 days'),
    (uid, 'first-task',     now() - interval '20 days'),
    (uid, 'first-full-day', now() - interval '29 days'),
    (uid, 'first-week',     now() - interval '23 days'),
    (uid, 'sessions-10',    now() - interval '26 days'),
    (uid, 'sessions-50',    now() - interval '16 days'),
    (uid, 'streak-3',       now() - interval '26 days'),
    (uid, 'streak-7',       now() - interval '22 days'),
    (uid, 'depth-4-day',    now() - interval '27 days')
  on conflict (user_id, key) do nothing;
end $$;

-- ---------------------------------------------------------------- receipts
select 'tasks'      as "table", count(*) from sukun.tasks      where user_id = 'ca912d21-25aa-479c-820d-f67ba5e04a2e'
union all select 'subtasks',   count(*) from sukun.subtasks   where user_id = 'ca912d21-25aa-479c-820d-f67ba5e04a2e'
union all select 'tags',       count(*) from sukun.tags       where user_id = 'ca912d21-25aa-479c-820d-f67ba5e04a2e'
union all select 'sessions',   count(*) from sukun.sessions   where user_id = 'ca912d21-25aa-479c-820d-f67ba5e04a2e'
union all select 'focus only', count(*) from sukun.sessions   where user_id = 'ca912d21-25aa-479c-820d-f67ba5e04a2e' and mode = 'focus'
union all select 'identities', count(*) from sukun.identities where user_id = 'ca912d21-25aa-479c-820d-f67ba5e04a2e'
union all select 'habits',     count(*) from sukun.habits     where user_id = 'ca912d21-25aa-479c-820d-f67ba5e04a2e'
union all select 'habit_logs', count(*) from sukun.habit_logs where user_id = 'ca912d21-25aa-479c-820d-f67ba5e04a2e';
