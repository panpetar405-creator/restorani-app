-- Restoran Babić, Igalo (Herceg Novi), II Dalmatinske 76. Podaci: Google Maps kartica (ocjena 4,6 / 1671 recenzija), radno vrijeme 07-23h.
-- Specijalitet: roštilj i meso (miks roštilj, ribaj, pljeskavica, džigerica, čorba, jabuka pita); ima i mesnicu.
-- Meni i cijene još nisu uneseni, pa aplikacija piše „Cijena uskoro" dok se ne dodaju stavke.
-- Koordinate su sa Google Maps kartice.
INSERT INTO restaurants (slug,name,city,rating,review_count,tags,amenities,moods,why,ambience,art,km,phone,lat,lng)
VALUES (
  'restoran-babic-igalo',
  'Restoran Babić',
  'Herceg Novi',
  4.6,
  1671,
  '["Roštilj", "Meso", "Domaća kuhinja"]',
  '[]',
  '[]',
  '["Roštilj i meso, velike porcije", "Povoljne cijene, jedu i mještani", "Otvoreno svaki dan 07-23h"]',
  'Domaća kuhinja, roštilj',
  'terasa',
  2.0,
  '+382 68 821 355',
  42.455437,
  18.499346
);
