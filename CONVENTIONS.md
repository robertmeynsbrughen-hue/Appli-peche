# Conventions de Rivio

## Version

L'appli affiche son numéro dans **Profil → Version** (`#app-version` dans `index.html`).
Ce numéro doit rester aligné à trois endroits :

| Fichier | Rôle |
|---|---|
| `VERSION` | valeur de référence, lue par le script |
| `index.html` | `<span id="app-version">0.63</span>`, ce que voit l'utilisateur |
| `sw.js` | `const VERSION="cdj-v64"`, nom du cache du service worker |

**Une version par changement livrable**, pas une par fichier modifié.

| Type | Incrément | Exemple |
|---|---|---|
| Grosse mise à jour | `+0.01` sur la décimale | 0.63 → 0.64 |
| Mise à jour mineure | `+0.00.1` (troisième chiffre) | 0.64 → 0.64.1, puis 0.64.2 |

Pour incrémenter, ne jamais éditer les trois fichiers à la main :

```powershell
$env:BUMP="major"; node tools/bump-version.mjs   # 0.64 -> 0.65
node tools/bump-version.mjs                       # 0.64 -> 0.64.1 (mineur par défaut)
```

En cas de doute : mineur. Le numéro doit rester crédible, pas décoratif.

Chaque version s'inscrit aussi dans **JOURNAL.md** (en tête de fichier), en une ou
deux lignes, sans code : ce qui est ajouté, corrigé, ou durci.

Le message de commit commence par le numéro :

```
0.64 : corrige la meteo ecrasee par une reponse tardive
```

## Commits

- français, sans accent dans la première ligne (lisibilité en terminal)
- une ligne de résumé, puis le détail du pourquoi si nécessaire
- un commit = un sujet ; ne pas mélanger un correctif et une migration

## Base de données

Toute évolution du schéma va dans `migrations/000N_*.sql`, jamais dans une
migration déjà appliquée. Voir `migrations/README.md`.
