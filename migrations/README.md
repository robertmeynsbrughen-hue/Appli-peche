# Migrations de la base Rivio

## Le problème réglé

`supabase.sql` à la racine était un journal cumulé : 106 Ko, des fonctions
redéfinies jusqu'à cinq fois, des références vers des fonctions absentes du
fichier, et une contrainte qui citait une colonne jamais créée. Il permettait
d'appliquer des changements à la base existante, mais **pas de la recréer**.

Conséquence : si la base était perdue, le dépôt ne suffisait pas à la remonter.

## Ce qui le remplace

- **`0001_baseline.sql`** — le schéma complet, extrait du catalogue PostgreSQL
  de la base de production (`pg_catalog`), pas du fichier historique. Tables,
  colonnes avec types exacts, contraintes, index, fonctions, RLS, policies,
  triggers, buckets de stockage et tâches planifiées.
- Chaque évolution future va dans un **nouveau** fichier `0002_*.sql`,
  `0003_*.sql`, etc. On ne modifie jamais une migration déjà appliquée.
- La table `public.schema_migrations` enregistre les versions appliquées.

## Règle d'écriture

Une migration doit être **rejouable sans erreur** : `if not exists`,
`drop policy if exists`, test d'existence avant d'ajouter une contrainte.
C'est ce qui permet de rejouer une migration après un échec partiel.

## Vérifier une migration avant de l'appliquer

```powershell
# exécute le fichier en transaction puis annule : rien n'est modifié
python validate_schema.py
```

## Appliquer

```powershell
# via l'API de management Supabase (token dans .secrets/env.txt)
$sql = Get-Content migrations/0002_xxx.sql -Raw
# POST https://api.supabase.com/v1/projects/<ref>/database/query  {"query": "<sql>"}
```

## Limite connue

La baseline est validée par exécution complète + `rollback` sur la base de
production. Cela prouve la syntaxe, l'ordre des dépendances et l'idempotence,
mais pas encore une reconstruction sur une base **vide**. Ce dernier test
demande un projet Supabase jetable.
