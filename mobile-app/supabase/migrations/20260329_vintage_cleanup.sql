-- Step 1: Widen vintage constraint from 1900-2100 to 1800-2100
ALTER TABLE product_catalog_wines
  DROP CONSTRAINT product_catalog_wines_vintage_check;

ALTER TABLE product_catalog_wines
  ADD CONSTRAINT product_catalog_wines_vintage_check
  CHECK (vintage IS NULL OR vintage BETWEEN 1800 AND 2100);

-- Step 2: Extract trailing year from name into vintage (if vintage is null),
-- then strip the year from name.
UPDATE product_catalog_wines
SET
  vintage = CASE
    WHEN vintage IS NULL
    THEN (regexp_match(name, '\m((?:18|19|20)\d{2})\s*$'))[1]::integer
    ELSE vintage
  END,
  name = trim(regexp_replace(name, '\s+(18|19|20)\d{2}\s*$', ''))
WHERE name ~ '\m(18|19|20)\d{2}\s*$';
