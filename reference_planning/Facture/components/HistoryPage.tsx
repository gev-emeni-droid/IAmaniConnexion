import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, ExternalLink, Trash2, Filter } from 'lucide-react';
import { InvoiceHistoryItem } from '../types';
import { api } from '../api';
import InvoicePreview from './InvoicePreview';
import { generatePDF } from '../utils';

interface HistoryPageProps {
    onBack: () => void;
    isDarkMode?: boolean;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ onBack, isDarkMode = false }) => {
    const [history, setHistory] = useState<InvoiceHistoryItem[]>([]);
    const [filteredHistory, setFilteredHistory] = useState<InvoiceHistoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    useEffect(() => {
        loadHistory();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchQuery, dateFrom, dateTo, minAmount, maxAmount, history]);

    const loadHistory = async () => {
        const items = await api.history.list();
        setHistory(items);
    };

    const applyFilters = () => {
        let filtered = [...history];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.invoiceNumber.toLowerCase().includes(query) ||
                item.clientName.toLowerCase().includes(query)
            );
        }

        // Date filter
        if (dateFrom) {
            filtered = filtered.filter(item => item.date >= dateFrom);
        }
        if (dateTo) {
            filtered = filtered.filter(item => item.date <= dateTo);
        }

        // Amount filter
        if (minAmount) {
            filtered = filtered.filter(item => item.totalTTC >= parseFloat(minAmount));
        }
        if (maxAmount) {
            filtered = filtered.filter(item => item.totalTTC <= parseFloat(maxAmount));
        }

        setFilteredHistory(filtered);
    };

    const handleDownloadPDF = async (item: InvoiceHistoryItem) => {
        if (!item.fullData) {
            alert("Cette facture ne contient pas les données complètes.");
            return;
        }

        // Open in new tab
        const newWindow = window.open('', '_blank');
        if (!newWindow) {
            alert("Impossible d'ouvrir un nouvel onglet. Vérifiez que les popups ne sont pas bloquées.");
            return;
        }

        // Write HTML with React and InvoicePreview component
        newWindow.document.write(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Facture ${item.invoiceNumber}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
                <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
                <style>
                    :root {
                        --primary: ${item.fullData.settings.primaryColor || '#4f46e5'};
                    }
                    @media print {
                        @page {
                            margin-top: 5mm;
                            margin-right: 5mm;
                            margin-bottom: 6mm;
                            margin-left: 5mm;
                            size: A4;
                        }
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        #invoice-preview {
                            width: 100% !important;
                            height: 286mm !important;
                            min-height: 286mm !important;
                            max-height: 286mm !important;
                            padding: 5mm !important;
                            margin: 0 !important;
                            box-shadow: none !important;
                            border-radius: 0 !important;
                            overflow: hidden !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                    body {
                        margin: 0;
                        padding: 20px;
                        background: #f8fafc;
                    }
                </style>
            </head>
            <body>
                <div id="root"></div>
                <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 1000;">
                    <button onclick="window.print()" style="background: var(--primary); color: white; padding: 14px; border-radius: 12px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" title="Imprimer (Ctrl+P)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                    </button>
                </div>
            </body>
            </html>
        `);

        newWindow.document.close();

        // Render the exact same InvoicePreview component
        setTimeout(() => {
            const root = newWindow.document.getElementById('root');
            if (root && item.fullData) {
                // Get the InvoicePreview source and inject it
                root.innerHTML = renderInvoicePreviewHTML(item.fullData.settings, item.fullData.invoiceData);
            }
        }, 100);
    };

    // This method generates the EXACT HTML from InvoicePreview.tsx component
    const renderInvoicePreviewHTML = (settings: any, data: any) => {
        const tva10Amount = data.amountHT10 * 0.1;
        const tva20Amount = data.amountHT20 * 0.2;
        const totalHT = data.amountHT10 + data.amountHT20;
        const totalTVA = tva10Amount + tva20Amount;
        const totalTTC = totalHT + totalTVA;
        const hasContent = data.amountHT10 > 0 || data.amountHT20 > 0;

        const formatCurrency = (amount: number) => {
            return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
        };

        return `
            <div id="invoice-preview" class="bg-white p-[5mm] w-full max-w-[210mm] min-h-[286mm] max-h-[286mm] mx-auto shadow-xl rounded-lg print:shadow-none print:rounded-none print:p-0 print:m-0 print:w-full print:min-h-[286mm] print:max-h-[286mm] flex flex-col overflow-hidden relative">
                <!-- Header : Logo puis Nom, Adresse (Rue, CP Ville), Tel -->
                <div class="flex justify-between items-start mb-5">
                    <div class="flex flex-col">
                        ${settings.logo ? `<img src="${settings.logo}" alt="Logo" class="max-h-28 max-w-[250px] mb-2 object-contain self-start">` : ''}
                        <h1 class="text-xl font-bold text-slate-800">${settings.name || 'Nom du Restaurant'}</h1>
                        <div class="text-slate-600 text-xs mt-1 leading-snug">
                            <p>${settings.street || ''}</p>
                            <p>${settings.zipCode || ''} ${settings.city || ''}</p>
                        </div>
                        ${settings.phone ? `<p class="mt-1 text-xs text-slate-600 font-medium tracking-tight">Tél : ${settings.phone}</p>` : ''}
                    </div>

                    <div class="text-right">
                        <h2 class="text-3xl font-black uppercase mb-2 tracking-tighter" style="color: var(--primary)">Facture</h2>
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 inline-block text-left min-w-[180px] shadow-sm">
                            <div class="mb-2">
                                <p class="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Numéro de facture</p>
                                <p class="font-mono text-base font-bold text-slate-900">${data.invoiceNumber || 'F-XXXXXX'}</p>
                            </div>
                            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                                <div>
                                    <p class="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Date</p>
                                    <p class="font-bold text-slate-900 text-xs">${data.date}</p>
                                </div>
                                <div>
                                    <p class="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Couverts</p>
                                    <p class="font-bold text-slate-900 text-xs">${data.covers}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Client Section -->
                ${data.client.companyName ? `
                <div class="mb-4 flex justify-end">
                    <div class="w-1/2 p-3 rounded-xl border-2 border-slate-50 bg-white shadow-sm">
                        <h3 class="text-[9px] font-black uppercase tracking-widest mb-1" style="color: var(--primary); opacity: 0.7">Destinataire</h3>
                        <p class="font-bold text-base text-slate-900 mb-0.5">${data.client.companyName}</p>
                        <p class="text-slate-600 text-xs whitespace-pre-line leading-relaxed">${data.client.address || ''}</p>
                    </div>
                </div>
                ` : ''}

                <!-- Items Table - Single line display -->
                <table class="w-full mb-4 border-collapse">
                    <thead>
                        <tr class="border-b border-slate-900 text-left">
                            <th class="pb-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Désignation de la prestation</th>
                            <th class="pb-1.5 pl-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base HT (10%)</th>
                            <th class="pb-1.5 pl-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base HT (20%)</th>
                            <th class="pb-1.5 pl-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total HT</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${hasContent ? `
                        <tr class="group">
                            <td class="py-3">
                                <p class="font-bold text-slate-800 text-base">${data.description}</p>
                                <p class="text-[9px] text-slate-400 uppercase font-bold mt-0.5 tracking-wider">Services de restauration et consommations (${data.covers} couverts)</p>
                            </td>
                            <td class="py-3 pl-4 text-right text-slate-700 font-medium text-sm">
                                ${data.amountHT10 > 0 ? formatCurrency(data.amountHT10) : '-'}
                            </td>
                            <td class="py-3 pl-4 text-right text-slate-700 font-medium text-sm">
                                ${data.amountHT20 > 0 ? formatCurrency(data.amountHT20) : '-'}
                            </td>
                            <td class="py-3 pl-6 text-right font-black text-slate-900 text-base">
                                ${formatCurrency(totalHT)}
                            </td>
                        </tr>
                        ` : `
                        <tr>
                            <td colspan="4" class="py-6 text-center text-slate-300 italic text-sm">
                                Saisissez les montants dans le formulaire pour générer la prestation
                            </td>
                        </tr>
                        `}
                    </tbody>
                </table>

                <!-- Summary Section -->
                <div class="flex justify-end mt-auto mb-3">
                    <div class="w-[280px] bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 shadow-sm">
                        <div class="flex justify-between text-xs text-slate-500 font-medium">
                            <span>Sous-total Hors Taxes :</span>
                            <span class="text-slate-900">${formatCurrency(totalHT)}</span>
                        </div>

                        <div class="space-y-1 pt-1.5 border-t border-slate-200/60">
                            ${data.amountHT10 > 0 ? `
                            <div class="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                <span>TVA Collectée (10%) :</span>
                                <span class="text-slate-600">${formatCurrency(tva10Amount)}</span>
                            </div>
                            ` : ''}
                            ${data.amountHT20 > 0 ? `
                            <div class="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                <span>TVA Collectée (20%) :</span>
                                <span class="text-slate-600">${formatCurrency(tva20Amount)}</span>
                            </div>
                            ` : ''}
                        </div>

                        <div class="flex justify-between text-slate-600 text-[10px] font-black uppercase tracking-tight pt-1">
                            <span>Total des taxes (TVA) :</span>
                            <span>${formatCurrency(totalTVA)}</span>
                        </div>

                        <div class="pt-3 border-t-2 flex justify-between items-baseline" style="border-color: var(--primary); border-top-style: solid; border-top-width: 2px; opacity: 1">
                            <span class="text-[10px] font-black uppercase tracking-widest" style="color: var(--primary); opacity: 0.7">Net à Payer TTC</span>
                            <span class="text-xl font-black" style="color: var(--primary)">${formatCurrency(totalTTC)}</span>
                        </div>
                    </div>
                </div>

                <!-- Footer Legal - SIRET, TVA etc. -->
                <div class="mt-3 pt-3 border-t border-slate-100 text-center">
                    <div class="space-y-0.5 opacity-80">
                        <p class="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-0.5">
                            ${settings.name}
                        </p>
                        <div class="text-[8px] text-slate-400 leading-relaxed font-medium flex flex-wrap justify-center gap-x-2 gap-y-0.5 uppercase tracking-wide">
                            ${settings.rcs ? `<span>${settings.rcs}</span>` : ''}
                            ${settings.siret ? `<span>• SIRET ${settings.siret}</span>` : ''}
                            ${settings.vatNumber ? `<span>• TVA ${settings.vatNumber}</span>` : ''}
                            ${settings.ape ? `<span>• Code APE ${settings.ape}</span>` : ''}
                        </div>
                        <div class="text-[8px] text-slate-400 leading-relaxed font-medium flex flex-wrap justify-center gap-x-2 gap-y-0.5 uppercase tracking-wide">
                            ${settings.capital ? `<span>Capital social : ${settings.capital}</span>` : ''}
                            ${settings.headquarters ? `<span>• ${settings.headquarters}</span>` : ''}
                            ${!settings.headquarters && (settings.street || settings.city) ? `<span>• ${settings.street} ${settings.zipCode} ${settings.city}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const handleDelete = async (id: number) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette facture de l\'historique ?')) {
            await api.history.delete(id);
            loadHistory();
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setMinAmount('');
        setMaxAmount('');
    };

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
            {/* Header */}
            <header className={`border-b sticky top-0 z-40 shadow-sm transition-colors duration-300 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-all ${isDarkMode
                                ? 'text-slate-300 hover:bg-slate-700'
                                : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Retour</span>
                        </button>
                        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Historique des Factures</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search and Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    {/* Search Bar */}
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par n° facture ou client..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-all"
                        >
                            <Filter className="w-5 h-5" />
                            Filtres
                        </button>
                    </div>

                    {/* Advanced Filters */}
                    {isFilterOpen && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Date de début</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Date de fin</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Montant min (€)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={minAmount}
                                    onChange={(e) => setMinAmount(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Montant max (€)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={maxAmount}
                                    onChange={(e) => setMaxAmount(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                            <div className="col-span-full flex justify-end">
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                                >
                                    Réinitialiser les filtres
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Summary */}
                <div className="mb-4 text-sm text-slate-600">
                    {filteredHistory.length} facture(s) trouvée(s)
                </div>

                {/* Invoices Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">N° Facture</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Client</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-wider">Montant TTC</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        Aucune facture trouvée
                                    </td>
                                </tr>
                            ) : (
                                filteredHistory.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-sm font-bold text-slate-900">{item.invoiceNumber}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{item.date}</td>
                                        <td className="px-6 py-4 text-sm text-slate-900 font-medium">{item.clientName || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-900 font-bold text-right">
                                            {item.totalTTC.toFixed(2)} €
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleDownloadPDF(item)}
                                                    disabled={!item.fullData}
                                                    className={`p-2 rounded-lg transition-all ${item.fullData
                                                        ? 'text-indigo-600 hover:bg-indigo-50'
                                                        : 'text-slate-300 cursor-not-allowed'
                                                        }`}
                                                    title={item.fullData ? 'Ouvrir la facture dans un nouvel onglet' : 'Données incomplètes'}
                                                >
                                                    <ExternalLink className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default HistoryPage;
