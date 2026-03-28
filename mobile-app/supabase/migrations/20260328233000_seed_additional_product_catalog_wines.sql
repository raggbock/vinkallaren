merge into public.product_catalog_wines as target
using (
  values
    (
      '5603016002379',
      'Vinhas de Pegoes Tinto',
      'Adega de Pegoes',
      'Portugal',
      'Peninsula de Setubal',
      'Castelao, Aragonez, Syrah',
      'Rott',
      null::integer,
      array['grillat', 'not', 'lamm']::text[],
      'Producer seed',
      'high'
    ),
    (
      '5603016003208',
      'Caves de Pegoes Tinto',
      'Adega de Pegoes',
      'Portugal',
      'Peninsula de Setubal',
      'Castelao, Aragonez, Alicante Bouschet',
      'Rott',
      null::integer,
      array['grillat', 'not', 'lamm']::text[],
      'Producer seed',
      'high'
    ),
    (
      '5603016004786',
      'Caves de Pegoes Branco',
      'Adega de Pegoes',
      'Portugal',
      'Peninsula de Setubal',
      'Fernao Pires, Moscatel Graudo, Antao Vaz',
      'Vitt',
      null::integer,
      array['fisk', 'skaldjur', 'sallad']::text[],
      'Producer seed',
      'high'
    ),
    (
      '5603016004519',
      'Rovisco Pais Reserve White',
      'Adega de Pegoes',
      'Portugal',
      'Peninsula de Setubal',
      'Antao Vaz, Verdelho, Fernao Pires, Arinto',
      'Vitt',
      null::integer,
      array['fisk', 'skaldjur', 'ost']::text[],
      'Producer seed',
      'high'
    ),
    (
      '5603016003116',
      'Adega de Pegoes Grande Reserva Tinto',
      'Adega de Pegoes',
      'Portugal',
      'Peninsula de Setubal',
      'Syrah, Touriga Nacional, Aragonez, Alicante Bouschet',
      'Rott',
      null::integer,
      array['vilt', 'not', 'lamm']::text[],
      'Producer seed',
      'high'
    ),
    (
      '5603016001617',
      'Adega de Pegoes Moscatel de Setubal',
      'Adega de Pegoes',
      'Portugal',
      'Peninsula de Setubal',
      'Moscatel de Setubal',
      'Dessert',
      null::integer,
      array['dessert', 'frukt', 'blamogelost']::text[],
      'Producer seed',
      'high'
    ),
    (
      '8423253171501',
      'La Val Albarino',
      'La Val',
      'Spain',
      'Rias Baixas',
      'Albarino',
      'Vitt',
      null::integer,
      array['fisk', 'skaldjur', 'sallad']::text[],
      'Importer seed',
      'high'
    ),
    (
      '8423253202304',
      'Finca Arantei',
      'La Val',
      'Spain',
      'Rias Baixas',
      'Albarino',
      'Vitt',
      null::integer,
      array['fisk', 'skaldjur', 'sallad']::text[],
      'Importer seed',
      'medium'
    )
) as source (
  barcode,
  name,
  producer,
  country,
  region,
  grape,
  type,
  vintage,
  food_pairings,
  source_label,
  source_confidence
)
on target.barcode = source.barcode
when matched then
  update set
    name = source.name,
    producer = source.producer,
    country = source.country,
    region = source.region,
    grape = source.grape,
    type = source.type,
    vintage = source.vintage,
    food_pairings = source.food_pairings,
    source_label = source.source_label,
    source_confidence = source.source_confidence
when not matched then
  insert (
    barcode,
    name,
    producer,
    country,
    region,
    grape,
    type,
    vintage,
    food_pairings,
    source_label,
    source_confidence
  )
  values (
    source.barcode,
    source.name,
    source.producer,
    source.country,
    source.region,
    source.grape,
    source.type,
    source.vintage,
    source.food_pairings,
    source.source_label,
    source.source_confidence
  );
