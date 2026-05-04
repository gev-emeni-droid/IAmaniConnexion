import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check, Clock, Save, RotateCcw, CalendarDays, Palette, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { Employee, Template, STANDARD_ROLES, ShiftServiceType, TimeSlot, ABSENCE_TYPES, LongAbsence } from '../types';
import {
  getEmployees, getTemplates, saveEmployees, updateTemplate, addTemplate, deleteTemplate,
  getRoles, addRole, updateRole, saveRole, deleteRole, saveRoleDisplayOrder,
  getLongAbsences, saveLongAbsences, saveLongAbsence, addLongAbsence, deleteLongAbsence,
  getTheme, saveTheme, deleteEmployee, updateEmployeeDetails, updateEmployeeWeeklyDefault
} from '../services/storage';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
  onThemeChanged?: (color: string) => void;
}

const PASTEL_COLORS = [
  '#60b4ff', // Bleu clair
  '#c7d0e9', // Lilas
  '#ffe39b', // Jaune clair
  '#7fd13b', // Vert
  '#94efe3', // Cyan
  '#ff0000', // Rouge
  '#F5DCCF', // Rose pastelle
];

const THEME_COLORS = [
  '#4AA3A2', '#A7E0E0', '#212E53', '#F4CFDF',
  '#C08493', '#1C0F12', '#D4C2A1', '#A1A27E',
  '#FFFFFF', '#C1D5AF', '#88C7BC', '#5FACD3'
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onDataChanged, onThemeChanged }) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'templates' | 'defaults' | 'roles' | 'absences' | 'theme'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [roles, setRoles] = useState<{ id: string, label: string }[]>([]);
  const [longAbsences, setLongAbsences] = useState<LongAbsence[]>([]);

  // -- Theme Tab --
  const [currentTheme, setCurrentTheme] = useState('#4AA3A2');


  // -- Employee Tab --
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Edit Employee State
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpRole, setEditEmpRole] = useState('');

  const [newRoleName, setNewRoleName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleLabel, setEditRoleLabel] = useState('');
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState<{ id: string, count: number } | null>(null);
  const [reassignRoleId, setReassignRoleId] = useState('');

  // -- Templates Tab --
  const [selectedRole, setSelectedRole] = useState<string>('GÉNÉRAL');
  const [editingTplId, setEditingTplId] = useState<string | null>(null); // Track if editing
  const [newTplName, setNewTplName] = useState('');
  const [newTplService, setNewTplService] = useState<ShiftServiceType>('midi+soir');
  const [newTplSlots, setNewTplSlots] = useState<TimeSlot[]>([{ start: '10:00', end: '15:00' }]);
  const [newTplColor, setNewTplColor] = useState(PASTEL_COLORS[6]); // Default Blue

  // -- Absences Tab --
  const [absEmpId, setAbsEmpId] = useState('');
  const [absType, setAbsType] = useState<string>(ABSENCE_TYPES[0]);
  const [absStart, setAbsStart] = useState('');
  const [absEnd, setAbsEnd] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const empsData = await getEmployees();
      const tplsData = await getTemplates();
      const absData = await getLongAbsences();
      const rolesData = await getRoles();
      const themeColor = await getTheme();

      setEmployees(Array.isArray(empsData) ? empsData : []);
      setTemplates(Array.isArray(tplsData) ? tplsData : []);
      setLongAbsences(Array.isArray(absData) ? absData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setCurrentTheme(themeColor);

      if (Array.isArray(rolesData) && rolesData.length > 0 && !newEmpRole) {
        setNewEmpRole(rolesData[0].id);
      }

      const finalEmpsData = Array.isArray(empsData) ? empsData : [];
      if (finalEmpsData.length > 0) {
        setAbsEmpId(finalEmpsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setEmployees([]);
      setTemplates([]);
      setLongAbsences([]);
      setRoles([]);
    }
  };

  const handleSaveTheme = async (color: string) => {
    try {
      await saveTheme(color);
      setCurrentTheme(color);
      onThemeChanged?.(color);
    } catch (err) {
      console.error('Failed to save theme:', err);
    }
  };

  // --- ROLES ---
  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await addRole(newRoleName.trim());
      setNewRoleName('');
      await loadData();
      onDataChanged?.();
    } catch (err) {
      console.error('Failed to add role:', err);
    }
  };
  const handleEditRoleStart = (id: string, label: string) => {
    setEditingRoleId(id);
    setEditRoleLabel(label);
  };
  const handleEditRoleSave = async () => {
    if (editingRoleId && editRoleLabel.trim()) {
      try {
        await updateRole(editingRoleId, editRoleLabel.trim());
        setEditingRoleId(null);
        await loadData();
        onDataChanged?.();
      } catch (err) {
        console.error('Failed to update role:', err);
      }
    }
  };
  const handleDeleteRoleClick = async (id: string) => {
    // Check usage-look for exact matches and also check all employee/template roles
    let usageCount = employees.filter(e => e.role === id).length + templates.filter(t => t.role === id).length;

    // Also check if there are employees/templates with similar role IDs (case-insensitive or variant)
    if (usageCount === 0) {
      const normalizedId = id.toLowerCase().trim();
      usageCount = employees.filter(e => e.role.toLowerCase().trim() === normalizedId).length +
        templates.filter(t => t.role.toLowerCase().trim() === normalizedId).length;
    }

    if (usageCount > 0) {
      setDeleteRoleConfirm({ id, count: usageCount });
      // Default reassign to first other role
      const other = roles.find(r => r.id !== id);
      if (other) setReassignRoleId(other.id);
    } else {
      // Direct deletion without confirmation if role is not in use
      try {
        await deleteRole(id);
        await loadData();
        alert('Poste supprimé avec succès !');
        onDataChanged?.();
      } catch (err) {
        console.error('Failed to delete role:', err);
        alert(`Erreur lors de la suppression du poste: ${err instanceof Error ? err.message : 'Erreur inconnue'} `);
      }
    }
  };
  const confirmDeleteRole = async () => {
    if (deleteRoleConfirm && reassignRoleId) {
      try {
        await deleteRole(deleteRoleConfirm.id, reassignRoleId);
        setDeleteRoleConfirm(null);
        await loadData();
        onDataChanged?.();
      } catch (err) {
        console.error('Failed to delete role:', err);
      }
    }
  };

  const handleMoveRole = async (roleId: string, direction: 'up' | 'down') => {
    const index = roles.findIndex(r => r.id === roleId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= roles.length) return;

    const nextRoles = [...roles];
    const [moved] = nextRoles.splice(index, 1);
    nextRoles.splice(targetIndex, 0, moved);

    setRoles(nextRoles);

    try {
      await saveRoleDisplayOrder(nextRoles.map(r => r.id));
      onDataChanged?.();
    } catch (err) {
      console.error('Failed to save roles order:', err);
      await loadData();
      alert('Erreur lors de la sauvegarde de l\'ordre des postes');
    }
  };

  // --- EMPLOYEES ---
  const handleAddEmployee = async () => {
    if (!newEmpName) return;
    try {
      const newEmp: Employee = {
        id: crypto.randomUUID(),
        name: newEmpName,
        role: newEmpRole,
        weeklyDefault: {},
        isActive: true,
      };
      const updated = [...employees, newEmp];
      setEmployees(updated);
      await saveEmployees(updated);
      setNewEmpName('');
      onDataChanged?.();
    } catch (err) {
      console.error('Failed to add employee:', err);
      alert('Erreur lors de l\'ajout de l\'employé');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Supprimer cet employé ?\n\nAttention : cela le supprimera de TOUS les plannings existants.")) return;
    try {
      await deleteEmployee(id);
      await loadData(); // Recharger la liste des employés
      onDataChanged?.();
    } catch (err) {
      console.error('Failed to delete employee:', err);
      alert('Erreur lors de la suppression de l\'employé');
    }
  };

  const handleEditEmployeeStart = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setEditEmpName(emp.name);
    setEditEmpRole(emp.role);
  };

  const handleEditEmployeeSave = async () => {
    if (!editingEmpId || !editEmpName) return;
    try {
      // Import updateEmployeeDetails from reference if not in imports or use direct API logic?
      // Wait, we need to import updateEmployeeDetails from storage.
      // Since I cannot change imports easily with multi_replace if they are at the top, I'll rely on the fact that I will add it to the import list in a separate chunk.
      await updateEmployeeDetails(editingEmpId, editEmpName, editEmpRole);
      setEditingEmpId(null);
      await loadData();
      onDataChanged?.();
    } catch (err) {
      console.error('Failed to update employee:', err);
      alert('Erreur lors de la modification de l\'employé');
    }
  };

  // --- TEMPLATES ---

  const resetTemplateForm = () => {
    setEditingTplId(null);
    setNewTplName('');
    setNewTplService('midi+soir');
    setNewTplSlots([{ start: '10:00', end: '15:00' }]);
    setNewTplColor(PASTEL_COLORS[6]);
  };

  const handleEditTemplateStart = (tpl: Template) => {
    setEditingTplId(tpl.id);
    setNewTplName(tpl.name);
    setNewTplService(tpl.serviceType);
    setNewTplSlots(tpl.slots && tpl.slots.length > 0 ? tpl.slots : [{ start: '10:00', end: '15:00' }]);
    setNewTplColor(tpl.color || '#ffffff');
    setSelectedRole(tpl.role);
  };

  const handleSaveTemplate = async () => {
    if (!newTplName) return alert("Nom du modèle requis");

    try {
      if (editingTplId) {
        const updatedTpl: Template = {
          id: editingTplId,
          role: selectedRole,
          name: newTplName,
          serviceType: newTplService,
          slots: newTplSlots,
          color: newTplColor
        };
        await updateTemplate(updatedTpl);
        const tplsData = await getTemplates();
        setTemplates(Array.isArray(tplsData) ? tplsData : []);
        resetTemplateForm();
        // Appeler immédiatement onDataChanged pour rafraîchir le planning
        onDataChanged?.();
      } else {
        const newTpl: Template = {
          id: crypto.randomUUID(),
          name: newTplName,
          role: selectedRole,
          serviceType: newTplService,
          slots: newTplSlots,
          color: newTplColor
        };

        const updated = [...templates, newTpl];
        setTemplates(updated);

        // Use atomic addTemplate instead of saveTemplates(all)
        await addTemplate(newTpl);

        // Removed auto-reload to prevent "disappearing" on race condition
        // const tplsData = await getTemplates();
        // setTemplates(Array.isArray(tplsData) ? tplsData : []);

        resetTemplateForm();
        onDataChanged?.();
      }
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Erreur lors de la sauvegarde du modèle');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const usageCount = employees.filter(e => e.weeklyDefault && Object.values(e.weeklyDefault).includes(id)).length;

    try {
      if (usageCount > 0) {
        if (!confirm(`Ce modèle est utilisé par défaut pour ${usageCount} employé(s).Si vous le supprimez, leurs jours deviendront "REPOS".Continuer ? `)) {
          return;
        }
        await deleteTemplate(id, 'repos');
      } else {
        if (!confirm("Supprimer ce modèle ?")) return;
        await deleteTemplate(id);
      }
      await loadData();
      if (editingTplId === id) resetTemplateForm();
      onDataChanged?.();
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Erreur lors de la suppression du modèle');
    }
  };

  // --- DEFAULTS ---
  const handleUpdateDefault = async (empId: string, dayIndex: string, tplId: string) => {
    try {
      // Update locally first for instant feedback
      const updatedEmployees = employees.map(emp =>
        emp.id === empId
          ? { ...emp, weeklyDefault: { ...emp.weeklyDefault, [dayIndex]: tplId } }
          : emp
      );
      setEmployees(updatedEmployees);

      // Then save to API
      await updateEmployeeWeeklyDefault(empId, dayIndex, tplId);
      onDataChanged?.();
    } catch (err) {
      console.error('Failed to update default:', err);
      // Reload on error
      const empsData = await getEmployees();
      setEmployees(Array.isArray(empsData) ? empsData : []);
    }
  };

  // --- ABSENCES ---
  const handleAddAbsence = async () => {
    if (!absEmpId || !absStart || !absEnd) return alert("Veuillez remplir tous les champs");
    if (absStart > absEnd) return alert("Date de fin invalide");

    try {
      await addLongAbsence({
        employeeId: absEmpId,
        startDate: absStart,
        endDate: absEnd,
        type: absType
      });
      await loadData();
      // Reset dates but keep employee selected
      setAbsStart('');
      setAbsEnd('');
      onDataChanged?.();
    } catch (err) {
      console.error('Failed to add absence:', err);
      alert('Erreur lors de l\'ajout de l\'absence');
    }
  };

  const handleDeleteAbsence = async (id: string) => {
    if (confirm("Supprimer cette absence ? Cela remettra le planning par défaut sur cette période.")) {
      try {
        await deleteLongAbsence(id);
        await loadData();
        onDataChanged?.();
      } catch (err) {
        console.error('Failed to delete absence:', err);
        alert('Erreur lors de la suppression de l\'absence');
      }
    }
  };

  if (!isOpen) return null;

  // Normalize roles for comparison (handle "ENCADREMENT /" vs "ENCADREMENT")
  const normalizeRole = (r: string) => r.trim().replace(/\/$/, '').trim();
  const visibleTemplates = templates.filter(t => normalizeRole(t.role) === normalizeRole(selectedRole));
  const getDropdownTemplates = (role: string) => {
    return templates.filter(t => normalizeRole(t.role) === 'GENERAL' || normalizeRole(t.role) === normalizeRole(role));
  };
  const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-xl font-bold text-slate-800">Paramètres</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Tabs-Fixed Layout */}
        <div className="flex border-b bg-white overflow-x-auto shrink-0 scrollbar-hide">
          {['theme', 'roles', 'employees', 'templates', 'defaults', 'absences'].map(tab => {
            let label = '';
            if (tab === 'theme') label = 'Apparence';
            if (tab === 'roles') label = 'Gestion Postes';
            if (tab === 'employees') label = 'Liste Employés';
            if (tab === 'templates') label = 'Modèles Horaires';
            if (tab === 'defaults') label = 'Défauts Hebdo';
            if (tab === 'absences') label = 'Gestion Absences';
            return (
              <button
                key={tab}
                className={`px-6 py-4 font-medium text-sm uppercase tracking-wide transition-colors whitespace-nowrap shrink-0 ${activeTab === tab ? 'border-b-2 border-brand text-brand bg-brand/5' : 'text-slate-500 hover:bg-slate-50'}`}
                style={activeTab === tab ? { borderColor: currentTheme, color: currentTheme, backgroundColor: `${currentTheme} 10` } : {}}
                onClick={() => {
                  setActiveTab(tab as any);
                  if (tab === 'templates' || tab === 'defaults') setSelectedRole('GÉNÉRAL');
                  resetTemplateForm();
                }}
              >
                {tab === 'theme' && <Palette size={16} className="inline mr-2 -mt-0.5" />}
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">

          {/* --- TAB:THEME --- */}
          {activeTab === 'theme' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Palette className="text-slate-400" size={20} />
                  Couleur Principale
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Choisissez la couleur principale de l'interface. Cette couleur sera utilisée pour les boutons, les titres et les éléments actifs.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {THEME_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => handleSaveTheme(color)}
                      className={`h-24 rounded-xl flex items-center justify-center transition-all hover:scale-105 shadow-sm border-2 ${currentTheme === color ? 'ring-2 ring-offset-2' : 'border-transparent hover:shadow-md'}`}
                      style={{
                        backgroundColor: color,
                        borderColor: currentTheme === color ? color : 'transparent',
                        outlineColor: color
                      }}
                    >
                      {currentTheme === color && (
                        <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                          <Check className="text-white drop-shadow-md" size={32} strokeWidth={3} />
                        </div>
                      )}
                      <span className="absolute bottom-2 text-[10px] font-mono text-white/80 bg-black/20 px-1.5 rounded uppercase tracking-wider">
                        {color}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* --- TAB:ROLES --- */}
          {activeTab === 'roles' && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* List Roles */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-600 border-b">
                    <tr>
                      <th className="p-3 text-left">Nom du poste</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((r, index) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-3">
                          {editingRoleId === r.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={editRoleLabel}
                                onChange={e => setEditRoleLabel(e.target.value)}
                                className="border rounded px-2 py-1"
                              />
                              <button onClick={handleEditRoleSave} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={16} /></button>
                              <button onClick={() => setEditingRoleId(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X size={16} /></button>
                            </div>
                          ) : (
                            <span className="font-bold text-slate-700">{r.label}</span>
                          )}
                        </td>
                        <td className="p-3 text-right flex justify-end gap-2">
                          <button
                            onClick={() => handleMoveRole(r.id, 'up')}
                            disabled={index === 0}
                            className="text-slate-400 hover:text-slate-700 p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Monter"
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            onClick={() => handleMoveRole(r.id, 'down')}
                            disabled={index === roles.length - 1}
                            className="text-slate-400 hover:text-slate-700 p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Descendre"
                          >
                            <ArrowDown size={16} />
                          </button>
                          <button onClick={() => handleEditRoleStart(r.id, r.label)} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteRoleClick(r.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    {/* Add Role Row */}
                    <tr className="bg-blue-50/30">
                      <td className="p-3">
                        <input
                          placeholder="Nouveau poste..."
                          value={newRoleName}
                          onChange={e => setNewRoleName(e.target.value)}
                          className="w-full border border-blue-200 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={handleAddRole}
                          disabled={!newRoleName.trim()}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                        >
                          AJOUTER
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Delete Confirmation Modal */}
              {deleteRoleConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
                  <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                    <h4 className="font-bold text-lg mb-2">Suppression impossible</h4>
                    <p className="text-sm text-slate-600 mb-4">
                      Ce poste est utilisé par <strong>{deleteRoleConfirm.count}</strong> éléments.
                      Veuillez réassigner ces éléments avant de supprimer.
                    </p>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Remplacer par :</label>
                    <select
                      className="w-full border rounded p-2 mb-4"
                      value={reassignRoleId}
                      onChange={e => setReassignRoleId(e.target.value)}
                    >
                      {roles.filter(r => r.id !== deleteRoleConfirm.id).map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setDeleteRoleConfirm(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Annuler</button>
                      <button onClick={confirmDeleteRole} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Confirmer et Supprimer</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- TAB:EMPLOYEES --- */}
          {activeTab === 'employees' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5">
                    <label className="text-xs text-slate-500 mb-1 block">Nom complet</label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="Ex:Jean Dupont"
                      value={newEmpName}
                      onChange={e => setNewEmpName(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-5">
                    <label className="text-xs text-slate-500 mb-1 block">Poste</label>
                    <select
                      className="w-full border rounded px-3 py-2 text-sm bg-white"
                      value={newEmpRole}
                      onChange={e => setNewEmpRole(e.target.value)}
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      onClick={handleAddEmployee}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Ajouter
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                {/* Search Bar */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Search className="text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Rechercher un employé..."
                    className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-400 text-slate-700"
                    value={employeeSearch}
                    onChange={e => setEmployeeSearch(e.target.value)}
                  />
                </div>

                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 border-b">
                    <tr>
                      <th className="p-3">Nom</th>
                      <th className="p-3">Poste</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees
                      .filter(emp => {
                        const search = employeeSearch.toLowerCase();
                        const rLabel = roles.find(r => r.id === emp.role)?.label || emp.role;
                        return emp.name.toLowerCase().includes(search) || rLabel.toLowerCase().includes(search);
                      })
                      .map(emp => {
                        const rLabel = roles.find(r => r.id === emp.role)?.label || emp.role;
                        const isEditing = editingEmpId === emp.id;

                        return (
                          <tr key={emp.id} className={`border-b hover:bg-slate-50 last:border-0 ${isEditing ? 'bg-blue-50' : ''} `}>
                            <td className="p-3 font-medium text-slate-800">
                              {isEditing ? (
                                <input
                                  value={editEmpName}
                                  onChange={e => setEditEmpName(e.target.value)}
                                  className="w-full border border-blue-300 rounded px-2 py-1 text-sm"
                                  autoFocus
                                />
                              ) : (
                                emp.name
                              )}
                            </td>
                            <td className="p-3 text-slate-600">
                              {isEditing ? (
                                <select
                                  value={editEmpRole}
                                  onChange={e => setEditEmpRole(e.target.value)}
                                  className="w-full border border-blue-300 rounded px-2 py-1 text-sm bg-white"
                                >
                                  {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-semibold">{rLabel}</span>
                              )}
                            </td>
                            <td className="p-3 text-right flex justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button onClick={handleEditEmployeeSave} className="text-green-600 hover:bg-green-100 p-1.5 rounded" title="Enregistrer"><Check size={16} /></button>
                                  <button onClick={() => setEditingEmpId(null)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded" title="Annuler"><X size={16} /></button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => handleEditEmployeeStart(emp)} className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Modifier"><Edit2 size={16} /></button>
                                  <button
                                    onClick={() => handleDeleteEmployee(emp.id)}
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- TAB:TEMPLATES --- */}
          {activeTab === 'templates' && (
            <div className="space-y-6 h-full flex flex-col">
              <div className="flex flex-col gap-2 mb-2">
                <h3 className="text-lg font-bold text-slate-800">Modèles Horaires par Poste</h3>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mt-2">
                  <button
                    onClick={() => { setSelectedRole('GÉNÉRAL'); resetTemplateForm(); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${selectedRole === 'GÉNÉRAL'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      } `}
                  >
                    GÉNÉRAL
                  </button>
                  {roles.map(role => (
                    <button
                      key={role.id}
                      onClick={() => { setSelectedRole(role.id); resetTemplateForm(); }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${selectedRole === role.id
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        } `}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                {/* Left Col:Existing Templates */}
                <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b font-semibold text-slate-700 flex justify-between items-center">
                    <span>MODÈLES EXISTANTS ({selectedRole === 'GÉNÉRAL' ? 'GÉNÉRAL' : roles.find(r => r.id === selectedRole)?.label})</span>
                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full text-slate-600 self-center">{visibleTemplates.length}</span>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
                    {visibleTemplates.length === 0 ? (
                      <div className="col-span-full py-10 text-center text-slate-400 italic">
                        Aucun modèle défini pour {selectedRole === 'GÉNÉRAL' ? 'GÉNÉRAL' : roles.find(r => r.id === selectedRole)?.label}.
                      </div>
                    ) : (
                      visibleTemplates.map(t => (
                        <div
                          key={t.id}
                          className={`border rounded-lg p-3 relative group transition-all ${editingTplId === t.id ? 'ring-2 ring-blue-500 border-transparent shadow-md bg-blue-50' : 'border-slate-200 hover:shadow-md bg-white'} `}
                        >
                          {/* Buttons */}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditTemplateStart(t)}
                              className="text-blue-500 hover:bg-blue-100 p-1.5 rounded bg-white shadow-sm"
                              title="Modifier"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(t.id)}
                              className="text-red-500 hover:bg-red-100 p-1.5 rounded bg-white shadow-sm"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-4 h-4 rounded-full border border-slate-200 shadow-sm"
                              style={{ backgroundColor: t.color || '#fff' }}
                            />
                            <span className="font-bold text-slate-900 truncate">{t.name}</span>
                          </div>

                          <div className="flex gap-2 mb-2">
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700`}>
                              {t.serviceType}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {t.slots.map((s, i) => (
                              <div key={i} className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 p-1 rounded font-mono border border-slate-100">
                                <Clock size={12} /> {s.start} - {s.end}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Col:Create/Edit Form */}
                <div className={`rounded-lg shadow-lg flex flex-col p-5 transition-colors ${editingTplId ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-100'} `}>
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                    {editingTplId ? (
                      <>
                        <Edit2 className="bg-white/20 text-white rounded-full p-1" size={24} />
                        Modifier le modèle
                      </>
                    ) : (
                      <>
                        <Plus className="bg-white text-slate-900 rounded-full p-0.5" size={20} />
                        Nouveau modèle
                      </>
                    )}
                  </h4>
                  <p className="text-xs text-white/70 mb-4 uppercase font-bold tracking-wider">
                    Pour : {selectedRole === 'GÉNÉRAL' ? 'GÉNÉRAL' : roles.find(r => r.id === selectedRole)?.label}
                  </p>

                  <div className="space-y-4 flex-1">
                    <div>
                      <label className="text-xs font-semibold text-white/70 block mb-1">Nom du modèle</label>
                      <input
                        value={newTplName}
                        onChange={e => setNewTplName(e.target.value)}
                        className="w-full bg-black/20 border border-white/20 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-white outline-none text-white placeholder-white/30"
                        placeholder="ex:Service Coupure"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/70 block mb-1">Type de service</label>
                      <select
                        value={newTplService}
                        onChange={e => setNewTplService(e.target.value as ShiftServiceType)}
                        className="w-full bg-black/20 border border-white/20 rounded px-3 py-2 text-sm outline-none text-white [&>option]:text-slate-800"
                      >
                        <option value="midi">Midi</option>
                        <option value="soir">Soir</option>
                        <option value="midi+soir">Midi + Soir</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/70 block mb-2">Couleur par défaut</label>
                      <div className="flex flex-wrap gap-2">
                        {PASTEL_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewTplColor(c)}
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${newTplColor === c ? 'border-white' : 'border-transparent'} `}
                            style={{ backgroundColor: c }}
                          >
                            {newTplColor === c && <Check size={14} className="text-slate-800" />}
                          </button>
                        ))}
                      </div>
                      <div
                        className="mt-3 p-2 rounded text-slate-800 text-xs text-center font-bold"
                        style={{ backgroundColor: newTplColor }}
                      >
                        Aperçu
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/70 block mb-2">Tranches Horaires</label>
                      <div className="space-y-2">
                        {newTplSlots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={slot.start}
                              onChange={e => {
                                const up = [...newTplSlots];
                                up[idx].start = e.target.value;
                                setNewTplSlots(up);
                              }}
                              className="bg-black/20 border border-white/20 rounded px-2 py-1 text-sm text-center w-24 text-white placeholder-white/50"
                            />
                            <span className="text-white/50">-</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={e => {
                                const up = [...newTplSlots];
                                up[idx].end = e.target.value;
                                setNewTplSlots(up);
                              }}
                              className="bg-black/20 border border-white/20 rounded px-2 py-1 text-sm text-center w-24 text-white placeholder-white/50"
                            />
                            {newTplSlots.length > 1 && (
                              <button onClick={() => setNewTplSlots(newTplSlots.filter((_, i) => i !== idx))} className="text-white/50 hover:text-white">
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setNewTplSlots([...newTplSlots, { start: '18:00', end: '23:00' }])}
                        className="mt-2 text-xs text-white/80 hover:text-white font-medium flex items-center gap-1"
                      >
                        <Plus size={12} /> Ajouter une tranche
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    {editingTplId && (
                      <button
                        onClick={resetTemplateForm}
                        className="flex-1 bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <RotateCcw size={16} /> Annuler
                      </button>
                    )}
                    <button
                      onClick={handleSaveTemplate}
                      className={`flex-1 ${editingTplId ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 hover:bg-blue-500 text-white'} font-bold py-3 rounded-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2`}
                    >
                      {editingTplId ? <Save size={18} /> : <Plus size={18} />}
                      {editingTplId ? 'Mettre à jour' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB:DEFAULTS --- */}
          {activeTab === 'defaults' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-2 mb-4">
                <h3 className="text-lg font-bold text-slate-800">Horaires par Défaut Hebdomadaire</h3>
                <p className="text-sm text-slate-500">Configurez la semaine type de vos employés. Ces réglages seront utilisés pour tout nouveau planning.</p>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mt-2">
                  {STANDARD_ROLES.map(roleId => (
                    <button
                      key={roleId}
                      onClick={() => setSelectedRole(roleId)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${selectedRole === roleId
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        } `}
                    >
                      {roleId}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="p-4 text-left min-w-[200px] sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Employé ({selectedRole})</th>
                        {DAYS_SHORT.map(d => (
                          <th key={d} className="p-2 text-center w-[120px]">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.filter(e => e.role === selectedRole).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 italic">Aucun employé pour ce poste.</td>
                        </tr>
                      ) : (
                        employees.filter(e => e.role === selectedRole).map(emp => (
                          <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                              <div className="font-bold text-slate-800">{emp.name}</div>
                            </td>
                            {Array.from({ length: 7 }).map((_, i) => {
                              const currentVal = emp.weeklyDefault?.[i.toString()] || 'repos';
                              const isRepos = currentVal === 'repos';
                              return (
                                <td key={i} className="p-2">
                                  <select
                                    value={currentVal}
                                    onChange={(e) => handleUpdateDefault(emp.id, i.toString(), e.target.value)}
                                    className={`w-full text-xs border rounded p-1.5 outline-none cursor-pointer ${isRepos ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-white text-blue-700 border-blue-200 font-semibold shadow-sm'
                                      } `}
                                  >
                                    <option value="repos">REPOS</option>
                                    <optgroup label="Modèles">
                                      {getDropdownTemplates(emp.role).map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                      ))}
                                    </optgroup>
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB:ABSENCES --- */}
          {activeTab === 'absences' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              <div className="lg:col-span-2 flex flex-col min-h-0">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Absences Longue Durée</h3>
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex-1 overflow-y-auto">
                  {longAbsences.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 italic">
                      Aucune absence planifiée.
                    </div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b sticky top-0">
                        <tr>
                          <th className="p-3">Employé</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Début</th>
                          <th className="p-3">Fin</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {longAbsences.sort((a, b) => b.startDate.localeCompare(a.startDate)).map(abs => {
                          const emp = employees.find(e => e.id === abs.employeeId);
                          return (
                            <tr key={abs.id} className="hover:bg-slate-50">
                              <td className="p-3 font-medium text-slate-800">{emp?.name || 'Inconnu'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${abs.type === 'CP' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'} `}>
                                  {abs.type}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600">{format(parseISO(abs.startDate), 'dd/MM/yyyy')}</td>
                              <td className="p-3 text-slate-600">{format(parseISO(abs.endDate), 'dd/MM/yyyy')}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteAbsence(abs.id)}
                                  className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                  title="Supprimer (Rétablit le planning)"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="bg-red-50 rounded-lg p-5 h-fit border border-red-100">
                <h4 className="font-bold text-red-900 mb-4 flex items-center gap-2">
                  <CalendarDays size={18} /> Nouvelle Absence
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-red-800 mb-1">Employé</label>
                    <select
                      className="w-full border-red-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white"
                      value={absEmpId}
                      onChange={e => setAbsEmpId(e.target.value)}
                    >
                      {employees.filter(e => e.isActive).map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-red-800 mb-1">Type</label>
                    <select
                      className="w-full border-red-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white"
                      value={absType}
                      onChange={e => setAbsType(e.target.value)}
                    >
                      {ABSENCE_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-red-800 mb-1">Début</label>
                      <input type="date" value={absStart} onChange={e => setAbsStart(e.target.value)} className="w-full border-red-200 rounded px-2 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-800 mb-1">Fin</label>
                      <input type="date" value={absEnd} onChange={e => setAbsEnd(e.target.value)} className="w-full border-red-200 rounded px-2 py-2 text-sm" />
                    </div>
                  </div>
                  <button
                    onClick={handleAddAbsence}
                    className="w-full bg-red-600 text-white py-2 rounded font-bold text-sm hover:bg-red-700 mt-2 shadow-sm"
                  >
                    Ajouter Absence
                  </button>
                  <p className="text-[10px] text-red-600 italic mt-2 leading-tight">
                    Cela appliquera automatiquement ce code d'absence sur tous les plannings actifs concernés par ces dates.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-900 transition-colors font-medium"
          >
            Fermer
          </button>
        </div>
      </div >
    </div >
  );
};

export default SettingsModal;

