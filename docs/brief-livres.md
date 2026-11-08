# Brief : intégrer « Livres » dans PCD

À transmettre à la personne qui a fait la page Livres. Objectif : la brancher dans PCD comme Pedro, avec les données partagées entre nos deux téléphones.

## Ce qu'il nous faut

1. **Le fichier HTML complet** (un seul fichier, avec son CSS et son JS dedans, ou le dossier s'il y en a plusieurs). Tel quel, sans retouche.
2. **Comment la page stocke ses données** — une réponse parmi :
   - `localStorage` / `IndexedDB` (tout reste dans le navigateur) ;
   - `window.claude.use('db')` ou un équivalent type Firestore (`collection().onSnapshot`, `doc().set`…) ;
   - une API externe (Firebase, Supabase, Airtable, Google Sheets…) : laquelle, et avec quelle clé ou compte ;
   - rien (données en dur dans le code).
3. **La forme des données** : un export JSON (ou une capture de la console) d'un ou deux livres réels, avec tous les champs. Exemple attendu : `{ "titre", "auteur", "isbn", "statut": "lu|a_lire", "note", "lu_le", "commentaire" }`.
4. **Les fonctions à garder** : liste courte de ce que la page sait faire (ajouter, noter, filtrer, listes lu / à lire, recherche de couverture…). On garde tout, on change seulement les couleurs et la synchro.
5. **Les ressources externes** utilisées : polices Google, API de couvertures (Open Library, Google Books…), scripts tiers.
6. **Les données déjà saisies** s'il y en a et qu'on veut les récupérer : un export JSON suffit.

## Ce qu'on fera ensuite

- Mêmes couleurs et composants que le reste de PCD, mêmes fonctions.
- Données partagées via l'API PCD (base D1), comme Pedro : chacun voit la même liste sur son téléphone.
- Notes à deux (🐊 Croco / 🐬 Dauphin) si la page ne le fait pas déjà, sur le modèle de Cinéma.
