-- GIN trigram index on normalized producer for autocomplete
create index if not exists idx_catalog_wines_producer_trgm_norm
  on product_catalog_wines using gin (public.immutable_unaccent(lower(producer)) gin_trgm_ops);

-- Autocomplete: fuzzy search across name, producer, and OCR text
create or replace function autocomplete_catalog(query text, max_results int default 20)
returns table(id uuid, name text, producer text, vintage int, image_url text, score real)
as $$
begin
  if length(trim(query)) < 2 then
    return;
  end if;

  perform set_config('pg_trgm.similarity_threshold', '0.15', true);

  return query
  select r.id, r.name, r.producer, r.vintage, r.image_url, r.score
  from (
    select w.id, w.name, w.producer, w.vintage, w.image_url,
           greatest(
             similarity(public.immutable_unaccent(lower(w.name)), public.immutable_unaccent(lower(query))),
             coalesce(similarity(public.immutable_unaccent(lower(w.producer)), public.immutable_unaccent(lower(query))), 0) * 0.9,
             coalesce(similarity(public.immutable_unaccent(lower(w.image_ocr_text)), public.immutable_unaccent(lower(query))), 0) * 0.6
           )::real as score,
           row_number() over (partition by lower(w.name), lower(w.producer) order by w.vintage desc nulls last) as rn
    from product_catalog_wines w
    where public.immutable_unaccent(lower(w.name)) % public.immutable_unaccent(lower(query))
       or public.immutable_unaccent(lower(w.producer)) % public.immutable_unaccent(lower(query))
       or public.immutable_unaccent(lower(w.image_ocr_text)) % public.immutable_unaccent(lower(query))
  ) r
  where r.rn = 1
  order by r.score desc
  limit max_results;
end;
$$ language plpgsql stable;
