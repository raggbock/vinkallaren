-- Step 1: Remove catalog wines without vintage or producer (no longer allowed)
DELETE FROM product_catalog_wines WHERE vintage IS NULL OR producer IS NULL;

-- Step 2: Remove duplicates (keep the best row per name+producer+vintage,
-- preferring rows with systembolaget_product_id or barcode)
DELETE FROM product_catalog_wines
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY name, producer, vintage
        ORDER BY
          CASE WHEN systembolaget_product_id IS NOT NULL THEN 0 ELSE 1 END,
          CASE WHEN barcode IS NOT NULL THEN 0 ELSE 1 END,
          created_at ASC
      ) as rn
    FROM product_catalog_wines
  ) ranked
  WHERE rn > 1
);

-- Step 3: Composite unique index for cross-source dedup.
-- The import_catalog_wines RPC uses ON CONFLICT DO NOTHING,
-- which will respect this index automatically.
CREATE UNIQUE INDEX product_catalog_wines_name_producer_vintage_uidx
  ON product_catalog_wines (name, producer, vintage);
