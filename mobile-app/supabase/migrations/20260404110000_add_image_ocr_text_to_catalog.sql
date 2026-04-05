-- Add column for OCR text extracted from product images
alter table public.product_catalog_wines
  add column if not exists image_ocr_text text;

-- Index for trigram search on OCR text
create index if not exists idx_catalog_image_ocr_text_trgm
  on public.product_catalog_wines using gin (image_ocr_text gin_trgm_ops);
