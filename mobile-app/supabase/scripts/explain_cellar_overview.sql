-- EXPLAIN (ANALYZE, BUFFERS) for get_cellar_overview — verifies that the
-- wines-trgm-search and filter-column indexes added in
-- 20260422090000/20260422090500 are actually scanned by the RPC.
--
-- Run this in the Supabase SQL editor (or `supabase db execute`) after the
-- migrations have been applied. Expects the caller to be authenticated as a
-- user with a meaningful cellar (≥ 500 wines for the index effects to be
-- visible).
--
-- What to look for:
--   * The outer "all_mine" CTE should show `Index Scan using
--     wines_user_id_quantity_partial_idx` or a bitmap heap scan driven by the
--     same index — not a seq scan on `wines`.
--   * With a 3+ char search, the LIKE predicate should show
--     `Bitmap Index Scan on idx_wines_search_trgm` or a similar trigram path.
--   * With a 1-2 char search, the LIKE predicate should be skipped entirely
--     (v_like is NULL per the length gate in the migration).

-- Baseline: no filter, no search — should hit the partial index.
EXPLAIN (ANALYZE, BUFFERS)
SELECT get_cellar_overview('{}'::jsonb, NULL);

-- Filter on type: should exercise idx_wines_user_type (materialization
-- caveats apply — if the planner materialises all_mine, the index may not
-- be picked, which is itself a finding worth noting).
EXPLAIN (ANALYZE, BUFFERS)
SELECT get_cellar_overview('{"type":"Rött"}'::jsonb, NULL);

-- Trigram search path (≥ 3 chars).
EXPLAIN (ANALYZE, BUFFERS)
SELECT get_cellar_overview('{}'::jsonb, 'bar');

-- Short search — length gate should skip the LIKE, no trigram scan.
EXPLAIN (ANALYZE, BUFFERS)
SELECT get_cellar_overview('{}'::jsonb, 'ba');

-- Combined: filter + search.
EXPLAIN (ANALYZE, BUFFERS)
SELECT get_cellar_overview('{"country":"Italien"}'::jsonb, 'barolo');
