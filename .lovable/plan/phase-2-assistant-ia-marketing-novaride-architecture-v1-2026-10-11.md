# Phase 2 — Assistant IA marketing NOVARIDE (architecture V1)

## Principes
- L'IA ne lit jamais les données brutes : elle reçoit un **résumé chiffré compact** calculé à partir des données du cockpit (déjà chargées, sans nouvel import).
- Aucune analyse automatique coûteuse : tout est déclenché par un clic, et le résultat est **mis en cache** (même période + mêmes filtres + données inchangées = pas de nouvel appel).
- Accès Google Ads / Meta Ads inchangés, en lecture seule. Aucune action n'est appliquée automatiquement.
- Chaque affirmation de l'IA est étiquetée **Fait mesuré** (avec chiffre et source) ou **Hypothèse** (avec niveau de confiance). Ventes Shopify = réalité ; conversions Google/Meta = « attribué », jamais additionnées.
- Marges : utilisées seulement si un coût produit est disponible ; sinon l'IA le signale au lieu de supposer.

## Les 4 fonctionnalités en V1

```text
Cockpit (filtres, périodes)
   └─> Résumé chiffré compact (~ quelques milliers de mots)
         ├─> 1. Diagnostic IA  ─┐
         ├─> 2. Plan par pays  ─┼─> Recommandations ─> 3. Tâches marketing
         └─> 4. Assistant chat ─┘                         └─> Export « brief Crush AI »
```

1. **Diagnostic IA** (onglet existant « Diagnostic IA ») — bouton « Analyser la période ». Résultat structuré : anomalies, tendances, opportunités, par pays / campagne / canal / produit ; chaque recommandation a un impact chiffré, une confiance (faible/moyenne/forte) et une justification avec les chiffres utilisés.
2. **Plans d'action par pays** — dans l'onglet Pays, bouton « Plan d'action » sur un marché : CA, dépenses, MER, trafic, conversion, produits à pousser, campagnes à optimiser, 3 à 5 objectifs et actions. Généré à la demande, pays par pays (pas tous d'un coup).
3. **Tâches marketing** — nouvel onglet « Tâches » : liste et tableau (filtres statut, catégorie, pays, responsable). Catégories : Google Ads, Meta Ads, Shopify, SEO, Conversion, Développement pays. Statuts : À faire, En cours, En attente, Terminé. Champs : priorité, responsable, échéance, pays, campagne, note de résultat. Une recommandation IA peut être **acceptée** (devient tâche), **modifiée** puis acceptée, ou **rejetée** (motif conservé). Tâches manuelles possibles. Bouton « Copier pour Crush AI » sur les tâches Meta (texte prêt à transmettre).
4. **Assistant conversationnel** — panneau de discussion avec questions suggérées (« Quelles campagnes Google optimiser ? », « Mes priorités cette semaine ? »…). Il répond à partir du même résumé chiffré et peut demander un zoom (un pays, une campagne, un produit) sans recharger toute la base. Il peut proposer de créer une tâche.

## Plan de développement progressif
1. **Étape A** — Résumé chiffré + Diagnostic IA + cache. Test réel sur 30 jours, validation.
2. **Étape B** — Tâches marketing (tables, onglet, accepter/modifier/rejeter, brief Crush AI).
3. **Étape C** — Plans d'action par pays (réutilise A et B).
4. **Étape D** — Assistant conversationnel.
Validation à chaque étape avant de continuer.

## Estimation des coûts IA (ordre de grandeur)
- Diagnostic ou plan pays : un seul appel avec un résumé compact → coût de l'ordre de quelques centimes par analyse, débité sur les crédits Lovable de l'espace de travail.
- Question au chat : moins qu'un diagnostic (résumé réutilisé, réponses courtes).
- Usage type (1 diagnostic/jour, quelques plans pays/semaine, ~20 questions/semaine) : quelques euros par mois. Le coût réel sera mesuré à l'étape A avant d'aller plus loin.
- Garde-fous : cache, pas d'analyse planifiée la nuit en V1, limite d'appels par jour et par utilisateur, arrêt propre si crédits épuisés.

## Points à valider
- Historique du chat : une seule conversation ou plusieurs fils ? Sauvegardé dans Supabase (partagé entre appareils) ou non ?
- Responsables des tâches : choisis parmi les utilisateurs de l'appli, ou saisie libre ?
- Coûts produits disponibles pour les marges (ex. depuis CostFlow) ou à laisser de côté en V1 ?

## Détails techniques
- Fonctions serveur Supabase : `marketing-ai` (modes `diagnosis`, `country_plan`, `chat`), accès contrôlé par `current_user_marketing_access`, modèle par défaut Lovable AI Gateway, réponses en flux et sortie structurée (schéma strict).
- Résumé construit côté serveur depuis `marketing_cockpit` (agrégats période courante vs précédente, top/flop pays, campagnes, produits, tunnel).
- Nouvelles tables (soumises à validation) : `marketing_ai_analyses` (cache : clé période+filtres+empreinte des données), `marketing_recommendations` (statut proposé/accepté/rejeté), `marketing_tasks`, éventuellement `marketing_chat_messages`. RLS lecture/écriture selon droit Marketing.
- Aucune modification d'Erplain, des imports ni des accès publicitaires.
