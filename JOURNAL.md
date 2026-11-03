RIVIO — JOURNAL DES MISES À JOUR
==============================

Ce fichier suit les versions numérotées du dépôt depuis 0.36. Il résume les
changements livrés, sans remplacer l'historique détaillé des commits Git.

Convention du projet : 0.xx pour une version majeure, 0.xx.x pour une version
mineure ou corrective. Les dates sont celles des changements dans le dépôt ;
elles ne garantissent pas à elles seules la date de propagation du cache web.

0.75.5 · 3 novembre 2026 · mineure
----------------------------------
- Site d'administration « Garde-pêche » en ligne à l'adresse /garde/, adapté au
  téléphone et installable sur l'écran d'accueil. Il ne contient aucune clé
  secrète : il faut se connecter avec le compte développeur, et la base vérifie
  les droits à chaque action. Il n'est pas indexé par les moteurs de recherche
  et le service worker de l'appli ne le met jamais en cache.

0.75.4 · 3 novembre 2026 · corrective
------------------------------------
- Chat de groupe : précise la clé de jointure auteur quand il charge le profil,
  sans confusion avec la clé du membre ayant épinglé le message.
- Chat : remplace la couronne du développeur par 🛠️.

0.75.3 · 3 novembre 2026 · mineure
----------------------------------
- Fil : les stories gardent les 60 prises les plus récentes avant l'affichage.
- Démarrage : les scripts conservent leur ordre mais se téléchargent en parallèle ;
  les polices et le style Leaflet ne bloquent plus le premier affichage.
- Carte de chaleur : l'application ne télécharge plus les traces complètes pour
  ne lire que leur premier point. La migration Supabase `0028` doit être appliquée.
- Hors réseau : les fichiers déjà en cache s'affichent après 2,5 s si le réseau
  mobile ne répond pas, et servent de secours sur erreur serveur. Une page HTML
  de secours est réservée à la navigation, pas aux scripts ou aux styles.

0.75.2 · 3 novembre 2026 · mineure
----------------------------------
- Le rôle « contrôleur » s'appelle maintenant « garde-pêche » partout dans
  l'appli (badge, chat staff, modération, signalement), « warden » en anglais.
  Rien ne change dans les droits. Les badges de rôle à côté d'un pseudo sont
  maintenant traduits en anglais.
- Annonces programmées (0026) : la notification part à l'heure de début.
- Préparation du freemium (0027) : abonnements Google Play, revenus,
  is_premium() ; statistiques d'usage pour le site d'administration.

0.75.1 · 3 novembre 2026 · mineure
----------------------------------
- Version anglaise, phase 3 : fiches nœuds et montages carpe, fiches techniques
  par espèce, assistant montage, calculateurs (plombée, fil, amorce), sessions
  carpe et carnet d'amorçage, prévisions et vent, état de l'eau, structures,
  fraie, réglementation, Fishdex, carnet, compte, chat, invitations, carte
  (environ 1 550 textes de plus). Le moteur de traduction reconnaît aussi un
  pictogramme devant un texte connu et traduit les morceaux des phrases
  composées. Restent en français : les notifications envoyées par le serveur
  et ce qu'écrivent les membres.
- Garde-pêche (0025) : trois fonctions de lecture réservées à l'administrateur
  pour le site d'administration sur PC (membres, groupes, stockage). Le site
  reste sur le PC du développeur, hors du dépôt.

0.75 · 3 novembre 2026 · majeure
--------------------------------
- Version anglaise, phase 2 : écrans de préparation de sortie, fiches espèces,
  conseils de leurres et de couleurs, sessions carpe, check-lists, carte,
  Fishdex et trophées, modération (environ 550 textes de plus). Restent en
  français pour la phase 3 : fiches nœuds, montages, assistant et calculateurs,
  et les notifications envoyées par le serveur.
- Notification push aux administrateurs pour chaque bug signalé (0023,
  fonction Supabase « alerte »).
- Performances de la base (0024) : index sur les 69 clés étrangères, identité
  du membre calculée une fois par requête dans les 91 règles d'accès, index en
  double supprimé.

0.74.1 · 2 novembre 2026 · mineure
----------------------------------
- Plan de reprise : reconstruction à blanc validée (migration 0018 qui recopie
  dans le dépôt les droits d'accès de la production), sauvegarde externe
  chiffrée chaque nuit vers Scaleway (0019, 0020), restauration testée.
- Ménage du stockage (0021) : les photos, vocaux et avatars sont effacés dès
  que la prise, le message ou le compte est supprimé, ou l'avatar remplacé ;
  balayage nocturne des fichiers orphelins.
- Liens de partage d'une prise : photo visible 24 h au lieu de 7 jours.
- Page de confidentialité mise à jour (Scaleway, durées de conservation).
- Tests de permissions sur une vraie base (projet de test isolé) à chaque PR :
  migrations en attente + vérification des droits, dans une transaction annulée.

0.74 · 2 novembre 2026 · majeure
--------------------------------
Rangement de l'interface. En-tête allégé : notifications, réglages, vue
membre et modération passent dans le menu de l'avatar, le nom du groupe n'est
plus coupé. Sous-onglets du profil avec icône et libellé court. Réglages en
cinq rubriques repliables. Groupe : nouvel onglet « Jeux » (compétitions,
défis, classement, photo du mois, Fishdex) et « À traiter » rangé dans
Membres. Modération du développeur en tuiles, une section à la fois.
Version précédente sauvegardée dans la branche sauvegarde-0.73.1.

0.73.1 · 2 novembre 2026 · correctif
------------------------------------
Les groupes avaient disparu pour les membres depuis la 0.70 : la base refusait
de lire une nouvelle colonne des groupes. Le droit de lecture est ajouté
(migration 0017), rien n'a été perdu.

0.73 · 2 novembre 2026 · majeure
--------------------------------
Version anglaise, première étape : choix de la langue dans Profil › Réglages
(un téléphone réglé en anglais démarre en anglais). La navigation, les écrans
Aujourd'hui, Fil, Carte, Groupe et Profil, les boutons, les formulaires et les
dates passent en anglais ; les messages écrits par les membres ne sont jamais
traduits. Les traductions sont dans i18n-en.js ; les écrans secondaires
(fiches techniques, outils, modération, notifications) suivront en 0.73.x.
Un test automatique vérifie la version anglaise avant chaque mise en ligne.

0.72 · 2 novembre 2026 · majeure
--------------------------------
Page de présentation publique (decouvrir.html) : ce que fait Rivio, captures
d'écran, installation sur Android et iPhone, questions fréquentes. Elle est
liée depuis Profil › Réglages.
Tests automatiques : avant chaque mise en ligne, un navigateur parcourt
l'appli avec un faux Supabase (tests/smoke.mjs) et bloque la fusion si un
écran plante ou si un élément essentiel manque.

0.71 · 2 novembre 2026 · majeure
--------------------------------
Signaler un bug depuis Profil › Réglages, avec capture d'écran facultative ;
la version, le téléphone et l'écran ouvert sont joints automatiquement.
Mes données : export complet du compte en un fichier (RGPD). Les comptes
inutilisés depuis presque 2 ans sont prévenus, puis peuvent être supprimés.
« Quoi de neuf » : après une mise à jour, une fenêtre résume les nouveautés.
Développeur : mode maintenance avec écran d'attente pour les membres,
statistiques d'usage (actifs par jour, rétention, écrans les plus ouverts),
bugs reçus, sauvegardes de toutes les tables chaque semaine (8 semaines)
téléchargeables, et sauvegarde à la demande.

0.70 · 2 novembre 2026 · majeure
--------------------------------
Messages privés : bouton ✉️ dans le chat et « Écrire » sur chaque profil. Une
personne peut être bloquée, et un message reçu peut être signalé au staff.
Chat de groupe : toucher un message pour réagir, répondre ou le signaler ; les
modérateurs peuvent épingler un message en haut du chat.
Groupe Bienvenue : questions-réponses avec meilleure réponse, et parrainage
(un pêcheur expérimenté accompagne un nouveau en privé, 3 filleuls maximum).
Bilan du mois de chaque groupe, affiché dans le groupe et notifié le 1er.
Invite tes potes : lien personnel à partager ; chaque ami inscrit grâce à lui
qui publie sa première prise fait progresser le badge d'ambassadeur.
Record du groupe : la notification annonce quand une prise bat le record de
l'espèce, et prévient l'ancien détenteur.
Prise pré-remplie : la date, l'heure et le spot sont lus dans la photo ; une
prise publiée plus tard affiche l'heure réelle dans le fil.
Température de l'eau : sans mesure récente, l'estimation est calée sur la
température relevée les années passées par la sonde la plus proche.

0.69.2 · 2 novembre 2026 · mineure
----------------------------------
Fil : les tuiles Prise, Bilan et Session carpe sont rangées derrière un seul
bouton « Nouvelle prise », et le formulaire ne se rouvre plus tout seul au
démarrage (sauf une session carpe en cours). Les premières photos du fil sont
visibles dès l'ouverture.

0.69.1 · 2 novembre 2026 · mineure
----------------------------------
Type de pêche : chacun choisit jusqu'à 3 étiquettes dans son profil (Carpiste,
Carnassier, Coup, Feeder, Mouche, Truite, Silure, Float-tube, Mer). Elles
s'affichent sous le nom dans le fil, le chat, la liste des membres et le profil
public. Une sélection est proposée d'après les espèces favorites.

0.69 · 2 novembre 2026 · majeure
--------------------------------
Groupe « Bienvenue » : chaque nouveau compte y entre automatiquement, sans
invitation ni limite de membres, pour poser ses questions dans le chat.
Saisie sans réseau étendue : bulletins d'eau, signalements environnement (avec
photo), traces de sortie, relevés de fond, structures, spots et amorçages sont
gardés sur le téléphone et envoyés au retour du réseau.
Annonces : le développeur publie un bandeau visible par tous, avec notification
facultative.
Modération : journal des actions (qui a fait quoi, quand), avertissement sans
suspension, dossier du membre sur 6 mois avec palier conseillé (avertissement,
puis 24 h, puis 7 jours) et motifs tout prêts.
Santé de l'appli (développeur) : erreurs remontées par les téléphones,
notifications livrées ou en échec, tâches planifiées en panne, compteurs.

0.68 · 2 novembre 2026 · majeure
--------------------------------
Liens d'invitation : un lien respecte désormais la validation par un modérateur,
la limite de membres du groupe et les sanctions en cours. Un nouveau venu qui
ouvre un lien voit le nom du groupe, crée son compte, puis rejoint le groupe
automatiquement (le lien est gardé 24 h). Un lien expiré l'indique clairement.
Le doublon caché du bouton « Inviter » est retiré.
Groupes : un propriétaire peut de nouveau supprimer son groupe ou le quitter
après avoir désigné un successeur (ces deux actions étaient bloquées).
Sanctions : un membre suspendu ne peut plus rien publier de visible par le
groupe (défis, compétitions, bilans, zones, structures, relevés d'eau, votes,
réactions, partages, profil public…). Ses outils personnels restent utilisables.
« Je pars pêcher » reste possible pour sa sécurité, sans note ni notification
au groupe. Il peut toujours signaler un membre ou un contenu.
Base de données : le dépôt et la base correspondent de nouveau (migrations
0010 et 0011, tâches planifiées nommées, règles de stockage). Le secret des
notifications a été changé et retiré du dépôt public.

0.67.2 · 31 octobre 2026 · correctif
------------------------------------
Remplace la feuille de style tronquée au chargement par sa version complète.
Le changement du cache du service worker force son renouvellement sur les
appareils déjà connectés.

0.67.1 · 31 octobre 2026 · correctif
------------------------------------
Restaure la feuille de style complète après une publication qui l'avait rendue
illisible par le navigateur. Incrémente le cache du service worker pour forcer
le rechargement des styles sur les appareils déjà connectés.

0.67 · 31 octobre 2026 · ajout
------------------------------
Les repères nationaux de pêche affichent leurs sources Légifrance et un
avertissement visible : ils sont indicatifs et ne remplacent pas les arrêtés
locaux, réserves temporaires ou règles propres aux parcours. Correction des
tailles minimales nationales du brochet (50 cm) et du sandre (40 cm), et du
premier jour de fermeture du brochet après le dernier dimanche de janvier.
L'encadré AAPPMA propose un menu des fédérations départementales, présélectionne
celle du secteur détecté et ouvre son site officiel. Les liens sont repris de
l'annuaire national Génération Pêche.

0.66.10 · 31 octobre 2026 · ajout
--------------------------------
Un carnet de sortie personnel est disponible dans Profil > Moi : une sortie,
son lieu, ses conditions, ses notes et ses prises. Il fonctionne entièrement
hors réseau. La sortie est d'abord gardée sur le téléphone, puis envoyée
automatiquement au retour de la connexion, avec un nouvel essai si le serveur
refuse. Chaque sortie porte un identifiant créé sur l'appareil : la renvoyer ne
crée jamais de doublon, et les prises peuvent être ajoutées, modifiées ou
supprimées hors ligne. Le carnet est strictement personnel : chaque membre ne
voit que ses propres sorties. Nécessite la migration `0009_field_logbook.sql`,
à appliquer séparément.

0.66.9 · 31 octobre 2026 · ajout
--------------------------------
Un membre suspendu peut demander un réexamen de sa sanction depuis son profil,
sans retrouver le droit d'écrire : la lecture reste possible, mais les
publications, commentaires et messages restent bloqués pendant tout l'examen.
La demande apparaît dans Profil > Modération. Un développeur ou un contrôleur
peut y répondre et, s'il le juge justifié, lever la sanction ; sinon il la
maintient. La réponse est notifiée au membre, qui retrouve l'historique de ses
recours dans son profil. Un seul recours est possible par sanction, et le
membre ne peut jamais traiter son propre recours. Nécessite la migration
`0008_sanction_appeals.sql`, à appliquer séparément.

0.66.8 · 31 octobre 2026 · fiabilité + sécurité
-----------------------------------------------
La console de modération affiche désormais l'état réel des garde-fous serveur :
sanctions actives, migration incomplète ou migration absente. Tant que la base
n'applique pas les sanctions, le formulaire de timeout est désactivé pour ne pas
faire croire à une suspension effective. La migration `0007_timeout_update_guards.sql`
étend le blocage aux modifications de contenu existant (prises, commentaires,
messages, notes de groupe) et aux autres contenus partagés (sondages, sorties,
spots, traces, signalements). L'historique des sanctions indique qui a sanctionné,
le motif, les dates, et qui a levé la sanction avec son motif. Les signalements
affichent le contenu réel et permettent d'ouvrir directement la publication ou
la fiche de l'auteur. Les actions de modération vérifient l'état courant et
signalent clairement un élément déjà traité par un autre modérateur avant de
rafraîchir la liste.

0.66.7 · 31 octobre 2026 · ajout + sécurité
--------------------------------------------
La modération globale est réunie dans Profil > Modération : éléments à traiter
(signalements, adhésions, publications), recherche de membres, groupes et
publications, et gestion des contrôleurs par le développeur. Un développeur ou
un contrôleur peut appliquer une sanction temporaire (10 min, 1 h, 24 h ou
7 jours) avec un motif obligatoire, et la lever avant terme. La sanction bloque
côté serveur les nouvelles prises, commentaires et messages de chat, y compris
les photos et vocaux, même depuis un chat déjà ouvert ; la lecture et la
connexion restent possibles. Nécessite la migration `0006_timeouts.sql`,
à appliquer séparément. L'ancien onglet Modo et ses notifications pointent
désormais vers la bonne section du profil. La suppression d'un groupe gérée
par le développeur rejoint cette console, et l'ancien panneau de modération
redondant du profil est retiré ; les responsables et modérateurs de groupe
gardent leurs outils locaux dans l'écran du groupe.

0.66.6 · 31 octobre 2026 · ajout + correctif
---------------------------------------------
Ajout de la modération dans le profil : gestion des membres, des demandes
d'adhésion et des groupes selon le rôle. Le chat staff et plusieurs éléments
d'interface sont corrigés. Les invitations par lien sont mises en avant et le
code de groupe historique est masqué dans l'interface.

0.66.5 · 31 octobre 2026 · ajout + sécurité
---------------------------------------------
Chat staff séparé, réservé aux développeurs et contrôleurs, avec médias dans
un stockage privé et mentions limitées à l'équipe.

0.66.4 · 31 octobre 2026 · ajout + fiabilité
---------------------------------------------
Suppression de groupe avec confirmation par son nom et nettoyage des photos.
Le responsable transmet son rôle à un membre actif avant de partir ; seul, son
départ supprime le groupe.

0.66.3 · 31 octobre 2026 · entretien
------------------------------------
Libellés visibles harmonisés autour de « Développeur » sans modifier les noms
techniques des rôles stockés en base.

0.66.2 · 31 octobre 2026 · correctif
------------------------------------
La carte se centre sur la position de l'utilisateur à son ouverture, lorsque
la localisation est disponible.

0.66.1 · 31 octobre 2026 · entretien
------------------------------------
Décision et consigne de gestion documentées : si le responsable est le dernier
membre du groupe et le quitte, le groupe est supprimé. Cette version consigne
principalement une règle de comportement ; elle n'ajoute pas d'écran utilisateur.

0.66 · 31 octobre 2026 · ajout
-----------------------------
Invitations par lien et QR code. Un seul jeton : le QR encode le lien, qui
s'affiche dessous et se copie d'un clic. Durée selon l'émetteur : 2 h pour un
responsable ou un modérateur, 1 h pour un membre simple. Jeton stocké haché,
usage multiple pendant la fenêtre, révocable. Le code de groupe reste encore
en place le temps de la bascule.

0.65 · 31 octobre 2026 · ajout
-----------------------------
Carte du jour : une ligne de provenance sous le score indique le lieu météo
réellement utilisé, l'heure de mise à jour (et « hors ligne » quand elle vient
du cache) et si la température de l'eau est mesurée par une sonde ou estimée.
Même information dans l'écran Conseils. Aucune requête supplémentaire.

0.64.1 · 31 octobre 2026 · correctif
-----------------------------------
Déconnexion : le bandeau « Connexion instable » pouvait survivre à la
déconnexion et masquer des options. Il est retiré en même temps que la session.

Fil et sorties : deux chargements secondaires (bilans de sortie, réponses des
participants) ignoraient leurs erreurs. L'information manquait sans que rien ne
l'indique ; un avertissement discret le signale désormais.

0.64 · 31 octobre 2026 · correctif + sécurité
---------------------------------------------
Fil, sorties, sondages et plusieurs écrans : les requêtes qui joignent le profil
de l'auteur échouaient (jointure ambiguë côté base). Le fil n'affichait donc
aucune publication. Douze requêtes corrigées, vérifiées une par une contre l'API.

Fichiers de notifications restaurés : notify-lib.js et score-lib.js composent
la fonction Supabase « notify » déployée. Leur suppression en 0.63 était une
erreur.

Documentation : le guide d'installation renvoie vers migrations/ au lieu de
supabase.sql, avec l'avertissement de ne plus appliquer l'ancien script.

0.63 · 31 octobre 2026 · sécurité + correctifs
----------------------------------------------
Sécurité : cinq règles d'accès à la base ne bloquaient pas un membre qui déplaçait
une de ses lignes dans un groupe dont il n'est pas membre (fausse annonce de
pêche, position inventée). Règles durcies, appliquées en production.

Correctif : un échec réseau au démarrage affichait « Terminer mon profil » à un
membre dont le compte existe.

Correctif : la météo pouvait être écrasée par une réponse plus lente que la
dernière demandée.

Correctif : hors ligne, une fin de sortie non enregistrée laissait le groupe
croire que la personne pêchait encore.

Correctif : le mode Fond de la carte gelait l'interface en calculant les
profondeurs (jusqu'à 288 millions d'opérations).

Entretien : schéma de la base reconstruit depuis la production dans migrations/,
cache des photos du fil, déconnexion unifiée.

0.62 · 30 octobre 2026 · ajout
------------------------------
Boîte à outils en lanceur : chaque tuile ouvre son outil, avec retour à la liste.

0.61 · 31 octobre 2026 · performance + fiabilité
-------------------------------------------------
Navigation à cinq entrées, profil dans l'en-tête et boîte à outils enrichie.
Démarrage et changements d'onglet accélérés. Relecture de sécurité et fiabilité :
codes cryptographiques, contrôle d'accès, chargements ordonnés, file hors ligne
protégée entre onglets et Leaflet chargé uniquement quand la carte est ouverte.

0.60 · 31 octobre 2026 · sécurité + correctifs
----------------------------------------------
Sécurité renforcée pour l'administration et les codes d'invitation. Les envois
hors ligne refusés sont conservés ; arrondi des heures corrigé.

0.59 · 31 octobre 2026 · ajout
------------------------------
Assistant de montage, conditions gagnantes, bulletin d'eau, rubrique
Environnement, carte des structures et récapitulatif de sortie.

0.58 · 30 octobre 2026 · ajout
------------------------------
Carte des prévisions, vent et berge, image des conditions et album par espèce.

0.57 · 30 octobre 2026 · ajout
------------------------------
Calculateur d'amorce et conseil adapté au type d'eau, au poste, à la couleur
de l'eau et à la pression, prérempli avec les conditions du jour.

0.56 · 30 octobre 2026 · ajout
------------------------------
Sondeur remanié, calculateurs de pêche (plomb, fil, amorce et conversions) et
agenda du groupe avec ouvertures et fermetures.

0.55 · 30 octobre 2026 · performance
------------------------------------
Logo d'en-tête allégé (50 Ko à 9 Ko), icône 512 retirée du préchargement,
histoires du fil chargées à l'ouverture du fil, historique des bilans et photos
de profil mis en cache pendant une heure.

0.54 · 30 octobre 2026 · amélioration
-------------------------------------
Espèce favorite affichée en premier, puis espèce la mieux adaptée au moment.

0.53 · 30 octobre 2026 · amélioration
-------------------------------------
Meilleur créneau mis en évidence et faible activité (moins de 50 %) affichée
en orange.

0.52 · 30 octobre 2026 · amélioration
-------------------------------------
Légende ajoutée aux barres d'activité dans « Espèces du moment ».

0.51 · 30 octobre 2026 · identité
---------------------------------
L'application adopte le nom Rivio.

0.50 · 30 octobre 2026 · ajout
------------------------------
Centre de notifications, invitations par lien et QR code, fiches techniques
par espèce, mode découverte sans compte, mode nuit rouge automatique et carte
de chaleur issue des bilans.

0.49 · 30 octobre 2026 · confidentialité
-----------------------------------------
Politique de confidentialité et parcours de suppression de compte. Manifeste
complété pour le Play Store et suppression de compte purgée des sauvegardes.

0.48 · 30 octobre 2026 · amélioration
-------------------------------------
Récupération du mot de passe oubliée.

0.47 · 30 octobre 2026 · sécurité
---------------------------------
Réinitialisation du mot de passe par l'équipe, avec mot de passe provisoire et
changement obligatoire à la connexion suivante.

0.46 · 30 octobre 2026 · amélioration
-------------------------------------
Ajout d'une adresse e-mail aux anciens comptes, avec message en cas d'échec du
serveur d'e-mails.

0.45 · 30 octobre 2026 · amélioration
-------------------------------------
Création de compte sans code de groupe obligatoire, avec parcours pour rejoindre
ou créer un groupe.

0.44 · 30 octobre 2026 · comptes
--------------------------------
Gestion des comptes par e-mail : changement d'adresse et de mot de passe,
mot de passe oublié et suppression du compte.

0.43 · 30 octobre 2026 · ajout
------------------------------
Fiches de nœuds en catégories, nœud Albright et section carpe avec huit bas de
ligne à fabriquer.

0.42 · 30 octobre 2026 · ajout
------------------------------
Minuteur par canne, carnet d'amorçage, photo du mois et alerte orage.

0.41 · 30 octobre 2026 · ajout
------------------------------
Suivi des poissons relâchés ou gardés, alertes de fraie et zones de frai.

0.40 · 30 octobre 2026 · correctif + ajout
------------------------------------------
Correctifs urgents du bilan, du chat et de l'onglet Groupe après la 0.39.
Réveil de pêche par notification, ajout à l'agenda et heure de départ à copier.

0.39 · 30 octobre 2026 · ajout + correctif
------------------------------------------
Calendrier, réveil de pêche, nœuds, montages, conseils sur les leurres et poids
estimé dans le bilan. Le réveil et ses notifications ont été finalisés dans
cette version ; les régressions rencontrées au premier déploiement ont été
corrigées.

0.38 · 29 octobre 2026 · correctif + sécurité
---------------------------------------------
Correction des panneaux en double au retour sur Profil, des ouvertures en double
et des chargements croisés du fil. Astuce des spots actualisée et fonctions
internes réservées aux comptes connectés.

0.37 · 29 octobre 2026 · correctif
----------------------------------
Correction du débordement de couleur de fond et affichage unique de la prochaine
sortie.

0.36 · 29 octobre 2026 · refonte + ajout
----------------------------------------
Refonte de l'application : fiche de prise, réactions par appui long, pseudos
cliquables, lecture à une main, partage depuis la galerie, chat dans l'en-tête
et numéro de version 0.x.
