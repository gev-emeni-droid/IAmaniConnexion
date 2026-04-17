// API pour récupérer l'historique d'une facture
import { apiFetch } from './api';

export const getFactureHistory = (factureId: string) =>
  apiFetch(`/facture/${factureId}/history`);
