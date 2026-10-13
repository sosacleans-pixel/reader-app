-- Workout-time prefs, push subscriptions, streaks. Run in Supabase SQL editor.
create table if not exists public.workout_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slot text check (slot in ('morning','afternoon','evening')),
  local_time time,
  timezone text not null default 'UTC',
  push_enabled boolean not null default false,
  email_enabled boolean not null default false,
  last_sent_date date,
  comeback_anchor date,          -- last_workout_date the comeback count belongs to
  comeback_sends int not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create table if not exists public.streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_workout_date date,
  total_workouts int not null default 0,
  timezone text,
  updated_at timestamptz not null default now()
);
alter table public.workout_prefs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.streaks enable row level security;
create policy "own prefs" on public.workout_prefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subs" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own streak" on public.streaks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Safe if the table already existed without it:
alter table public.streaks add column if not exists total_workouts int not null default 0;
alter table public.workout_prefs add column if not exists comeback_anchor date;
alter table public.workout_prefs add column if not exists comeback_sends int not null default 0;
