-- Livres : catalogue partagé + un statut par (livre, personne), comme la base d'origine (Turso) de Morgane.
CREATE TABLE livres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL,
  auteur TEXT,
  isbn TEXT,
  isbn13 TEXT,
  genre TEXT,
  editeur TEXT,
  pages INTEGER,
  annee INTEGER,
  type TEXT CHECK (type IN ('fiction', 'essai', 'reference')),
  version TEXT, -- 'papier', 'numerique' ou 'papier,numerique'
  culte INTEGER NOT NULL DEFAULT 0,
  reference INTEGER NOT NULL DEFAULT 0, -- livre de référence, sans statut personnel
  resume TEXT,
  note_exemplaire TEXT,
  notes TEXT,
  couverture_url TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now')),
  modifie_le TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX livres_titre ON livres (titre);
CREATE INDEX livres_isbn13 ON livres (isbn13);

CREATE TABLE livre_statuts (
  livre_id INTEGER NOT NULL REFERENCES livres (id) ON DELETE CASCADE,
  personne TEXT NOT NULL CHECK (personne IN ('croco', 'dauphin', 'pedro')),
  statut TEXT NOT NULL CHECK (statut IN ('a_acheter', 'a_lire', 'en_cours', 'lu')),
  note INTEGER CHECK (note BETWEEN 1 AND 5),
  annee_lu INTEGER,
  commentaire TEXT,
  modifie_le TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (livre_id, personne)
);
