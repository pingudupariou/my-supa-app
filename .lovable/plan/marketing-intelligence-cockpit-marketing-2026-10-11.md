# Marketing Intelligence : cockpit marketing

## Audit rapide

**Données disponibles (déjà importées)**
- Shopify : commandes (date, pays, CA, remboursements), lignes produits. C'est la seule source de ventes réelles.
- Google Ads : jour × campagne (totaux), et jour × campagne × pays (ventilation à part).
- Meta Ads : jour × campagne (totaux), et jour × campagne × pays (ventilation à part).
- GA4 : jour × canal × pays × appareil (sessions et tunnel), plus une table source/support séparée.

**Limites du dashboard actuel**
- Quatre cartes indépendantes, chacune avec ses propres dates. Il n'y a pas de filtre global.
- Il n'y a que des tableaux : aucune courbe ni répartition visuelle.
- Il n'y a pas de comparaison avec la période précédente.
- Il n'y a pas de sélection multiple de pays ou de campagnes.
- Chaque changement de date relance un calcul serveur par carte, soit quatre appels.
- Le MER est calculé dans deux cartes différentes.

**Règles de compatibilité des filtres**
- **Pays :** applicable à toutes les sources. Pour les publicités, les dépenses filtrées par pays viennent de la ventilation par pays, sans aucune part sans pays connu.
- **Campagne :** applicable seulement à Google et Meta. Shopify et GA4 affichent « non filtrable par campagne ».
- **Canal GA4 et appareil :** applicables seulement à GA4.
- **Canal publicitaire (Google ou Meta) :** filtre les dépenses. Le CA Shopify reste global, et le MER est marqué « MER partiel » le cas échéant.
- **Ventes attribuées :** les ventes attribuées par Google, Meta ou GA4 sont toujours affichées avec la mention « attribué ». Elles ne sont jamais additionnées au CA Shopify.

## Phase 1 : refonte visuelle et interactivité

**Barre de filtres globale, fixée en haut de l'écran**
- Période : préréglages ou dates personnalisées.
- Comparaison avec la période précédente.
- Pays et campagnes en sélection multiple.
- Canal et appareil.

**Un seul chargement par période**
- Un seul calcul serveur renvoie des séries quotidiennes compactes pour toutes les sources, découpées par pays et par campagne.
- Tous les filtres, comparaisons et graphiques sont recalculés dans le navigateur, sans nouvel appel ni nouvel import.
- La période précédente est chargée une seule fois avec la période en cours.

**Sept onglets**
1. **Vue d'ensemble :** cartes KPI (CA, commandes, panier moyen, dépenses Ads, MER, CPA, sessions, taux de conversion) avec la variation en %. Courbe CA, dépenses et MER, avec un choix des indicateurs affichés.
2. **Acquisition :** comparaison Google et Meta (dépenses, ROAS attribué, part des dépenses), plus le trafic GA4 par canal.
3. **Pays :** histogramme comparatif, avec CA Shopify, dépenses, MER par pays et sessions. Comparaison de plusieurs pays.
4. **Campagnes :** tableau triable et filtrable avec recherche, et comparaison de campagnes sélectionnées sur une courbe.
5. **Produits :** ventes Shopify par produit (CA, quantités, évolution), avec les produits en hausse et en baisse.
6. **Tunnel :** de la vue produit à l'achat GA4, avec les taux par étape et la comparaison par période.
7. **Diagnostic IA :** emplacement prévu pour la phase 2.

**Design**
- Cartes sobres, couleurs fixes par source (Shopify, Google, Meta, GA4), affichage adapté au mobile.
- Badge « non applicable » quand un filtre ne concerne pas une source.

**Ce qui est conservé tel quel**
- Les cartes de synchronisation de l'onglet Connexions.
- La réconciliation Shopify.
- Les tables et les imports.

## Phase 2 : diagnostic IA

- Un bouton « Analyser » envoie au modèle IA uniquement les agrégats déjà calculés pour les filtres en cours, jamais les données brutes. Le coût est d'un appel par analyse, à la demande.
- Résultat structuré :
  - anomalies, par exemple une chute du MER, un pays dont les dépenses montent sans CA, ou une campagne avec un ROAS en baisse ;
  - opportunités ;
  - trois à cinq actions prioritaires, chacune avec les chiffres sources affichés.
- Règle donnée au modèle : il ne cite que les chiffres fournis et distingue toujours le CA réel des conversions attribuées.
- Option possible : garder l'historique des diagnostics.

## Détails techniques

- Une nouvelle fonction en lecture seule, `marketing_cockpit(_from, _to)`, avec le même contrôle d'accès que les autres. Elle renvoie :
  - Shopify : jour × pays (CA, commandes), plus les produits ;
  - Ads : jour × campagne (totaux) et jour × campagne × pays ;
  - GA4 : extrait du cube.
- Aucune nouvelle table et aucune modification des imports.
- Graphiques avec la bibliothèque Recharts, déjà présente dans le projet. Nouveaux composants dans `src/components/marketing/cockpit/`.
- Les anciennes cartes du Dashboard global sont remplacées. Les calculs serveur existants restent en place.
- Phase 2 : une fonction serveur `marketing-diagnosis` qui appelle le modèle IA via la clé déjà en place côté serveur. Elle sera validée avant tout développement.
- Rien n'est modifié dans Erplain ni dans les campagnes.
