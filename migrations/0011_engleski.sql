-- Engleski tekstovi (nije obavezno; ako je polje prazno, prikazuje se crnogorski tekst).
ALTER TABLE items ADD COLUMN title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN description_en TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN details_en TEXT NOT NULL DEFAULT '';
ALTER TABLE restaurants ADD COLUMN ambience_en TEXT NOT NULL DEFAULT '';
