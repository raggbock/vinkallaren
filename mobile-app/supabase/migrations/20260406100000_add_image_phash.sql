-- Add perceptual hash column for image-based wine matching
ALTER TABLE public.product_catalog_wines
  ADD COLUMN IF NOT EXISTS image_phash text;

-- Index for fast lookup (exact match is rare, but speeds up sequential scan filtering)
CREATE INDEX IF NOT EXISTS idx_catalog_image_phash
  ON public.product_catalog_wines (image_phash)
  WHERE image_phash IS NOT NULL;

-- RPC: match catalog wines by perceptual image hash (hamming distance)
-- Takes a hex hash string and returns closest matches
CREATE OR REPLACE FUNCTION match_catalog_by_image(
  query_hash text,
  max_results int DEFAULT 5
)
RETURNS TABLE(id uuid, name text, producer text, vintage int, image_url text, hash_distance int)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, name, producer, vintage, image_url,
    bit_count((('x' || image_phash)::bit(64)) # (('x' || query_hash)::bit(64))) AS hash_distance
  FROM product_catalog_wines
  WHERE image_phash IS NOT NULL
    AND length(image_phash) = 16
    AND length(query_hash) = 16
  ORDER BY hash_distance ASC
  LIMIT max_results;
$$;

-- RPC: store a computed phash for a catalog wine
CREATE OR REPLACE FUNCTION set_image_phash(wine_id uuid, phash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE product_catalog_wines
  SET image_phash = phash
  WHERE id = wine_id;
$$;
