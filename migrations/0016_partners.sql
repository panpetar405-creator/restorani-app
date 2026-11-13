-- Evidencija partnera (restorani, turističke organizacije, institucije) i veza promocije sa partnerom.
CREATE TABLE partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'restoran',
  contact TEXT NOT NULL DEFAULT '',
  package TEXT NOT NULL DEFAULT '',
  starts_on TEXT,
  ends_on TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE push_campaigns ADD COLUMN partner_id INTEGER;
