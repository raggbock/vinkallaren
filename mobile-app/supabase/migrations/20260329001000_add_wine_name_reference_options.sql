alter table public.reference_options
drop constraint if exists reference_options_category_check;

alter table public.reference_options
add constraint reference_options_category_check
check (category in ('grape', 'country', 'region', 'wine_name'));

create index if not exists reference_options_category_name_idx
  on public.reference_options (category, name);

insert into public.reference_options (name, category, aliases, parent_name, sort_order)
select distinct
  wine_name,
  'wine_name',
  alias_values,
  producer_name,
  1000 + row_number() over (order by wine_name, producer_name)
from (
  select
    trim(name) as wine_name,
    nullif(trim(producer), '') as producer_name,
    array_remove(array[
      nullif(trim(producer), ''),
      nullif(trim(country), ''),
      nullif(trim(region), '')
    ], null) as alias_values
  from public.product_catalog_wines
  where nullif(trim(name), '') is not null

  union

  select
    trim(name) as wine_name,
    nullif(trim(producer), '') as producer_name,
    array_remove(array[
      nullif(trim(producer), ''),
      nullif(trim(country), ''),
      nullif(trim(region), '')
    ], null) as alias_values
  from public.wines
  where nullif(trim(name), '') is not null
) seeded_names
on conflict (name, category) do update
set aliases = (
      select array(
        select distinct alias_value
        from unnest(coalesce(public.reference_options.aliases, '{}'::text[]) || excluded.aliases) as alias_value
        where alias_value is not null and alias_value <> ''
      )
    ),
    parent_name = coalesce(public.reference_options.parent_name, excluded.parent_name);
