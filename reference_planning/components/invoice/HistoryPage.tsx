import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, ExternalLink, Trash2, Filter, Eye, Download, Printer, X } from 'lucide-react';
import { InvoiceHistoryItem, InvoiceData } from '../../src/features/invoice/types';
import { api } from '../../services/invoiceApi';
import InvoicePreview from './InvoicePreview';
import { generatePDF } from '../../src/features/invoice/utils';

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
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceHistoryItem | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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

    const handleViewInvoice = (item: InvoiceHistoryItem) => {
        if (!item.fullData) {
            alert("Cette facture ne contient pas les données complètes.");
            return;
        }
        setSelectedInvoice(item);
        setIsPreviewOpen(true);
    };

    const handleClosePreview = () => {
        setIsPreviewOpen(false);
        setSelectedInvoice(null);
    };

    const handlePrintInvoice = () => {
        if (!selectedInvoice) return;
        window.print();
    };

    const handleExportInvoice = async () => {
        if (!selectedInvoice) return;
        try {
            const pdfBlob = await generatePDF('invoice-preview');
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Facture-${selectedInvoice.invoiceNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erreur export PDF:', error);
            alert('Erreur lors de l\'export du PDF.');
        }
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

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 no-print">
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
                                                    onClick={() => handleViewInvoice(item)}
                                                    disabled={!item.fullData}
                                                    className={`p-2 rounded-lg transition-all ${item.fullData
                                                        ? 'text-indigo-600 hover:bg-indigo-50'
                                                        : 'text-slate-300 cursor-not-allowed'
                                                        }`}
                                                    title={item.fullData ? 'Voir la facture' : 'Données incomplètes'}
                                                >
                                                    <Eye className="w-5 h-5" />
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

            {/* Preview Modal */}
            {isPreviewOpen && selectedInvoice && selectedInvoice.fullData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header - Hidden on print */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 no-print">
                            <h2 className="text-lg font-bold text-slate-800">
                                Facture {selectedInvoice.invoiceNumber}
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExportInvoice}
                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Exporter en PDF"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handlePrintInvoice}
                                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Imprimer"
                                >
                                    <Printer className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleClosePreview}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div
                            className="flex-1 overflow-y-auto p-8 bg-slate-50 flex justify-center"
                            style={{
                                '--primary': selectedInvoice.fullData.settings.primaryColor || '#4f46e5'
                            } as React.CSSProperties}
                        >
                            <InvoicePreview
                                settings={selectedInvoice.fullData.settings}
                                data={selectedInvoice.fullData.invoiceData}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoryPage;
