# Ce qu'on a appris

> Une ligne par apprentissage issu d'un test réel (API, appareil, données). Daté, sourcé, avec l'impact sur le produit.

| Date       | Constat                                                                                                                   | Source                    | Impact                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-11-08 | Télérama, Première, AlloCiné et SensCritique n'ont pas d'API publique                                                     | recherche                 | notes externes = OMDb (Rotten Tomatoes, Metacritic, IMDb) + TMDB                                                      |
| 2026-11-08 | La page Pedro attend `window.claude.use('db')` (API façon Firestore) et se replie sur `localStorage`                      | lecture du HTML d'origine | `public/pedro/shim.js` imite cette API au-dessus de `/api/pedro/*` : rien à changer dans la page                      |
| 2026-11-08 | Les photos de la bibliothèque Photos sont illisibles depuis le terminal (protection macOS), même hors sandbox             | import du carnet          | demander les images dans la conversation plutôt que des chemins `.photoslibrary`                                      |
| 2026-11-16 | Les repas de Pedro viennent surtout des packs surgelés Yooji (purées lisses + haché de poulet), pas de courses au marché  | François                  | pas d'onglet Courses ; Artichaut ajouté à la liste                                                                    |
| 2026-11-16 | Barre d'onglets : l'onglet actif en simple couleur ne se voyait pas (fougère et gris de luminosité proche, libellé 11 px) | test sur iPhone           | pilule fougère pleine, animée par View Transitions (`@view-transition` entre pages, `startViewTransition` dans l'app) |
