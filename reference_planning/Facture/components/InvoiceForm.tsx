
import React from 'react';
import { InvoiceData } from '../types';



interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
  prestations: string[];
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ data, onChange, prestations }) => {
  const updateClient = (field: string, value: string) => {
    onChange({
      ...data,
      client: { ...data.client, [field]: value }
    });
  };

  const updateField = (field: keyof InvoiceData, value: any) => {
    onChange({
      ...data,
      [field]: value
    });
  };

  return (
    <div className="space-y-6 no-print">
      {/* Section Facture & Client */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 border-l-4 pl-3" style={{ borderColor: 'var(--primary)' }}>Informations de la Facture</h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Numéro de facture</label>
            <input
              type="text"
              value={data.invoiceNumber}
              onChange={e => updateField('invoiceNumber', e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all font-mono"
              style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
              placeholder="Ex: F-202403-0001"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Date de la facture</label>
            <input
              type="date"
              value={(() => {
                // Convert DD/MM/YYYY (FR) to YYYY-MM-DD (Input)
                if (!data.date) return '';
                const [day, month, year] = data.date.split('/');
                return `${year}-${month}-${day}`;
              })()}
              onChange={e => {
                // Convert YYYY-MM-DD (Input) to DD/MM/YYYY (FR)
                const val = e.target.value;
                if (!val) return;
                const [year, month, day] = val.split('-');
                updateField('date', `${day}/${month}/${year}`);
              }}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all font-mono"
              style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
            />
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Client</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Nom de l'entreprise</label>
                <input
                  type="text"
                  value={data.client.companyName}
                  onChange={e => updateClient('companyName', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all"
                  style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
                  placeholder="Ex: Société Digitale SAS"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Adresse</label>
                <textarea
                  value={data.client.address}
                  onChange={e => updateClient('address', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none h-20 transition-all"
                  style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
                  placeholder="Adresse complète du client"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Prestation & Détails */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 border-l-4 pl-3" style={{ borderColor: 'var(--primary)' }}>Détails de la prestation</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-600">Type de prestation</label>
              <select
                value={data.description}
                onChange={e => updateField('description', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all"
                style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
              >
                {prestations.map(desc => (
                  <option key={desc} value={desc}>{desc}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Nbr. Couverts</label>
              <input
                type="number"
                min="1"
                value={data.covers}
                onChange={e => updateField('covers', parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all text-center"
                style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
              <label className="text-xs font-bold text-orange-700 uppercase mb-2 block">Montant HT (TVA 10%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.amountHT10 || ''}
                  onChange={e => updateField('amountHT10', parseFloat(e.target.value) || 0)}
                  className="w-full pl-4 pr-8 py-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-lg font-semibold text-orange-900"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 font-bold">€</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <label className="text-xs font-bold text-blue-700 uppercase mb-2 block">Montant HT (TVA 20%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.amountHT20 || ''}
                  onChange={e => updateField('amountHT20', parseFloat(e.target.value) || 0)}
                  className="w-full pl-4 pr-8 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-semibold text-blue-900"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 font-bold">€</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceForm;
