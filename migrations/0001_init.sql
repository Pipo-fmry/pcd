-- Films (vus ou à voir). Les infos externes viennent de TMDB / OMDb au moment de l'ajout.
CREATE TABLE films (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id INTEGER UNIQUE,
  imdb_id TEXT,
  titre TEXT NOT NULL,
  titre_original TEXT,
  annee INTEGER,
  realisateur TEXT,
  acteurs TEXT NOT NULL DEFAULT '[]',   -- JSON array
  genres TEXT NOT NULL DEFAULT '[]',    -- JSON array de noms FR
  synopsis TEXT,
  duree INTEGER,                        -- minutes
  affiche_url TEXT,
  trailer_youtube TEXT,                 -- clé vidéo YouTube
  note_tmdb REAL,
  note_imdb REAL,
  note_metacritic INTEGER,
  note_rt INTEGER,                      -- Rotten Tomatoes, %
  statut TEXT NOT NULL CHECK (statut IN ('vu', 'a_voir')),
  ajoute_par TEXT CHECK (ajoute_par IN ('croco', 'dauphin')),
  vu_le TEXT,                           -- ISO date, ou année seule pour l'import du carnet
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX films_statut ON films (statut, vu_le DESC, cree_le DESC);

-- Une note par personne et par film.
CREATE TABLE notes (
  film_id INTEGER NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  personne TEXT NOT NULL CHECK (personne IN ('croco', 'dauphin')),
  note INTEGER NOT NULL CHECK (note BETWEEN 0 AND 5),
  PRIMARY KEY (film_id, personne)
);

-- Recommandations refusées (« Pas pour moi »).
CREATE TABLE reco_refus (
  tmdb_id INTEGER NOT NULL,
  personne TEXT NOT NULL CHECK (personne IN ('croco', 'dauphin')),
  PRIMARY KEY (tmdb_id, personne)
);

-- Cache des appels TMDB (recommandations), pour rester loin des quotas.
CREATE TABLE tmdb_cache (
  cle TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  recupere_le TEXT NOT NULL DEFAULT (datetime('now'))
);
