-- Detalji stavke + galerija (slike, video). ref: 'i:<slug>' za items, 'r:<slug>' za restorane.
ALTER TABLE items ADD COLUMN details TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN website TEXT NOT NULL DEFAULT '';
CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image','video','youtube')),
  url TEXT NOT NULL,            -- https URL slike/videa (mp4), ili YouTube link/ID
  poster TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  credit TEXT NOT NULL DEFAULT '',  -- autor / izvor fotografije
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_media_ref ON media(ref, sort);
