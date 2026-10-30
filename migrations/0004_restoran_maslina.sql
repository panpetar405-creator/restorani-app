-- Restoran Maslina, Igalo (Herceg Novi). Podaci: Google Maps kartica.
-- Koordinate nisu poznate (NULL): navigacija traži po nazivu i gradu, a restoran se ne prikazuje na mapi.
-- Meni i cijene još nisu uneseni, pa aplikacija piše „Cijena uskoro" dok se ne dodaju stavke.
INSERT INTO restaurants (slug,name,city,rating,review_count,tags,amenities,moods,why,ambience,art,km,phone,lat,lng)
VALUES (
  'restoran-maslina-igalo',
  'Restoran Maslina',
  'Herceg Novi',
  4.9,
  125,
  '["Restoran"]',
  '["Terasa"]',
  '[]',
  '["Terasa na Obali Nikole Kovačevića u Igalu", "Bogata vinska karta"]',
  'Terasa',
  'terasa',
  2.0,
  '+382 69 575 119',
  NULL,
  NULL
);
