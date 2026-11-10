-- Statistika promocija: po jedan red za svaki uređaj kojem je promocija poslata.
-- shown_at = obavještenje se prikazalo na telefonu, clicked_at = korisnik je kucnuo na njega.
-- Bez ličnih podataka: samo broj pretplate i vrijeme, a uređaj se može računati najviše jednom po promociji.
CREATE TABLE push_stats (
  campaign_id INTEGER NOT NULL,
  sub_id INTEGER NOT NULL,
  shown_at TEXT,
  clicked_at TEXT,
  PRIMARY KEY (campaign_id, sub_id)
);
