-- Push obavještenja (Web Push). Bez ličnih podataka: čuva se samo adresa koju daje preglednik, jezik i izbor korisnika.
CREATE TABLE push_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'sr',
  promo INTEGER NOT NULL DEFAULT 1,      -- promocije i akcije
  remind INTEGER NOT NULL DEFAULT 1,     -- podsjetnik dan prije događaja iz „Moj put”
  saved TEXT NOT NULL DEFAULT '[]',      -- slugovi događaja iz „Moj put” (JSON lista)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Promocije/akcije koje admin pošalje odmah ili zakaže. enqueued_at se popuni kad se stavi u red za slanje.
CREATE TABLE push_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '/',
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','test')),
  send_at TEXT NOT NULL,                 -- ISO UTC
  enqueued_at TEXT,
  recipients INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Red za slanje: cron svake minute šalje po nekoliko poruka (zbog ograničenja broja zahtjeva u jednom pozivu).
CREATE TABLE push_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_id INTEGER NOT NULL REFERENCES push_subs(id) ON DELETE CASCADE,
  campaign_id INTEGER,
  payload TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 86400,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_push_queue_campaign ON push_queue(campaign_id);

-- Da isti podsjetnik ne ode dvaput istom uređaju.
CREATE TABLE push_log (
  sub_id INTEGER NOT NULL,
  ref TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (sub_id, ref)
);
