# Conventions de Rivio

## Version

L'appli affiche son numéro dans **Profil → Version** (`#app-version` dans `index.html`).
Ce numéro doit rester aligné à trois endroits :

| Fichier | Rôle |
|---|---|
| `VERSION` | valeur de référence, lue par le script |
| `index.html` | `<span id="app-version">0.63</span>`, ce que voit l'utilisateur |
| `sw.js` | `const VERSION="cdj-v64"`, nom du cache du service worker |

**Une version par changement livrable**, pas une par fichier modifié : un correctif
= 0.63 → 0.64. La version s'incrémente de un en un sur la décimale.

Pour incrémenter, ne jamais éditer les trois fichiers à la main :

```powershell
node tools/bump-version.mjs        # 0.63 -> 0.64, et v64 -> v65
node tools/bump-version.mjs 0.70   # numéro imposé
```

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
