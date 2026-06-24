import React from 'react';
import { ArrowLeft, Download, Eye, History, Loader2, Trash2 } from 'lucide-react';
import { moduleApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { generateInvoicePdfFromData } from './invoicePdfGenerator';
import { resolveLogoUrl } from '../../lib/resolveLogoUrl';

interface InvoiceHistoryProps {
    refreshKey?: number;
    onBack: () => void;
    onOpenInvoice: (invoice: any) => void;
}


const toCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(value) ? value : 0);

export const InvoiceHistory = ({ refreshKey = 0, onBack, onOpenInvoice }: InvoiceHistoryProps) => {
    const { user } = useAuth();
    const [items, setItems] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);
    const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

    const isSuperAdminSession = Boolean(
        (user?.type === 'admin' && user?.email?.toLowerCase() === 'gev-emeni@outlook.fr') ||
        (user?.type === 'client' && user?.impersonatedBySuperAdmin && user?.originalAdminEmail?.toLowerCase() === 'gev-emeni@outlook.fr')
    );

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const data = await moduleApi.getFactures();
            setItems(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);


    React.useEffect(() => {
        load();
    }, [load, refreshKey]);

    const handleDelete = React.useCallback(async (invoice: any) => {
        if (!invoice?.id) return;

        const confirmed = window.confirm(`Supprimer définitivement la facture ${invoice.invoice_number || ''} ?`);
        if (!confirmed) return;

        setDeletingId(String(invoice.id));
        try {
            await moduleApi.deleteFacture(String(invoice.id));
            setItems((current) => current.filter((entry) => String(entry.id) !== String(invoice.id)));
        } catch (e: any) {
            console.error(e);
            window.alert(e?.message || 'Impossible de supprimer cette facture.');
        } finally {
            setDeletingId(null);
        }
    }, []);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-soft)] transition-colors"
                >
                    <ArrowLeft size={14} /> Retour
                </button>
                <div className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                    <History size={16} /> Historique des factures
                </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full text-left min-w-[760px]">
                        <thead>
                            <tr className="border-b border-[var(--border-color)] bg-[var(--bg-soft)]">
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">N° Facture</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Date</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Client</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)] text-right">Montant TTC</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)] text-right">Reste à payer</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Chargement...</td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Aucune facture enregistrée.</td>
                                </tr>
                            ) : items.map((item) => (
                                <tr key={item.id} className="border-b border-[var(--border-color)] last:border-0">
                                    <td className="px-4 py-3 text-sm font-bold text-[var(--text-primary)]">{item.invoice_number || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{item.due_date ? new Date(item.due_date).toLocaleDateString() : new Date(item.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{item.customer_name || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-[var(--text-primary)]">{toCurrency(Number(item.total_ttc || item.amount || 0))}</td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-[var(--text-primary)]">{toCurrency(Number(item.remaining_due ?? 0))}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onOpenInvoice(item)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-soft)] transition-colors"
                                            >
                                                <Eye size={13} /> Visualiser
                                            </button>
                                            <button
                                                type="button"
                                                disabled={downloadingId === String(item.id)}
                                                onClick={async () => {
                                                    setDownloadingId(String(item.id));
                                                    try {
                                                        // mapFacture already parses these — use directly, no re-parse
                                                        const payload = (item.payload_json && typeof item.payload_json === 'object')
                                                            ? item.payload_json
                                                            : (() => { try { return JSON.parse(item.payload_json || '{}'); } catch { return {}; } })();

                                                        let snapshot = (item.billing_snapshot && typeof item.billing_snapshot === 'object')
                                                            ? item.billing_snapshot
                                                            : (() => { try { return JSON.parse(item.billing_snapshot || '{}'); } catch { return {}; } })();

                                                        // Fallback: if snapshot has no company name, fetch fresh billing settings
                                                        if (!snapshot?.company_name) {
                                                            try {
                                                                const fresh = await moduleApi.getBillingSettings();
                                                                if (fresh?.company_name) snapshot = { ...fresh, ...snapshot };
                                                            } catch { /* ignore */ }
                                                        }

                                                        // Resolve logo URL to absolute for iframe rendering
                                                        if (snapshot?.logo_url) {
                                                            snapshot = { ...snapshot, logo_url: resolveLogoUrl(snapshot.logo_url) };
                                                        }

                                                        const { pdf } = await generateInvoicePdfFromData({
                                                            invoice: item,
                                                            payload,
                                                            snapshot,
                                                        });
                                                        pdf.save(`Facture_${item.invoice_number || item.id}.pdf`);
                                                    } catch (e: any) {
                                                        console.error('Download error:', e);
                                                        alert(e.message || 'Impossible de générer le PDF.');
                                                    } finally {
                                                        setDownloadingId(null);
                                                    }
                                                }}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2f9e9e] text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
                                            >
                                                {downloadingId === String(item.id)
                                                    ? <><Loader2 size={13} className="animate-spin" /> Génération...</>
                                                    : <><Download size={13} /> Télécharger</>
                                                }
                                            </button>
                                            {isSuperAdminSession && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item)}
                                                    disabled={deletingId === String(item.id)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#d9485f] text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
                                                >
                                                    <Trash2 size={13} /> {deletingId === String(item.id) ? 'Suppression...' : 'Supprimer'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
    );
};