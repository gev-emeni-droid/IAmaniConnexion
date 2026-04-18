// src/lib/factureHistoryApi.ts
// Fonction pour récupérer l'historique des actions sur une facture (email, téléchargement, impression, etc.)
// Cette version utilise l'API REST côté serveur (exemple d'appel à /api/facture/:id/history)

import { apiFetch } from './api';

/**
 * Récupère l'historique des actions pour une facture donnée.
 * @param factureId L'identifiant de la facture
 * @returns Promise<any[]> Liste des actions (email, download, print, etc.)
 */
export async function getFactureHistory(factureId: string): Promise<any[]> {
    if (!factureId) return [];
    try {
        const data = await apiFetch(`/facture/${factureId}/history`);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        // En cas d'erreur, on retourne un tableau vide
        return [];
    }
}
