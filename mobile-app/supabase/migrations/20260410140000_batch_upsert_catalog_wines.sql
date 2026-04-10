-- Batch upsert catalog wines: replaces per-wine backfill with single call
create or replace function public.batch_upsert_catalog_wines(wines jsonb)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  upserted integer := 0;
begin
  with input as (
    select
      nullif(trim(w->>'barcode'), '') as barcode,
      nullif(trim(w->>'systembolaget_product_id'), '') as systembolaget_product_id,
      trim(w->>'name') as name,
      nullif(trim(w->>'producer'), '') as producer,
      nullif(trim(w->>'country'), '') as country,
      nullif(trim(w->>'region'), '') as region,
      nullif(trim(w->>'grape'), '') as grape,
      nullif(trim(w->>'type'), '') as type,
      (w->>'vintage')::integer as vintage,
      coalesce(w->'food_pairings', '[]'::jsonb) as food_pairings,
      coalesce(w->>'source_label', 'MinVinkällaren') as source_label,
      coalesce(w->>'source_confidence', 'high') as source_confidence,
      nullif(trim(w->>'created_by'), '') as created_by
    from jsonb_array_elements(wines) as w
    where trim(w->>'name') <> ''
  )
  insert into product_catalog_wines (
    barcode, systembolaget_product_id, name, producer, country, region,
    grape, type, vintage, food_pairings, source_label, source_confidence, created_by
  )
  select * from input
  on conflict (name, producer, vintage)
  do update set
    country = coalesce(excluded.country, product_catalog_wines.country),
    region = coalesce(excluded.region, product_catalog_wines.region),
    grape = coalesce(excluded.grape, product_catalog_wines.grape),
    type = coalesce(excluded.type, product_catalog_wines.type),
    food_pairings = case
      when jsonb_array_length(excluded.food_pairings) > 0 then excluded.food_pairings
      else product_catalog_wines.food_pairings
    end,
    updated_at = now();

  get diagnostics upserted = row_count;
  return upserted;
end;
$$;
