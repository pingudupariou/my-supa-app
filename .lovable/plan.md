# Base clients unique : Erplain comme référence

## Objectif
Une seule base clients : les clients Erplain. Les fiches CRM saisies à la main sont rattachées à leur client Erplain quand c'est le même, ou gardées comme « nouveau client » quand il n'existe pas encore dans Erplain. Chaque client a un seul canal (B2C / B2B / OEM), utilisé partout.

## 1. Audit de l'application (avant tout changement)
Lister chaque onglet qui lit un client ou un canal et la source utilisée :
- Statistiques commerciales, Pipe commercial, Marge B2C après Ads, Plan produit (B2B par client, Réalisé Erplain, projection), CRM / fiches B2B, Synthèse.
- Repérer les anciennes déductions à supprimer (ex. canal deviné depuis le nom de catégorie CRM « OEM »).
- Résultat présenté sous forme de tableau « onglet → source → état ».

## 2. Module « Rapprochement CRM ↔ Erplain »
Dans la fenêtre « Classement clients », nouvelle étape :
- Liste des fiches CRM avec leur statut : **Rattachée**, **Suggestion**, **Nouveau client (hors Erplain)**.
- Suggestions proposées par nom normalisé, e-mail ou n° TVA, **jamais appliquées automatiquement** : vous confirmez chaque rattachement (ou en masse après vérification).
- Recherche d'un client Erplain pour rattacher à la main ; bouton « Détacher ».
- Anti-doublon : un client Erplain ne peut être rattaché qu'à une seule fiche CRM ; alerte si deux fiches CRM semblent identiques.

## 3. Canal unique
- Client rattaché : le canal vient du classement Erplain (règles ou manuel). Le canal saisi dans le CRM n'est plus modifiable séparément, pour éviter deux valeurs.
- Nouveau client hors Erplain : canal choisi sur sa fiche, dans les mêmes catégories B2C / B2B / OEM.
- Quand ce client apparaît ensuite dans Erplain, il est proposé au rattachement.

## 4. Répercussion dans les onglets
- Tous les onglets lisent le canal via le même résolveur commun.
- Plan produit / CRM : un client rattaché n'apparaît qu'une fois (plus de doublon fiche CRM + client Erplain dans les sélecteurs).
- Ventes toujours issues des factures/avoirs Erplain uniquement ; le rattachement ne crée aucune vente.

## 5. Vérifications
- Tests : un client Erplain = une fiche CRM max ; canal identique dans chaque onglet ; aucun rattachement sans confirmation ; client hors Erplain conservé.
- Erplain reste en lecture seule.

## Détails techniques
- Contrainte d'unicité sur `b2b_clients.erplain_customer_id` (non nul), via migration.
- Suggestions calculées côté client sur listes bornées ; rattachement par ID explicite.
- `crmChannel()` : ID lié → canal Erplain ; sinon `sales_channel`.
- Sélecteurs Plan produit dédoublonnés par `erplain_customer_id`.
