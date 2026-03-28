alter table public.wines
add column if not exists food_pairings text[] not null default '{}'::text[];

alter table public.wines
add column if not exists pairing_source text;

create index if not exists wines_user_id_food_pairings_idx
  on public.wines using gin (food_pairings);
