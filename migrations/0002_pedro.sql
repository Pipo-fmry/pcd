-- Diversification de Pedro : journal et réglages, partagés entre les deux appareils.
-- La page Pedro parle « documents » (style Firestore) ; on stocke chaque document en JSON.
CREATE TABLE pedro_log (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE pedro_settings (
  cle TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  modifie_le TEXT NOT NULL DEFAULT (datetime('now'))
);
