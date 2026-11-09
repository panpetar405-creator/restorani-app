-- Tekst promocije i na njemačkom, ruskom i italijanskom (prazno = koristi se engleski, pa crnogorski).
ALTER TABLE push_campaigns ADD COLUMN title_de TEXT NOT NULL DEFAULT '';
ALTER TABLE push_campaigns ADD COLUMN body_de TEXT NOT NULL DEFAULT '';
ALTER TABLE push_campaigns ADD COLUMN title_ru TEXT NOT NULL DEFAULT '';
ALTER TABLE push_campaigns ADD COLUMN body_ru TEXT NOT NULL DEFAULT '';
ALTER TABLE push_campaigns ADD COLUMN title_it TEXT NOT NULL DEFAULT '';
ALTER TABLE push_campaigns ADD COLUMN body_it TEXT NOT NULL DEFAULT '';
