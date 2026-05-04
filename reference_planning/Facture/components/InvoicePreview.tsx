
import React from 'react';
import { RestaurantSettings, InvoiceData } from '../types';
import { formatCurrency } from '../utils';

interface InvoicePreviewProps {
  settings: RestaurantSettings;
  data: InvoiceData;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ settings, data }) => {
  const tva10Amount = data.amountHT10 * 0.1;
  const tva20Amount = data.amountHT20 * 0.2;
  const totalHT = data.amountHT10 + data.amountHT20;
  const totalTVA = tva10Amount + tva20Amount;
  const totalTTC = totalHT + totalTVA;

  const hasContent = data.amountHT10 > 0 || data.amountHT20 > 0;

  return (
    <div id="invoice-preview" className="bg-white p-[5mm] w-full max-w-[210mm] mx-auto shadow-xl rounded-lg print:shadow-none print:rounded-none print:p-[5mm] print:m-0 print:w-full flex flex-col h-[290mm] print:h-[290mm] overflow-hidden relative">
      {/* Header : Logo puis Nom, Adresse (Rue, CP Ville), Tel */}
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
          <h2 className="text-3xl font-black uppercase mb-2 tracking-tighter" style={{ color: 'var(--primary)' }}>Facture</h2>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 inline-block text-left min-w-[180px] shadow-sm">
            <div className="mb-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Numéro de facture</p>
              <p className="font-mono text-base font-bold text-slate-900">{data.invoiceNumber || "F-XXXXXX"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Date</p>
                <p className="font-bold text-slate-900 text-xs">{data.date}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Couverts</p>
                <p className="font-bold text-slate-900 text-xs">{data.covers}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Section */}
      {data.client.companyName && (
        <div className="mb-6 flex justify-end">
          <div className="w-1/2 p-4 rounded-xl border-2 border-slate-50 bg-white shadow-sm">
            <h3 className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--primary)', opacity: 0.7 }}>Destinataire</h3>
            <p className="font-bold text-lg text-slate-900 mb-0.5">{data.client.companyName}</p>
            <p className="text-slate-600 text-xs whitespace-pre-line leading-relaxed">{data.client.address}</p>
          </div>
        </div>
      )}

      {/* Items Table - Single line display */}
      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr className="border-b border-slate-900 text-left">
            <th className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Désignation de la prestation</th>
            <th className="pb-2 pl-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base HT (10%)</th>
            <th className="pb-2 pl-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base HT (20%)</th>
            <th className="pb-2 pl-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total HT</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {hasContent ? (
            <tr className="group">
              <td className="py-4">
                <p className="font-bold text-slate-800 text-lg">{data.description}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5 tracking-wider">Services de restauration et consommations ({data.covers} couverts)</p>
              </td>
              <td className="py-4 pl-4 text-right text-slate-700 font-medium text-sm">
                {data.amountHT10 > 0 ? formatCurrency(data.amountHT10) : '-'}
              </td>
              <td className="py-4 pl-4 text-right text-slate-700 font-medium text-sm">
                {data.amountHT20 > 0 ? formatCurrency(data.amountHT20) : '-'}
              </td>
              <td className="py-4 pl-6 text-right font-black text-slate-900 text-lg">
                {formatCurrency(totalHT)}
              </td>
            </tr>
          ) : (
            <tr>
              <td colSpan={4} className="py-8 text-center text-slate-300 italic text-sm">
                Saisissez les montants dans le formulaire pour générer la prestation
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Summary Section */}
      <div className="flex justify-end mt-auto mb-4">
        <div className="w-[300px] bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3 shadow-sm">
          <div className="flex justify-between text-xs text-slate-500 font-medium">
            <span>Sous-total Hors Taxes :</span>
            <span className="text-slate-900">{formatCurrency(totalHT)}</span>
          </div>

          <div className="space-y-1 pt-2 border-t border-slate-200/60">
            {data.amountHT10 > 0 && (
              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>TVA Collectée (10%) :</span>
                <span className="text-slate-600">{formatCurrency(tva10Amount)}</span>
              </div>
            )}
            {data.amountHT20 > 0 && (
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

          <div className="pt-4 border-t-2 flex justify-between items-baseline" style={{ borderColor: 'var(--primary)', borderTopStyle: 'solid', borderTopWidth: '2px', opacity: 1 }}>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)', opacity: 0.7 }}>Net à Payer TTC</span>
            <span className="text-2xl font-black" style={{ color: 'var(--primary)' }}>{formatCurrency(totalTTC)}</span>
          </div>
        </div>
      </div>

      {/* Footer Legal - SIRET, TVA etc. */}
      <div className="mt-4 pt-4 border-t border-slate-100 text-center">
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
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
