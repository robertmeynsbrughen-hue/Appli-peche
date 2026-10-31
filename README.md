# Rivio — l’assistant de pêche entre amis

Rivio aide à préparer une sortie, suivre les conditions et garder le souvenir des prises. L’application réunit conseils de pêche, carnet partagé et outils pratiques dans une interface utilisable sur téléphone ou ordinateur.

**Application : [ouvrir Rivio](https://robertmeynsbrughen-hue.github.io/Appli-peche/)**  
**Version du dépôt : 0.66.9 · bêta**

## Ce que l’application permet de faire

- **Préparer sa pêche** : consulter la météo et les conditions locales, les espèces et créneaux d’activité, puis ajuster manuellement les paramètres si besoin.
- **Garder une trace des sorties** : publier une prise avec photo et informations, noter un bilan de session ou suivre une session carpe.
- **Partager avec son groupe** : retrouver un fil de prises, une carte de spots, un agenda et un chat avec les autres membres.
- **Inviter et gérer les membres** : rejoindre un groupe par invitation, participer à plusieurs groupes et modérer les adhésions ou publications selon son rôle.
- **Utiliser les outils de pêche** : consulter des aides aux montages et aux nœuds, des calculateurs et d’autres fiches pratiques.
- **Modérer l’application** : les développeurs et contrôleurs disposent d’une console dans Profil > Modération pour examiner les signalements, membres, groupes et publications. Ils peuvent appliquer des sanctions temporaires et examiner les demandes de recours. Les outils locaux des responsables et modérateurs restent accessibles dans leur groupe.

## Installation sur le téléphone

Rivio est une application web installable. Ouvre le lien ci-dessus dans le navigateur du téléphone :

- **Android** : dans Chrome, ouvre le menu ⋮ puis choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».
- **iPhone** : dans Safari, touche « Partager », puis « Sur l’écran d’accueil ».

L’installation dépend des possibilités du navigateur. Une connexion reste nécessaire pour les données de compte et de groupe ; certaines ressources peuvent être disponibles depuis le cache.

## Conseils et données

Les conseils reposent sur des règles générales et les conditions disponibles pour le lieu. La température de l’eau peut être estimée, et les données météo ou de débit peuvent provenir d’un cache. Ces indications ne remplacent pas l’observation sur place.

Les périodes d’ouverture, tailles minimales, quotas et autres règles varient selon le département et le cours d’eau : vérifie toujours la réglementation locale en vigueur. Consulte aussi la [politique de confidentialité](https://robertmeynsbrughen-hue.github.io/Appli-peche/confidentialite.html) avant d’utiliser les fonctions de compte et de partage.

## Pour les personnes qui contribuent

Le dépôt contient l’application web (HTML, CSS et JavaScript) ainsi que les migrations SQL de son backend Supabase. Les migrations sont documentées dans [migrations/](migrations/) et doivent être prises en compte lors d’un déploiement du backend. Le numéro de version suit la convention du projet : **0.xx pour une version majeure**, **0.xx.x pour une version mineure ou corrective**.

- [Historique complet des mises à jour](JOURNAL.md)
- [Guide technique et de mise en ligne](LISEZMOI.md)
- [Code source](https://github.com/robertmeynsbrughen-hue/Appli-peche)

<details>
<summary>Suivi des versions</summary>

- **0.66.9** — Recours contre une sanction temporaire, examiné par un développeur ou un contrôleur.
- **0.66.8** — État réel des sanctions, garde-fous contre les modifications pendant un timeout et contexte des signalements.
- **0.66.7** — Console de modération globale dans Profil, sanctions temporaires et gestion des groupes et publications.
- **0.66.6** — Modération des groupes, chat staff corrigé, invitations par lien mises en avant.
- **0.66.5** — Chat staff avec médias privés et mentions réservées à l’équipe.
- **0.66.4** — Suppression de groupe et transfert du rôle de responsable.
- **0.66.3** — Libellés de rôles harmonisés.
- **0.66.2** — La carte s’ouvre sur la position de l’utilisateur.
- **0.66.1** — Décision de gestion documentée : le départ du responsable seul supprime le groupe.
- **0.66** — Invitations temporaires par lien et QR code.
- **0.65** — Provenance des conseils météo et de la température de l’eau.
- **0.64.1** — Nettoyage de l’état de déconnexion et signalement d’erreurs de chargement.
- **0.64** — Corrections des jointures de profils, notifications restaurées et documentation de base corrigée.
- **0.63** — Sécurité des accès, fiabilité météo et sessions, correction d’un gel de la carte et entretien du cache.
- **0.62** — Boîte à outils réorganisée en lanceur.
- **0.61** — Navigation et démarrage améliorés, outils regroupés et durcissement de la fiabilité.
- **0.60** — Sécurité renforcée, conservation des envois hors ligne en échec et heures arrondies.
- **0.59** — Assistant de montages, conditions gagnantes, informations sur l’eau et l’environnement, structures et récapitulatif de sortie.
- **0.58** — Prévisions cartographiques, vent et berge, conditions illustrées et album par espèce.
- **0.57** — Calculateur d’amorce adapté aux conditions.
- **0.56** — Sondeur remanié, calculateurs et agenda de groupe.
- **0.55** — Optimisations de chargement, cache et poids des images.
- **0.54** — Espèce favorite et conseils adaptés.
- **0.53** — Créneaux favorables et repérage des périodes de faible activité.
- **0.52** — Légende des barres d’activité.
- **0.51** — L’application adopte le nom Rivio.
- **0.50** — Notifications, invitations, fiches espèces, mode découverte et améliorations de carte et d’affichage.
- **0.49** — Politique de confidentialité et suppression de compte.
- **0.48** — Récupération du mot de passe.
- **0.47** — Réinitialisation encadrée du mot de passe par l’équipe.
- **0.46** — Ajout d’une adresse e-mail aux anciens comptes.
- **0.45** — Création de compte et parcours de groupe simplifiés.
- **0.44** — Gestion des comptes et des adresses e-mail.
- **0.43** — Fiches de nœuds et montages carpe.
- **0.42** — Minuteur par canne, carnet d’amorçage, photo du mois et alerte orage.
- **0.41** — Suivi des poissons relâchés ou gardés et alertes de fraie.
- **0.40** — Correctifs du bilan, du chat et du groupe ; réveil et agenda de pêche.
- **0.39** — Calendrier, réveil pêche, nœuds, montages et aides sur les leurres.
- **0.38** — Correctifs de navigation, chargement et accès.
- **0.37** — Corrections d’affichage et prochaine sortie.
- **0.36** — Refonte, fiches de prise, réactions, partage depuis la galerie, chat et version visible.

Le [journal](JOURNAL.md) détaille les changements et les correctifs associés à chaque version.

</details>
