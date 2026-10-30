-- Restoran Maslina: kuhinja i meni. Izvor: fotografije menija na Google kartici (korisnička objava).
-- Izabrana su jela po porciji (bez riba i rakova koji se naplaćuju po kilogramu ili po 100 g). Doručak i karta pića još nisu uneseni.
-- Cijene nisu potvrđene od strane restorana (verified_at ostaje prazan).
UPDATE restaurants SET tags='["Riba", "Morska hrana", "Meso", "Pasta"]', why='["Terasa na Obali Nikole Kovačevića u Igalu", "Široka ponuda: riba, meso, paste i rižoto", "Bogata vinska karta"]' WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Špagete bolonjeze','Mljeveno meso, sos · 350 g',1200,'pasta','g',0 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Svinjski vrat','400 g',1200,'tuna','g',1 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Mušlje na buzaru','Crvena buzara · 500 g',1300,'orada','g',2 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Rižot sa pečurkama','Pečurke, riža · 350 g',1300,'pasta','g',3 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Lignje na žaru','400 g',1700,'orada','g',4 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Špagete u sosu od paradajza','250 g',1000,'pasta','g',5 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Špagete karbonara','Slanina, sos · 350 g',1300,'pasta','g',6 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Pasta sa gorgonzolom','300 g',1300,'pasta','g',7 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Pasta sa dimljenim lososom','300 g',1700,'pasta','g',8 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Bokeška pasta','Morski plodovi, pasta, sos · 450 g',2500,'pasta','g',9 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Rižot sa piletinom i povrćem','350 g',1500,'pasta','g',10 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Crni rižot','Sipa, riža · 350 g',1800,'pasta','g',11 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Piletina','400 g',1300,'tuna','g',12 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Domaća pljeskavica','450 g',1200,'tuna','g',13 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Natur šnicla','Teleće meso · 400 g',1800,'tuna','g',14 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Svinjska glazirana rebra','Rebra, mix povrće · 450 g',1400,'tuna','g',15 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Biftek','450 g',2700,'tuna','g',16 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Prigane lignje','400 g',1700,'orada','g',17 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Riba dana','400 g',1800,'orada','g',18 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Odrezak lososa','450 g',2200,'orada','g',19 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Hobotnica na domaći način','Krompir, luk, kapari · 400 g',2600,'orada','g',20 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Brodet od ribe','Više vrsta ribe · 500 g',2000,'orada','g',21 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Gotovo jelo','',1000,'pasta','g',22 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Sezonska salata','Paradajz, krastavac, paprika, zelena salata, kupus · 250 g',500,'salata','p',23 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Grčka salata','Feta sir, masline · 300 g',700,'salata','p',24 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Šopska salata','Feta sir · 350 g',550,'salata','p',25 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Rukola šeri salata','250 g',700,'salata','p',26 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Prilog','150 g',400,'salata','p',27 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Domaće masline','200 g',500,'salata','p',28 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Pršut','100 g',800,'salata','p',29 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Slane sardele','200 g',700,'salata','p',30 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Peraška torta','Bademi, jaja, brašno, šećer · 150 g',500,'salata','z',31 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Tres leches','Jaja, mlijeko, brašno, šećer · 150 g',400,'salata','z',32 FROM restaurants WHERE slug='restoran-maslina-igalo';
INSERT INTO menu_items (restaurant_id,name,description,price_cents,art,kind,sort) SELECT id,'Sladoled','1 kugla',200,'salata','z',33 FROM restaurants WHERE slug='restoran-maslina-igalo';
