# ADR 0001 — Hébergement : Cloudflare Workers + D1

Date : 2026-11-08. Statut : acceptée.

## Contexte

Site perso pour deux personnes, accessible depuis une URL publique, en ligne même Mac éteint, coût nul ou presque,
petite base de données (films, notes, journal de diversification). Dépôt GitHub public.

## Options

| Option                                         | Coût | Limites                                                | URL                        |
| ---------------------------------------------- | ---- | ------------------------------------------------------ | -------------------------- |
| **Cloudflare Workers (assets statiques) + D1** | 0 €  | 100 000 requêtes/jour, D1 5 Go, 100 000 écritures/jour | `pcd.<compte>.workers.dev` |
| GitHub Pages + Turso                           | 0 €  | deux services, clé exposée côté navigateur à protéger  | `pipo-fmry.github.io/pcd`  |
| GitHub Pages + Supabase                        | 0 €  | projet mis en pause après 7 jours d'inactivité         | idem                       |

## Décision

Cloudflare Workers + D1 : un seul service, une seule commande de déploiement, pas de mise en pause, API et secrets côté
serveur (clés TMDB/OMDb jamais exposées). Pas de framework ni de bundler : le Worker sert `public/` tel quel.

## Conséquences

- Les clés vivent dans `wrangler secret` (prod) et `.dev.vars` (local, ignoré par git).
- L'accès est protégé par un code partagé (`PCD_PIN`) posé en cookie signé ; suffisant pour deux personnes, pas de comptes.
- Les migrations D1 sont des fichiers SQL numérotés, appliqués en local puis en prod.
