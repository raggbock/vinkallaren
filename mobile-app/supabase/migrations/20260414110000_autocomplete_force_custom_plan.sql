-- Rewrite autocomplete_catalog to use EXECUTE (dynamic SQL) instead of static SQL.
-- This forces PostgreSQL to create a custom query plan every time, avoiding the
-- generic plan cache miss that causes 700ms+ on first call per backend session.
-- Also drops unused duplicate indexes (27 MB savings).

drop function if exists autocomplete_catalog(text, int, boolean, int);

create or replace function autocomplete_catalog(
  query text,
  max_results int default 20,
  distinct_names boolean default true,
  result_offset int default 0
)
returns table(id uuid, name text, producer text, vintage int, image_url text, score real)
as $$
declare
  q text := immutable_unaccent(lower(trim(query)));
  words text[];
  sql text;
begin
  if length(q) < 3 then return; end if;

  words := string_to_array(q, ' ');

  if array_length(words, 1) >= 2 and length(words[2]) >= 2 then
    -- Multi-word: all words must appear in name or producer
    sql := 'WITH matches AS (
      SELECT w.id, w.name, w.producer, w.vintage, w.image_url,
        ((CASE WHEN immutable_unaccent(lower(w.name)) ILIKE ''%'' || $2 || ''%'' THEN 1 ELSE 0 END
        + CASE WHEN immutable_unaccent(lower(w.producer)) ILIKE ''%'' || $2 || ''%'' THEN 1 ELSE 0 END
        + CASE WHEN immutable_unaccent(lower(w.name)) ILIKE ''%'' || $3 || ''%'' THEN 1 ELSE 0 END
        + CASE WHEN immutable_unaccent(lower(w.producer)) ILIKE ''%'' || $3 || ''%'' THEN 1 ELSE 0 END
        + CASE WHEN $4 IS NOT NULL AND immutable_unaccent(lower(w.name)) ILIKE ''%'' || $4 || ''%'' THEN 1 ELSE 0 END
        + CASE WHEN $4 IS NOT NULL AND immutable_unaccent(lower(w.producer)) ILIKE ''%'' || $4 || ''%'' THEN 1 ELSE 0 END
        ) * 15)::real AS score
      FROM product_catalog_wines w
      WHERE (immutable_unaccent(lower(w.name)) ILIKE ''%'' || $2 || ''%''
         OR (w.producer IS NOT NULL AND immutable_unaccent(lower(w.producer)) ILIKE ''%'' || $2 || ''%''))
        AND (immutable_unaccent(lower(w.name)) ILIKE ''%'' || $3 || ''%''
         OR (w.producer IS NOT NULL AND immutable_unaccent(lower(w.producer)) ILIKE ''%'' || $3 || ''%''))
        AND ($4 IS NULL OR immutable_unaccent(lower(w.name)) ILIKE ''%'' || $4 || ''%''
         OR (w.producer IS NOT NULL AND immutable_unaccent(lower(w.producer)) ILIKE ''%'' || $4 || ''%''))
    ), ranked AS (
      SELECT m.*,
        CASE WHEN $5 THEN row_number() OVER (PARTITION BY lower(m.name) ORDER BY m.score DESC, m.vintage DESC NULLS LAST)
        ELSE 1 END AS rn
      FROM matches m
    )
    SELECT r.id, r.name, r.producer, r.vintage, r.image_url, r.score
    FROM ranked r WHERE r.rn = 1
    ORDER BY r.score DESC, r.vintage DESC NULLS LAST
    LIMIT $6 OFFSET $7';

    return query execute sql using
      q, words[1], words[2],
      case when array_length(words, 1) >= 3 then words[3] else null end,
      distinct_names, max_results, result_offset;

  elsif length(q) = 3 then
    -- Short prefix: fast ILIKE prefix match
    sql := 'WITH prefixed AS (
      SELECT w.id, w.name, w.producer, w.vintage, w.image_url, 90::real AS score,
        row_number() OVER (PARTITION BY lower(w.name) ORDER BY w.vintage DESC NULLS LAST) AS rn
      FROM product_catalog_wines w
      WHERE immutable_unaccent(lower(w.name)) ILIKE $1 || ''%''
    )
    SELECT p.id, p.name, p.producer, p.vintage, p.image_url, p.score
    FROM prefixed p WHERE p.rn = 1
    ORDER BY p.name
    LIMIT $2 OFFSET $3';

    return query execute sql using q, max_results, result_offset;

  else
    -- 4+ chars: tiered scoring with substring match
    sql := 'WITH scored AS (
      SELECT w.id, w.name, w.producer, w.vintage, w.image_url,
        greatest(
          CASE WHEN immutable_unaccent(lower(w.name)) = $1 THEN 100
               WHEN immutable_unaccent(lower(w.name)) LIKE $1 || ''%'' THEN 90
               WHEN immutable_unaccent(lower(w.name)) LIKE ''%'' || $1 || ''%'' THEN 70
               ELSE 0 END,
          CASE WHEN w.producer IS NOT NULL AND immutable_unaccent(lower(w.producer)) = $1 THEN 95
               WHEN w.producer IS NOT NULL AND immutable_unaccent(lower(w.producer)) LIKE $1 || ''%'' THEN 85
               WHEN w.producer IS NOT NULL AND immutable_unaccent(lower(w.producer)) LIKE ''%'' || $1 || ''%'' THEN 60
               ELSE 0 END
        )::real AS score
      FROM product_catalog_wines w
      WHERE immutable_unaccent(lower(w.name)) ILIKE ''%'' || $1 || ''%''
         OR (w.producer IS NOT NULL AND immutable_unaccent(lower(w.producer)) ILIKE ''%'' || $1 || ''%'')
    ), ranked AS (
      SELECT s.*,
        CASE WHEN $2 THEN row_number() OVER (PARTITION BY lower(s.name) ORDER BY s.score DESC, s.vintage DESC NULLS LAST)
        ELSE 1 END AS rn
      FROM scored s WHERE s.score > 0
    )
    SELECT r.id, r.name, r.producer, r.vintage, r.image_url, r.score
    FROM ranked r WHERE r.rn = 1
    ORDER BY r.score DESC, r.vintage DESC NULLS LAST
    LIMIT $3 OFFSET $4';

    return query execute sql using q, distinct_names, max_results, result_offset;
  end if;
end;
$$ language plpgsql stable;

-- Drop unused duplicate indexes (27 MB savings)
-- idx_catalog_wines_name_trgm: old non-normalized version, 9 scans total, replaced by _norm variant (216 scans)
drop index if exists idx_catalog_wines_name_trgm;
-- idx_catalog_image_ocr_text_trgm: old non-normalized version, 0 scans, replaced by _ocr_trgm_norm (12 scans)
drop index if exists idx_catalog_image_ocr_text_trgm;
