
import React, { useState, useEffect } from 'react';
import { Settings, X, Upload, Trash2, Edit2, Check } from 'lucide-react';
import { RestaurantSettings } from '../../src/features/invoice/types';
import { STORAGE_KEYS, PREDEFINED_COLORS } from '../../src/features/invoice/constants';
import { api } from '../../services/invoiceApi';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: RestaurantSettings) => void;
  initialSettings: RestaurantSettings;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, initialSettings }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'prestations'>('general');
  const [settings, setSettings] = useState<RestaurantSettings>(initialSettings);
  const [prestations, setPrestations] = useState<{ id: number; label: string }[]>([]);
  const [newPrestation, setNewPrestation] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSettings(initialSettings);
      loadPrestations();
    }
  }, [isOpen, initialSettings]);

  const loadPrestations = async () => {
    const data = await api.prestations.list();
    setPrestations(data);
  };

  const handleAddPrestation = async () => {
    if (!newPrestation.trim()) return;
    await api.prestations.add(newPrestation);
    setNewPrestation('');
    loadPrestations();
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = (p: { id: number; label: string }) => {
    setEditingId(p.id);
    setEditValue(p.label);
  };

  const saveEdit = async () => {
    if (editingId && editValue.trim()) {
      await api.prestations.update(editingId, editValue);
      setEditingId(null);
      setEditValue('');
      loadPrestations();
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDeletePrestation = async (id: number) => {
    if (confirm('Supprimer cette prestation ?')) {
      await api.prestations.delete(id);
      loadPrestations();
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    await api.settings.save(settings);
    onSave(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-800">Paramètres</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Général
          </button>
          <button
            onClick={() => setActiveTab('prestations')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'prestations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Prestations
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {activeTab === 'general' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Nom du restaurant</label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={e => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: Le Gourmet Paris"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Rue / Adresse</label>
                  <input
                    type="text"
                    value={settings.street}
                    onChange={e => setSettings({ ...settings, street: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="123 Rue de Rivoli"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Code Postal</label>
                  <input
                    type="text"
                    value={settings.zipCode}
                    onChange={e => setSettings({ ...settings, zipCode: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="75001"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Ville</label>
                  <input
                    type="text"
                    value={settings.city}
                    onChange={e => setSettings({ ...settings, city: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Paris"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">SIRET</label>
                  <input
                    type="text"
                    value={settings.siret}
                    onChange={e => setSettings({ ...settings, siret: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="123 456 789 00012"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">TVA Intracommunautaire</label>
                  <input
                    type="text"
                    value={settings.vatNumber}
                    onChange={e => setSettings({ ...settings, vatNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="FR 12 345678901"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Téléphone</label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={e => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="01 23 45 67 89"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Capital Social</label>
                  <input
                    type="text"
                    value={settings.capital || ''}
                    onChange={e => setSettings({ ...settings, capital: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: 40 000€"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Code APE / NAF</label>
                  <input
                    type="text"
                    value={settings.ape || ''}
                    onChange={e => setSettings({ ...settings, ape: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: 56.10A"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-slate-700">Siège Social (si différent)</label>
                  <input
                    type="text"
                    value={settings.headquarters || ''}
                    onChange={e => setSettings({ ...settings, headquarters: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: 55 rue Deguingand 92300 Levallois Perret"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-slate-700">Mention RCS (Ville + Numéro)</label>
                  <input
                    type="text"
                    value={settings.rcs || ''}
                    onChange={e => setSettings({ ...settings, rcs: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: RCS NANTERRE 449.331.164"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Logo</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors border border-slate-200">
                      <Upload className="w-4 h-4" />
                      <span>Logo</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                    {settings.logo && (
                      <img src={settings.logo} alt="Preview" className="h-10 w-10 object-contain rounded border bg-white" />
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Couleur principale</label>

                  <div className="flex flex-wrap gap-3">
                    {PREDEFINED_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setSettings({ ...settings, primaryColor: color })}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${settings.primaryColor === color ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Ou personnalisée :</span>
                    <input
                      type="color"
                      value={settings.primaryColor || '#4f46e5'}
                      onChange={e => setSettings({ ...settings, primaryColor: e.target.value })}
                      className="h-9 w-16 p-0.5 bg-white border border-slate-200 rounded cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 font-mono">{settings.primaryColor || '#4f46e5'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPrestation}
                  onChange={(e) => setNewPrestation(e.target.value)}
                  placeholder="Nouvelle prestation..."
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  onClick={handleAddPrestation}
                  disabled={!newPrestation.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ajouter
                </button>
              </div>

              <div className="space-y-2">
                {prestations.map(prestation => (
                  <div key={prestation.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg group">
                    <span className="font-medium text-slate-700">{prestation.label}</span>
                    <button
                      onClick={() => handleDeletePrestation(prestation.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {prestations.length === 0 && (
                  <p className="text-center text-slate-400 py-8 italic">Aucune prestation personnalisée.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
          >
            Fermer
          </button>
          {activeTab === 'general' && (
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95"
            >
              Enregistrer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
