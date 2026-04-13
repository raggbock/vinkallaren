-- Add result_offset parameter to autocomplete_catalog for real pagination
-- Must drop old signature first to avoid overload ambiguity

drop function if exists autocomplete_catalog(text, int, boolean);
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
  w1 text;
  w2 text;
  w3 text;
begin
  if length(q) < 3 then return; end if;

  words := string_to_array(q, ' ');
  w1 := words[1];
  w2 := case when array_length(words, 1) >= 2 then words[2] else null end;
  w3 := case when array_length(words, 1) >= 3 then words[3] else null end;

  if array_length(words, 1) >= 2 and length(w2) >= 2 then
    return query
    with matches as (
      select w.id, w.name, w.producer, w.vintage, w.image_url,
        ((case when immutable_unaccent(lower(w.name)) ilike '%' || w1 || '%' then 1 else 0 end
       + case when immutable_unaccent(lower(w.producer)) ilike '%' || w1 || '%' then 1 else 0 end
       + case when immutable_unaccent(lower(w.name)) ilike '%' || w2 || '%' then 1 else 0 end
       + case when immutable_unaccent(lower(w.producer)) ilike '%' || w2 || '%' then 1 else 0 end
       + case when w3 is not null and immutable_unaccent(lower(w.name)) ilike '%' || w3 || '%' then 1 else 0 end
       + case when w3 is not null and immutable_unaccent(lower(w.producer)) ilike '%' || w3 || '%' then 1 else 0 end
        ) * 15)::real as score
      from product_catalog_wines w
      where (immutable_unaccent(lower(w.name)) ilike '%' || w1 || '%'
         or (w.producer is not null and immutable_unaccent(lower(w.producer)) ilike '%' || w1 || '%'))
        and (immutable_unaccent(lower(w.name)) ilike '%' || w2 || '%'
         or (w.producer is not null and immutable_unaccent(lower(w.producer)) ilike '%' || w2 || '%'))
        and (w3 is null or immutable_unaccent(lower(w.name)) ilike '%' || w3 || '%'
         or (w.producer is not null and immutable_unaccent(lower(w.producer)) ilike '%' || w3 || '%'))
    ),
    ranked as (
      select m.*,
        case when distinct_names then
          row_number() over (partition by lower(m.name) order by m.score desc, m.vintage desc nulls last)
        else 1 end as rn
      from matches m
    )
    select r.id, r.name, r.producer, r.vintage, r.image_url, r.score
    from ranked r where r.rn = 1
    order by r.score desc, r.vintage desc nulls last
    limit max_results offset result_offset;

  elsif length(q) = 3 then
    return query
    with prefixed as (
      select w.id, w.name, w.producer, w.vintage, w.image_url, 90::real as score,
        row_number() over (partition by lower(w.name) order by w.vintage desc nulls last) as rn
      from product_catalog_wines w
      where immutable_unaccent(lower(w.name)) ilike q || '%'
    )
    select p.id, p.name, p.producer, p.vintage, p.image_url, p.score
    from prefixed p where p.rn = 1
    order by p.name
    limit max_results offset result_offset;

  else
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
          row_number() over (partition by lower(s.name) order by s.score desc, s.vintage desc nulls last)
        else 1 end as rn
      from scored s where s.score > 0
    )
    select r.id, r.name, r.producer, r.vintage, r.image_url, r.score
    from ranked r where r.rn = 1
    order by r.score desc, r.vintage desc nulls last
    limit max_results offset result_offset;
  end if;
end;
$$ language plpgsql stable;
