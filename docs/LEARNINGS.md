# Ce qu'on a appris

> Une ligne par apprentissage issu d'un test réel (API, appareil, données). Daté, sourcé, avec l'impact sur le produit.

| Date       | Constat                                                                                                       | Source                    | Impact                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| 2026-11-08 | Télérama, Première, AlloCiné et SensCritique n'ont pas d'API publique                                         | recherche                 | notes externes = OMDb (Rotten Tomatoes, Metacritic, IMDb) + TMDB                                 |
| 2026-11-08 | La page Pedro attend `window.claude.use('db')` (API façon Firestore) et se replie sur `localStorage`          | lecture du HTML d'origine | `public/pedro/shim.js` imite cette API au-dessus de `/api/pedro/*` : rien à changer dans la page |
| 2026-11-08 | Les photos de la bibliothèque Photos sont illisibles depuis le terminal (protection macOS), même hors sandbox | import du carnet          | demander les images dans la conversation plutôt que des chemins `.photoslibrary`                 |
