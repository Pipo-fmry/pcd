# Guide des agents — PCD

Source unique des consignes pour tout agent de code (Claude Code, Cursor, Codex…). `CLAUDE.md` l'importe.
Garder ce fichier **court** : il renvoie vers `docs/` et `README.md`, il ne les duplique pas.

## Le projet en 3 lignes

Site perso à deux (🐊 Croco = François, 🐬 Dauphin = Morgane), trois espaces : **Cinéma** (films vus / à voir, notes sur 5
par personne, fiches remplies depuis TMDB, recommandations), **Diversification de Pedro** (page existante reprise telle
quelle, données partagées) et **Livres** (à venir). Un Worker Cloudflare sert le front statique et l'API, D1 stocke tout.
Zéro coût, zéro build : HTML, CSS et JS vanilla.

## Commandes

Voir [README.md](README.md) : `pnpm dev` (http://localhost:5793), `pnpm db:migrate:local`, `pnpm deploy`, import du carnet.
`pnpm check` = Biome (format + lint) : doit passer avant tout commit.

## Carte du repo

| Dossier             | Rôle                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/worker.js`     | API : auth par code, films, notes, TMDB/OMDb, recommandations, documents Pedro. Seul endroit qui parle à D1. |
| `public/`           | Front : `index.html` (écrans), `app.js` (état, rendu, appels API), `app.css` (tokens + composants).          |
| `public/pedro/`     | Page Diversification d'origine + `shim.js` qui la branche sur l'API. **On ne modifie pas sa logique.**       |
| `migrations/`       | Schéma D1, un fichier numéroté par changement, jamais réécrit après déploiement.                             |
| `seed/`, `scripts/` | Carnet manuscrit (source JSON) et script d'import.                                                           |
| `docs/`             | Design system, décisions, erreurs à ne pas refaire, apprentissages.                                          |

## Règles non négociables

1. **Aucune donnée en dur dans le code.** Films, notes, journal Pedro, réglages : tout vient de D1 via `/api`. Les seules
   constantes autorisées sont des référentiels stables (genres TMDB, liste des deux personnes).
2. **Le front ne connaît pas D1.** `app.js` et `shim.js` ne parlent qu'à `/api/*` ; `worker.js` est le seul à écrire du SQL.
3. **Pas de clé dans le code ni dans le dépôt.** `.dev.vars` en local, `wrangler secret` en prod. Le dépôt est public.
4. **Pas de hex en dur dans l'UI** hors `:root` de `app.css` : on utilise les tokens ([docs/design/design-system.md](docs/design/design-system.md)).
   Pedro garde ses propres variables, remappées sur la palette PCD par `scripts` ; on n'y touche qu'aux couleurs.
5. **Mobile d'abord, iOS en référence.** Chaque écran est vérifié à 390 px de large avant le desktop ; cible tactile ≥ 44 px ;
   barre d'onglets fixe en bas, une action principale par écran, `safe-area-inset-*` respectés.
6. **Moins de code.** Pas de framework, pas de bundler, pas de dépendance ajoutée sans avoir essayé la plateforme (fetch,
   `<dialog>`, CSS moderne) et l'existant. Une dépendance = une ligne de justification dans la PR.
7. **Les appels externes sont économes.** TMDB et OMDb passent par le Worker, jamais depuis le navigateur ; les
   recommandations sont mises en cache dans D1 (7 jours). Rester loin des quotas gratuits.
8. **Les écritures sont réversibles ou confirmées.** Suppression d'un film = double appui ; les notes se modifient à tout moment.

## Flux de travail

1. Lire la doc concernée (`docs/`, `STOP-DOING.md`) avant de modifier un module.
2. Branche courte depuis `main` : `feat/…`, `fix/…`, `docs/…`. Jamais de push direct sur `main`.
3. Implémenter, puis **vérifier dans le navigateur** (mobile 390 px puis desktop) sur le parcours touché, avec la base locale.
4. `pnpm check` vert, puis `/code-review` et `/simplify` avant toute PR.
5. PR vers `main`, description courte : quoi, pourquoi, comment tester, capture mobile si UI.

## UX et design : quels skills, quand

- **`frontend-design`** : pour finir un écran dans le cadre du design system (hiérarchie, espacements, états vides, micro-interactions).
  Jamais pour inventer une direction artistique : la palette, la typo système et la structure à onglets sont fixées.
- **`ui-ux-pro-max`** ou **`design-taste-frontend`** : pour auditer un écran existant (lisibilité, contraste, cibles tactiles,
  cohérence des composants) et proposer des corrections concrètes, pas une refonte.
- **`design:accessibility-review`** : avant une PR qui touche formulaires, feuilles (sheets) ou navigation.
- Écrire les libellés comme on parle : « Vu », « À voir », « Pour nous », « Pas pour moi ». Pas de jargon technique à l'écran.

## Mémoire du projet

- **Décision structurante** (hébergement, source de données, algo de reco) → un fichier dans [`docs/adr/`](docs/adr/).
- **Erreur à ne pas refaire** → une ligne datée dans [`docs/STOP-DOING.md`](docs/STOP-DOING.md).
- **Chose apprise en testant** (quota API, comportement iOS, données TMDB) → une ligne datée dans [`docs/LEARNINGS.md`](docs/LEARNINGS.md).
- Mettre à jour ce fichier si une commande ou une règle change.

## Conventions

- Code (identifiants, fichiers) en **français** quand c'est du métier (`films`, `notes`, `ajoute_par`), en anglais pour le
  technique standard (`fetch`, `env`, `json`). Commentaires, docs, commits et PR en français.
- Commits : `type(portée): description` — `feat`, `fix`, `docs`, `refactor`, `chore`, `style`. Ex. `feat(cinema): filtrer les vus par personne`.
- JS moderne sans TypeScript (pas de build) : fonctions courtes, early return, pas de `var`, pas de `console.log` oublié.
- Formatage Biome : 2 espaces, guillemets simples, point-virgule, 120 colonnes.
