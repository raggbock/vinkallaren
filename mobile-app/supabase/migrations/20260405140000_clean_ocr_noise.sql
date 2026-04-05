-- Helper: clean OCR text by removing noise tokens
-- Keeps words with 2+ chars that contain a letter, plus 4-digit years
create or replace function clean_ocr_text(raw text) returns text
language sql immutable strict parallel safe
as $$
  select string_agg(word, ' ')
  from (
    select word from unnest(regexp_split_to_array(
      regexp_replace(raw, '[^a-zA-ZÀ-ÿ0-9 ]', ' ', 'g'),
      '\s+'
    )) as word
    where length(word) >= 2
      and (
        word ~ '[a-zA-ZÀ-ÿ]'
        or word ~ '^\d{4}$'
      )
  ) t
$$;

-- Update set_image_ocr_text to clean before storing
create or replace function set_image_ocr_text(wine_id uuid, ocr_text text)
returns void
language plpgsql
security definer
as $$
declare
  existing text;
  cleaned text;
  existing_words text[];
  new_words text[];
  merged text;
  max_len constant int := 2000;
begin
  cleaned := clean_ocr_text(ocr_text);
  if cleaned is null or cleaned = '' then return; end if;

  select image_ocr_text into existing
  from product_catalog_wines where id = wine_id;

  if existing is null or existing = '' then
    update product_catalog_wines
    set image_ocr_text = left(cleaned, max_len)
    where id = wine_id;
    return;
  end if;

  if length(existing) >= max_len then return; end if;

  existing_words := array(
    select distinct lower(w) from unnest(string_to_array(existing, ' ')) as w
    where length(w) >= 2
  );
  new_words := array(
    select distinct lower(w) from unnest(string_to_array(cleaned, ' ')) as w
    where length(w) >= 2
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
