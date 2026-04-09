-- Improved autocomplete: fast prefix + substring with tiered ranking
-- 3-char queries: prefix-only, no dedup (~44ms vs 1381ms)
-- 4+ char queries: substring match with ranked scoring (~55ms vs 116ms)
-- No similarity() calls — pure ILIKE with GIN trigram indexes

drop function if exists autocomplete_catalog(text, int);

create or replace function autocomplete_catalog(
  query text,
  max_results int default 20,
  distinct_names boolean default true
)
returns table(id uuid, name text, producer text, vintage int, image_url text, score real)
as $$
declare
  q text := immutable_unaccent(lower(trim(query)));
begin
  if length(q) < 3 then return; end if;

  if length(q) = 3 then
    -- 3-char query: fast prefix, no dedup, no ranking
    return query
    select w.id, w.name, w.producer, w.vintage, w.image_url, 90::real as score
    from product_catalog_wines w
    where immutable_unaccent(lower(w.name)) ilike q || '%'
    limit max_results;

  else
    -- 4+ chars: substring match with tiered ranking + dedup
    return query
    with scored as (
      select w.id, w.name, w.producer, w.vintage, w.image_url,
        greatest(
          case when immutable_unaccent(lower(w.name)) = q then 100
               when immutable_unaccent(lower(w.name)) like q || '%' then 90
               when immutable_unaccent(lower(w.name)) like '%' || q || '%' then 70
               else 0 end,
          case when w.producer is not null and immutable_unaccent(lower(w.producer)) = q then 95
               when w.producer is not null and immutable_unaccent(lower(w.producer)) like q || '%' then 85
               when w.producer is not null and immutable_unaccent(lower(w.producer)) like '%' || q || '%' then 60
               else 0 end
        )::real as score
      from product_catalog_wines w
      where immutable_unaccent(lower(w.name)) ilike '%' || q || '%'
         or (w.producer is not null and immutable_unaccent(lower(w.producer)) ilike '%' || q || '%')
    ),
    ranked as (
      select s.*,
        case when distinct_names then
          row_number() over (partition by lower(s.name), lower(s.producer) order by s.vintage desc nulls last)
        else 1 end as rn
      from scored s where s.score > 0
    )
    select r.id, r.name, r.producer, r.vintage, r.image_url, r.score
    from ranked r where r.rn = 1
    order by r.score desc, r.vintage desc nulls last
    limit max_results;
  end if;
end;
$$ language plpgsql stable;
