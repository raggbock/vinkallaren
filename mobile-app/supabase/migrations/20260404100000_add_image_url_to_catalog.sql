-- Add image_url column to product_catalog_wines for storing source product images
alter table public.product_catalog_wines
  add column if not exists image_url text;
