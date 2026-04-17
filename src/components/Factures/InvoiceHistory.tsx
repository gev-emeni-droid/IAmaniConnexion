import React from 'react';
import { ArrowLeft, Download, Eye, History, Trash2 } from 'lucide-react';
import { moduleApi } from '../../lib/api';
import { getFactureHistory } from '../../lib/factureHistoryApi';
import { useAuth } from '../../context/AuthContext';

interface InvoiceHistoryProps {
    refreshKey?: number;
    onBack: () => void;
    onOpenInvoice: (invoice: any) => void;
    onDownloadInvoice: (invoice: any) => void;
}


const toCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(value) ? value : 0);

export const InvoiceHistory = ({ refreshKey = 0, onBack, onOpenInvoice, onDownloadInvoice }: InvoiceHistoryProps) => {
    const { user } = useAuth();
    const [items, setItems] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);
    // Pour l'historique d'envoi
    const [history, setHistory] = React.useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = React.useState(false);
    const [historyFor, setHistoryFor] = React.useState<string | null>(null);
    const [resendLoading, setResendLoading] = React.useState<string | null>(null);
    const [customEmail, setCustomEmail] = React.useState('');
    const [customSendLoading, setCustomSendLoading] = React.useState(false);
    const [customSendError, setCustomSendError] = React.useState('');
    // Fonction pour renvoyer la facture à une adresse donnée
    const resendInvoice = async (factureId: string, email: string) => {
        if (!email) return;
        setResendLoading(email);
        try {
            await moduleApi.sendFactureEmail(factureId, { to: email });
            alert('Facture renvoyée à ' + email);
        } catch (e: any) {
            alert('Erreur lors de l’envoi : ' + (e?.message || 'Erreur inconnue'));
        } finally {
            setResendLoading(null);
        }
    };

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

    // Afficher l'historique d'envoi pour une facture
    const showHistory = async (factureId: string) => {
        setHistoryLoading(true);
        setHistoryFor(factureId);
        try {
            const data = await getFactureHistory(factureId);
            setHistory(Array.isArray(data) ? data : []);
        } catch {
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

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

            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[760px]">
                        <thead>
                            <tr className="border-b border-[var(--border-color)] bg-[var(--bg-soft)]">
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">N° Facture</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Date</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Client</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Adresse mail</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)] text-right">Montant TTC</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)] text-right">Reste à payer</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Chargement...</td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Aucune facture enregistrée.</td>
                                </tr>
                            ) : items.map((item) => (
                                <tr key={item.id} className="border-b border-[var(--border-color)] last:border-0">
                                    <td className="px-4 py-3 text-sm font-bold text-[var(--text-primary)]">{item.invoice_number || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{item.due_date ? new Date(item.due_date).toLocaleDateString() : new Date(item.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{item.customer_name || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{item.customer_email || item.email || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-[var(--text-primary)]">{toCurrency(Number(item.total_ttc ?? item.amount ?? 0))}</td>
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
                                                onClick={() => onDownloadInvoice(item)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2f9e9e] text-white text-xs font-bold hover:opacity-90 transition-opacity"
                                            >
                                                <Download size={13} /> Télécharger
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => showHistory(item.id)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-soft)]"
                                            >
                                                <History size={13} /> Historique envois
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
            {/* Affichage de l'historique d'envoi */}
            {historyFor && (
                <div className="mt-4 p-4 border rounded-lg bg-[var(--bg-soft)]">
                    <div className="font-bold mb-2">Historique des envois pour la facture {historyFor}</div>
                    {historyLoading ? (
                        <div>Chargement...</div>
                    ) : history.length === 0 ? (
                        <div>Aucun envoi enregistré.</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Action</th>
                                    <th>Email</th>
                                    <th>PDF</th>
                                    <th>Renvoyer</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id}>
                                        <td>{new Date(h.created_at).toLocaleString()}</td>
                                        <td>{h.action}</td>
                                        <td>{h.email || '-'}</td>
                                        <td>{h.pdf_filename || '-'}</td>
                                        <td>
                                            {h.email && (
                                                <button
                                                    className="px-2 py-1 text-xs rounded bg-[#2f9e9e] text-white hover:opacity-90 disabled:opacity-60"
                                                    disabled={resendLoading === h.email}
                                                    onClick={() => resendInvoice(historyFor, h.email)}
                                                >
                                                    {resendLoading === h.email ? 'Envoi...' : 'Renvoyer'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {/* Champ pour saisir une nouvelle adresse */}
                    <div className="mt-4 flex items-center gap-2">
                        <input
                            type="email"
                            placeholder="Nouvelle adresse email..."
                            value={customEmail}
                            onChange={e => setCustomEmail(e.target.value)}
                            className="px-2 py-1 border rounded text-sm"
                            style={{ minWidth: 220 }}
                        />
                        <button
                            className="px-3 py-1 text-xs rounded bg-[#2f9e9e] text-white hover:opacity-90 disabled:opacity-60"
                            disabled={customSendLoading || !customEmail}
                            onClick={async () => {
                                setCustomSendLoading(true);
                                setCustomSendError('');
                                try {
                                    await resendInvoice(historyFor, customEmail);
                                    setCustomEmail('');
                                } catch (e: any) {
                                    setCustomSendError(e?.message || 'Erreur inconnue');
                                } finally {
                                    setCustomSendLoading(false);
                                }
                            }}
                        >
                            {customSendLoading ? 'Envoi...' : 'Envoyer à une autre adresse'}
                        </button>
                        {customSendError && <span className="text-xs text-red-500 ml-2">{customSendError}</span>}
                    </div>
                    <button onClick={() => setHistoryFor(null)} className="mt-2 text-xs underline">Fermer</button>
                </div>
            )}
        </div>
    );
};