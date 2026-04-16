import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, Package, Plus, Trash2 } from 'lucide-react';
import { moduleApi } from '../../lib/api';

interface BillingSettingsModalProps {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void | Promise<void>;
}

interface BillingSettings {
    company_name: string;
    logo_url: string;
    default_tva_rate?: string;
    default_tva_custom_rate?: number | null;
    can_edit_branding?: boolean;
    can_edit_tax_rate?: boolean;
    tva_rates?: number[];
    address: string;
    postal_code: string;
    city: string;
    country: string;
    siret: string;
    tva: string;
    phone: string;
    capital: string;
    ape: string;
    siege_social: string;
    rcs_ville: string;
    rcs_numero: string;
    prestations_catalog: string;
}

interface CatalogItem {
    id: string;
    label: string;
    unit_price_ttc?: number;
    tax_rate?: number;
}

const EMPTY: BillingSettings = {
    company_name: '', logo_url: '',
    address: '', postal_code: '', city: '', siret: '', tva: '',
    country: 'France', phone: '', capital: '', ape: '', siege_social: '', rcs_ville: '', rcs_numero: '', prestations_catalog: '[]',
};

const Field = ({
    label,
    value,
    onChange,
    className = '',
    readOnly = false,
}: {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
    readOnly?: boolean;
}) => (
    <div className={`flex flex-col gap-1 ${className}`}>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</label>
        <input
            type="text"
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            className={`h-8 px-2 text-sm bg-transparent border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] transition-colors ${readOnly ? 'opacity-70 cursor-not-allowed' : 'focus:outline-none focus:border-blue-500'}`}
        />
    </div>
);

export function BillingSettingsModal({ open, onClose, onSaved }: BillingSettingsModalProps) {
    const [tab, setTab] = React.useState<'general' | 'prestations'>('general');
    const [form, setForm] = React.useState<BillingSettings>(EMPTY);
    const [saving, setSaving] = React.useState(false);
    const [saved, setSaved] = React.useState(false);
    const [catalogItems, setCatalogItems] = React.useState<CatalogItem[]>([]);
    const [newCatalogItem, setNewCatalogItem] = React.useState('');

    React.useEffect(() => {
        if (open) {
            moduleApi.getBillingSettings().then((data: any) => {
                if (data) {
                    const merged = { ...EMPTY, ...data };
                    setForm(merged);
                    try {
                        const parsed = JSON.parse(merged.prestations_catalog || '[]');
                        if (Array.isArray(parsed)) {
                            setCatalogItems(
                                parsed
                                    .map((p: any, index: number) => ({
                                        id: String(p?.id || index + 1),
                                        label: String(p?.label || '').trim(),
                                        unit_price_ttc: Number(p?.unit_price_ttc ?? 0),
                                        tax_rate: Number(p?.tax_rate ?? 0),
                                    }))
                                    .filter((item: CatalogItem) => item.label.length > 0)
                            );
                        } else {
                            setCatalogItems([]);
                        }
                    } catch {
                        setCatalogItems([]);
                    }
                    setNewCatalogItem('');
                }
            }).catch(() => {});
        }
    }, [open]);

    const set = (field: keyof BillingSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [field]: e.target.value }));

    const allowedTvaRates = (form.tva_rates && form.tva_rates.length > 0 ? form.tva_rates : [20]).map(Number).filter((n) => Number.isFinite(n) && n >= 0);

    const addCatalogItem = () => {
        const label = newCatalogItem.trim();
        if (!label) return;
        setCatalogItems((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, unit_price_ttc: 0, tax_rate: allowedTvaRates[0] ?? 20 }]);
        setNewCatalogItem('');
    };

    const updateCatalogItem = (id: string, value: string) => {
        setCatalogItems((prev) => prev.map((item) => item.id === id ? { ...item, label: value } : item));
    };

    const updateCatalogPrice = (id: string, value: string) => {
        const numericValue = Math.max(0, Number(value || 0));
        setCatalogItems((prev) => prev.map((item) => item.id === id ? { ...item, unit_price_ttc: numericValue } : item));
    };

    const updateCatalogTaxRate = (id: string, value: string) => {
        const numericValue = Math.max(0, Number(value || 0));
        setCatalogItems((prev) => prev.map((item) => item.id === id ? { ...item, tax_rate: numericValue } : item));
    };

    const removeCatalogItem = (id: string) => {
        setCatalogItems((prev) => prev.filter((item) => item.id !== id));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const prestations_catalog = JSON.stringify(
                catalogItems
                    .map((item, index) => ({
                        id: String(index + 1),
                        label: item.label.trim(),
                        unit_price_ttc: Number(item.unit_price_ttc ?? 0),
                        tax_rate: Number(item.tax_rate ?? allowedTvaRates[0] ?? 20),
                    }))
                    .filter((item) => item.label.length > 0)
            );
            const { company_name, logo_url, default_tva_rate, default_tva_custom_rate, can_edit_branding, can_edit_tax_rate, ...safeForm } = form as any;
            await moduleApi.saveBillingSettings({ ...safeForm, prestations_catalog });
            await onSaved?.();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch {}
        finally { setSaving(false); }
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-full max-w-3xl bg-white dark:bg-[#0A0A0A] border border-[var(--border-color)] rounded-2xl shadow-2xl z-10 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                            <h2 className="text-base font-bold text-[var(--text-primary)]">Paramètres de facturation</h2>
                            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[var(--border-color)] px-6">
                            <button
                                onClick={() => setTab('general')}
                                className={`flex items-center gap-2 py-3 px-1 mr-6 text-xs font-bold border-b-2 transition-colors ${
                                    tab === 'general'
                                        ? 'border-blue-500 text-blue-500'
                                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Settings size={13} />
                                Général
                            </button>
                            <button
                                onClick={() => setTab('prestations')}
                                className={`flex items-center gap-2 py-3 px-1 text-xs font-bold border-b-2 transition-colors ${
                                    tab === 'prestations'
                                        ? 'border-blue-500 text-blue-500'
                                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Package size={13} />
                                Prestations
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 overflow-y-auto">
                            {tab === 'general' && (
                                <div className="flex flex-col gap-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Informations légales</p>

                                    {/* Ligne 1 : Adresse pleine largeur */}
                                    <Field label="Rue / Adresse postale" value={form.address} onChange={set('address')} />

                                    {/* Ligne 2 : Code postal | Ville */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Code Postal" value={form.postal_code} onChange={set('postal_code')} />
                                        <Field label="Ville" value={form.city} onChange={set('city')} />
                                    </div>

                                    <Field label="Pays" value={form.country} onChange={set('country')} />

                                    {/* Ligne 3 : SIRET | TVA */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="SIRET" value={form.siret} onChange={set('siret')} />
                                        <Field label="TVA Intracommunautaire" value={form.tva} onChange={set('tva')} />
                                    </div>

                                    {/* Ligne 4 : Téléphone | Capital Social */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Téléphone" value={form.phone} onChange={set('phone')} />
                                        <Field label="Capital Social" value={form.capital} onChange={set('capital')} />
                                    </div>

                                    {/* Ligne 5 : Code APE / NAF | Siège Social */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Code APE / NAF" value={form.ape} onChange={set('ape')} />
                                        <Field label="Siège Social (si différent)" value={form.siege_social} onChange={set('siege_social')} />
                                    </div>

                                    {/* Ligne 6 : RCS Ville | RCS Numéro */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Ville d'immatriculation RCS" value={form.rcs_ville} onChange={set('rcs_ville')} />
                                        <Field label="Numéro RCS" value={form.rcs_numero} onChange={set('rcs_numero')} />
                                    </div>
                                </div>
                            )}

                            {tab === 'prestations' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-[var(--text-primary)]">
                                        <Package size={16} />
                                        <p className="text-sm font-bold">Gestion du catalogue</p>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)]">Ajoute, modifie ou supprime les prestations proposées dans la facture.</p>

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCatalogItem}
                                            onChange={(e) => setNewCatalogItem(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addCatalogItem();
                                                }
                                            }}
                                            placeholder="Ex: Cocktail entreprise"
                                            className="flex-1 h-8 px-3 text-sm bg-transparent border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                        <button
                                            type="button"
                                            onClick={addCatalogItem}
                                            className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                                        >
                                            <Plus size={13} /> Ajouter
                                        </button>
                                    </div>

                                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                        {catalogItems.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-[var(--border-color)] px-3 py-4 text-xs text-[var(--text-muted)] text-center">
                                                Aucune prestation enregistrée.
                                            </div>
                                        ) : catalogItems.map((item, index) => (
                                            <div key={item.id} className="rounded-lg border border-[var(--border-color)] px-3 py-3 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-[var(--text-muted)] w-5">{index + 1}</span>
                                                    <input
                                                        type="text"
                                                        value={item.label}
                                                        onChange={(e) => updateCatalogItem(item.id, e.target.value)}
                                                        className="flex-1 h-8 px-2 text-sm bg-transparent border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                                                        placeholder="Nom de la prestation"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCatalogItem(item.id)}
                                                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                                                        aria-label="Supprimer la prestation"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Montant TTC à l’unité optionnel</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min={0}
                                                            value={item.unit_price_ttc ?? 0}
                                                            onChange={(e) => updateCatalogPrice(item.id, e.target.value)}
                                                            className="h-8 px-2 text-sm bg-transparent border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                                                            placeholder="Ex: 25"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">TVA appliquée</label>
                                                        <select
                                                            value={item.tax_rate ?? allowedTvaRates[0] ?? 20}
                                                            onChange={(e) => updateCatalogTaxRate(item.id, e.target.value)}
                                                            className="h-8 px-2 text-sm bg-transparent border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                                                        >
                                                            {allowedTvaRates.map((rate) => (
                                                                <option key={rate} value={rate}>{rate}%</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-color)]">
                            <button
                                onClick={onClose}
                                className="px-4 py-1.5 text-xs font-bold rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
                            >
                                Fermer
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
