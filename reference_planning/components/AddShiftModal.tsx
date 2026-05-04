
import React, { useState, useEffect } from 'react';
import { X, UserPlus, Users, CalendarDays, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { Employee, Shift, ShiftServiceType, ABSENCE_TYPES } from '../types';
import { getEmployees, saveEmployees, getRoles, addLongAbsence } from '../services/storage';
import { format, parseISO, isWithinInterval, startOfDay, parse } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AddShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    employeeId: string;
    employeeName: string;
    employeeRole: string;
    isExtra: boolean;
    date?: string; // Single date (Legacy/Standard)
    dates?: string[]; // Multiple dates (Absence Longue Durée)
    shift: Shift;
    extraCount?: number;
    extraType?: "Hôtesse LBE" | "Brigad Plage" | "Agent de sécurité";
  }) => void;
  weekStart: string; // YYYY-MM-DD
  weekDates: string[];
  onSuccess?: () => void; // Callback to refresh data without reload
}

const AddShiftModal: React.FC<AddShiftModalProps> = ({ isOpen, onClose, onSave, weekDates, onSuccess }) => {
  const [mode, setMode] = useState<'new_employee' | 'extra' | 'long_absence'>('new_employee');
  const [employees, setEmployees] = useState<Employee[]>([]);

  // -- Common --
  const [selectedDate, setSelectedDate] = useState(weekDates[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('15:00');

  // -- New Employee Mode --
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<string>(''); // Will initialize from roles
  const [shiftLabel, setShiftLabel] = useState(''); // Text libre for new employee shift

  // -- Extra Mode --
  const [extraCount, setExtraCount] = useState<number>(1);
  const [extraType, setExtraType] = useState<"Hôtesse LBE" | "Brigad Plage" | "Agent de sécurité">("Hôtesse LBE");

  // -- Long Absence Mode --
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [absenceType, setAbsenceType] = useState<string>(ABSENCE_TYPES[0]);
  const [startDate, setStartDate] = useState(weekDates[0]);
  const [endDate, setEndDate] = useState(weekDates[weekDates.length - 1]);

  const [roles, setRoles] = useState<{ id: string, label: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadFormData();
    }
  }, [isOpen, weekDates]);

  const loadFormData = async () => {
    try {
      const rolesData = await getRoles();
      setRoles(Array.isArray(rolesData) ? rolesData : []);

      const allEmps = await getEmployees();
      const activeEmps = Array.isArray(allEmps) ? allEmps.filter(e => e.isActive) : [];
      setEmployees(activeEmps);

      // Reset form
      setMode('new_employee');

      setNewEmpName('');
      if (Array.isArray(rolesData) && rolesData.length > 0) {
        setNewEmpRole(rolesData[0].id);
      } else {
        setNewEmpRole('');
      }

      setShiftLabel('');

      // Init Extra
      setExtraCount(1);
      setExtraType("Hôtesse LBE");

      // Init Absence
      if (activeEmps.length > 0) setSelectedEmpId(activeEmps[0].id);
      setAbsenceType("CP"); // Default to CP or first type

      setStartTime('10:00');
      setEndTime('15:00');
      // Default date is first day
      if (weekDates.length > 0) {
        setSelectedDate(weekDates[0]);
        setStartDate(weekDates[0]);
        setEndDate(weekDates[weekDates.length - 1]);
      }
    } catch (err) {
      console.error('Failed to load form data:', err);
      setRoles([]);
      setEmployees([]);
    }
  };

  const calculateServiceType = (start: string, end: string): ShiftServiceType => {
    const hasMidi = start < "16:00";
    const hasSoir = end >= "16:00";
    if (hasMidi && hasSoir) return 'midi+soir';
    if (hasMidi) return 'midi';
    if (hasSoir) return 'soir';
    return 'none';
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const formatFrenchDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    return capitalize(format(d, 'eeee d MMMM', { locale: fr }));
  };

  const handleSubmit = async () => {
    // 1. ABSENCE LONGUE DURÉE
    if (mode === 'long_absence') {
      if (!selectedEmpId) return alert("Veuillez sélectionner un employé.");
      if (startDate > endDate) return alert("La date de fin doit être après la date de début.");

      try {
        // Use central storage to add the absence, which will propagate to plannings automatically
        await addLongAbsence({
          employeeId: selectedEmpId,
          type: absenceType,
          startDate: startDate,
          endDate: endDate
        });

        if (onSuccess) onSuccess();
        onClose();
      } catch (err) {
        console.error('Failed to add absence:', err);
        alert('Erreur lors de l\'ajout de l\'absence');
      }
      return;
    }

    // 2. OTHER MODES (Single Day)
    if (!startTime || !endTime) return alert("Heures requises.");

    let empId = '';
    let empName = '';
    let empRole = '';
    let isExtra = false;

    try {
      if (mode === 'new_employee') {
        if (!newEmpName.trim()) return alert("Nom de l'employé requis.");

        // Create new employee globally
        const newEmp: Employee = {
          id: crypto.randomUUID(),
          name: newEmpName.trim(),
          role: newEmpRole,
          isActive: true,
          weeklyDefault: {}
        };

        // Save to storage
        const updatedEmployees = [...employees, newEmp];
        await saveEmployees(updatedEmployees);
        setEmployees(updatedEmployees); // Update local state if needed

        empId = newEmp.id;
        empName = newEmp.name;
        empRole = newEmp.role;
        isExtra = false;

      } else {
        // Extra Mode: Anonymous, just passing counts and type
        empId = 'extra-placeholder';
        empName = 'Extra';
        empRole = 'EXTRA';
        isExtra = true;
      }

      const sType = calculateServiceType(startTime, endTime);

      // Create segment (used for Employee row, ignored for Extra logic in parent but structure needed)
      const newShift: Shift = {
        date: selectedDate,
        type: 'travail',
        serviceType: sType,
        segments: [{
          type: 'horaire',
          start: startTime,
          end: endTime,
        }]
      };

      onSave({
        employeeId: empId,
        employeeName: empName,
        employeeRole: empRole,
        isExtra,
        date: selectedDate,
        shift: newShift,
        extraCount: isExtra ? extraCount : undefined,
        extraType: isExtra ? extraType : undefined
      });

      onClose();
    } catch (err) {
      console.error('Failed to submit:', err);
      alert('Erreur lors de la soumission du formulaire');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] font-sans">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="text-blue-600" /> Ajouter au planning
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setMode('new_employee')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-md transition-all ${mode === 'new_employee' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <UserPlus size={14} /> Nouvel Employé
          </button>
          <button
            onClick={() => setMode('extra')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-md transition-all ${mode === 'extra' ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users size={14} /> Extra / Renfort
          </button>
          <button
            onClick={() => setMode('long_absence')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-md transition-all ${mode === 'long_absence' ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <CalendarDays size={14} /> Absence Longue
          </button>
        </div>

        <div className="space-y-5">

          {/* --- TAB 1: NEW EMPLOYEE --- */}
          {mode === 'new_employee' && (
            <>
              <div className="bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-md text-sm">
                Crée une fiche employé et l'ajoute au planning.
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nom de l'employé <span className="text-red-500">*</span></label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-400"
                  placeholder="Ex: Thomas Durand"
                  value={newEmpName}
                  onChange={e => setNewEmpName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Poste <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    value={newEmpRole}
                    onChange={e => setNewEmpRole(e.target.value)}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {/* --- TAB 2: EXTRA --- */}
          {mode === 'extra' && (
            <>
              <div className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-md text-sm">
                Ajoute un nombre défini de renforts pour impacter les effectifs (KPI) sans créer de ligne dans le tableau.
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Type de renfort <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    value={extraType}
                    onChange={e => setExtraType(e.target.value as any)}
                  >
                    <option value="Hôtesse LBE">Hôtesse LBE</option>
                    <option value="Brigad Plage">Brigad Plage</option>
                    <option value="Agent de sécurité">Agent de sécurité</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nombre de renforts <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={extraCount}
                  onChange={e => setExtraCount(parseInt(e.target.value) || 1)}
                />
              </div>
            </>
          )}

          {/* --- TAB 3: LONG ABSENCE --- */}
          {mode === 'long_absence' && (
            <>
              <div className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-md text-sm">
                Applique un code d'absence (CP, AM, etc.) sur une plage de dates pour un employé existant.
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Employé <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    value={selectedEmpId}
                    onChange={e => setSelectedEmpId(e.target.value)}
                  >
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Type d'absence <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    value={absenceType}
                    onChange={e => setAbsenceType(e.target.value)}
                  >
                    {ABSENCE_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date Début</label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date Fin</label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* --- COMMON FIELDS (For Single Shift Modes) --- */}
          {mode !== 'long_absence' && (
            <>
              {/* Date Field - ONLY for Extra Mode based on screenshots */}
              {mode === 'extra' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-sm capitalize focus:ring-2 focus:ring-purple-500 outline-none appearance-none"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                    >
                      {weekDates.map(d => (
                        <option key={d} value={d}>
                          {formatFrenchDate(d)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase mb-1"><Clock size={12} /> Début</label>
                    <div className="relative">
                      <input
                        type="time"
                        className={`w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 outline-none ${mode === 'extra' ? 'focus:ring-purple-500' : 'focus:ring-blue-500'}`}
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase mb-1"><Clock size={12} /> Fin</label>
                    <div className="relative">
                      <input
                        type="time"
                        className={`w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 outline-none ${mode === 'extra' ? 'focus:ring-purple-500' : 'focus:ring-blue-500'}`}
                        value={endTime}
                        onChange={e => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-center mt-3">
                  <span className="text-xs text-slate-400 italic">
                    {startTime < "16:00" ? (endTime >= "16:00" ? "Compté en Midi & Soir" : "Compté en Midi") : "Compté en Soir"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className={`flex-1 py-3 rounded-lg text-white font-bold shadow-sm transition-colors ${mode === 'extra' ? 'bg-purple-600 hover:bg-purple-700' :
                mode === 'long_absence' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {mode === 'extra' ? 'Ajouter Renfort' :
              mode === 'long_absence' ? 'Appliquer Absences' :
                'Créer Employé'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddShiftModal;
