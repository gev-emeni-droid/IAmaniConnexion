
import { RestaurantSettings, InvoiceData } from '../src/features/invoice/types';

export const api = {
    settings: {
        get: async (): Promise<RestaurantSettings | null> => {
            try {
                const res = await fetch('/api/invoice/settings');
                if (!res.ok) throw new Error('Failed to fetch settings');
                const data = await res.json();
                // Check if object is empty (initial state)
                if (Object.keys(data).length === 0) return null;
                return data as RestaurantSettings;
            } catch (e) {
                console.error(e);
                return null;
            }
        },
        save: async (settings: RestaurantSettings) => {
            await fetch('/api/invoice/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
        }
    },
    invoice: {
        get: async (): Promise<InvoiceData | null> => {
            try {
                const res = await fetch('/api/invoice/invoice');
                if (!res.ok) throw new Error('Failed to fetch invoice');
                const data = await res.json();
                if (Object.keys(data).length === 0) return null;
                return data as InvoiceData;
            } catch (e) {
                console.error(e);
                return null;
            }
        },
        save: async (data: InvoiceData) => {
            await fetch('/api/invoice/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
    },
    history: {
        list: async (): Promise<any[]> => {
            try {
                const res = await fetch('/api/invoice/history');
                if (!res.ok) throw new Error('Failed to fetch history');
                return await res.json();
            } catch (e) {
                console.error(e);
                return [];
            }
        },
        add: async (data: any) => {
            await fetch('/api/invoice/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        },
        delete: async (id: number) => {
            await fetch(`/api/invoice/history?id=${id}`, {
                method: 'DELETE',
            });
        }
    },
    prestations: {
        list: async (): Promise<any[]> => {
            try {
                const res = await fetch('/api/invoice/prestations');
                if (!res.ok) throw new Error('Failed to fetch prestations');
                return await res.json();
            } catch (e) {
                console.error(e);
                return [];
            }
        },
        add: async (label: string) => {
            await fetch('/api/invoice/prestations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label })
            });
        },
        delete: async (id: number) => {
            await fetch(`/api/invoice/prestations?id=${id}`, {
                method: 'DELETE',
            });
        },
        update: async (id: number, label: string) => {
            await fetch('/api/invoice/prestations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, label })
            });
        }
    }
};
