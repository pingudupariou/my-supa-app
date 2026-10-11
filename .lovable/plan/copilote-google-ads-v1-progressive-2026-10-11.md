# Copilote Google Ads — V1 progressive

Rules: Google Ads read-only until explicit validation; Meta supervision only (Crush AI); Merchant Center read-only; Erplain untouched. Existing modules reused, nothing rebuilt.

## Étape 1 — Audit de structure (à développer maintenant)
Today the sync reads only campaign name/status/type + daily metrics and countries. Add a read-only "structure" snapshot (one run per day, plus manual button), no new paid API:
- Campagnes : type/sous-type, budget quotidien, budget partagé ou non, stratégie d'enchères et cibles (ROAS/CPA), dates, pays et langues ciblés/exclus.
- Groupes d'annonces (Search/Shopping) et groupes de composants PMax : statut, signaux/thèmes de recherche.
- Sélections de produits : groupes de fiches PMax/Shopping (custom labels, ID, type, marque) → résolues contre le catalogue Merchant pour savoir quelles variantes chaque campagne couvre.
- Performances produit 90 j (shopping_performance_view par offer ID) : coût, clics, conversions attribuées, reliées aux variantes Merchant/Shopify.
- Historique des modifications (change_event, 30 derniers jours max autorisés par Google).
- Écran « Audit Google Ads » : arbre campagne → groupes → produits couverts ; alertes factuelles : produits éligibles jamais couverts, produits couverts par plusieurs campagnes (chevauchement/cannibalisation), budgets limités, campagnes sans conversions, pays dépensant sans ventes Shopify.

## Étape 2 — Recommandations IA (après validation de l'étape 1)
Réutilise le diagnostic IA existant (agrégats compacts, cache, quota) avec un résumé de structure : nouveaux types (Shopping, PMax, Search, remarketing), nouveaux pays/familles, fusion/séparation, ciblages/exclusions, enchères, budgets. Chaque proposition : faits, hypothèse, risque de chevauchement, fenêtres 7/30/90/180/365 j. Enveloppe Google + Meta configurable (12 000 €/mois par défaut), sans obligation de tout dépenser ; ROAS attribué jamais présenté comme rentabilité. Proposition → tâche marketing existante.

## Étape 3 — Constructeur de campagnes (plus tard)
Projet de campagne enregistré (brouillon) : type, pays, sélection du catalogue publicitaire, budget, enchères, textes. Aucun envoi à Google tant que l'écriture n'est pas explicitement activée ; ensuite chaque création/modification passe par une carte de validation et est journalisée (décision, avant/après).

## Coûts
Lecture API Google Ads gratuite ; ~10 requêtes de structure par jour. IA : uniquement à la demande, même tarif que le diagnostic actuel.

## Technique
- New tables google_ads_structure_* (campaigns detail, ad_groups/asset_groups, listing_groups, product_daily, change_events), RLS marketing read, writes service role only.
- google-ads-sync gains mode "structure" with GAQL on campaign, campaign_budget, campaign_criterion, ad_group, asset_group, asset_group_listing_group_filter, ad_group_criterion (listing groups), shopping_performance_view, change_event.
- Listing-group resolution done client-side against the catalogue model (same grouping as AdCatalog).
