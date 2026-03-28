create table if not exists public.storage_spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  space_type text not null default 'kallare',
  row_count integer not null default 1 check (row_count > 0),
  slots_per_row integer not null default 1 check (slots_per_row > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.storage_spaces enable row level security;

drop policy if exists "storage_spaces_select_own" on public.storage_spaces;
create policy "storage_spaces_select_own"
on public.storage_spaces
for select
using (auth.uid() = user_id);

drop policy if exists "storage_spaces_insert_own" on public.storage_spaces;
create policy "storage_spaces_insert_own"
on public.storage_spaces
for insert
with check (auth.uid() = user_id);

drop policy if exists "storage_spaces_update_own" on public.storage_spaces;
create policy "storage_spaces_update_own"
on public.storage_spaces
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "storage_spaces_delete_own" on public.storage_spaces;
create policy "storage_spaces_delete_own"
on public.storage_spaces
for delete
using (auth.uid() = user_id);

drop trigger if exists set_storage_spaces_updated_at on public.storage_spaces;
create trigger set_storage_spaces_updated_at
before update on public.storage_spaces
for each row execute function public.set_updated_at();

alter table public.wines
add column if not exists storage_space_id uuid references public.storage_spaces (id) on delete set null;

alter table public.wines
add column if not exists storage_row integer;

alter table public.wines
add column if not exists storage_slot integer;

alter table public.wines
add constraint wines_storage_row_check check (storage_row is null or storage_row > 0);

alter table public.wines
add constraint wines_storage_slot_check check (storage_slot is null or storage_slot > 0);

create index if not exists wines_user_id_storage_space_idx
  on public.wines (user_id, storage_space_id);

create index if not exists wines_user_id_storage_position_idx
  on public.wines (user_id, storage_space_id, storage_row, storage_slot);
