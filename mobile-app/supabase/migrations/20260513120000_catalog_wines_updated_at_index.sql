CREATE INDEX IF NOT EXISTS idx_catalog_wines_updated_at_desc
  ON public.product_catalog_wines (updated_at DESC);
