# Marketing Intelligence — suite (Shopify sync, connexions, dashboard)

Ton message s'arrête à « 4. Assistant marketing IA — Prévoir ». Cette partie sera détaillée quand tu l'auras complétée. Le reste est prévu ci-dessous. Erplain, la connexion Shopify existante et les secrets ne sont pas modifiés.

## 1. Shopify — synchronisation et tableau de bord

**Nouvelles tables (migration soumise à ta validation) :**
- commandes Shopify (id, numéro, dates de création/mise à jour, pays, devise, totaux bruts, remises, taxes, livraison, remboursé, CA net, statut financier/expédition, annulée)
- lignes de commande (produit, variante, SKU, quantité, prix, remise)
- produits et variantes (titre, SKU, prix, coût unitaire si disponible)
- remboursements (montant, date, lignes concernées)
- historique des synchronisations (période, début/fin, statut, pages lues, commandes importées/mises à jour, erreurs)
- Accès : administrateur et rôles ayant le droit sur « Marketing Intelligence » ; écriture uniquement par le serveur.

**Synchronisation :**
- Choix de période : 30 jours, 90 jours, 12 mois, tout l'historique, dates personnalisées.
- Bouton « Synchroniser » : progression (pages, commandes), erreurs, nombre importé / mis à jour.
- Pagination Shopify complète, reprise par lots si la synchro est longue.
- Doublons évités : chaque commande est enregistrée par son identifiant Shopify et remplacée si elle a changé (date de mise à jour).
- Au-delà de 60 jours, Shopify demande le droit « lecture de toutes les commandes » : l'appli détecte s'il manque et l'indique clairement.
- Synchro quotidienne automatique des commandes modifiées depuis la veille.

**Tableau de bord Shopify :** filtres de dates ; CA net, nombre de commandes, panier moyen ; ventes par pays et par produit.

## 2. Section « Connexions »

Cartes Google Ads, GA4, Meta Ads (Crush AI) : état « Non connecté », données prévues, ce qu'il faudra fournir. Rien n'est activé ni appelé tant que tu n'as pas donné les autorisations.

## 3. Dashboard marketing global (préparé)

Comparaison par période, canal, pays, produit : CA Shopify, dépenses Ads, ROAS, MER (CA Shopify ÷ dépenses totales), CPA, conversion, marge quand les coûts existeront. Shopify reste la référence des ventes ; les conversions Meta/Google sont affichées à part, jamais additionnées comme des ventes. Les indicateurs Ads affichent « en attente de connexion » d'ici là.

## 4. Assistant marketing IA

À préciser (message coupé).

## Détails techniques

- Nouvelle fonction serveur `shopify-sync` (réutilise les secrets et l'obtention du token de `shopify-test`), API GraphQL Admin, pagination par curseur, upsert sur l'id Shopify, filtre `updated_at` pour l'incrémental, lots avec reprise.
- Tâche planifiée quotidienne (pg_cron) appelant `shopify-sync` en mode incrémental.
- Nouvel onglet de permission `marketing-intelligence` intégré au système de droits existant.
- Agrégats du tableau de bord calculés côté base (vue/fonction) pour rester rapides.
