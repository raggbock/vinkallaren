alter table public.wines
add column if not exists systembolaget_product_id text;

create index if not exists wines_user_id_systembolaget_product_id_idx
  on public.wines (user_id, systembolaget_product_id);
