create table if not exists public.user_dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index idx_user_dishes_user on user_dishes (user_id);

alter table user_dishes enable row level security;

create policy "user_dishes_select" on user_dishes for select using (user_id = auth.uid());
create policy "user_dishes_insert" on user_dishes for insert with check (user_id = auth.uid());
create policy "user_dishes_update" on user_dishes for update using (user_id = auth.uid());
create policy "user_dishes_delete" on user_dishes for delete using (user_id = auth.uid());
