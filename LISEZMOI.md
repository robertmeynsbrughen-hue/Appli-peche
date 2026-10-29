# Coup du Jour : mise en ligne

Compte environ 20 minutes. Tout se fait depuis un navigateur, téléphone ou PC (le PC est plus confortable pour l'étape 3).

## Ce que contient le dossier

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css` | L'appli |
| `advice.js` | Le moteur de conseils (espèces, météo, créneaux) |
| `social.js` | Comptes, fil photo, carte des spots |
| `config.js` | **À compléter** avec les clés Supabase |
| `supabase.sql` | Crée la base de données (à coller dans Supabase) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil et mode hors ligne |

## Étape 1 : créer la base sur Supabase (gratuit)

1. Va sur **supabase.com**, crée un compte (« Start your project »).
2. **New project** : nom `coup-du-jour`, choisis un mot de passe de base (garde-le), région **Europe (Paris ou Frankfurt)**.
3. Ouvre `supabase.sql`, remplace `CHANGE-MOI` par le **code de ton groupe** (prends quelque chose d'assez long, ex. `brochet-garonne-2026`).
4. Dans Supabase : menu **SQL Editor** → **New query** → colle tout le contenu du fichier → **Run**. Tu dois voir « Success ».
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
3. Clique **uploading an existing file**, glisse **tous les fichiers du dossier** (dont le dossier `icons`), puis **Commit changes**.
   - Sur téléphone : décompresse d'abord le zip dans l'appli Fichiers, puis « Add file → Upload files ». Si le dossier `icons` ne passe pas, crée-le avec « Add file → Create new file » en tapant `icons/` puis envoie les images dedans.
4. **Settings** → **Pages** → Source : **Deploy from a branch**, branche **main**, dossier **/ (root)** → **Save**.
5. Après 1 à 2 minutes, l'appli est en ligne à l'adresse `https://TON-PSEUDO.github.io/coup-du-jour/`.

## Étape 4 : inviter les potes

Envoie-leur le lien et le code du groupe. Chacun :

1. ouvre le lien, puis l'installe : Android (Chrome) menu ⋮ → « Installer l'application » ; iPhone (Safari) bouton Partager → « Sur l'écran d'accueil » ;
2. va dans **Profil** → **Créer un compte** : nom d'utilisateur, mot de passe, code du groupe ;
3. autorise la localisation quand l'appli la demande.

## Questions pratiques

**Quelqu'un a oublié son mot de passe.** Dans Supabase → SQL Editor, lance (en remplaçant le pseudo en minuscules et le nouveau mot de passe) :

```sql
update auth.users
set encrypted_password = extensions.crypt('nouveau-mot-de-passe', extensions.gen_salt('bf'))
where email = 'pseudo@coupdujour.app';
```

**Changer le code du groupe** (les comptes existants restent membres) :

```sql
update public.config set invite_code = 'nouveau-code' where id = 1;
```

**Retirer quelqu'un du groupe** : Supabase → Authentication → Users → la personne → Delete user. Ses posts et spots partent avec.

**Mettre l'appli à jour** : remplace les fichiers modifiés sur GitHub (« Add file → Upload files »). Tout le monde reçoit la nouvelle version à la prochaine ouverture.

**Limites du gratuit** : Supabase offre 1 Go de stockage photo (environ 3 000 à 4 000 photos, l'appli les compresse) et met le projet en pause après 7 jours sans aucune activité ; il suffit alors de cliquer « Restore » dans le tableau de bord.

**Vie privée** : les photos sont réenregistrées par l'appli avant envoi, ce qui supprime les coordonnées GPS que les téléphones cachent dans les photos. Les spots ne sont visibles que par les membres.
