-- Oznaka „Popularno” na karticama (početna, istraži). Postavlja se ručno:
--   UPDATE items SET featured = 1 WHERE slug = 'sea-dance-festival';
ALTER TABLE items ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
