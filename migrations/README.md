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

## Secrets

Aucun secret dans ce dépôt public. Dans `0001_baseline.sql`, les fonctions
`call_notify` et `notify_new` contiennent `<SECRET_NOTIFY>` et `<CLE_ANON>` :
à remplacer par les vraies valeurs (gardées hors dépôt) avant de rejouer la
baseline sur une base neuve. Le secret a été changé en 0.68.

## Lignes historiques de `schema_migrations`

La table de production contient trois lignes plus anciennes que la
numérotation actuelle : `0003_group_delete`, `0004_group_succession` et
`0005_staff_chat`. Elles correspondent à des changements appliqués avant la
baseline et désormais inclus dans les fichiers 0001 à 0005 et 0010 ; une note
l'indique dans la colonne `notes`. Ne pas les supprimer.

## 0.70

- `0014_v070_echanges.sql` : réponses, réactions et message épinglé dans le
  chat, messages privés et blocage, questions-réponses, parrainage, bilan du mois.
- `0015_v070_lien_parrain.sql` : lien d'invitation personnel (ambassadeur),
  heure réelle de la prise, signalement des messages privés.

## 0.69.1

- `0013_v0691_types_peche.sql` : `profiles.fish_styles` et `set_fish_styles`.

## 0.69

- `0012_v069_bienvenue_admin.sql` : groupe Bienvenue (`groups.is_welcome`,
  adhésion automatique à la création du profil), journal de modération,
  `warn_member`, `member_record`, annonces, erreurs client et `app_health`.

## 0.68

- `0010_v068_invitations_groupes_resync.sql` : liens d'invitation (validation,
  limite, sanctions, `peek_invite`), réparation de la suppression et de la
  sortie d'un groupe par son propriétaire, règles de stockage, tâches
  planifiées nommées.
- `0011_v068_sanctions_completes.sql` : sanctions étendues à tout ce que le
  groupe voit ; « Je pars pêcher » discret ; signalement toujours permis.
