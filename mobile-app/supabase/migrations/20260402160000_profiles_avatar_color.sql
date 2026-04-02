-- Add avatar_color column
alter table public.profiles
  add column if not exists avatar_color text;

-- Allow all authenticated users to read any profile (needed for session participant display)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_all"
on public.profiles
for select to authenticated
using (true);
