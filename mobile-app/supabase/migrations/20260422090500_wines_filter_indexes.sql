-- Compound indexes for common filter combinations in get_cellar_overview.
-- Partial WHERE quantity > 0 matches the RPC's base predicate.

CREATE INDEX IF NOT EXISTS idx_wines_user_type
  ON wines (user_id, type) WHERE quantity > 0;

CREATE INDEX IF NOT EXISTS idx_wines_user_country
  ON wines (user_id, country) WHERE quantity > 0;

CREATE INDEX IF NOT EXISTS idx_wines_user_vintage
  ON wines (user_id, vintage) WHERE quantity > 0;

CREATE INDEX IF NOT EXISTS idx_wines_user_grape
  ON wines (user_id, grape) WHERE quantity > 0;

CREATE INDEX IF NOT EXISTS idx_wines_food_pairings_gin
  ON wines USING gin (food_pairings) WHERE quantity > 0;
