create table if not exists public.reference_options (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('grape', 'country', 'region')),
  aliases text[] not null default '{}'::text[],
  parent_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reference_options_name_category_uidx unique (name, category)
);

create index if not exists reference_options_category_sort_idx
  on public.reference_options (category, sort_order, name);

alter table public.reference_options enable row level security;

drop policy if exists "reference_options_select_all" on public.reference_options;
create policy "reference_options_select_all"
on public.reference_options
for select
using (auth.role() = 'authenticated');

drop policy if exists "reference_options_insert_authenticated" on public.reference_options;
create policy "reference_options_insert_authenticated"
on public.reference_options
for insert
with check (auth.role() = 'authenticated');

drop policy if exists "reference_options_update_authenticated" on public.reference_options;
create policy "reference_options_update_authenticated"
on public.reference_options
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "reference_options_delete_authenticated" on public.reference_options;
create policy "reference_options_delete_authenticated"
on public.reference_options
for delete
using (auth.role() = 'authenticated');

drop trigger if exists set_reference_options_updated_at on public.reference_options;
create trigger set_reference_options_updated_at
before update on public.reference_options
for each row execute function public.set_updated_at();

insert into public.reference_options (name, category, sort_order)
select value, 'grape', row_number() over ()
from jsonb_array_elements_text(
  '[
    "Albarino","Barbera","Cabernet Franc","Cabernet Sauvignon","Carmenere","Carignan","Carménère",
    "Chardonnay","Chenin Blanc","Cinsault","Corvina","Cortese","Dolcetto","Fiano","Furmint","Gamay",
    "Garganega","Gewurztraminer","Godello","Grenache","Gruner Veltliner","Malbec","Marsanne","Merlot",
    "Mourvedre","Muscadet","Muscat","Nebbiolo","Negroamaro","Nero d''Avola","Palomino","Petite Sirah",
    "Petit Verdot","Pinot Blanc","Pinot Grigio","Pinot Gris","Pinot Noir","Pinotage","Primitivo",
    "Riesling","Roussanne","Sangiovese","Sauvignon Blanc","Semillon","Syrah","Shiraz","Tempranillo",
    "Torrontes","Trebbiano","Verdejo","Verdicchio","Vermentino","Viognier","Xinomavro","Zinfandel"
  ]'::jsonb
) as value
on conflict (name, category) do nothing;

insert into public.reference_options (name, category, sort_order)
select value, 'country', row_number() over ()
from jsonb_array_elements_text(
  '[
    "Argentina","Australia","Austria","Chile","England","France","Germany","Greece","Hungary","Italy",
    "New Zealand","Portugal","South Africa","Spain","Sweden","USA"
  ]'::jsonb
) as value
on conflict (name, category) do nothing;

insert into public.reference_options (name, category, parent_name, sort_order)
select value, 'region',
  case
    when value in ('Alsace','Beaujolais','Bordeaux','Bourgogne','Champagne','Chablis','Chateauneuf-du-Pape','Graves','Haut-Medoc','Loire','Margaux','Medoc','Pauillac','Pessac-Leognan','Pomerol','Pouilly-Fume','Saint-Emilion','Sancerre','Sauternes') then 'France'
    when value in ('Barbaresco','Barolo','Bolgheri','Brunello di Montalcino','Chianti','Chianti Classico','Etna','Piemonte','Toscana','Trentino-Alto Adige','Valpolicella','Veneto') then 'Italy'
    when value in ('Cava','Castilla y Leon','Priorat','Rias Baixas','Ribera del Duero','Rioja','Jerez') then 'Spain'
    when value in ('Mosel') then 'Germany'
    when value in ('Douro') then 'Portugal'
    when value in ('Mendoza') then 'Argentina'
    when value in ('Central Valley','Colchagua Valley') then 'Chile'
    when value in ('Hawke''s Bay','Marlborough') then 'New Zealand'
    when value in ('Coonawarra','Margaret River','McLaren Vale') then 'Australia'
    when value in ('Stellenbosch','Western Cape') then 'South Africa'
    when value in ('Calistoga','Central Coast','Finger Lakes','Lake County','Napa Valley','North Coast','Oakville','Rutherford','Sonoma','Willamette Valley') then 'USA'
    else null
  end,
  row_number() over ()
from jsonb_array_elements_text(
  '[
    "Alsace","Barbaresco","Barolo","Beaujolais","Bolgheri","Bordeaux","Bourgogne","Brunello di Montalcino",
    "Calistoga","Castilla y Leon","Cava","Central Coast","Central Valley","Champagne","Chablis",
    "Chateauneuf-du-Pape","Chianti","Chianti Classico","Colchagua Valley","Coonawarra","Cotes du Rhone",
    "Douro","Etna","Finger Lakes","Fleurie","Franciacorta","Graves","Haut-Medoc","Hawke''s Bay","Jerez",
    "Lake County","Loire","Marlborough","Margaret River","Margaux","McLaren Vale","Medoc","Mendoza",
    "Mosel","Napa Valley","North Coast","Oakville","Pauillac","Pessac-Leognan","Piemonte","Pomerol",
    "Pouilly-Fume","Priorat","Rias Baixas","Ribera del Duero","Rioja","Rutherford","Saint-Emilion",
    "Sancerre","Sauternes","Sonoma","Stellenbosch","Toscana","Trentino-Alto Adige","Valpolicella","Veneto",
    "Western Cape","Willamette Valley"
  ]'::jsonb
) as value
on conflict (name, category) do nothing;

update public.reference_options
set aliases = case
  when category = 'grape' and name = 'Cabernet Sauvignon' then array['cab', 'cab sav']
  when category = 'grape' and name = 'Sauvignon Blanc' then array['sauv blanc', 'sb']
  when category = 'grape' and name = 'Grenache' then array['garnacha', 'gren']
  when category = 'grape' and name = 'Syrah' then array['shiraz']
  when category = 'country' and name = 'France' then array['fr']
  when category = 'country' and name = 'Italy' then array['it']
  when category = 'country' and name = 'Spain' then array['es']
  when category = 'country' and name = 'USA' then array['us', 'united states']
  when category = 'region' and name = 'Bordeaux' then array['bdx', 'bor']
  when category = 'region' and name = 'Rioja' then array['rio']
  when category = 'region' and name = 'Napa Valley' then array['napa', 'nap']
  when category = 'region' and name = 'Bourgogne' then array['burgundy', 'burg']
  else aliases
end
where category in ('grape', 'country', 'region');
