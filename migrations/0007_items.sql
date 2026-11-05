-- Događaji i lokacije (plaže, kultura) sa datumima ili sezonom. Gastronomija ostaje u tabeli restaurants.
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('event','beach','culture')),
  title TEXT NOT NULL,
  place TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  date_from TEXT,
  date_to TEXT,
  months TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'okvirno' CHECK (status IN ('potvrdjeno','okvirno','provjeriti')),
  lat REAL,
  lng REAL,
  verified_at TEXT,
  demo INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_items_kind_date ON items(kind, date_from);
