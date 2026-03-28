alter table public.product_catalog_wines
alter column barcode drop not null;

alter table public.product_catalog_wines
drop constraint if exists product_catalog_wines_barcode_check;

drop index if exists product_catalog_wines_barcode_uidx;

create unique index if not exists product_catalog_wines_barcode_uidx
  on public.product_catalog_wines (barcode)
  where barcode is not null and barcode <> '';
