alter table public.wines
add column if not exists grape text;

create index if not exists wines_user_id_grape_idx
  on public.wines (user_id, grape);
