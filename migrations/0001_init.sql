CREATE TABLE restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  amenities TEXT NOT NULL DEFAULT '[]',
  moods TEXT NOT NULL DEFAULT '[]',
  why TEXT NOT NULL DEFAULT '[]',
  ambience TEXT NOT NULL DEFAULT '',
  art TEXT NOT NULL DEFAULT 'terasa',
  km REAL NOT NULL DEFAULT 0,
  phone TEXT,
  lat REAL,
  lng REAL,
  owner_key_hash TEXT UNIQUE,
  verified_at TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

-- kind: g = glavno jelo, p = predjelo/prilog, d = piće, z = desert
CREATE TABLE menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  art TEXT NOT NULL DEFAULT 'salata',
  kind TEXT NOT NULL CHECK (kind IN ('g','p','d','z')),
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_menu_restaurant ON menu_items(restaurant_id, sort);

CREATE TABLE offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

-- dnevni brojači događaja (view | call | nav), bez ličnih podataka
CREATE TABLE events (
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('view','call','nav')),
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, day, type)
);
