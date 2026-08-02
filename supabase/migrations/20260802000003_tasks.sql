-- 003 — tasks, subtasks, tags

create table if not exists sukun.tasks (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 200),
  description          text,
  icon                 text not null default 'circle-dashed',
  color                text not null default 'sage',
  category             text,
  priority             sukun.priority_level not null default 'medium',
  status               sukun.task_status    not null default 'active',
  estimated_pomodoros  int  not null default 1 check (estimated_pomodoros between 0 and 50),
  completed_pomodoros  int  not null default 0,
  due_date             date,
  planned_date         date,
  planned_block        sukun.day_block,
  planned_order        int  not null default 0,
  -- local-only in spirit, but synced so a hand-placed task stays pinned on
  -- every device rather than being re-planned by the next Auto-plan elsewhere
  planned_manually     boolean not null default false,
  recurrence           jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,
  deleted_at           timestamptz
);

create index if not exists tasks_user_status_idx
  on sukun.tasks (user_id, status) where deleted_at is null;
create index if not exists tasks_user_updated_idx
  on sukun.tasks (user_id, updated_at);
create index if not exists tasks_planned_idx
  on sukun.tasks (user_id, planned_date, planned_block, planned_order)
  where deleted_at is null;

create table if not exists sukun.subtasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references sukun.tasks(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  priority   sukun.priority_level not null default 'medium',
  is_done    boolean not null default false,
  position   int     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists subtasks_task_idx
  on sukun.subtasks (task_id, position) where deleted_at is null;
create index if not exists subtasks_user_updated_idx
  on sukun.subtasks (user_id, updated_at);

create table if not exists sukun.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table if not exists sukun.task_tags (
  task_id    uuid not null references sukun.tasks(id) on delete cascade,
  tag_id     uuid not null references sukun.tags(id)  on delete cascade,
  user_id    uuid not null references auth.users(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, tag_id)
);

drop trigger if exists t_tasks_updated on sukun.tasks;
create trigger t_tasks_updated before update on sukun.tasks
  for each row execute function sukun.set_updated_at();

drop trigger if exists t_subtasks_updated on sukun.subtasks;
create trigger t_subtasks_updated before update on sukun.subtasks
  for each row execute function sukun.set_updated_at();

drop trigger if exists t_tags_updated on sukun.tags;
create trigger t_tags_updated before update on sukun.tags
  for each row execute function sukun.set_updated_at();
