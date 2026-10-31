# Rivio : mise en ligne

Compte environ 25 minutes. Tout se fait depuis un navigateur, téléphone ou PC (le PC est plus confortable pour l'étape 3).

## Ce que contient le dossier

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css` | L'appli |
| `advice.js` | Le moteur de conseils (espèces, météo, créneaux) |
| `social.js` | Comptes, fil photo, carte des spots |
| `config.js` | **À compléter** avec les clés Supabase |
| `supabase.sql` | Crée la base de données (à coller dans Supabase) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Installation sur l'écran d'accueil et mode hors ligne |

## Étape 1 : créer la base sur Supabase (gratuit)

1. Va sur **supabase.com**, crée un compte (« Start your project »).
2. **New project** : nom `coup-du-jour`, choisis un mot de passe de base (garde-le), région **Europe (Paris ou Frankfurt)**.
3. Ouvre **`migrations/0001_baseline.sql`** : c'est désormais la référence du schéma
   (tables, règles d'accès, fonctions). Il est rejouable sans risque.
4. Dans Supabase : menu **SQL Editor** → **New query** → colle le contenu de
   `migrations/0001_baseline.sql` → **Run**. Tu dois voir « Success ».

> ⚠️ **N'applique pas `supabase.sql`.** C'est l'ancien journal de migrations, conservé
> uniquement pour l'historique : il n'est pas rejouable sur une base neuve et il est
> désormais en retard sur la réalité. Toute évolution passe par `migrations/0002_*.sql`,
> `0003_*.sql`, etc.

⚠️ **Limite connue de la baseline** : elle crée la structure, pas les données de départ.
Sur une base neuve, le premier compte développeur et le premier groupe doivent encore
être créés à la main (leur amorçage automatique n'est pas encore écrit).
5. Menu **Authentication** → **Sign In / Providers** (ou **Providers**) → **Email** : **désactive « Confirm email »** puis enregistre. Sinon personne ne pourra se connecter, puisque les comptes n'ont pas de vraie adresse.
6. Menu **Project Settings** → **API** (ou **Data API** / **API Keys**) : note la **Project URL** et la clé **anon public** (parfois appelée **publishable key**).

## Étape 2 : renseigner config.js

Ouvre `config.js` et remplace :

- `COLLE_ICI_L_URL_DU_PROJET` par la Project URL (commence par `https://`)
- `COLLE_ICI_LA_CLE_ANON` par la clé anon / publishable

Cette clé peut être publique : les données ne sont lisibles qu'avec un compte membre, et on ne devient membre qu'avec le code du groupe.

Tu peux aussi faire cette modification à la fin, directement sur GitHub (icône crayon sur le fichier).

## Étape 3 : mettre l'appli en ligne avec GitHub Pages (gratuit)

1. Crée un compte sur **github.com**.
2. **New repository** : nom `coup-du-jour`, coche **Public**, puis **Create repository**.
3. Clique **uploading an existing file**, sélectionne **tous les fichiers du dossier**, puis **Commit changes**.
   - Sur téléphone : décompresse d'abord le zip dans l'appli Fichiers, puis « Add file → Upload files ».
4. **Settings** → **Pages** → Source : **Deploy from a branch**, branche **main**, dossier **/ (root)** → **Save**.
5. Après 1 à 2 minutes, l'appli est en ligne à l'adresse `https://TON-PSEUDO.github.io/coup-du-jour/`.

## Étape 4 : créer ton compte développeur

Ouvre l'appli, onglet **Profil** → **Créer un compte**, avec exactement le nom d'utilisateur mis à la place de `TON_PSEUDO` et le code du premier groupe. Un badge **Développeur** apparaît à côté de ton nom et l'onglet d'administration s'ajoute en bas.

Depuis l'onglet développeur tu peux :

- créer des groupes (nom, région, code) et modifier leur code ;
- voir le nombre de membres, posts et spots de chaque groupe, et la liste des membres ;
- retirer quelqu'un d'un groupe ;
- ouvrir le fil ou la carte de n'importe quel groupe, ou de **tous les groupes** à la fois, et y supprimer n'importe quel post, photo ou spot.

## Étape 5 : inviter les potes

Envoie-leur le lien et le code du groupe. Chacun :

1. ouvre le lien, puis l'installe : Android (Chrome) menu ⋮ → « Installer l'application » ; iPhone (Safari) bouton Partager → « Sur l'écran d'accueil » ;
2. va dans **Profil** → **Créer un compte** : nom d'utilisateur, mot de passe, code de **son** groupe ;
3. autorise la localisation quand l'appli la demande.

Chacun ne voit que les posts et spots des groupes dont il fait partie. On peut rejoindre plusieurs groupes (Profil → « Rejoindre un autre groupe ») et passer de l'un à l'autre avec le sélecteur en haut du Fil et de la Carte.

## Questions pratiques

**Quelqu'un a oublié son mot de passe.** Dans Supabase → SQL Editor, lance (en remplaçant le pseudo en minuscules et le nouveau mot de passe) :

```sql
update auth.users
set encrypted_password = extensions.crypt('nouveau-mot-de-passe', extensions.gen_salt('bf'))
where email = 'pseudo@coupdujour.app';
```

**Changer un code de groupe** : onglet Développeur → Modifier. Les membres actuels restent dans le groupe.

**Retirer quelqu'un d'un groupe** : onglet Développeur → Membres → Retirer du groupe. Pour supprimer complètement son compte (avec tous ses posts et spots) : Supabase → Authentication → Users → la personne → Delete user.

**Donner les droits développeur à quelqu'un d'autre** (Supabase → SQL Editor) :

```sql
update public.profiles set is_admin = true where username = 'son_pseudo';
```

**Mettre l'appli à jour** : remplace les fichiers modifiés sur GitHub (« Add file → Upload files »). Tout le monde reçoit la nouvelle version à la prochaine ouverture.

**Limites du gratuit** : Supabase offre 1 Go de stockage photo (environ 3 000 à 4 000 photos, l'appli les compresse) et met le projet en pause après 7 jours sans aucune activité ; il suffit alors de cliquer « Restore » dans le tableau de bord.

**Vie privée** : les photos sont réenregistrées par l'appli avant envoi, ce qui supprime les coordonnées GPS que les téléphones cachent dans les photos. Les spots ne sont visibles que par les membres.
