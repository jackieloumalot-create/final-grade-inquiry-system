-- Run this entire script in Supabase Dashboard > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  class_code text not null unique,
  subject text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.student_grades (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id text not null,
  student_name text not null,
  pin_hash text not null,
  final_grade text not null,
  remarks text,
  updated_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists student_grades_lookup_idx on public.student_grades (class_id, student_id);

-- Deny public/browser access to grades and class metadata. The server uses the service role key.
alter table public.classes enable row level security;
alter table public.student_grades enable row level security;
alter table public.admin_users enable row level security;

revoke all on public.classes from anon, authenticated;
revoke all on public.student_grades from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

-- An authenticated user can check only whether their own account is an authorized admin.
drop policy if exists "admins can read own authorization row" on public.admin_users;
create policy "admins can read own authorization row"
  on public.admin_users for select to authenticated
  using (auth.uid() = user_id);

-- IMPORTANT: Do not create policies allowing anon/authenticated users to read grades.
-- Add an administrator only after creating that user in Supabase Authentication:
-- insert into public.admin_users (user_id) values ('PASTE-AUTH-USER-UUID-HERE');

-- Basic server-side rate limit for student lookups: 10 attempts per source IP per 15 minutes.
create table if not exists public.lookup_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0
);
alter table public.lookup_rate_limits enable row level security;
revoke all on public.lookup_rate_limits from anon, authenticated;

create or replace function public.check_lookup_rate_limit(
  p_key_hash text,
  p_max_attempts integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.lookup_rate_limits as current_limit (key_hash, window_started_at, attempt_count)
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do update
    set window_started_at = case
      when current_limit.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
      else current_limit.window_started_at end,
        attempt_count = case
      when current_limit.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
      else current_limit.attempt_count + 1 end
  returning attempt_count into v_count;
  return v_count <= p_max_attempts;
end;
$$;
revoke all on function public.check_lookup_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_lookup_rate_limit(text, integer, integer) to service_role;
