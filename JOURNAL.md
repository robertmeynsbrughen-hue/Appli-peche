RIVIO — JOURNAL DES MISES À JOUR
==============================

Ce fichier ne contient pas de code. Il raconte, en une ou deux lignes par version,
ce qui a changé et pourquoi. Une entrée par version livrable.

Format : version · date · nature (ajout / correctif / sécurité / entretien)


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

Fichiers de notifications restaurés : notify-lib.js et score-lib.js ne sont pas
du code mort, ils composent la fonction Supabase « notify » déployée. Leur
suppression en 0.63 était une erreur.

Documentation : le guide d'installation renvoie vers migrations/ au lieu de
supabase.sql, avec l'avertissement de ne plus appliquer l'ancien script.


0.63 · 31 octobre 2026 · sécurité + correctifs
----------------------------------------------
Sécurité : cinq règles d'accès à la base empêchaient pas un membre de déplacer
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
