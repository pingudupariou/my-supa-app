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
- [x] Étape A : diagnostic IA + cache
- [x] Étape B : tâches marketing
- [ ] Étape C : plans par pays
- [ ] Étape D : assistant conversationnel (attend choix historique)

## Merchant Center
- [x] Étape 1 : test de connexion lecture seule
- [ ] Étape 1 : lancer le test (attend MERCHANT_CENTER_ID et accès du compte de service)
- [x] Synchro complète + rapprochement Shopify (2 048 offres, 95,8 % rapprochées)
- [x] Onglet Catalogue publicitaire : regroupement famille/modèle/couleur/variante, filtres, sélections fixes/dynamiques, non identifiées + correction manuelle, analyse des refus par pays
