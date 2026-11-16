# ADR 0003 — Pedro : planning recalculé à partir de ce qui a été noté

Date : 2026-11-16. Statut : acceptée.

## Contexte

Le programme de diversification fixait chaque aliment à un jour. Quand on donne autre chose (pas de petits pois, on
donne du brocoli), le planning restait faux et les jours suivants proposaient des doublons ou oubliaient le manquant.

## Décision

Chaque semaine du programme devient une liste d'objectifs : chaque nouveauté 2 fois, l'allergène en cours 3 prises
au total (un seul à la fois), l'entretien des allergènes tolérés, les reprises, les refus à retenter 2 jours après.
Les jours à partir d'aujourd'hui se recalculent à chaque affichage : ce qui a été noté compte (même hors programme),
ce qui manque glisse au premier jour possible. Règles :

- un seul repas par jour, le soir (Pedro est chez la nounou en journée) : 4 j/7 les 2 premières semaines, 5 j/7
  jusqu'à la 4e, puis tous les jours ;
- un seul aliment par repas les 2 premières semaines, puis 2 au plus, jamais 2 nouveautés le même jour ;
- une prise d'introduction d'allergène seulement le mercredi ou le week-end, le midi à la maison, jamais le jour
  d'une première fois, un jour sur deux si possible, 3 jours après la 1re prise d'un autre allergène ;
- pas la même reprise deux jours de suite.
  « Remplacer » sur un jour enregistre `swaps[date] = {skip, add}` dans les réglages partagés ; le reste se recalcule.

## Conséquences

- Aucune migration : le journal (`pedro_log`) et les réglages gardent leur format ; `swaps` et `cats` s'ajoutent.
- Le planning n'est pas stocké : il dépend du journal, donc il est le même sur les deux téléphones.
- Les règles sont des repères de diversification courants, pas un avis médical : à valider avec le pédiatre.
