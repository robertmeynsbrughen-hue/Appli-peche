# À faire — demandes du 31 octobre

Consigné pour ne rien perdre. Ordre de traitement proposé, du plus sûr au plus
risqué. Chaque ligne deviendra une version : `0.67.1`, `0.67.2`, etc.

## 1. Recentrer la carte sur la position GPS (0.67.1)

À l'ouverture, la carte part sur la France entière. Elle doit s'ouvrir centrée
sur la position de l'utilisateur, avec un zoom de travail (rue/quartier), et ne
revenir à la vue large que si la position est refusée.

Point d'attention : `window.CDJ_POS` n'est renseigné qu'après un chargement
météo. Si la carte s'ouvre avant, il faut demander la position à ce moment-là,
avec un repli propre sur la dernière position connue puis sur la France.

## 2. Renommer « Admin » en « Développeur » (0.67.2)

Le libellé apparaît dans les badges de rôle, les écrans d'administration et les
messages. À vérifier : ne pas toucher aux valeurs stockées en base
(`is_admin`, `is_controller`), seulement à ce qui s'affiche. Un renommage de
colonne casserait tout le code existant.

## 3. Suppression d'un groupe (0.67.3)

- Un responsable peut supprimer **son** groupe.
- Un développeur peut supprimer **n'importe quel** groupe, un par un.
- Suppression réelle avec cascade (posts, spots, adhésions, invitations,
  relevés, sorties…). Les photos du stockage doivent être retirées aussi,
  sinon elles restent orphelines et consomment le quota.
- Double confirmation obligatoire : saisir le nom du groupe, pas un simple
  « oui/non ». Une suppression de groupe est irréversible.

## 4. Transmission avant départ (0.67.4)

Un responsable qui veut quitter son groupe doit d'abord désigner un successeur
parmi les membres actifs. Tant qu'il n'y en a pas, le départ est bloqué.

Cas à traiter : le responsable est seul dans son groupe. Il doit pouvoir soit
supprimer le groupe (point 3), soit nommer quelqu'un qui n'est pas encore
membre — ce qui n'a pas de sens. À trancher : dans ce cas, le départ supprime
le groupe, ou reste bloqué avec une explication claire.

## 5. Chat du staff (0.67.5)

Salon réservé aux contrôleurs et développeurs, distinct du chat de groupe.
Nécessite une table dédiée ou un marqueur de portée, plus une policy qui exclut
strictement les membres ordinaires — c'est le point à tester en priorité, un
salon privé qui fuit est pire que pas de salon.

---

## Décision tranchée — départ d'un responsable seul dans son groupe

Si le responsable est le **dernier membre actif** de son groupe, quitter le
groupe **supprime le groupe**. Pas de transmission possible, donc pas de groupe
orphelin sans responsable.

Conséquences à implémenter (0.67.4) :

- le départ est refusé tant qu'il reste d'autres membres et qu'aucun successeur
  n'a été désigné ;
- si le responsable est seul, l'interface annonce clairement que partir
  supprimera le groupe, avec la même confirmation par saisie du nom qu'au
  point 3 ;
- la suppression effective réutilise la même fonction que le point 3, pour
  n'avoir qu'un seul chemin de suppression dans le code.
