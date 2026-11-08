@AGENTS.md

## Spécifique à Claude Code

- Un hook formate avec Biome chaque fichier `.js`, `.json`, `.jsonc` ou `.css` écrit ou modifié (`.claude/settings.json`).
- Lecture de `.dev.vars` refusée par configuration : ne pas contourner. Les clés se demandent à François.
- Vérification navigateur : `.claude/launch.json` lance `pnpm dev` ; code d'accès local = `PCD_PIN` de `.dev.vars`.
- Avant de proposer une PR : `/code-review` et `/simplify`.
- La direction artistique est fixée (palette PCD, typo système, onglets iOS) : ne pas en proposer une autre, demander si un cas n'est pas couvert par `docs/design/design-system.md`.
