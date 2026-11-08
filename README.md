# PCD

Site perso à deux (🐊 Croco et 🐬 Dauphin), trois espaces :

- **Cinéma** : films vus et à voir, notés sur 5 par chacun, fiche remplie automatiquement (affiche, réal, casting, genres, bande-annonce, notes IMDb / Metacritic / Rotten Tomatoes) et recommandations.
- **Diversification de Pedro** : la page existante, aux couleurs PCD, avec journal et réglages partagés entre vos deux téléphones.
- **Livres** : vide pour l'instant.

Hébergé sur Cloudflare Workers (site statique + API) avec une base D1 (SQLite). Offre gratuite, largement suffisante pour deux.

**En ligne : https://pcd.pipo-fmry.workers.dev** (code d'accès partagé, secret `PCD_PIN`).

## Lancer en local

Prérequis : Node ≥ 20, pnpm.

```bash
pnpm install
cp .dev.vars.example .dev.vars      # puis remplir les clés (voir plus bas)
pnpm db:migrate:local               # crée la base locale
pnpm dev                            # http://localhost:5793
```

Code d'accès en local : la valeur de `PCD_PIN` dans `.dev.vars` (`0000` par défaut).

## Clés

Trois secrets, tous gratuits :

| Nom            | Sert à                                                         | Où l'obtenir                                                                    |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `PCD_PIN`      | code d'accès au site (le même pour vous deux)                  | tu le choisis                                                                   |
| `TMDB_API_KEY` | recherche de films, affiches, bandes-annonces, recommandations | https://www.themoviedb.org/settings/api (compte gratuit, « API Key (v3 auth) ») |
| `OMDB_API_KEY` | notes IMDb, Metacritic, Rotten Tomatoes (facultatif)           | https://www.omdbapi.com/apikey.aspx (gratuit, 1 000 appels/jour)                |

En local : dans `.dev.vars`. En prod : `pnpm wrangler secret put PCD_PIN` (puis les deux autres).

## Importer le carnet de films

`seed/carnet.json` contient les 87 films du carnet manuscrit (notes de Croco, 2012–2015). Un champ `tmdb_id` optionnel force la correspondance quand la recherche TMDB se trompe (homonymes). Pour les enrichir via TMDB et les charger :

```bash
TMDB_API_KEY=… OMDB_API_KEY=… pnpm seed:build   # écrit seed/carnet.sql
pnpm seed:local                                  # base locale
pnpm seed                                        # base de prod
```

Le script est idempotent (`INSERT OR IGNORE` sur l'identifiant TMDB). Les films introuvables sont listés en fin d'exécution.

## Déployer

Première fois :

```bash
pnpm wrangler login                        # ouvre le navigateur
pnpm wrangler d1 create pcd                # copier le database_id dans wrangler.jsonc
pnpm db:migrate                            # migrations sur la base de prod
pnpm wrangler secret put PCD_PIN
pnpm wrangler secret put TMDB_API_KEY
pnpm wrangler secret put OMDB_API_KEY
pnpm run deploy
```

Ensuite, à chaque changement : `pnpm run deploy`. L'URL est de la forme `https://pcd.<sous-domaine>.workers.dev` (affichée à la fin du déploiement ; le sous-domaine workers.dev du compte se choisit au premier déploiement).

Nouvelle migration : ajouter un fichier `migrations/000N_nom.sql`, puis `pnpm db:migrate:local` et `pnpm db:migrate`.

## Structure

```
src/worker.js          API (auth par PIN, films, notes, TMDB/OMDb, recommandations, Pedro)
public/                front statique : index.html, app.js, app.css
public/pedro/          page Diversification + shim.js (pont vers l'API)
migrations/            schéma D1
seed/                  carnet.json (source) → carnet.sql (généré, ignoré par git)
scripts/import-carnet.mjs
```

## Comment marchent les recommandations

Pour une personne, ses films notés 4 ou 5 servent de graines. TMDB donne les films proches de chaque graine ; un candidat marque d'autant plus qu'il revient souvent, que la graine était bien notée et que ses genres ressemblent à ceux que la personne aime. On retire les films déjà vus, à voir ou refusés (« Pas pour moi »). « Pour nous » croise les deux listes. Les appels TMDB sont mis en cache 7 jours dans D1.
