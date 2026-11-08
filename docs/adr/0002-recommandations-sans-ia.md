# ADR 0002 — Recommandations : graines TMDB + affinité par genre, sans IA

Date : 2026-11-08. Statut : acceptée.

## Contexte

Les deux personnes veulent des pistes de films « pour moi » et « pour nous » à partir de leurs notes. Volume : une
centaine de films notés par Croco au départ, Dauphin part de zéro. Budget nul, pas d'appel à un modèle.

## Décision

Pour une personne : ses films notés ≥ 4 sont des graines ; l'endpoint TMDB `recommendations` donne les voisins de
chaque graine ; un candidat marque `poids(graine) × (1 + affinité genres) × bonus note TMDB`, cumulé sur toutes les graines.
Affinité genres = moyenne des écarts de notes par genre, bornée à ±0,5. On exclut les films vus, à voir et refusés.
« Pour nous » = candidats positifs chez les deux (repli sur une seule personne si l'autre n'a rien noté).
Les appels TMDB sont mis en cache 7 jours dans D1 (`tmdb_cache`).

## Conséquences

- Résultats explicables (« parce que tu as aimé X ») et stables.
- Qualité limitée par les notes saisies : il faut au moins quelques 4 et 5 par personne.
- Un bouton « Pas pour moi » alimente `reco_refus` ; c'est le seul retour utilisateur pris en compte pour l'instant.
