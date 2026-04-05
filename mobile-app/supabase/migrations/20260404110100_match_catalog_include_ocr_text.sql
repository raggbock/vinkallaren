-- Recreate match_catalog_by_text to also search image_ocr_text
drop function if exists match_catalog_by_text(text, int);

create or replace function match_catalog_by_text(query text, max_results int default 5)
returns table(id uuid, name text, producer text, vintage int, image_url text, similarity real)
as $$
  select id, name, producer, vintage, image_url,
         greatest(
           similarity(name, query),
           coalesce(similarity(image_ocr_text, query), 0)
         ) as similarity
  from product_catalog_wines
  where similarity(name, query) > 0.2
     or similarity(image_ocr_text, query) > 0.25
  order by similarity desc
  limit max_results;
$$ language sql stable;
