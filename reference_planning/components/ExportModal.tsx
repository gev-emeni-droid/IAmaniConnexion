import React, { useState, useEffect } from 'react';
import { X, Download, CheckSquare, Calendar, Columns } from 'lucide-react';
import { getRoles } from '../services/storage';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ExportOptions {
  roles: string[];
  period: 'WEEK' | 'DAY';
  selectedDay: string; // YYYY-MM-DD
  columns: {
    arrival: boolean;
    departure: boolean;
    signature: boolean;
  };
  colors: {
    header: string;
    text: string;
  };
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: ExportOptions) => void;
  weekDates: string[]; // List of YYYY-MM-DD for the day selector
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onConfirm, weekDates }) => {
  const [availableRoles, setAvailableRoles] = useState<{ id: string, label: string }[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Options
  const [period, setPeriod] = useState<'WEEK' | 'DAY'>('WEEK');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [showArrival, setShowArrival] = useState(true);
  const [showDeparture, setShowDeparture] = useState(true);
  const [showSignature, setShowSignature] = useState(true);

  const [headerColor, setHeaderColor] = useState('#C1D5AF');
  const [textColor, setTextColor] = useState('#000000');

  const PRESET_COLORS = [
    '#4AA3A2', '#A7E0E0', '#212E53', '#F4CFDF',
    '#C08493', '#1C0F12', '#D4C2A1', '#A1A27E',
    '#FFFFFF', '#C1D5AF', '#88C7BC', '#5FACD3',
    '#000000' // Added black for text option specifically
  ];

  useEffect(() => {
    if (isOpen) {
      const loadRoles = async () => {
        const roles = await getRoles();
        setAvailableRoles(roles);
        setSelectedRoles(roles.map(r => r.id)); // Default select all
      };
      loadRoles();
      // Default to first day if available and not set
      if (weekDates.length > 0 && !selectedDay) setSelectedDay(weekDates[0]);
    }
  }, [isOpen, weekDates]);

  const toggleRole = (roleId: string) => {
    if (selectedRoles.includes(roleId)) {
      setSelectedRoles(selectedRoles.filter(r => r !== roleId));
    } else {
      setSelectedRoles([...selectedRoles, roleId]);
    }
  };

  const handleConfirm = () => {
    onConfirm({
      roles: selectedRoles,
      period,
      selectedDay: selectedDay || weekDates[0],
      columns: {
        arrival: showArrival,
        departure: showDeparture,
        signature: showSignature
      },
      colors: {
        header: headerColor,
        text: textColor
      }
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Download className="text-blue-600" /> Options d'export PDF
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">

          {/* 1. Période */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar size={16} /> Période
            </h3>
            <div className="flex bg-slate-100 p-1 rounded-lg mb-3">
              <button
                onClick={() => setPeriod('WEEK')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${period === 'WEEK' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Semaine complète
              </button>
              <button
                onClick={() => setPeriod('DAY')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${period === 'DAY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Jour unique
              </button>
            </div>

            {period === 'DAY' && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <label className="block text-xs font-bold text-blue-800 mb-1">Sélectionnez le jour :</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full text-sm border-blue-200 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {weekDates.map(d => (
                    <option key={d} value={d}>
                      {format(parseISO(d), 'eeee d MMMM', { locale: fr }).replace(/^\w/, c => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Personnalisation (Couleurs) */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckSquare size={16} /> Personnalisation
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Couleur de fond Entête */}
              <div className="bg-slate-50 p-3 rounded border">
                <label className="block text-xs font-bold text-slate-500 mb-2">Fond Entêtes</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.filter(c => c !== '#000000').map(color => (
                    <button
                      key={`bg-${color}`}
                      onClick={() => setHeaderColor(color)}
                      className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 ${headerColor === color ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : ''}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Couleur Texte */}
              <div className="bg-slate-50 p-3 rounded border">
                <label className="block text-xs font-bold text-slate-500 mb-2">Texte Entêtes</label>
                <div className="flex flex-wrap gap-2">
                  {['#000000', '#FFFFFF', '#212E53', '#1C0F12'].map(color => (
                    <button
                      key={`text-${color}`}
                      onClick={() => setTextColor(color)}
                      className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 ${textColor === color ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : ''}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Colonnes Optionnelles */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Columns size={16} /> Colonnes à afficher
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={showArrival} onChange={e => setShowArrival(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-700">Heure arrivée</span>
              </label>
              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={showDeparture} onChange={e => setShowDeparture(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-700">Heure départ</span>
              </label>
              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={showSignature} onChange={e => setShowSignature(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-700">Signature</span>
              </label>
            </div>
            <p className="text-xs text-slate-400 mt-2 italic">
              Ces colonnes seront ajoutées pour permettre le pointage manuel (feuille d'émargement).
            </p>
          </div>

          {/* 4. Postes */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-end mb-3">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Postes à inclure</h3>
              <div className="flex gap-2">
                <button onClick={() => setSelectedRoles(availableRoles.map(r => r.id))} className="text-[10px] text-blue-600 font-bold hover:underline">Tout cocher</button>
                <button onClick={() => setSelectedRoles([])} className="text-[10px] text-slate-400 font-bold hover:underline">Tout décocher</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
              {availableRoles.map(role => {
                const isChecked = selectedRoles.includes(role.id);
                return (
                  <label key={role.id} className="flex items-center gap-2 p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors select-none">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                      {isChecked && <CheckSquare size={12} className="text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isChecked}
                      onChange={() => toggleRole(role.id)}
                    />
                    <span className={`text-xs font-bold truncate ${isChecked ? 'text-slate-800' : 'text-slate-500'}`}>
                      {role.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 flex items-center justify-center gap-2 shadow-sm"
          >
            <Download size={18} /> Exporter PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;