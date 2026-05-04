
import { RestaurantSettings, InvoiceData } from './types';

export const api = {
    settings: {
        get: async (): Promise<RestaurantSettings | null> => {
            try {
                const res = await fetch('/api/settings');
                if (!res.ok) throw new Error('Failed to fetch settings');
                const data = await res.json();
                // Check if object is empty (initial state)
                if (Object.keys(data).length === 0) return null;
                return data;
            } catch (e) {
                console.error(e);
                return null;
            }
        },
        save: async (settings: RestaurantSettings) => {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
        }
    },
    invoice: {
        get: async (): Promise<InvoiceData | null> => {
            try {
                const res = await fetch('/api/invoice');
                if (!res.ok) throw new Error('Failed to fetch invoice');
                const data = await res.json();
                if (Object.keys(data).length === 0) return null;
                return data;
            } catch (e) {
                console.error(e);
                return null;
            }
        },
        save: async (data: InvoiceData) => {
            await fetch('/api/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
    },
    history: {
        list: async (): Promise<any[]> => {
            try {
                const res = await fetch('/api/history');
                if (!res.ok) throw new Error('Failed to fetch history');
                return await res.json();
            } catch (e) {
                console.error(e);
                return [];
            }
        },
        add: async (data: any) => {
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        },
        delete: async (id: number) => {
            await fetch(`/api/history?id=${id}`, {
                method: 'DELETE',
            });
        }
    },
    prestations: {
        list: async (): Promise<any[]> => {
            try {
                const res = await fetch('/api/prestations');
                if (!res.ok) throw new Error('Failed to fetch prestations');
                return await res.json();
            } catch (e) {
                console.error(e);
                return [];
            }
        },
        add: async (label: string) => {
            await fetch('/api/prestations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label })
            });
        },
        delete: async (id: number) => {
            await fetch(`/api/prestations?id=${id}`, {
                method: 'DELETE',
            });
        },
        update: async (id: number, label: string) => {
            await fetch('/api/prestations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, label })
            });
        }
    }
};
