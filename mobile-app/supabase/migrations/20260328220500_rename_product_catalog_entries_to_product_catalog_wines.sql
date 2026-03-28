do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'product_catalog_entries'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'product_catalog_wines'
  ) then
    alter table public.product_catalog_entries rename to product_catalog_wines;
  end if;
end $$;

alter table public.product_catalog_wines
  alter column barcode set not null;

alter table public.product_catalog_wines
  drop constraint if exists product_catalog_entries_identity_check;

alter table public.product_catalog_wines
  drop constraint if exists product_catalog_wines_identity_check;

alter table public.product_catalog_wines
  drop constraint if exists product_catalog_wines_barcode_check;

alter table public.product_catalog_wines
  add constraint product_catalog_wines_barcode_check check (barcode <> '');

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'i'
      and n.nspname = 'public'
      and c.relname = 'product_catalog_entries_barcode_uidx'
  ) and not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'i'
      and n.nspname = 'public'
      and c.relname = 'product_catalog_wines_barcode_uidx'
  ) then
    alter index public.product_catalog_entries_barcode_uidx rename to product_catalog_wines_barcode_uidx;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'i'
      and n.nspname = 'public'
      and c.relname = 'product_catalog_entries_systembolaget_uidx'
  ) and not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'i'
      and n.nspname = 'public'
      and c.relname = 'product_catalog_wines_systembolaget_uidx'
  ) then
    alter index public.product_catalog_entries_systembolaget_uidx rename to product_catalog_wines_systembolaget_uidx;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'i'
      and n.nspname = 'public'
      and c.relname = 'product_catalog_entries_name_idx'
  ) and not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'i'
      and n.nspname = 'public'
      and c.relname = 'product_catalog_wines_name_idx'
  ) then
    alter index public.product_catalog_entries_name_idx rename to product_catalog_wines_name_idx;
  end if;
end $$;

drop policy if exists "product_catalog_entries_select_all" on public.product_catalog_wines;
drop policy if exists "product_catalog_entries_insert_authenticated" on public.product_catalog_wines;
drop policy if exists "product_catalog_entries_update_authenticated" on public.product_catalog_wines;
drop policy if exists "product_catalog_entries_delete_authenticated" on public.product_catalog_wines;

drop policy if exists "product_catalog_wines_select_all" on public.product_catalog_wines;
create policy "product_catalog_wines_select_all"
on public.product_catalog_wines
for select
using (auth.role() = 'authenticated');

drop policy if exists "product_catalog_wines_insert_authenticated" on public.product_catalog_wines;
create policy "product_catalog_wines_insert_authenticated"
on public.product_catalog_wines
for insert
with check (auth.role() = 'authenticated');

drop policy if exists "product_catalog_wines_update_authenticated" on public.product_catalog_wines;
create policy "product_catalog_wines_update_authenticated"
on public.product_catalog_wines
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "product_catalog_wines_delete_authenticated" on public.product_catalog_wines;
create policy "product_catalog_wines_delete_authenticated"
on public.product_catalog_wines
for delete
using (auth.role() = 'authenticated');

drop trigger if exists set_product_catalog_entries_updated_at on public.product_catalog_wines;
drop trigger if exists set_product_catalog_wines_updated_at on public.product_catalog_wines;
create trigger set_product_catalog_wines_updated_at
before update on public.product_catalog_wines
for each row execute function public.set_updated_at();
