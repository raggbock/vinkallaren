-- Enable unaccent for accent-insensitive matching
create extension if not exists unaccent;

-- Recreate match_catalog_by_text with accent-stripping and lower threshold
drop function if exists match_catalog_by_text(text, int);

create or replace function match_catalog_by_text(query text, max_results int default 5)
returns table(id uuid, name text, producer text, vintage int, image_url text, similarity real)
as $$
  select id, name, producer, vintage, image_url,
         greatest(
           similarity(unaccent(lower(name)), unaccent(lower(query))),
           coalesce(similarity(unaccent(lower(image_ocr_text)), unaccent(lower(query))), 0)
         ) as similarity
  from product_catalog_wines
  where similarity(unaccent(lower(name)), unaccent(lower(query))) > 0.15
     or similarity(unaccent(lower(image_ocr_text)), unaccent(lower(query))) > 0.15
  order by similarity desc
  limit max_results;
$$ language sql stable;
