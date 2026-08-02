-- 005 — row level security
--
-- RLS is the entire authorization model. There is no server-side privileged
-- path in this app and the service_role key never leaves a password manager,
-- so if a policy is wrong, it is wrong for everybody.

alter table sukun.profiles     enable row level security;
alter table sukun.settings     enable row level security;
alter table sukun.tasks        enable row level security;
alter table sukun.subtasks     enable row level security;
alter table sukun.tags         enable row level security;
alter table sukun.task_tags    enable row level security;
alter table sukun.sessions     enable row level security;
alter table sukun.achievements enable row level security;
alter table sukun.waitlist     enable row level security;

-- profiles key on id; everything else on user_id
drop policy if exists "own profile" on sukun.profiles;
create policy "own profile" on sukun.profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array[
    'settings','tasks','subtasks','tags','task_tags','sessions','achievements'
  ]
  loop
    execute format('drop policy if exists "own rows" on sukun.%I', t);
    execute format($f$
      create policy "own rows" on sukun.%I
        for all
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- Waitlist is insert-only from the app. Nothing reads it back; the list is
-- read from the Supabase dashboard.
drop policy if exists "waitlist insert" on sukun.waitlist;
create policy "waitlist insert" on sukun.waitlist
  for insert
  to anon, authenticated
  with check (true);
