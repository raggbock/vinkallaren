-- Replace set_image_ocr_text to merge new words into existing OCR text
-- instead of overwriting. Each scan makes future matching better.
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
begin
  select image_ocr_text into existing
  from product_catalog_wines where id = wine_id;

  -- If no existing text, just save directly
  if existing is null or existing = '' then
    update product_catalog_wines
    set image_ocr_text = ocr_text
    where id = wine_id;
    return;
  end if;

  -- Extract unique lowercase words from both texts
  existing_words := array(
    select distinct lower(word) from unnest(regexp_split_to_array(existing, '\s+')) as word
    where length(word) >= 2
  );
  new_words := array(
    select distinct lower(word) from unnest(regexp_split_to_array(ocr_text, '\s+')) as word
    where length(word) >= 2
  );

  -- Merge: keep existing text + append only new unique words
  merged := existing || ' ' || (
    select coalesce(string_agg(w, ' '), '')
    from unnest(new_words) as w
    where lower(w) != all(existing_words)
  );

  update product_catalog_wines
  set image_ocr_text = trim(merged)
  where id = wine_id;
end;
$$;
