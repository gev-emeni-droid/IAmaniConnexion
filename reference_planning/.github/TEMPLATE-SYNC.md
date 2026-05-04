# Synchronisation Modèles de Postes (Templates) avec les Postes (Roles)

## 📋 Résumé du changement

Implémentation de la **synchronisation automatique** entre les modèles de postes et les postes de travail. Désormais, quand un poste est modifié, supprimé ou ajouté, les modèles de postes se mettent à jour automatiquement.

## 🔄 Flux de synchronisation

### 1. **Ajout d'un poste** (`addRole`)
- Le poste est créé dans la base de données
- Les modèles de ce poste deviennent disponibles dans le planning
- Les employés du poste peuvent utiliser les modèles associés

### 2. **Modification d'un poste** (`updateRole`)
- Le label/nom du poste est mis à jour
- **Cascade automatique :** tous les modèles associés à ce poste sont mis à jour
- **Cascade automatique :** tous les employés du poste sont mis à jour
- Les plannings existants conservent la cohérence des références

### 3. **Suppression d'un poste** (`deleteRole`)
- Le poste est supprimé de la base de données
- **NOUVEAU :** Tous les modèles spécifiques au poste sont **supprimés en cascade**
- Les employés du poste sont réassignés au poste de remplacement
- Les modèles GÉNÉRAL restent disponibles pour tous

## 🎯 Implémentation

### Fichier modifié : `services/storage.ts`

#### Fonction `deleteRole(id, reassignRoleId)`

**Avant :** Les modèles n'étaient pas supprimés quand un poste était supprimé

```typescript
// Ancien comportement - templates orphelins après suppression de poste
export const deleteRole = async (id: string, reassignRoleId?: string) => {
  await api.deleteRole(id);
  // ... réassign employees uniquement
  // Templates restaient en base sans poste associé
};
```

**Après :** Suppression en cascade des templates

```typescript
export const deleteRole = async (id: string, reassignRoleId?: string) => {
  await api.deleteRole(id);
  await addRoleToBlacklist(id);
  
  // ✅ NOUVEAU : Supprimer tous les modèles du poste
  const templates = await getTemplates();
  const templatesForRole = templates.filter(t => t.role === id);
  for (const t of templatesForRole) {
    await api.deleteTemplate(t.id);
  }
  
  // Réassigner employés seulement
  if (reassignRoleId) {
    // ... reassign employees
  }
};
```

## 📊 Cas d'utilisation couverts

| Opération | Avant | Après |
|-----------|-------|-------|
| Ajouter poste | ✓ | ✓ |
| Modifier label poste | ✓ | ✓ Cascades to templates |
| Supprimer poste | ✓ Employees réassignés | ✓ Templates supprimés + Employees réassignés |
| Ajouter template | ✓ | ✓ |
| Modifier template | ✓ | ✓ |
| Supprimer template | ✓ | ✓ |

## 🧪 Vérification

Pour vérifier que la synchronisation fonctionne :

1. **Accédez aux paramètres** (Settings modal)
2. **Onglet "Gestion Postes"** :
   - Créez un nouveau poste (ex: "TEST_ROLE")
   - Vérifiez qu'il apparaît dans la liste

3. **Onglet "Modèles Horaires"** :
   - Créez un modèle pour "TEST_ROLE"
   - Vérifiez que le modèle est associé au poste

4. **Retour à "Gestion Postes"** :
   - Supprimez "TEST_ROLE"
   - Confirmez la réassignation des employés

5. **Onglet "Modèles Horaires"** :
   - Vérifiez que le modèle créé pour "TEST_ROLE" a été supprimé

## 🔍 Points clés

- **Pas de données orphelines** : Aucun modèle n'est laissé sans poste associé
- **Intégrité référentielle** : Les plantings restent cohérents
- **Transparence utilisateur** : Les changements cascadent automatiquement
- **Sécurité** : Confirmations utilisateur pour les opérations destructives

## 📝 Notes développeur

- Les modèles GÉNÉRAL ne sont jamais supprimés (disponibles pour tous les postes)
- La suppression de templates lors de la suppression de poste utilise la même API `api.deleteTemplate()`
- Les employés weekly defaults sont gérés par `deleteTemplate()` existant
- Les plannings ne sont jamais directement affectés (intégrité des données)
