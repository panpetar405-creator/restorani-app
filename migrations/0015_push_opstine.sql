-- Ciljanje promocija po opštini. Korisnik sam bira koje opštine ga zanimaju (prazno = sve), a promocija može biti ciljana na izabrane opštine.
ALTER TABLE push_subs ADD COLUMN places TEXT NOT NULL DEFAULT '[]';
ALTER TABLE push_campaigns ADD COLUMN places TEXT NOT NULL DEFAULT '[]';
-- 1 = ciljana promocija ide i onima koji nisu izabrali nijednu opštinu
ALTER TABLE push_campaigns ADD COLUMN and_unset INTEGER NOT NULL DEFAULT 1;
