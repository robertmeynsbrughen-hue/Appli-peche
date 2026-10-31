# Suivi des demandes du 31 octobre

Les points ci-dessous sont implémentés dans la branche locale `codex/resume-roadmap`.
Ils ne sont pas encore publiés. Les changements fonctionnels suivent la règle de
version mineure `0.xx.x` ; la décimale `0.xx` reste réservée aux mises à jour majeures.

## 1. Recentrage GPS de la carte — déjà présent en 0.66.2

La carte utilise la position connue, demande la géolocalisation si nécessaire,
puis revient à une vue de France en cas de refus ou d'échec.

## 2. Libellés visibles — 0.66.3

« Admin » devient « Développeur » dans l'interface et la documentation. Les
colonnes et valeurs techniques (`is_admin`, `is_controller`) restent inchangées.

## 3. Suppression d'un groupe — 0.66.4

Un responsable supprime son groupe ; un développeur peut supprimer chaque
groupe. La confirmation exige son nom. Les photos du groupe sont nettoyées après
la suppression en base, avec un droit temporaire limité à l'initiateur.

## 4. Transmission avant départ — 0.66.4

Le responsable choisit un membre actif avant de quitter le groupe. S'il est le
dernier membre actif, quitter supprime le groupe avec la même confirmation par
saisie du nom.

## 5. Chat staff — 0.66.5

Un salon séparé est réservé aux développeurs et contrôleurs. Il possède sa table,
ses règles d'accès et son bucket privé pour les photos et vocaux. Les signalements
du chat groupe ne sont pas proposés dans ce salon.
