create table if not exists public.wine_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wine_id uuid references public.wines (id) on delete set null,
  name text not null,
  producer text,
  country text,
  region text,
  grape text,
  vintage integer,
  type text,
  barcode text,
  systembolaget_product_id text,
  storage_space_id uuid references public.storage_spaces (id) on delete set null,
  storage_row integer,
  storage_slot integer,
  cellar_location text,
  image_path text,
  quantity_consumed integer not null default 1 check (quantity_consumed > 0),
  rating integer check (rating is null or rating between 1 and 5),
  tasting_notes text,
  consumed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists wine_history_user_id_consumed_at_idx
  on public.wine_history (user_id, consumed_at desc);

create index if not exists wine_history_user_id_name_idx
  on public.wine_history (user_id, name);

alter table public.wine_history enable row level security;

drop policy if exists "wine_history_select_own" on public.wine_history;
create policy "wine_history_select_own"
on public.wine_history
for select
using (auth.uid() = user_id);

drop policy if exists "wine_history_insert_own" on public.wine_history;
create policy "wine_history_insert_own"
on public.wine_history
for insert
with check (auth.uid() = user_id);

drop policy if exists "wine_history_update_own" on public.wine_history;
create policy "wine_history_update_own"
on public.wine_history
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "wine_history_delete_own" on public.wine_history;
create policy "wine_history_delete_own"
on public.wine_history
for delete
using (auth.uid() = user_id);

insert into public.product_catalog_wines (
  name,
  producer,
  country,
  region,
  grape,
  type,
  vintage,
  food_pairings,
  source_label,
  source_confidence,
  created_by,
  systembolaget_product_id,
  barcode
)
select
  wines.name,
  wines.producer,
  wines.country,
  wines.region,
  wines.grape,
  wines.type,
  wines.vintage,
  wines.food_pairings,
  'MinVinkällare',
  'high',
  wines.user_id,
  wines.systembolaget_product_id,
  wines.barcode
from public.wines as wines
where
  nullif(trim(wines.name), '') is not null
  and nullif(trim(coalesce(wines.producer, '')), '') is not null
  and nullif(trim(coalesce(wines.country, '')), '') is not null
  and nullif(trim(coalesce(wines.region, '')), '') is not null
  and nullif(trim(coalesce(wines.grape, '')), '') is not null
  and nullif(trim(coalesce(wines.type, '')), '') is not null
  and not exists (
    select 1
    from public.product_catalog_wines as catalog
    where lower(catalog.name) = lower(wines.name)
      and lower(coalesce(catalog.producer, '')) = lower(coalesce(wines.producer, ''))
      and lower(coalesce(catalog.country, '')) = lower(coalesce(wines.country, ''))
      and lower(coalesce(catalog.region, '')) = lower(coalesce(wines.region, ''))
      and lower(coalesce(catalog.grape, '')) = lower(coalesce(wines.grape, ''))
      and lower(coalesce(catalog.type, '')) = lower(coalesce(wines.type, ''))
      and coalesce(catalog.vintage, -1) = coalesce(wines.vintage, -1)
  );
