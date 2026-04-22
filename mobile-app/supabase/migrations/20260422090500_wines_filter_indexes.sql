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

-- Intentionally NO GIN index on food_pairings: get_cellar_overview materializes
-- `all_mine` before filtering on `= ANY(food_pairings)`, so a GIN index would
-- never be used and would pure-cost every wine insert/update. Revisit if the
-- RPC is ever restructured to push the pairing filter down to the base table.
