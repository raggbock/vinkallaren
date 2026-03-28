create table if not exists public.product_catalog_entries (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  systembolaget_product_id text,
  name text not null,
  producer text,
  country text,
  region text,
  grape text,
  type text,
  vintage integer,
  food_pairings text[] not null default '{}'::text[],
  source_label text,
  source_confidence text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_catalog_entries_identity_check check (
    coalesce(nullif(barcode, ''), nullif(systembolaget_product_id, '')) is not null
  ),
  constraint product_catalog_entries_vintage_check check (
    vintage is null or vintage between 1900 and 2100
  )
);

create unique index if not exists product_catalog_entries_barcode_uidx
  on public.product_catalog_entries (barcode)
  where barcode is not null and barcode <> '';

create unique index if not exists product_catalog_entries_systembolaget_uidx
  on public.product_catalog_entries (systembolaget_product_id)
  where systembolaget_product_id is not null and systembolaget_product_id <> '';

create index if not exists product_catalog_entries_name_idx
  on public.product_catalog_entries (name);

alter table public.product_catalog_entries enable row level security;

drop policy if exists "product_catalog_entries_select_all" on public.product_catalog_entries;
create policy "product_catalog_entries_select_all"
on public.product_catalog_entries
for select
using (auth.role() = 'authenticated');

drop policy if exists "product_catalog_entries_insert_authenticated" on public.product_catalog_entries;
create policy "product_catalog_entries_insert_authenticated"
on public.product_catalog_entries
for insert
with check (auth.role() = 'authenticated');

drop policy if exists "product_catalog_entries_update_authenticated" on public.product_catalog_entries;
create policy "product_catalog_entries_update_authenticated"
on public.product_catalog_entries
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop trigger if exists set_product_catalog_entries_updated_at on public.product_catalog_entries;
create trigger set_product_catalog_entries_updated_at
before update on public.product_catalog_entries
for each row execute function public.set_updated_at();
