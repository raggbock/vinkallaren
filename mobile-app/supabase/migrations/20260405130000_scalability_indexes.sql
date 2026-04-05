-- Immutable wrapper for unaccent (required for expression indexes)
create or replace function public.immutable_unaccent(text) returns text
language sql immutable strict parallel safe
as $$ select public.unaccent($1) $$;

-- Expression indexes for trigram search on normalized text
create index if not exists idx_catalog_wines_name_trgm_norm
  on product_catalog_wines using gin (public.immutable_unaccent(lower(name)) gin_trgm_ops);

create index if not exists idx_catalog_wines_ocr_trgm_norm
  on product_catalog_wines using gin (public.immutable_unaccent(lower(image_ocr_text)) gin_trgm_ops);

-- Recreate match function: uses % operator for GIN index, threshold 0.2, vintage boost
drop function if exists match_catalog_by_text(text, int, int);

create or replace function match_catalog_by_text(query text, max_results int default 5, query_vintage int default null)
returns table(id uuid, name text, producer text, vintage int, image_url text, similarity real)
as $$
begin
  perform set_config('pg_trgm.similarity_threshold', '0.2', true);

  return query
  select w.id, w.name, w.producer, w.vintage, w.image_url,
         (greatest(
           similarity(public.immutable_unaccent(lower(w.name)), public.immutable_unaccent(lower(query))),
           coalesce(similarity(public.immutable_unaccent(lower(w.image_ocr_text)), public.immutable_unaccent(lower(query))), 0)
         )
         + case when query_vintage is not null and w.vintage = query_vintage then 0.15 else 0 end
         )::real as similarity
  from product_catalog_wines w
  where public.immutable_unaccent(lower(w.name)) % public.immutable_unaccent(lower(query))
     or public.immutable_unaccent(lower(w.image_ocr_text)) % public.immutable_unaccent(lower(query))
  order by similarity desc
  limit max_results;
end;
$$ language plpgsql stable;

-- Cap OCR text at 2000 chars in merge function
create or replace function set_image_ocr_text(wine_id uuid, ocr_text text)
returns void
language plpgsql
security definer
as $$
declare
  existing text;
  existing_words text[];
  new_words text[];
  merged text;
  max_len constant int := 2000;
begin
  select image_ocr_text into existing
  from product_catalog_wines where id = wine_id;

  if existing is null or existing = '' then
    update product_catalog_wines
    set image_ocr_text = left(ocr_text, max_len)
    where id = wine_id;
    return;
  end if;

  if length(existing) >= max_len then
    return;
  end if;

  existing_words := array(
    select distinct lower(word) from unnest(regexp_split_to_array(existing, '\s+')) as word
    where length(word) >= 2
  );
  new_words := array(
    select distinct lower(word) from unnest(regexp_split_to_array(ocr_text, '\s+')) as word
    where length(word) >= 2
  );

  merged := existing || ' ' || (
    select coalesce(string_agg(w, ' '), '')
    from unnest(new_words) as w
    where lower(w) != all(existing_words)
  );

  update product_catalog_wines
  set image_ocr_text = left(trim(merged), max_len)
  where id = wine_id;
end;
$$;
