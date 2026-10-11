# Google Merchant Center — prérequis et plan de connexion

Rien n'est développé avant validation. Google Ads, Meta Ads et Erplain restent inchangés.

## 1. Faisabilité

- Possible, gratuit (aucun coût Google ; coût Lovable limité au développement).
- API à utiliser : **Merchant API** (la nouvelle API Google ; l'ancienne « Content API » ferme en 2026).
- Le connecteur Google Ads existant ne donne **pas** accès à Merchant Center : il faut une autorisation séparée.
- **Méthode la plus simple : réutiliser le compte de service déjà créé pour GA4.** Aucun nouveau compte Google, aucune clé supplémentaire.

## 2. Point important sur la lecture seule

Google ne propose pas d'autorisation « lecture seule » pour Merchant Center : l'autorisation technique est unique. La lecture seule sera garantie de deux façons :
1. Dans Merchant Center, le compte de service est ajouté avec l'accès le plus faible possible (pas Administrateur).
2. Le code serveur n'appelle que des lectures (liste des produits et des statuts). Aucune fonction d'écriture n'est programmée.

## 3. Ce que vous devez faire (≈ 10 minutes)

1. **Google Cloud** (projet du compte de service GA4) : activer « Merchant API ».
2. **Merchant Center** → Paramètres → Personnes et accès → Ajouter l'adresse e-mail du compte de service GA4 (…@….iam.gserviceaccount.com), accès **Standard** (pas Administrateur), sans notifications.
3. Me donner **l'identifiant Merchant Center** (nombre en haut à droite de Merchant Center). Il sera stocké dans un secret Supabase `MERCHANT_CENTER_ID`.
4. Google demande parfois un enregistrement développeur unique du projet Cloud : si nécessaire, le test le signalera et je l'effectuerai par l'appli (une seule fois, aucune donnée produit modifiée).

## 4. Données récupérables

- Par offre : identifiant exact de l'offre, pays/libellé de flux, langue, titre, SKU, GTIN/MPN, couleur, taille, modèle (groupe de variantes), prix, disponibilité, custom labels 0 à 4.
- Statuts : éligible / en attente / refusé **par pays et par destination** (Shopping, annonces gratuites…), avec les problèmes détaillés.
- **Compatibilités** : Merchant Center n'a pas de champ dédié. Elles seront lues depuis les custom labels ou le titre si vous les y mettez ; sinon il faudra les lire côté Shopify (champs personnalisés produits). À confirmer lors du test.

## 5. Correspondance avec Shopify

- Le canal Google de Shopify crée des offres au format `shopify_PAYS_idProduit_idVariante` : correspondance **exacte** avec les variantes Shopify déjà importées.
- Repli pour les autres offres : SKU puis GTIN. Les offres sans correspondance seront listées à part (jamais devinées).

## 6. Plan en étapes (validation à chaque étape)

1. **Test de connexion** (fonction serveur lecture seule, rien enregistré) : nom du compte, nombre d'offres, pays, statuts, exemple de correspondances Shopify, présence des compatibilités.
2. **Tables et synchronisation** : offres, statuts par pays, historique des synchros ; import complet + mise à jour quotidienne la nuit ; sans doublon (une ligne par offre et par pays) ; même modèle que Google Ads / GA4 (bouton, progression, erreurs).
3. **Catalogue publicitaire** (nouvel onglet) : recherche, filtres (pays, statut, custom label, modèle, couleur, correspondance Shopify), cases à cocher produit → couleurs → variantes, « tout sélectionner ».
4. **Sélections enregistrées** : nommées, réutilisables pour de futurs projets de campagnes Google Ads (aucun envoi à Google Ads à ce stade).

## Détails techniques

- Authentification : JWT du compte de service `GA4_SERVICE_ACCOUNT_JSON`, scope `https://www.googleapis.com/auth/content`, appels `merchantapi.googleapis.com/products/v1/accounts/{id}/products` (GET uniquement) avec pagination.
- Fonctions `merchant-test` puis `merchant-sync` (admin / droit write Marketing Intelligence), mêmes contrôles d'accès que les autres synchros.
- Tables prévues (étape 2, migration soumise à validation) : `merchant_offers`, `merchant_offer_status`, `merchant_sync_runs`, `ad_catalog_selections`, `ad_catalog_selection_items` ; RLS lecture via l'accès Marketing Intelligence, écriture serveur.
