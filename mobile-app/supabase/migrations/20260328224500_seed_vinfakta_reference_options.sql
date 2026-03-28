insert into public.reference_options (name, category, sort_order)
select value, 'grape', row_number() over ()
from jsonb_array_elements_text(
  '[
    "Zinfandel",
    "Cabernet Sauvignon",
    "Pinot Noir",
    "Chardonnay",
    "Primitivo",
    "Nebbiolo",
    "Barbera",
    "Dolcetto",
    "Cortese",
    "Arneis",
    "Timorasso",
    "Sangiovese",
    "Petit Verdot",
    "Syrah/Shiraz",
    "Gamaby",
    "Xarel-lo",
    "Chenin blanc",
    "Gruner Veltliner",
    "Grenache",
    "Cinsault",
    "Sauvignon blanc",
    "Mourvedre",
    "Carignan",
    "Pinot Gris",
    "Pinot Grigio",
    "Grauburgunder",
    "Tempranillo",
    "Cataratto",
    "Semillon",
    "Viognier",
    "Sercial",
    "Vouvray",
    "Airen",
    "Carmenere",
    "Negroamaro",
    "Aglianico",
    "Gewurztraminer",
    "Riesling",
    "Muscat",
    "Nero d''Avola",
    "Trebbiano",
    "Pinot Blanc",
    "Solaris",
    "Cabernet Cortis",
    "Muscaris",
    "Souvigner Gris",
    "Glera",
    "Jaen",
    "Mencia",
    "Colorino",
    "Garnacha",
    "Monastrell",
    "Honchurabbi",
    "Munemanatsa",
    "Nerella Mascalese",
    "Pinotage",
    "Alvarinho",
    "Koshu",
    "Verdejo"
  ]'::jsonb
) as value
on conflict (name, category) do nothing;

insert into public.reference_options (name, category, sort_order)
select value, 'country', row_number() over ()
from jsonb_array_elements_text(
  '[
    "USA",
    "Frankrike",
    "Italien"
  ]'::jsonb
) as value
on conflict (name, category) do nothing;

insert into public.reference_options (name, category, parent_name, sort_order)
select value.name,
       'region',
       value.parent_name,
       row_number() over ()
from (
  values
    ('Washington', 'USA'),
    ('Cotes Du Rhone', 'Frankrike'),
    ('Toscana', 'Italien'),
    ('Piemonte', 'Italien'),
    ('Sancerre', 'Frankrike'),
    ('Alsace', 'Frankrike'),
    ('Bourgogne', 'Frankrike'),
    ('Columbia valley', 'Washington'),
    ('Chianti', 'Toscana'),
    ('Alba', 'Piemonte'),
    ('Asti', 'Piemonte'),
    ('Barolo', 'Piemonte'),
    ('Barbaresco', 'Piemonte'),
    ('Brunello de Montalcino', 'Toscana')
) as value(name, parent_name)
on conflict (name, category) do nothing;
