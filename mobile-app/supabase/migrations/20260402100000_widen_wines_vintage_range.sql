-- Align wines.vintage constraint with product_catalog_wines (1800-2100)
ALTER TABLE wines
  DROP CONSTRAINT wines_vintage_check;

ALTER TABLE wines
  ADD CONSTRAINT wines_vintage_check
  CHECK (vintage IS NULL OR vintage BETWEEN 1800 AND 2100);
