## Dossier bancaire basé sur la synthèse actuelle
- [x] Réutiliser la présentation actuelle, conserver les explications générales et les commentaires modifiables ; PDF testé sur le plan de démonstration (données connectées indisponibles).

## Personnalisation PDF Synthèse
- [x] Choisir séparément les sections, graphiques et indicateurs des exports actuel et bancaire, sans changer les calculs (9 tests réussis).
- [ ] Vérifier sur le plan réel connecté : Supabase externe sans session disponible.

- [x] Simplifier le Plan atelier avec couleurs Erplain et détails dépliables, sans changer les calculs ou les protections d’envoi.
- [x] Afficher CA total HT (base MER inchangée), livraison importée et ventes hors livraison estimées ; moyenne glissante quotidienne optionnelle et ratio Shopify / GA4 renommé ; 4 tests réussis.
- [ ] Obtenir la ventilation HT exacte hors livraison : taxes et remboursements de livraison absents des données actuellement importées.
- [ ] Vérifier ces ajustements avec les données réelles : accès connecté indisponible pour ce Supabase externe.
- [x] Vérifier le parcours opérateur simplifié et la sélection précise : 7 tests réussis et contrôle visuel sur données de test, sans envoi réel.
- [x] Afficher le client et la date de création dans la sélection des commandes.
- [x] Ajouter un choix visible des colonnes, mémorisé sur cet appareil.
- [x] Vérifier les colonnes et leurs cases de visibilité (3 tests réussis).
- [ ] Vérifier sur les commandes réelles : session administrateur externe indisponible ; les noms clients seront chargés à la prochaine synchronisation des commandes.
- [x] Corriger le rafraîchissement du rôle et des permissions pour activer les boutons du Plan atelier en écriture.
- [x] Tester les actions du Plan atelier avec un rôle non administrateur autorisé (tests automatisés).
- [ ] Vérifier Actualiser et Calculer avec un vrai compte Bureau d'étude : session externe non disponible pour les vérifications connectées.
- [x] Replier la liste « OF envoyés à Erplain » (choix mémorisé sur l'appareil) et limiter à 5 OF affichés avec bouton pour les suivants.
- [x] Ajouter « Tout cocher » dans la vue classique des commandes à fabriquer (case à trois états : tout cocher, partiel, tout décocher) — 9 tests réussis, build OK.

## Phase 2 IA
- [x] Croissance : taux par produit/canal et année de départ, application individuelle ou groupée (5 tests réussis, build OK ; vérification sur plan connecté indisponible avec Supabase externe).
- [ ] Simplifier visuellement la saisie des volumes du Plan produit sans changer les calculs ni les sauvegardes.
- [x] Afficher la sauvegarde active par onglet, sauvegarder sur place et inclure données et noms courants dans les sauvegardes globales (8 tests ciblés et 7 tests de non-régression).
- [ ] Vérifier sauvegarde, ouverture et restauration globale avec un compte réel : Supabase externe sans session de test disponible.
- [x] Plan produit : noms sauvegardés dans les catégories, ajout aux catégories existantes, création manuelle et retrait visibles ; 4 tests réussis et contrôle visuel sur données de test.
- [x] Simplifier la gestion visuelle des catégories du Plan produit et empêcher les nouveaux doublons (3 tests réussis et contrôle visuel sur ventes de test).
- [ ] Vérifier la gestion des catégories sur un plan réel sauvegardé : session Supabase externe indisponible.
- [x] Étape A : diagnostic IA + cache
- [x] Étape B : tâches marketing
- [ ] Étape C : plans par pays
- [ ] Étape D : assistant conversationnel (attend choix historique)

## Merchant Center
- [x] Étape 1 : test de connexion lecture seule
- [ ] Étape 1 : lancer le test (attend MERCHANT_CENTER_ID et accès du compte de service)
- [x] Synchro complète + rapprochement Shopify (2 048 offres, 95,8 % rapprochées)
- [x] Onglet Catalogue publicitaire : regroupement famille/modèle/couleur/variante, filtres, sélections fixes/dynamiques, non identifiées + correction manuelle, analyse des refus par pays

## Copilote Google Ads
- [x] Ajouter au Pilotage les tendances, comparaisons de campagnes et historiques de budget/ROAS issus des données importées, sans appel IA ni écriture Google (5 tests et contrôle visuel sur données de test).
- [ ] Vérifier les graphiques Pilotage avec les propositions et données réelles (session Supabase externe indisponible).
- [x] Étape 1 : audit de structure en lecture seule (lecture nocturne + onglet Audit)
- [x] Étape 2 : Copilote stratégique IA (onglet Stratégie IA)
- [ ] Tester une analyse stratégique réelle (attend un lancement depuis un compte connecté)
- [x] Étape 3 : constructeur de campagnes (projets Shopping/PMax/Search, conflits, validation — aucune écriture Google Ads)
- [ ] Vérifier le constructeur avec un compte Marketing réel (session externe indisponible)
- [x] Étape 4 : publication supervisée préparée (écriture désactivée côté serveur ; Search et Shopping ; PMax en attente des images)
- [x] Audit des 16 alertes Supabase : rôles/approbation limités à soi-même ; autres alertes justifiées
- [ ] Activer la protection des mots de passe divulgués (réglage Supabase Auth, à faire par l'utilisateur)
- [x] Étape 5 : boucle de pilotage (onglet Pilotage : propositions chiffrées issues de Stratégie IA, approbation, modification budget/ROAS/pause supervisée, suivi avant/après)
- [ ] Relancer une analyse Stratégie IA et l'audit de structure pour obtenir les premières propositions (compte connecté requis)
- [ ] Première publication réelle (attend l'accord explicite et GOOGLE_ADS_ALLOW_WRITE=true)
