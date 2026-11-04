# Rivio sur Google Play

Rivio part sur le Play Store sous la forme d'une **Trusted Web Activity** (TWA) :
une petite appli Android qui ouvre le site Rivio en plein écran, sans barre
d'adresse. Il n'y a pas de seconde base de code : chaque mise à jour du site
arrive dans l'appli. On ne republie l'AAB que pour changer l'icône, le nom,
les permissions ou la version Android ciblée.

- Identifiant Android : **`app.rivio`**. Il est définitif dès la première publication.
- Fabrication : `.github/workflows/android.yml` avec Bubblewrap, en ciblant Android 16 (API 36),
  version exigée par Google Play pour les nouvelles applis depuis le 31 août 2026.
- Numéro de version : il vient de `VERSION`. 0.78 donne le code 7800, 0.78.1 donne le code 7801.

## 1. La clé d'envoi (une seule fois, sur le PC de Robert)

1. Lancer `Rivio-creer-cle-Android.bat`. S'il manque Java, le script donne
   la commande à lancer : `winget install EclipseAdoptium.Temurin.17.JDK`.
2. Choisir un mot de passe et le noter. Le script crée
   `Documents\Rivio-cle-Android\rivio-upload.keystore`.
3. Sauvegarder ce dossier hors ligne, par exemple sur une clé USB.
   **Ne jamais le mettre dans le dépôt, ni dans un cloud public, ni dans une conversation.**
4. Créer les trois secrets GitHub du dépôt :
   - `ANDROID_KEYSTORE_BASE64` ;
   - `ANDROID_KEYSTORE_PASSWORD` ;
   - `ANDROID_KEY_PASSWORD`.
5. Supprimer `cle-pour-github.txt`.

Avec la « signature des applis par Google Play », Google garde la vraie clé de
signature. Si la clé d'envoi est perdue, on peut la faire réinitialiser par le
support Play, sans perdre l'appli.

## 2. Le nom de domaine

Android ne retire la barre d'adresse que si le site publie
`https://<domaine>/.well-known/assetlinks.json`, **à la racine du domaine**.
Ce n'est pas possible avec `…github.io/Appli-peche/`, d'où le domaine à soi.

1. Acheter le domaine (OVH, Gandi…).
2. Chez le registrar, créer les enregistrements DNS pour GitHub Pages :
   - 4 enregistrements `A` vers 185.199.108.153, 185.199.109.153, 185.199.110.153 et 185.199.111.153 ;
   - un `CNAME www` vers `robertmeynsbrughen-hue.github.io`.
3. Dans le dépôt, ajouter un fichier `CNAME` contenant le domaine. Puis, dans
   Settings › Pages, cocher « Enforce HTTPS ».
4. Supabase › Authentication › URL Configuration : mettre le nouveau domaine en
   Site URL, et garder l'ancienne adresse dans les Redirect URLs le temps de la transition.
5. Vérifier les liens d'invitation, les mails de confirmation, le partage de
   photo et les notifications push sur le nouveau domaine.
   **Attention :** sur un nouveau domaine, les abonnements aux notifications
   push doivent être refaits.

Le fichier `.nojekyll` est déjà dans le dépôt : sans lui, GitHub Pages
ignorerait le dossier `.well-known`.

## 3. Fabriquer l'AAB

Dans GitHub, aller dans Actions › **Android** › Run workflow, et indiquer :
- l'hôte, par exemple `rivio.fr` ;
- le chemin, par exemple `/`.

Le run produit un artifact `rivio-android-N`. Il contient :
- le fichier `.aab` à déposer dans la Play Console ;
- l'empreinte SHA-256 de la clé d'envoi, dans le journal de l'étape « Clé d'envoi ».

Une PR qui modifie `android/` lance une construction **non signée**, pour
vérifier la chaîne.

## 4. Play Console (compte personnel)

1. Créer l'appli : nom Rivio, langue par défaut français, application gratuite.
2. Activer la signature des applis par Google Play, qui est proposée au premier envoi.
3. Remplir la fiche avec le contenu de `Rivio-PlayStore.zip` :
   - les textes, captures, bannière et icône ;
   - la politique de confidentialité, à l'adresse `https://<domaine>/confidentialite.html` ;
   - le formulaire « Sécurité des données ». Le texte est prêt dans `securite-des-donnees.txt`.
     Y déclarer la **localisation** : l'appli la demande pour la météo et les spots.
4. Remplir les autres questionnaires : classification du contenu, public cible
   (adultes, pas d'enfants), appli d'actualité (non), identifiant publicitaire (non).
5. Créer un compte de démo pour les testeurs Google, à faire par Robert.
6. **Test fermé.** Un compte personnel doit avoir **12 testeurs inscrits sans
   interruption pendant 14 jours** avant de pouvoir demander la mise en production.
   Les testeurs peuvent venir des groupes Rivio.
7. Après le premier envoi, récupérer l'empreinte de la clé de signature Google
   dans Intégrité de l'appli › Signature de l'appli. Ensuite :
   `node android/assetlinks.mjs <empreinte clé d'envoi> <empreinte clé Google>`,
   puis commit et mise en ligne.
8. Au bout des 14 jours, demander l'accès à la production.

## 5. Plus tard : Premium

Une appli distribuée par Google Play doit vendre ses contenus numériques avec
**Google Play Billing**. Dans une TWA, cela passe par la Digital Goods API :
fonction `playBilling` de Bubblewrap, à activer dans `android/twa-manifest.mjs`
le jour où le Premium sera vendu.
