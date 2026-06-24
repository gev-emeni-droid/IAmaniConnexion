import React from 'react';
import { X } from 'lucide-react';
import { CreateInvoice } from './CreateInvoice';
import { InvoiceHistory } from './InvoiceHistory';
import { InfoModal } from '../InfoModal';

export const FacturesModule = () => {
    const [view, setView] = React.useState<'create' | 'history'>('create');
    const [selectedInvoice, setSelectedInvoice] = React.useState<any>(null);
    const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0);
    const [autoPrintToken, setAutoPrintToken] = React.useState(0);
    const [autoDownloadToken, setAutoDownloadToken] = React.useState(0);
    const [showInfoModal, setShowInfoModal] = React.useState(true);
    const [previewInvoice, setPreviewInvoice] = React.useState<any>(null);

    const renderContent = () => {
        if (view === 'history') {
            return (
                <InvoiceHistory
                    refreshKey={historyRefreshKey}
                    onBack={() => setView('create')}
                    onOpenInvoice={(invoice) => {
                        setPreviewInvoice(invoice);
                    }}
                />
            );
        }

        return (
            <CreateInvoice
                initialInvoice={selectedInvoice}
                autoPrintToken={autoPrintToken}
                autoDownloadToken={autoDownloadToken}
                onShowHistory={() => setView('history')}
                onInvoiceSaved={() => setHistoryRefreshKey((k) => k + 1)}
            />
        );
    };

    return (
        <>
            <InfoModal
                id="facture_welcome_v1"
                title="Module Facturation"
                message="Bienvenue dans votre module de facturation. Envoyez désormais les factures directement à vos clients depuis le bouton « Envoyer la facture »."
                isOpen={showInfoModal}
                onClose={() => setShowInfoModal(false)}
            />
            {renderContent()}

            {previewInvoice && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-soft)]">
                            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">
                                Facture {previewInvoice.invoice_number}
                            </h3>
                            <button 
                                onClick={() => setPreviewInvoice(null)}
                                className="p-2 hover:bg-[var(--bg-card)] rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
                             {/* Simple reconstruction of invoice view */}
                             <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-8 max-w-[210mm] mx-auto shadow-lg text-slate-800 dark:text-slate-200">
                                <div className="flex justify-between mb-8">
                                    <div>
                                        <div className="text-xl font-black text-[#2f9e9e] mb-2">{previewInvoice.billing_snapshot?.company_name || 'ÉTABLISSEMENT'}</div>
                                        <div className="text-[11px] leading-relaxed opacity-75">
                                            {previewInvoice.billing_snapshot?.address}<br/>
                                            {previewInvoice.billing_snapshot?.postal_code} {previewInvoice.billing_snapshot?.city}<br/>
                                            {previewInvoice.billing_snapshot?.phone && `Tél: ${previewInvoice.billing_snapshot?.phone}`}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black uppercase mb-1">FACTURE</div>
                                        <div className="text-xs font-bold mb-1">{previewInvoice.invoice_number}</div>
                                        <div className="text-[10px] opacity-60">Date: {new Date(previewInvoice.due_date || previewInvoice.created_at).toLocaleDateString('fr-FR')}</div>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <div className="text-[10px] uppercase font-bold text-[#2f9e9e] mb-2">Facturé à :</div>
                                    <div className="font-bold text-sm">{previewInvoice.customer_name}</div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full mb-8 min-w-[500px]">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] uppercase font-bold text-slate-400">
                                                <th className="py-2 text-left">Description</th>
                                                <th className="py-2 text-center w-20">Qté</th>
                                                <th className="py-2 text-right w-32">Total TTC</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {(previewInvoice.payload_json?.lines || []).map((line: any, i: number) => (
                                                <tr key={i} className="text-xs">
                                                    <td className="py-3 font-medium min-w-[200px]">{line.label}</td>
                                                    <td className="py-3 text-center">{line.quantity}</td>
                                                    <td className="py-3 text-right font-bold">
                                                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Object.values(line.ttcByRate || {}).reduce((a: any, b: any) => Number(a) + Number(b), 0))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-end">
                                    <div className="w-64 space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="opacity-60 uppercase font-bold">Total HT</span>
                                            <span className="font-bold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(previewInvoice.total_ht || 0)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="opacity-60 uppercase font-bold">TVA</span>
                                            <span className="font-bold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(previewInvoice.total_tva || 0)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm border-t border-slate-200 dark:border-white/10 pt-2 text-[#2f9e9e]">
                                            <span className="uppercase font-black">Total TTC</span>
                                            <span className="font-black text-lg">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(previewInvoice.total_ttc || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                        <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end bg-[var(--bg-soft)]">
                            <button 
                                onClick={() => setPreviewInvoice(null)}
                                className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-xs font-bold hover:bg-[var(--bg-soft)] transition-colors"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
};
