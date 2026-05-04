
import React from 'react';
import { RefreshCcw, Calculator, X } from 'lucide-react';
import { InvoiceData } from '../../src/features/invoice/types';
import { generateInvoiceNumber } from '../../src/features/invoice/utils';



const PrestationCombobox = ({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = showAll
    ? options
    : options.filter(o => o.toLowerCase().includes((value || '').toLowerCase()));

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowAll(false);
          setIsOpen(true);
        }}
        onFocus={() => {
          setShowAll(true);
          setIsOpen(true);
        }}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 outline-none text-sm"
        style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
        placeholder="Ex: Privatisation Salle"
      />

      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto py-1">
          {filteredOptions.map((opt) => (
            <li
              key={opt}
              className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

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

  // --- Calculator Logic ---
  const [calculator, setCalculator] = React.useState<{
    isOpen: boolean;
    itemIndex: number | null;
    rate: 10 | 20 | null;
    value: string;
  }>({
    isOpen: false,
    itemIndex: null,
    rate: null,
    value: ''
  });

  const openCalculator = (index: number, rate: 10 | 20) => {
    setCalculator({
      isOpen: true,
      itemIndex: index,
      rate: rate,
      value: ''
    });
  };

  const applyCalculator = () => {
    if (calculator.itemIndex === null || calculator.rate === null) return;

    // Replace comma with dot for flexibility
    const ttc = parseFloat(calculator.value.replace(',', '.')) || 0;
    const ht = ttc / (1 + (calculator.rate / 100));

    // Create new items array
    const newItems = [...data.items];
    const field = calculator.rate === 10 ? 'amountHT10' : 'amountHT20';

    // Round to 2 decimals properly using Round Half Up (Standard Accounting)
    const roundedHt = Math.round((ht + Number.EPSILON) * 100) / 100;

    newItems[calculator.itemIndex] = {
      ...newItems[calculator.itemIndex],
      [field]: roundedHt
    };

    onChange({ ...data, items: newItems });
    setCalculator({ ...calculator, isOpen: false });
  };

  return (
    <div className="space-y-6 no-print">
      {/* Section Facture & Client */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 border-l-4 pl-3" style={{ borderColor: 'var(--primary)' }}>Informations de la Facture</h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Numéro de facture</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.invoiceNumber}
                onChange={e => updateField('invoiceNumber', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all font-mono"
                style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
                placeholder="Ex: F-202403-0001"
              />
              <button
                onClick={() => updateField('invoiceNumber', generateInvoiceNumber())}
                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                title="Générer un nouveau numéro"
              >
                <RefreshCcw size={20} />
              </button>
            </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Code postal</label>
                  <input
                    type="text"
                    value={data.client.zipCode || ''}
                    onChange={e => updateClient('zipCode', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all"
                    style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
                    placeholder="75000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Ville</label>
                  <input
                    type="text"
                    value={data.client.city || ''}
                    onChange={e => updateClient('city', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all"
                    style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Pays</label>
                <input
                  type="text"
                  value={data.client.country || ''}
                  onChange={e => updateClient('country', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all"
                  style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
                  placeholder="France"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Prestation & Détails */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 border-l-4 pl-3" style={{ borderColor: 'var(--primary)' }}>Détails de la prestation</h3>

        <div className="space-y-6">
          {/* Global Fields like Covers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-2">
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

          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Lignes de facturation</label>

            {data.items && data.items.map((item, index) => (
              <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative group">
                {data.items.length > 1 && (
                  <button
                    onClick={() => {
                      const newItems = data.items.filter(i => i.id !== item.id);
                      updateField('items', newItems);
                    }}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 transition-colors"
                    title="Supprimer la ligne"
                  >
                    ×
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-6 space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">Description</label>
                    <PrestationCombobox
                      value={item.description}
                      options={prestations}
                      onChange={(newDesc) => {
                        const newItems = [...data.items];
                        newItems[index] = { ...item, description: newDesc };
                        updateField('items', newItems);
                      }}
                    />
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-orange-600 uppercase">HT (10%)</label>
                      <button
                        onClick={() => openCalculator(index, 10)}
                        className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-orange-200 transition-colors"
                        title="Calculer montant HT depuis TTC"
                      >
                        <Calculator size={10} />
                        <span>TTC</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.amountHT10 || ''}
                        onChange={e => {
                          const newItems = [...data.items];
                          newItems[index] = { ...item, amountHT10: parseFloat(e.target.value) || 0 };
                          updateField('items', newItems);
                        }}
                        className="w-full pl-3 pr-6 py-2 bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-medium text-orange-900 text-sm"
                        placeholder="0.00"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-400 font-bold text-xs">€</span>
                    </div>
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-blue-600 uppercase">HT (20%)</label>
                      <button
                        onClick={() => openCalculator(index, 20)}
                        className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-blue-200 transition-colors"
                        title="Calculer montant HT depuis TTC"
                      >
                        <Calculator size={10} />
                        <span>TTC</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.amountHT20 || ''}
                        onChange={e => {
                          const newItems = [...data.items];
                          newItems[index] = { ...item, amountHT20: parseFloat(e.target.value) || 0 };
                          updateField('items', newItems);
                        }}
                        className="w-full pl-3 pr-6 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-blue-900 text-sm"
                        placeholder="0.00"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 font-bold text-xs">€</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => {
                const newItem = {
                  id: crypto.randomUUID(),
                  description: '',
                  amountHT10: 0,
                  amountHT20: 0
                };
                updateField('items', [...data.items, newItem]);
              }}
              className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold uppercase text-xs hover:border-slate-400 hover:text-slate-600 transition-all"
            >
              + Ajouter une ligne
            </button>
          </div>

          <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Acompte déjà versé</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.deposit || ''}
                  onChange={e => updateField('deposit', parseFloat(e.target.value) || 0)}
                  className="w-full pl-4 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none text-lg font-bold text-slate-800"
                  style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
              </div>
              <p className="text-xs text-slate-400 italic">Ce montant sera déduit du total à payer.</p>
            </div>

            <div className="flex flex-col justify-end items-end space-y-1 text-right opacity-60">
              <p className="text-xs">Total HT et TVA calculés automatiquement pour l'aperçu.</p>
            </div>
          </div>

        </div>
      </div>


      {/* Calculator Modal */}
      {
        calculator.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-600" />
                  Calculer HT ({calculator.rate}%)
                </h3>
                <button
                  onClick={() => setCalculator({ ...calculator, isOpen: false })}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Entrez le montant TOTAL (TTC)</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={calculator.value}
                      onChange={(e) => setCalculator({ ...calculator, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyCalculator();
                        if (e.key === 'Escape') setCalculator({ ...calculator, isOpen: false });
                      }}
                      className="w-full pl-4 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 outline-none text-xl font-bold text-slate-800"
                      style={{ '--tw-ring-color': 'var(--primary)' } as React.CSSProperties}
                      placeholder="0.00"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Le montant HT sera automatiquement calculé : <br />
                    <span className="font-mono bg-slate-100 px-1 rounded">HT = TTC ÷ {calculator.rate === 10 ? '1.1' : '1.2'}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setCalculator({ ...calculator, isOpen: false })}
                    className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={applyCalculator}
                    className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default InvoiceForm;
