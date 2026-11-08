# Design system PCD

> Source de vérité du code : le bloc `:root` de `public/app.css`. Maquette validée : [artifact « PCD »](https://claude.ai/artifact/Ry5XWr9NtDP92Xw5sHmnsv) (privé).

## Intention

Ultra simple, dans l'esprit des apps iOS : fond uni, grandes cartes blanches arrondies, un grand titre par écran,
un contrôle segmenté pour les sous-listes, une barre d'onglets fixe en bas. Pensé pour le téléphone, le desktop est
le même écran centré à 720 px. **Le vert fougère est l'accent, pas le décor** : les écrans vivent sur le crème et le blanc.

## Couleurs

Palette d'origine (Coolors) : `330F0A` acajou, `394F49` ardoise, `65743A` fougère, `EFDD8D` or clair, `F4FDAF` crème citron.

| Token         | Clair                    | Sombre    | Usage                                                                        |
| ------------- | ------------------------ | --------- | ---------------------------------------------------------------------------- |
| `--bg`        | `#F6F8E8` (crème adouci) | `#1E0906` | fond des écrans                                                              |
| `--card`      | `#FFFFFF`                | `#2A1510` | cartes, feuilles, barre d'onglets                                            |
| `--fg`        | `#330F0A` acajou         | `#F4FDAF` | texte principal                                                              |
| `--muted`     | `#6B6F5E`                | `#B9BFA0` | texte secondaire, libellés                                                   |
| `--line`      | `#E3E6CF`                | `#46241C` | bordures, fond du contrôle segmenté                                          |
| `--accent`    | `#65743A` fougère        | `#A3B36A` | action principale, onglet actif, FAB                                         |
| `--accent-fg` | `#F4FDAF`                | `#1E0906` | texte sur l'accent                                                           |
| `--deep`      | `#394F49` ardoise        | `#5E7A72` | tuile Livres, dégradés d'affiche manquante                                   |
| `--gold`      | `#D9BF5A`                | `#EFDD8D` | pastilles de note (l'or `EFDD8D` d'origine est trop clair sur blanc : 1,5:1) |
| `--gold-soft` | `#EFDD8D`                | `#4A3F1E` | fond de la tuile Cinéma                                                      |
| `--danger`    | `#A8402E`                | `#E08A7A` | suppression, erreurs                                                         |

Interdits : texte en `--gold` ou `--gold-soft` sur fond clair ; hex en dur hors de `:root`.
Le mode sombre suit `prefers-color-scheme`, sans bascule manuelle.

## Typographie

Police système (`-apple-system`, SF Pro sur Apple) : aucune police chargée, pour un affichage immédiat sur mobile.

| Rôle                           | Taille / graisse                    |
| ------------------------------ | ----------------------------------- |
| Titre d'écran `h1`             | 34 px / 800, interlettrage −0,02 em |
| Titre de section `h2`          | 22 px / 700                         |
| Titre de fiche                 | 17 px / 700                         |
| Corps                          | 16 px / 400                         |
| Métadonnées                    | 13 px, `--muted`                    |
| Étiquette (`.eyebrow`)         | mono 11 px, capitales, +0,08 em     |
| Chiffres (notes, pourcentages) | mono, `tabular-nums`                |

## Espacements et formes

- Multiples de 4 ; gouttière latérale 16 px (`max(16px, env(safe-area-inset-*))`).
- Rayons : 999 (pilules, chips), 10 (affiches, boutons), 12 (champs, segmenté), 18 (fiche film), 20 (tuile), 22 (feuille).
- Cible tactile ≥ 44 px ; FAB 56 px à 84 px du bas (au-dessus de la barre d'onglets).
- Ombres rares : FAB, toast, segment actif.

## Composants

| Composant         | Classe    | Règle                                                                                |
| ----------------- | --------- | ------------------------------------------------------------------------------------ |
| Tuile d'accueil   | `.tile`   | icône 56 px sur fond coloré, titre, sous-titre, compteur mono à droite               |
| Contrôle segmenté | `.seg`    | 2 ou 3 segments, le segment actif est une carte blanche                              |
| Chips de filtre   | `.chip`   | une seule active ; active = inversée (`--fg` sur `--bg`)                             |
| Fiche film        | `.film`   | affiche 2:3 à gauche (84 px), titre, méta, genres, notes externes, notes 🐊 🐬       |
| Notes             | `.stars`  | 5 pastilles de 10 px, remplies en `--gold`, valeur en mono à côté                    |
| Feuille           | `.sheet`  | montée depuis le bas, poignée, boutons pleine largeur, se ferme au clic hors panneau |
| Barre d'onglets   | `.tabbar` | 4 onglets, flou d'arrière-plan, onglet actif en `--accent`                           |
| Toast             | `.toast`  | pilule `--fg` sur `--bg`, 2,5 s                                                      |

## Identité des personnes

🐊 Croco = François, 🐬 Dauphin = Morgane. Les emojis sont l'identité visuelle, pas d'avatar ni de prénom à l'écran.
Pedro = 🐦.

## Pedro

La page Diversification garde ses propres variables CSS (`--sage`, `--peach`, `--blue`…) et sa police Fraunces / Inter :
on les remappe sur la palette PCD (`scripts/`, voir `public/pedro/index.html`), on ne redessine rien.
