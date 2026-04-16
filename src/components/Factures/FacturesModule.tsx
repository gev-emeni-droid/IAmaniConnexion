import React from 'react';
import { CreateInvoice } from './CreateInvoice';
import { InvoiceHistory } from './InvoiceHistory';

export const FacturesModule = () => {
    const [view, setView] = React.useState<'create' | 'history'>('create');
    const [selectedInvoice, setSelectedInvoice] = React.useState<any>(null);
    const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0);
    const [autoPrintToken, setAutoPrintToken] = React.useState(0);

    if (view === 'history') {
        return (
            <InvoiceHistory
                refreshKey={historyRefreshKey}
                onBack={() => setView('create')}
                onOpenInvoice={(invoice) => {
                    setSelectedInvoice(invoice);
                    setView('create');
                }}
                onDownloadInvoice={(invoice) => {
                    setSelectedInvoice(invoice);
                    setAutoPrintToken(Date.now());
                    setView('create');
                }}
            />
        );
    }

    return (
        <CreateInvoice
            initialInvoice={selectedInvoice}
            autoPrintToken={autoPrintToken}
            onShowHistory={() => setView('history')}
            onInvoiceSaved={() => setHistoryRefreshKey((k) => k + 1)}
        />
    );
};
