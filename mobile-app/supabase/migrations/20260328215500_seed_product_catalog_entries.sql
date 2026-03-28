merge into public.product_catalog_wines as target
using (
  values
    (
      '5603016003505',
      'Vinhas de Pegoes Syrah',
      'Adega de Pegoes',
      'Portugal',
      'Peninsula de Setubal',
      'Syrah',
      'Rött',
      null::integer,
      array['lamm', 'nöt', 'grillat']::text[],
      'Producer seed',
      'high'
    ),
    (
      '5603016000665',
      'Adega de Pegoes Touriga Nacional',
      'Adega de Pegoes',
      'Portugal',
      'Peninsula de Setubal',
      'Touriga Nacional',
      'Rött',
      null::integer,
      array['lamm', 'vilt', 'grillat']::text[],
      'Producer seed',
      'high'
    ),
    (
      '5603016000788',
      'Adega de Pegoes White',
      'Adega de Pegoes',
      'Portugal',
      'Peninsula de Setubal',
      'Fernao Pires, Moscatel, Arinto',
      'Vitt',
      null::integer,
      array['fisk', 'skaldjur', 'sallad']::text[],
      'Producer seed',
      'high'
    ),
    (
      '810404021538',
      'Niersteiner Riesling Trocken Aus Ersten Lagen',
      'Weingut Wittmann',
      'Germany',
      'Rheinhessen',
      'Riesling',
      'Vitt',
      2024,
      array['fisk', 'asiatiskt', 'skaldjur']::text[],
      'Importer seed',
      'high'
    ),
    (
      '051497037239',
      'Vina Real Gran Reserva',
      'Vina Real',
      'Spain',
      'Rioja',
      'Tempranillo, Graciano',
      'Rött',
      null::integer,
      array['lamm', 'nöt', 'lagrad ost']::text[],
      'Distributor seed',
      'high'
    ),
    (
      '051497037154',
      'Contino Garnacha',
      'Contino',
      'Spain',
      'Rioja',
      'Garnacha',
      'Rött',
      null::integer,
      array['lamm', 'grillat', 'tapas']::text[],
      'Distributor seed',
      'high'
    ),
    (
      '051497053093',
      'Regueiron Godello',
      'Virgen del Galir',
      'Spain',
      'Valdeorras',
      'Godello',
      'Vitt',
      null::integer,
      array['fisk', 'skaldjur', 'sallad']::text[],
      'Distributor seed',
      'high'
    ),
    (
      '00098709088580',
      'Bodega Catena Zapata Malbec',
      'Bodega Catena Zapata',
      'Argentina',
      'Mendoza',
      'Malbec',
      'Rött',
      2016,
      array['nöt', 'grillat', 'vilt']::text[],
      'Retail seed',
      'medium'
    ),
    (
      '00669576019214',
      'Decoy Sauvignon Blanc',
      'Decoy',
      'USA',
      'Napa Valley',
      'Sauvignon Blanc',
      'Vitt',
      2018,
      array['fisk', 'getost', 'sallad']::text[],
      'Retail seed',
      'medium'
    ),
    (
      '8000160623288',
      'Granaio Chianti Classico DOCG',
      'Fattorie Melini',
      'Italy',
      'Chianti Classico',
      'Sangiovese Grosso',
      'Rött',
      null::integer,
      array['pasta', 'pizza', 'lamm']::text[],
      'Retail seed',
      'medium'
    ),
    (
      '4860099003308',
      'Umano Kisi Dry White Wine',
      'Umano Wines',
      'Georgia',
      'Kakheti',
      'Kisi',
      'Vitt',
      2024,
      array['fisk', 'ost', 'sallad']::text[],
      'Retail seed',
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
