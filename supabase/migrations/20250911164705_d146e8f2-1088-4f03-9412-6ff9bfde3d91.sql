-- Create a non-recursive, security-definer role check to avoid RLS recursion
create or replace function public.is_cdc_director(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = _uid
      and role = 'cdc_director'::user_role
  );
$$;

-- Replace recursive policies with function-based checks
-- PROFILES
drop policy if exists "CDC Directors can manage profiles" on public.profiles;
create policy "CDC Directors can manage profiles"
  on public.profiles
  for all
  using (public.is_cdc_director(auth.uid()))
  with check (public.is_cdc_director(auth.uid()));

-- TASKS
drop policy if exists "CDC Directors can manage tasks" on public.tasks;
create policy "CDC Directors can manage tasks"
  on public.tasks
  for all
  using (public.is_cdc_director(auth.uid()))
  with check (public.is_cdc_director(auth.uid()));

drop policy if exists "CDC Directors can view all tasks" on public.tasks;
create policy "CDC Directors can view all tasks"
  on public.tasks
  for select
  using (public.is_cdc_director(auth.uid()));

-- EVENTS
drop policy if exists "CDC Directors can manage events" on public.events;
create policy "CDC Directors can manage events"
  on public.events
  for all
  using (public.is_cdc_director(auth.uid()))
  with check (public.is_cdc_director(auth.uid()));

-- EVENT ASSIGNMENTS
drop policy if exists "CDC Directors can manage event assignments" on public.event_assignments;
create policy "CDC Directors can manage event assignments"
  on public.event_assignments
  for all
  using (public.is_cdc_director(auth.uid()))
  with check (public.is_cdc_director(auth.uid()));