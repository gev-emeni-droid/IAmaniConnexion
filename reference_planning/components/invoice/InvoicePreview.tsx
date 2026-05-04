
import React from 'react';
import { RestaurantSettings, InvoiceData } from '../../src/features/invoice/types';
import { formatCurrency } from '../../src/features/invoice/utils';

interface InvoicePreviewProps {
  settings: RestaurantSettings;
  data: InvoiceData;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ settings, data }) => {
  // Normalize items (backward compatibility)
  const items = data.items && data.items.length > 0 ? data.items : [
    {
      id: 'legacy',
      description: data.description || '',
      amountHT10: data.amountHT10 || 0,
      amountHT20: data.amountHT20 || 0
    }
  ];

  const totalHT10 = items.reduce((sum, item) => sum + (item.amountHT10 || 0), 0);
  const totalHT20 = items.reduce((sum, item) => sum + (item.amountHT20 || 0), 0);

  const tva10Amount = totalHT10 * 0.1;
  const tva20Amount = totalHT20 * 0.2;

  const totalHT = totalHT10 + totalHT20;
  const totalTVA = tva10Amount + tva20Amount;
  const totalTTC = totalHT + totalTVA;

  const deposit = data.deposit || 0;
  const netToPay = totalTTC - deposit;

  const hasContent = totalHT > 0;

  // --- Pagination Logic ---
  const ITEMS_PER_PAGE_1_WITH_TOTALS = 6;  // Very conservative for Single Page
  const ITEMS_PER_PAGE_1_NO_TOTALS = 14;   // Header + Client + Footer, No Totals
  const ITEMS_PER_PAGE_MIDDLE = 20;        // Table Header + Footer
  const ITEMS_PER_PAGE_LAST = 10;          // Table Header + Totals + Footer

  const paginatedItems: typeof items[] = [];
  let remaining = [...items];

  // Logic to split items
  if (remaining.length <= ITEMS_PER_PAGE_1_WITH_TOTALS) {
    // Case: Everything fits on one page
    paginatedItems.push(remaining);
  } else {
    // Case: Multi-page
    // Page 1
    paginatedItems.push(remaining.slice(0, ITEMS_PER_PAGE_1_NO_TOTALS));
    remaining = remaining.slice(ITEMS_PER_PAGE_1_NO_TOTALS);

    // Middle Pages
    while (remaining.length > 0) {
      // Check if the remainder fits on the Last Page
      if (remaining.length <= ITEMS_PER_PAGE_LAST) {
        paginatedItems.push(remaining);
        break;
      } else {
        // Create a Middle Page
        paginatedItems.push(remaining.slice(0, ITEMS_PER_PAGE_MIDDLE));
        remaining = remaining.slice(ITEMS_PER_PAGE_MIDDLE);
      }
    }
  }

  // --- Render Helpers ---

  const Header = () => (
    <div className="flex justify-between items-start mb-6">
      <div className="flex flex-col">
        {settings.logo && (
          <img src={settings.logo} alt="Logo" className="max-h-28 max-w-[250px] mb-2 object-contain self-start" />
        )}
        <h1 className="text-xl font-bold text-slate-800">{settings.name || "Nom du Restaurant"}</h1>
        <div className="text-slate-600 text-xs mt-1 leading-snug">
          <p>{settings.street}</p>
          <p>{settings.zipCode} {settings.city}</p>
        </div>
        {settings.phone && (
          <p className="mt-1 text-xs text-slate-600 font-medium tracking-tight">Tél : {settings.phone}</p>
        )}
      </div>

      <div className="text-right">
        <h2 className="text-3xl font-black uppercase mb-6 tracking-tighter" style={{ color: 'var(--primary)' }}>Facture</h2>
        <div
          className="rounded-xl border shadow-sm text-left min-w-[180px]"
          style={{
            backgroundColor: '#f8fafc', // explicit slate-50 hex
            borderColor: '#e2e8f0', // explicit slate-200 hex
            borderWidth: '1px',
            borderStyle: 'solid',
            padding: '16px',
            display: 'block' // explicit block
          }}
        >
          <div className="mb-2">
            <p className="text-[9px] font-bold uppercase mb-0.5" style={{ color: '#94a3b8' }}>Numéro de facture</p>
            <p className="font-mono text-base font-bold" style={{ color: '#0f172a' }}>{data.invoiceNumber || "F-XXXXXX"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2" style={{ borderTop: '1px solid #e2e8f0' }}>
            <div>
              <p className="text-[9px] font-bold uppercase mb-0.5" style={{ color: '#94a3b8' }}>Date</p>
              <p className="font-bold text-xs" style={{ color: '#0f172a' }}>{data.date}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase mb-0.5" style={{ color: '#94a3b8' }}>Couverts</p>
              <p className="font-bold text-xs" style={{ color: '#0f172a' }}>{data.covers}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ClientInfoBlock = () => (
    data.client.companyName ? (
      <div className="mb-6 flex justify-end">
        <div className="w-1/2 p-4 rounded-xl border-2 border-slate-50 bg-white shadow-sm">
          <h3 className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--primary)', opacity: 0.7 }}>Destinataire</h3>
          <p className="font-bold text-lg mb-1" style={{ color: '#1e293b' }}>{data.client.companyName}</p>
          <div className="text-sm leading-relaxed" style={{ color: '#475569' }}>
            {/* Split address by lines to handle multiline input properly when printing */}
            {data.client.address && data.client.address.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {(data.client.zipCode || data.client.city) && (
              <div className="mt-1">
                {data.client.zipCode} {data.client.city}
              </div>
            )}
            {data.client.country && (
              <div className="mt-1 font-semibold">
                {data.client.country}
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null
  );

  const Footer = ({ pageCurrent, pageTotal }: { pageCurrent: number, pageTotal: number }) => (
    <div className="absolute bottom-[6mm] left-[6mm] right-[6mm] pt-4 border-t border-slate-100 text-center">
      <div className="space-y-1 opacity-80">
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">
          {settings.name}
        </p>
        <div className="text-[8px] text-slate-400 leading-relaxed font-medium flex flex-wrap justify-center gap-x-2 gap-y-0.5 uppercase tracking-wide">
          {settings.rcs && <span>{settings.rcs}</span>}
          {settings.siret && <span>• SIRET {settings.siret}</span>}
          {settings.vatNumber && <span>• TVA {settings.vatNumber}</span>}
          {settings.ape && <span>• Code APE {settings.ape}</span>}
        </div>
        <div className="text-[8px] text-slate-400 leading-relaxed font-medium flex flex-wrap justify-center gap-x-2 gap-y-0.5 uppercase tracking-wide">
          {settings.capital && <span>Capital social : {settings.capital}</span>}
          {settings.headquarters && <span>• {settings.headquarters}</span>}
          {!settings.headquarters && (settings.street || settings.city) && <span>• {settings.street} {settings.zipCode} {settings.city}</span>}
        </div>
        <div className="text-[8px] text-slate-300 mt-1">Page {pageCurrent} / {pageTotal}</div>
      </div>
    </div>
  );

  const TotalsBlock = () => (
    <div className="absolute bottom-[45mm] right-[6mm] flex justify-end">
      <div className="w-[300px] bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3 shadow-sm">
        <div className="flex justify-between text-xs text-slate-500 font-medium">
          <span>Sous-total Hors Taxes :</span>
          <span className="text-slate-900">{formatCurrency(totalHT)}</span>
        </div>

        <div className="space-y-1 pt-2 border-t border-slate-200/60">
          {totalHT10 > 0 && (
            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>TVA Collectée (10%) :</span>
              <span className="text-slate-600">{formatCurrency(tva10Amount)}</span>
            </div>
          )}
          {totalHT20 > 0 && (
            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>TVA Collectée (20%) :</span>
              <span className="text-slate-600">{formatCurrency(tva20Amount)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between text-slate-600 text-[10px] font-black uppercase tracking-tight pt-1">
          <span>Total des taxes (TVA) :</span>
          <span>{formatCurrency(totalTVA)}</span>
        </div>

        <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
          <span className="text-xs font-bold text-slate-700">Total TTC</span>
          <span className="text-lg font-bold text-slate-900">{formatCurrency(totalTTC)}</span>
        </div>

        {deposit > 0 && (
          <div className="flex justify-between items-baseline text-slate-500">
            <span className="text-xs font-medium">Acompte perçu</span>
            <span className="text-sm font-medium text-slate-700">- {formatCurrency(deposit)}</span>
          </div>
        )}

        <div className="pt-4 border-t-2 flex justify-between items-baseline" style={{ borderColor: 'var(--primary)', borderTopStyle: 'solid', borderTopWidth: '2px', opacity: 1 }}>
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)', opacity: 0.7 }}>Net à Payer</span>
          <span className="text-2xl font-black" style={{ color: 'var(--primary)' }}>{formatCurrency(netToPay)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div id="invoice-preview-container" className="flex flex-col gap-8 print:block print:gap-0">
      {paginatedItems.map((pageItems, pageIndex) => {
        const isFirst = pageIndex === 0;
        const isLast = pageIndex === paginatedItems.length - 1;

        return (
          <div
            key={pageIndex}
            className="invoice-page bg-white p-[6mm] mx-auto shadow-xl rounded-lg print:shadow-none print:rounded-none print:p-[6mm] print:m-0 relative"
            style={{
              width: '210mm',
              minHeight: '297mm', // Force A4 height
              height: '297mm',
              overflow: 'hidden', // Ensure no spillover
              pageBreakAfter: isLast ? 'auto' : 'always'
            }}
          >
            {isFirst && <Header />}
            {isFirst && <ClientInfoBlock />}

            {/* Spacer logic if not first page to simulate header margin if needed, but usually we just start the table */}
            {!isFirst && <div className="h-4"></div>}

            <div className="flex-grow relative">
              {/* We iterate here, but table structure requires Headers. We show headers on every page for clarity */}
              <table className="w-full mb-6 border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-left">
                    <th className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Désignation</th>
                    <th className="pb-2 pl-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base HT (10%)</th>
                    <th className="pb-2 pl-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base HT (20%)</th>
                    <th className="pb-2 pl-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((item, idx) => {
                    const lineHT = (item.amountHT10 || 0) + (item.amountHT20 || 0);
                    return (
                      <tr key={idx} className="group">
                        <td className="py-2"> {/* Reduced padding slightly to fit more */}
                          <p className="font-bold text-slate-800 text-sm">{item.description}</p>
                          {/* Only show sub-caption on absolute first item of whole Invoice */}
                          {isFirst && idx === 0 && (
                            <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5 tracking-wider">Services de restauration ({data.covers} cvts)</p>
                          )}
                        </td>
                        <td className="py-2 pl-4 text-right text-slate-700 font-medium text-xs">
                          {item.amountHT10 > 0 ? formatCurrency(item.amountHT10) : '-'}
                        </td>
                        <td className="py-2 pl-4 text-right text-slate-700 font-medium text-xs">
                          {item.amountHT20 > 0 ? formatCurrency(item.amountHT20) : '-'}
                        </td>
                        <td className="py-2 pl-6 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(lineHT)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isLast && <TotalsBlock />}

            <Footer pageCurrent={pageIndex + 1} pageTotal={paginatedItems.length} />
          </div>
        );
      })}
    </div>
  );
};

export default InvoicePreview;
