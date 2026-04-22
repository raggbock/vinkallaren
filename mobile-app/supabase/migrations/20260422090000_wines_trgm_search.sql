-- Trigram search index on wines to replace 7-column ILIKE %x% scan
-- in get_cellar_overview. Mirrors the pattern in 20260405130000_scalability_indexes.sql.

CREATE INDEX IF NOT EXISTS idx_wines_search_trgm
  ON wines
  USING gin ((
    public.immutable_unaccent(lower(
      coalesce(name, '') || ' ' ||
      coalesce(producer, '') || ' ' ||
      coalesce(country, '') || ' ' ||
      coalesce(region, '') || ' ' ||
      coalesce(grape, '') || ' ' ||
      coalesce(type, '') || ' ' ||
      coalesce(cellar_location, '')
    ))
  ) gin_trgm_ops);

CREATE OR REPLACE FUNCTION get_cellar_overview(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_search  text  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_search  text := NULLIF(trim(COALESCE(p_search, '')), '');
  -- Trigram GIN requires ≥ 3 chars to be useful; below that we skip the LIKE filter
  -- rather than forcing a seq scan with a too-permissive pattern.
  v_like    text := CASE
    WHEN v_search IS NULL OR char_length(v_search) < 3 THEN NULL
    ELSE '%' || public.immutable_unaccent(lower(v_search)) || '%'
  END;
  result    jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH all_mine AS (
    SELECT quantity, storage_space_id, country, type, grape, vintage,
           food_pairings, name, producer, region, cellar_location
    FROM wines
    WHERE user_id = v_user_id AND quantity > 0
  ),
  filtered AS (
    SELECT quantity, storage_space_id, country, type, grape, vintage,
           food_pairings, name, producer, region, cellar_location
    FROM all_mine
    WHERE (NOT p_filters ? 'country'  OR country  = p_filters->>'country')
      AND (NOT p_filters ? 'region'   OR region   = p_filters->>'region')
      AND (NOT p_filters ? 'type'     OR type     = p_filters->>'type')
      AND (NOT p_filters ? 'grape'    OR grape    = p_filters->>'grape')
      AND (NOT p_filters ? 'vintage'  OR vintage::text = p_filters->>'vintage')
      AND (NOT p_filters ? 'pairing'  OR p_filters->>'pairing' = ANY(food_pairings))
      AND (NOT p_filters ? 'storage_space_id'
           OR storage_space_id = (p_filters->>'storage_space_id')::uuid)
      AND (v_like IS NULL OR public.immutable_unaccent(lower(
        coalesce(name, '') || ' ' ||
        coalesce(producer, '') || ' ' ||
        coalesce(country, '') || ' ' ||
        coalesce(region, '') || ' ' ||
        coalesce(grape, '') || ' ' ||
        coalesce(type, '') || ' ' ||
        coalesce(cellar_location, '')
      )) LIKE v_like)
  ),
  counts_by_space AS (
    SELECT storage_space_id, SUM(quantity)::int AS cnt
    FROM filtered
    WHERE storage_space_id IS NOT NULL
    GROUP BY storage_space_id
  ),
  unplaced AS (
    SELECT COALESCE(SUM(quantity), 0)::int AS cnt
    FROM filtered WHERE storage_space_id IS NULL
  ),
  top_country AS (
    SELECT country, SUM(quantity)::int AS cnt
    FROM filtered WHERE country IS NOT NULL
    GROUP BY country ORDER BY cnt DESC LIMIT 1
  ),
  top_type AS (
    SELECT type, SUM(quantity)::int AS cnt
    FROM filtered
    WHERE type IS NOT NULL
    GROUP BY type ORDER BY cnt DESC LIMIT 1
  ),
  top_pairing AS (
    SELECT p, SUM(quantity)::int AS cnt FROM (
      SELECT unnest(food_pairings) AS p, quantity FROM filtered
    ) s
    WHERE p IS NOT NULL AND p <> ''
    GROUP BY p ORDER BY cnt DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'stats', jsonb_build_object(
      'totalBottles',  COALESCE((SELECT SUM(quantity) FROM filtered), 0),
      'totalLabels',   (SELECT COUNT(*) FROM filtered),
      'averageVintage', COALESCE(
        (SELECT ROUND(AVG(vintage))::text FROM filtered WHERE vintage IS NOT NULL),
        '-'
      ),
      'topCountry', COALESCE(
        (SELECT country || ' (' || cnt || ')' FROM top_country), 'Ingen data'),
      'topType', COALESCE(
        (SELECT type || ' (' || cnt || ')' FROM top_type), 'Ingen data'),
      'topPairing', COALESCE(
        (SELECT p || ' (' || cnt || ')' FROM top_pairing), 'Ingen data')
    ),
    'bottleCountsBySpaceId', COALESCE(
      (SELECT jsonb_object_agg(storage_space_id::text, cnt) FROM counts_by_space),
      '{}'::jsonb
    ),
    'unplacedCount', (SELECT cnt FROM unplaced),
    'filterOptions', jsonb_build_object(
      'countries', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT country AS v FROM all_mine WHERE country IS NOT NULL) s),
        '[]'::jsonb),
      'regions', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT region AS v FROM all_mine WHERE region IS NOT NULL) s),
        '[]'::jsonb),
      'types', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT type AS v FROM all_mine WHERE type IS NOT NULL) s),
        '[]'::jsonb),
      'vintages', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v DESC) FROM (SELECT DISTINCT vintage::text AS v FROM all_mine WHERE vintage IS NOT NULL) s),
        '[]'::jsonb),
      'grapes', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT grape AS v FROM all_mine WHERE grape IS NOT NULL) s),
        '[]'::jsonb),
      'pairings', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT unnest(food_pairings) AS v FROM all_mine) s WHERE v IS NOT NULL AND v <> ''),
        '[]'::jsonb)
    )
  ) INTO result;

  RETURN result;
END;
$$;
