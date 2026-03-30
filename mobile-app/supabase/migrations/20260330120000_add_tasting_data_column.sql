alter table public.wine_history add column if not exists tasting_data jsonb default null;
