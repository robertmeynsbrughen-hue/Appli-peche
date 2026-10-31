RIVIO — JOURNAL DES MISES À JOUR
==============================

Ce fichier suit les versions numérotées du dépôt depuis 0.36. Il résume les
changements livrés, sans remplacer l'historique détaillé des commits Git.

Convention du projet : 0.xx pour une version majeure, 0.xx.x pour une version
mineure ou corrective. Les dates sont celles des changements dans le dépôt ;
elles ne garantissent pas à elles seules la date de propagation du cache web.

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
