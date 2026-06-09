## Objectif

Permettre, depuis les **Paramètres** du tableau *Données clients* (CRM), de créer des colonnes personnalisées dont l'utilisateur définit le type :

- **Texte libre** (saisie courte)
- **Menu déroulant** (avec options définies + possibilité de saisir une nouvelle valeur)
- **Case à cocher** (avec libellé personnalisé)

Ces colonnes apparaissent ensuite dans le tableau et sont éditables ligne par ligne comme les colonnes natives.

## Base de données (2 nouvelles tables)

**`b2b_custom_columns`** — définition des colonnes
- `name` (libellé affiché en en-tête)
- `column_type` ('text' | 'select' | 'checkbox')
- `options` (jsonb — array d'options pour 'select')
- `sort_order` (entier, position dans le tableau)

**`b2b_client_custom_values`** — valeurs par client
- `client_id` (fk b2b_clients)
- `column_id` (fk b2b_custom_columns)
- `value` (text — stocke la valeur, 'true'/'false' pour checkbox)
- contrainte unique (client_id, column_id)

RLS : lecture/écriture par tout utilisateur authentifié (cohérent avec le modèle collaboratif CRM actuel).

## Interface utilisateur

### Panneau Paramètres (`B2BSettingsPanel`)
Ajout d'une 4ᵉ carte **« Colonnes personnalisées »** :
- Liste des colonnes existantes (libellé + type + bouton supprimer)
- Formulaire d'ajout : `nom`, `type` (text / select / checkbox)
- Si type = `select` : sous-formulaire pour ajouter/supprimer les options
- Si type = `checkbox` : le libellé saisi sert d'étiquette à cocher

### Tableau (`B2BClientTable`)
- Les colonnes custom sont ajoutées à la fin de `ALL_COLUMNS` dynamiquement
- Intégrées au système existant (réordonnement drag-and-drop, masquage, persistance localStorage)
- Cellules éditables selon le type :
  - **text** → `EditableCell` existant
  - **select** → `EditableSelectCell` avec les options + valeur libre via input
  - **checkbox** → composant `Checkbox` shadcn avec libellé

## Fichiers modifiés

```text
supabase/migrations/<timestamp>_b2b_custom_columns.sql   (nouveau)
src/hooks/useB2BClientsData.ts                           (charge custom_columns + values, CRUD)
src/components/b2b/B2BSettingsPanel.tsx                  (4ᵉ carte de gestion)
src/components/b2b/B2BClientTable.tsx                    (rendu dynamique des colonnes custom)
```

Aucun changement aux colonnes natives existantes — purement additif.
