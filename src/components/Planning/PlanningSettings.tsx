import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Edit2, Save, GripVertical } from 'lucide-react';
import { Template, ShiftServiceType, TimeSlot, ABSENCE_TYPES } from './types';
import { planningApi } from '../../lib/api';

interface PlanningSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    onDataChanged?: (options?: { applyWeeklyDefaults?: boolean }) => void;
    employees: any[];
    roles: { id: string, label: string }[];
    canManageGlobalTypes?: boolean;
}

type PlanningSettingsPayload = {
    weeklyDefaults?: Record<string, Record<string, string>>;
    absenceCodes?: string[];
    [key: string]: any;
};

const PASTEL_COLORS = ['#60b4ff', '#c7d0e9', '#ffe39b', '#7fd13b', '#94efe3', '#ff0000', '#F5DCCF'];
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const PlanningSettings: React.FC<PlanningSettingsProps> = ({ isOpen, onClose, onDataChanged, roles, employees, canManageGlobalTypes = false }) => {
    const [activeTab, setActiveTab] = useState<'templates' | 'defaults' | 'absences' | 'order'>('templates');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [settingsPayload, setSettingsPayload] = useState<PlanningSettingsPayload>({});

    const [selectedRole, setSelectedRole] = useState<string>('GÉNÉRAL');
    const [editingTplId, setEditingTplId] = useState<string | null>(null);
    const [newTplName, setNewTplName] = useState('');
    const [newTplService, setNewTplService] = useState<ShiftServiceType>('midi+soir');
    const [newTplSlots, setNewTplSlots] = useState<TimeSlot[]>([{ start: '10:00', end: '15:00' }]);
    const [newTplColor, setNewTplColor] = useState(PASTEL_COLORS[6]);

    const [weeklyDefaults, setWeeklyDefaults] = useState<Record<string, Record<string, string>>>({});
    const [absenceCodes, setAbsenceCodes] = useState<string[]>([...ABSENCE_TYPES]);
    const [newAbsenceCode, setNewAbsenceCode] = useState('');
    const [extraTypes, setExtraTypes] = useState<string[]>(['Hôtesse LBE', 'Agent de sécurité', 'Extra Service', 'Extra Cuisine']);
    const [newExtraType, setNewExtraType] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);
    const [rolesOrder, setRolesOrder] = useState<string[]>([]);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    const orderedRolesForDisplay = useMemo(() => {
        if (!Array.isArray(roles) || roles.length === 0) return [] as { id: string; label: string }[];
        if (!Array.isArray(rolesOrder) || rolesOrder.length === 0) return [...roles];

        const ordered = rolesOrder
            .map((id) => roles.find((r) => r.id === id))
            .filter((r): r is { id: string; label: string } => Boolean(r));
        const remaining = roles.filter((r) => !rolesOrder.includes(r.id));
        return [...ordered, ...remaining];
    }, [roles, rolesOrder]);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!roles || roles.length === 0) return;
        if (selectedRole === 'GÉNÉRAL') return;
        const exists = roles.some((r) => r.id === selectedRole);
        if (!exists) setSelectedRole(roles[0].id);
    }, [roles, selectedRole]);

    const loadData = async () => {
        try {
            const [tplData, rawSettings] = await Promise.all([
                planningApi.getTemplates(),
                planningApi.getSettings(),
            ]);
            setTemplates(Array.isArray(tplData) ? tplData : []);

            const settings = (rawSettings && typeof rawSettings === 'object') ? rawSettings : {};
            const nextDefaults = (settings.weeklyDefaults && typeof settings.weeklyDefaults === 'object')
                ? settings.weeklyDefaults
                : {};
            const nextAbsences = Array.isArray(settings.absenceCodes) && settings.absenceCodes.length > 0
                ? settings.absenceCodes.map((c: any) => String(c)).filter(Boolean)
                : [...ABSENCE_TYPES];
            const nextExtraTypes = Array.isArray(settings.extraTypes) && settings.extraTypes.length > 0
                ? settings.extraTypes.map((c: any) => String(c)).filter(Boolean)
                : ['Hôtesse LBE', 'Agent de sécurité', 'Extra Service', 'Extra Cuisine'];
            const nextRolesOrder = Array.isArray(settings.rolesOrder) ? Array.from(new Set(settings.rolesOrder.map((v: any) => String(v)))) : [];

            setSettingsPayload(settings);
            setWeeklyDefaults(nextDefaults);
            setAbsenceCodes(nextAbsences);
            setExtraTypes(nextExtraTypes);
            setRolesOrder(nextRolesOrder);
        } catch (e) {
            console.error('Failed to load planning settings', e);
        }
    };

    const persistSettings = async (nextDefaults: Record<string, Record<string, string>>, nextAbsences: string[], nextExtraTypes: string[], nextRolesOrder?: string[]) => {
        try {
            setSavingSettings(true);
            const payload: PlanningSettingsPayload = {
                ...settingsPayload,
                weeklyDefaults: nextDefaults,
                absenceCodes: nextAbsences,
                extraTypes: nextExtraTypes,
                rolesOrder: nextRolesOrder ?? rolesOrder,
            };
            await planningApi.saveSettings(payload);
            setSettingsPayload(payload);
            onDataChanged?.({ applyWeeklyDefaults: true });
        } catch (e) {
            console.error('Failed to save planning settings', e);
        } finally {
            setSavingSettings(false);
        }
    };

    const resetTemplateForm = () => {
        setEditingTplId(null);
        setNewTplName('');
        setNewTplService('midi+soir');
        setNewTplSlots([{ start: '10:00', end: '15:00' }]);
        setNewTplColor(PASTEL_COLORS[6]);
    };

    const handleSaveTemplate = async () => {
        if (!newTplName.trim()) return;
        try {
            let updated: Template[];
            if (editingTplId) {
                updated = templates.map((t) =>
                    t.id === editingTplId
                        ? {
                            ...t,
                            id: editingTplId,
                            role: selectedRole,
                            name: newTplName.trim(),
                            serviceType: newTplService,
                            slots: newTplSlots,
                            color: newTplColor,
                        }
                        : t
                );
            } else {
                const newTpl: Template = {
                    id: crypto.randomUUID(),
                    name: newTplName.trim(),
                    role: selectedRole,
                    serviceType: newTplService,
                    slots: newTplSlots,
                    color: newTplColor,
                };
                updated = [...templates, newTpl];
            }

            await planningApi.saveTemplates(updated);
            setTemplates(updated);
            resetTemplateForm();
            onDataChanged?.();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Supprimer ce modèle ?')) return;
        try {
            const updated = templates.filter((t) => t.id !== id);
            await planningApi.saveTemplates(updated);
            setTemplates(updated);
            if (editingTplId === id) resetTemplateForm();
            onDataChanged?.();
        } catch (e) {
            console.error(e);
        }
    };

    const visibleTemplates = templates.filter((t) => t.role === selectedRole);

    const employeesForSelectedRole = useMemo(() => {
        return (Array.isArray(employees) ? employees : []).filter((e: any) => String(e?.position || '') === selectedRole);
    }, [employees, selectedRole]);

    const getTemplateOptionsForRole = (roleId: string) => {
        return templates.filter((t) => t.role === roleId || t.role === 'GÉNÉRAL');
    };

    const updateDefaultForEmployeeDay = (employeeId: string, dayIndex: number, value: string) => {
        const dayKey = String(dayIndex);
        setWeeklyDefaults((prev) => ({
            ...prev,
            [employeeId]: {
                ...(prev[employeeId] || {}),
                [dayKey]: value,
            },
        }));
    };

    const addAbsenceCode = () => {
        const code = newAbsenceCode.trim();
        if (!code) return;
        if (absenceCodes.includes(code)) return;
        setAbsenceCodes((prev) => [...prev, code]);
        setNewAbsenceCode('');
    };

    const removeAbsenceCode = (code: string) => {
        setAbsenceCodes((prev) => prev.filter((c) => c !== code));
    };

    const addExtraType = () => {
        const code = newExtraType.trim();
        if (!code) return;
        if (extraTypes.includes(code)) return;
        setExtraTypes((prev) => [...prev, code]);
        setNewExtraType('');
    };

    const removeExtraType = (code: string) => {
        setExtraTypes((prev) => prev.filter((c) => c !== code));
    };

    const handleDropRoleAt = (targetIdx: number) => {
        if (dragIdx === null || dragIdx === targetIdx) {
            setDragIdx(null);
            setDragOverIdx(null);
            return;
        }

        const ids = orderedRolesForDisplay.map((r) => r.id);
        const [removed] = ids.splice(dragIdx, 1);
        ids.splice(targetIdx, 0, removed);
        setRolesOrder(ids);
        setDragIdx(null);
        setDragOverIdx(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                <div className="p-4 md:p-5 border-b flex justify-between items-center bg-slate-50 shrink-0">
                    <h2 className="text-xl font-bold text-slate-800">Paramètres</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X size={20} /></button>
                </div>

                <div className="flex border-b bg-white overflow-x-auto shrink-0 scrollbar-hide">
                    <button className={`px-6 py-4 font-medium text-sm uppercase tracking-wide whitespace-nowrap ${activeTab === 'templates' ? 'border-b-2 border-[#4AA3A2] text-[#4AA3A2] bg-[#4AA3A2]/5' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setActiveTab('templates')}>Modèles Horaires</button>
                    <button className={`px-6 py-4 font-medium text-sm uppercase tracking-wide whitespace-nowrap ${activeTab === 'defaults' ? 'border-b-2 border-[#4AA3A2] text-[#4AA3A2] bg-[#4AA3A2]/5' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setActiveTab('defaults')}>Défauts Hebdo</button>
                    {canManageGlobalTypes && (
                        <button className={`px-6 py-4 font-medium text-sm uppercase tracking-wide whitespace-nowrap ${activeTab === 'absences' ? 'border-b-2 border-[#4AA3A2] text-[#4AA3A2] bg-[#4AA3A2]/5' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setActiveTab('absences')}>Gestion Absences</button>
                    )}
                    <button className={`px-6 py-4 font-medium text-sm uppercase tracking-wide whitespace-nowrap ${activeTab === 'order' ? 'border-b-2 border-[#4AA3A2] text-[#4AA3A2] bg-[#4AA3A2]/5' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setActiveTab('order')}>Ordre d'Affichage</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 md:p-6 bg-slate-50/70">
                    {(activeTab === 'templates' || activeTab === 'defaults') && (
                        <div className="flex flex-wrap gap-2 pb-1 mb-5">
                            <button
                                onClick={() => { setSelectedRole('GÉNÉRAL'); resetTemplateForm(); }}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${selectedRole === 'GÉNÉRAL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                            >
                                GÉNÉRAL
                            </button>
                            {roles.map((role) => (
                                <button
                                    key={role.id}
                                    onClick={() => { setSelectedRole(role.id); resetTemplateForm(); }}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${selectedRole === role.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                                >
                                    {role.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[540px]">
                            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                                <div className="p-4 bg-slate-50 border-b font-semibold text-slate-700 flex justify-between items-center">
                                    <span>MODÈLES EXISTANTS</span>
                                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full text-slate-600">{visibleTemplates.length}</span>
                                </div>
                                <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
                                    {visibleTemplates.map((t) => (
                                        <div key={t.id} className="border rounded-lg p-3 relative group bg-white hover:shadow-md border-slate-200">
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        setEditingTplId(t.id);
                                                        setNewTplName(t.name);
                                                        setNewTplService(t.serviceType);
                                                        setNewTplSlots(t.slots);
                                                        setNewTplColor(t.color || PASTEL_COLORS[6]);
                                                    }}
                                                    className="text-blue-500 hover:bg-blue-100 p-1.5 rounded bg-white shadow-sm"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => handleDeleteTemplate(t.id)} className="text-red-500 hover:bg-red-100 p-1.5 rounded bg-white shadow-sm">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#ccc' }} />
                                                <h4 className="font-bold text-slate-800 text-sm truncate">{t.name}</h4>
                                            </div>
                                            <div className="space-y-1">
                                                {t.slots.map((s, i) => (
                                                    <div key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded inline-block mr-1">
                                                        {s.start} - {s.end}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                                <div className="p-4 bg-slate-50 border-b font-semibold text-slate-700">
                                    {editingTplId ? 'MODIFIER LE MODÈLE' : 'NOUVEAU MODÈLE'}
                                </div>
                                <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Nom du modèle</label>
                                        <input value={newTplName} onChange={(e) => setNewTplName(e.target.value)} className="w-full border rounded px-3 py-2 text-sm outline-none focus:border-black" placeholder="Ex: Matin, Soir, Coupure..." />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Service</label>
                                        <select value={newTplService} onChange={(e) => setNewTplService(e.target.value as ShiftServiceType)} className="w-full border rounded px-3 py-2 text-sm outline-none focus:border-black">
                                            <option value="midi+soir">Midi + Soir</option>
                                            <option value="midi">Midi</option>
                                            <option value="soir">Soir</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Couleur</label>
                                        <div className="flex flex-wrap gap-2">
                                            {PASTEL_COLORS.map((c) => (
                                                <button key={c} onClick={() => setNewTplColor(c)} className={`w-8 h-8 rounded-full border-2 ${newTplColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Horaires</label>
                                        <div className="space-y-2">
                                            {newTplSlots.map((slot, i) => (
                                                <div key={i} className="flex gap-2 items-center">
                                                    <input type="time" value={slot.start} onChange={(e) => { const n = [...newTplSlots]; n[i].start = e.target.value; setNewTplSlots(n); }} className="border rounded px-2 py-1 text-sm flex-1 outline-none" />
                                                    <span className="text-slate-400">-</span>
                                                    <input type="time" value={slot.end} onChange={(e) => { const n = [...newTplSlots]; n[i].end = e.target.value; setNewTplSlots(n); }} className="border rounded px-2 py-1 text-sm flex-1 outline-none" />
                                                    {newTplSlots.length > 1 && (
                                                        <button onClick={() => { const n = [...newTplSlots]; n.splice(i, 1); setNewTplSlots(n); }} className="text-slate-400 hover:text-red-500 p-1"><X size={16} /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => setNewTplSlots([...newTplSlots, { start: '18:00', end: '23:00' }])} className="text-xs text-blue-600 font-bold mt-2 flex items-center gap-1"><Plus size={12} /> Ajouter plage</button>
                                    </div>
                                </div>
                                <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
                                    {editingTplId && <button onClick={resetTemplateForm} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded font-semibold">Annuler</button>}
                                    <button onClick={handleSaveTemplate} className="px-4 py-2 text-sm bg-[#4AA3A2] text-white hover:brightness-95 rounded font-semibold">{editingTplId ? 'Mettre à jour' : 'Créer'}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'defaults' && (
                        <div className="space-y-5">
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                                <h3 className="text-lg font-bold text-slate-800">Défauts Hebdomadaires</h3>
                                <p className="text-sm text-slate-500 mt-1">Configure les horaires par défaut de chaque employé. Les modèles viennent de Modèles Horaires et se remplissent automatiquement dans le planning.</p>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[980px]">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="p-3 text-left text-slate-600 font-semibold sticky left-0 bg-slate-50 z-10">Employé ({selectedRole})</th>
                                                {DAYS.map((day) => (
                                                    <th key={day} className="p-3 text-center text-slate-600 font-semibold">{day}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {employeesForSelectedRole.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="p-6 text-center text-slate-400 italic">Aucun employé pour ce poste.</td>
                                                </tr>
                                            ) : employeesForSelectedRole.map((emp: any) => {
                                                const employeeName = `${String(emp?.first_name || '').trim()} ${String(emp?.last_name || '').trim()}`.trim() || String(emp?.name || 'Employé');
                                                const empDefaults = weeklyDefaults[String(emp.id)] || {};
                                                const options = getTemplateOptionsForRole(String(emp?.position || selectedRole));
                                                return (
                                                    <tr key={String(emp.id)} className="hover:bg-slate-50/60">
                                                        <td className="p-3 text-slate-800 font-semibold sticky left-0 bg-white z-10">{employeeName}</td>
                                                        {DAYS.map((_, dayIdx) => (
                                                            <td key={`${emp.id}-${dayIdx}`} className="p-2">
                                                                <select
                                                                    value={empDefaults[String(dayIdx)] || 'REPOS'}
                                                                    onChange={(e) => updateDefaultForEmployeeDay(String(emp.id), dayIdx, e.target.value)}
                                                                    className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:border-black"
                                                                >
                                                                    <option value="REPOS">REPOS</option>
                                                                    {options.map((t) => (
                                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 flex justify-end">
                                    <button
                                        onClick={() => persistSettings(weeklyDefaults, absenceCodes, extraTypes)}
                                        disabled={savingSettings}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4AA3A2] text-white font-semibold hover:brightness-95 disabled:opacity-60"
                                    >
                                        <Save size={16} /> Enregistrer les défauts
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {canManageGlobalTypes && activeTab === 'absences' && (
                        <div className="space-y-5">
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                                <h3 className="text-lg font-bold text-slate-800">Gestion Absences</h3>
                                <p className="text-sm text-slate-500 mt-1">Gérez les codes d'absence disponibles dans l'éditeur de shift.</p>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 mb-3">Types d'absence</h4>
                                <div className="flex flex-wrap gap-2">
                                    {absenceCodes.map((code) => (
                                        <span key={code} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-300 text-sm bg-slate-50 text-slate-700">
                                            {code}
                                            <button onClick={() => removeAbsenceCode(code)} className="text-slate-400 hover:text-red-500">
                                                <Trash2 size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        value={newAbsenceCode}
                                        onChange={(e) => setNewAbsenceCode(e.target.value)}
                                        placeholder="Ajouter un code (ex: RTT)"
                                        className="flex-1 border rounded px-3 py-2 text-sm outline-none focus:border-black"
                                    />
                                    <button onClick={addAbsenceCode} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold">
                                        <Plus size={14} /> Ajouter
                                    </button>
                                </div>
                                </div>

                                <div className="pt-4 border-t border-slate-200">
                                    <h4 className="text-sm font-bold text-slate-700 mb-3">Types de renfort</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {extraTypes.map((code) => (
                                            <span key={code} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-300 text-sm bg-slate-50 text-slate-700">
                                                {code}
                                                <button onClick={() => removeExtraType(code)} className="text-slate-400 hover:text-red-500">
                                                    <Trash2 size={14} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                                        <input
                                            value={newExtraType}
                                            onChange={(e) => setNewExtraType(e.target.value)}
                                            placeholder="Ajouter un type (ex: Vigile VIP)"
                                            className="flex-1 border rounded px-3 py-2 text-sm outline-none focus:border-black"
                                        />
                                        <button onClick={addExtraType} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold">
                                            <Plus size={14} /> Ajouter
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-200 flex justify-end">
                                    <button
                                        onClick={() => persistSettings(weeklyDefaults, absenceCodes, extraTypes)}
                                        disabled={savingSettings}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#4AA3A2] text-white font-semibold hover:brightness-95 disabled:opacity-60"
                                    >
                                        <Save size={16} /> Enregistrer
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'order' && (
                        <div className="space-y-5">
                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                                <h3 className="text-lg font-bold text-slate-800">Ordre d'Affichage des Postes</h3>
                                <p className="text-sm text-slate-500 mt-1">Glissez et déposez les postes pour définir leur ordre d'affichage dans le planning.</p>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                                {orderedRolesForDisplay.map((role, idx) => (
                                    <div
                                        key={role.id}
                                        draggable
                                        onDragStart={() => setDragIdx(idx)}
                                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                                        onDrop={() => handleDropRoleAt(idx)}
                                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-grab active:cursor-grabbing select-none transition-all ${dragOverIdx === idx ? 'border-[#4AA3A2] bg-[#4AA3A2]/10 scale-[1.01] shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'} ${dragIdx === idx ? 'opacity-40' : 'opacity-100'}`}
                                    >
                                        <GripVertical size={16} className="text-slate-400 shrink-0" />
                                        <span className="font-semibold text-slate-700 flex-1">{role.label}</span>
                                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">#{idx + 1}</span>
                                    </div>
                                ))}
                                {roles.length === 0 && (
                                    <p className="text-slate-400 text-sm text-center py-6 italic">Aucun poste configuré. Ajoutez des postes dans le module Employés.</p>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => {
                                        const orderedRoles = orderedRolesForDisplay.map((r) => r.id);
                                        persistSettings(weeklyDefaults, absenceCodes, extraTypes, orderedRoles);
                                        setRolesOrder(orderedRoles);
                                    }}
                                    disabled={savingSettings}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#4AA3A2] text-white font-semibold hover:brightness-95 disabled:opacity-60"
                                >
                                    <Save size={16} /> {savingSettings ? 'Enregistrement...' : "Enregistrer l'ordre"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlanningSettings;
