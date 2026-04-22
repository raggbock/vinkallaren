-- Only vintage is missing from the existing (user_id, X) index set created by
-- earlier migrations — type/country/grape/food_pairings already exist as
-- wines_user_id_type_idx / wines_user_id_country_idx / wines_user_id_grape_idx /
-- wines_user_id_food_pairings_idx. Adding duplicates would only cost writes.
--
-- Intentionally NO GIN on food_pairings: get_cellar_overview materializes
-- `all_mine` before filtering on `= ANY(food_pairings)`, so a GIN index would
-- never be used. Revisit if the RPC is ever restructured to push the pairing
-- filter down to the base table.

CREATE INDEX IF NOT EXISTS wines_user_id_vintage_idx
  ON wines (user_id, vintage) WHERE quantity > 0;
