-- Enable trigram extension for fuzzy text matching
create extension if not exists pg_trgm;

-- Trigram index on wine name for fast similarity search
create index if not exists idx_catalog_wines_name_trgm
  on product_catalog_wines using gin (name gin_trgm_ops);

-- RPC function: fuzzy-match catalog wines by text
create or replace function match_catalog_by_text(query text, max_results int default 5)
returns table(id uuid, name text, producer text, vintage int, similarity real)
as $$
  select id, name, producer, vintage,
         similarity(name, query) as similarity
  from product_catalog_wines
  where similarity(name, query) > 0.2
  order by similarity desc
  limit max_results;
$$ language sql stable;
