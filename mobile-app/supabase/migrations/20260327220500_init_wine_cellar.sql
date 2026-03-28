create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.wines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  producer text,
  country text,
  region text,
  vintage integer,
  quantity integer not null default 1 check (quantity > 0),
  type text not null default 'red',
  barcode text,
  tags text[] not null default '{}'::text[],
  notes text,
  cellar_location text,
  image_path text,
  acquired_at date,
  drink_by_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wines_vintage_check check (vintage is null or vintage between 1900 and 2100),
  constraint wines_drink_by_year_check check (drink_by_year is null or drink_by_year between 1900 and 2100)
);

create index if not exists wines_user_id_created_at_idx
  on public.wines (user_id, created_at desc);

create index if not exists wines_user_id_type_idx
  on public.wines (user_id, type);

create index if not exists wines_user_id_country_idx
  on public.wines (user_id, country);

create index if not exists wines_barcode_idx
  on public.wines (user_id, barcode)
  where barcode is not null and barcode <> '';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_wines_updated_at on public.wines;
create trigger set_wines_updated_at
before update on public.wines
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.wines enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "wines_select_own" on public.wines;
create policy "wines_select_own"
on public.wines
for select
using (auth.uid() = user_id);

drop policy if exists "wines_insert_own" on public.wines;
create policy "wines_insert_own"
on public.wines
for insert
with check (auth.uid() = user_id);

drop policy if exists "wines_update_own" on public.wines;
create policy "wines_update_own"
on public.wines
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "wines_delete_own" on public.wines;
create policy "wines_delete_own"
on public.wines
for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('wine-images', 'wine-images', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "wine_images_select_own" on storage.objects;
create policy "wine_images_select_own"
on storage.objects
for select
using (
  bucket_id = 'wine-images'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "wine_images_insert_own" on storage.objects;
create policy "wine_images_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'wine-images'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "wine_images_update_own" on storage.objects;
create policy "wine_images_update_own"
on storage.objects
for update
using (
  bucket_id = 'wine-images'
  and auth.uid()::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'wine-images'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "wine_images_delete_own" on storage.objects;
create policy "wine_images_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'wine-images'
  and auth.uid()::text = split_part(name, '/', 1)
);
