import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Edit2, Save, GripVertical, Check, Clock } from 'lucide-react';
import { Template, ShiftServiceType, TimeSlot, ABSENCE_TYPES } from './types';
import { planningApi } from '../../lib/api';
import { format, parseISO } from 'date-fns';

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
    const [activeTab, setActiveTab] = useState<'templates' | 'defaults' | 'absences' | 'longAbsences' | 'order'>('templates');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [settingsPayload, setSettingsPayload] = useState<PlanningSettingsPayload>({});

    const [selectedRole, setSelectedRole] = useState<string>('GÉNÉRAL');
    const [editingTplId, setEditingTplId] = useState<string | null>(null);
    const [newTplName, setNewTplName] = useState('');
    const [newTplService, setNewTplService] = useState<ShiftServiceType>('midi+soir');
    const [newTplSlots, setNewTplSlots] = useState<TimeSlot[]>([{ start: '10:00', end: '15:00' }]);
    const [newTplColor, setNewTplColor] = useState(PASTEL_COLORS[6]);

    const [weeklyDefaults, setWeeklyDefaults] = useState<Record<string, Record<string, string>>>({});
    const [absenceCodes, setAbsenceCodes] = useState<{ code: string; isFullDay: boolean; autoApply: boolean; color?: string }[]>([]);
    const [newAbsenceCode, setNewAbsenceCode] = useState('');
    const [newAbsenceColor, setNewAbsenceColor] = useState('#ffe39b');
    const [extraTypes, setExtraTypes] = useState<string[]>(['Hôtesse LBE', 'Agent de sécurité', 'Extra Service', 'Extra Cuisine']);
    const [newExtraType, setNewExtraType] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);
    const [rolesOrder, setRolesOrder] = useState<string[]>([]);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [changedDefaults, setChangedDefaults] = useState<Set<string>>(new Set());
    const [longAbsences, setLongAbsences] = useState<any[]>([]);
    const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
    const [editStart, setEditStart] = useState('');
    const [editEnd, setEditEnd] = useState('');
    const [isSavingAbsence, setIsSavingAbsence] = useState(false);
    const [isLoadingAbsences, setIsLoadingAbsences] = useState(false);

    const orderedRolesForDisplay = useMemo(() => {
        if (!Array.isArray(roles) || roles.length === 0) return [] as { id: string; label: string }[];
        if (!Array.isArray(rolesOrder) || rolesOrder.length === 0) return [...roles];

        const ordered = rolesOrder
            .map((id) => roles.find((r) => String(r.id) === String(id)))
            .filter((r): r is { id: string; label: string } => Boolean(r));
        const remaining = roles.filter((r) => !rolesOrder.includes(String(r.id)));
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
            const [tplData, rawSettings, absencesData] = await Promise.all([
                planningApi.getTemplates(),
                planningApi.getSettings(),
                planningApi.getAbsences()
            ]);
            setTemplates(Array.isArray(tplData) ? tplData : []);
            setLongAbsences(Array.isArray(absencesData) ? absencesData : []);

            const settings = (rawSettings && typeof rawSettings === 'object') ? rawSettings : {};
            const nextDefaults = (settings.weeklyDefaults && typeof settings.weeklyDefaults === 'object')
                ? settings.weeklyDefaults
                : {};
            const nextAbsences = Array.isArray(settings.absenceCodes) && settings.absenceCodes.length > 0
                ? settings.absenceCodes.map((c: any) => {
                    if (typeof c === 'string') return { code: c, isFullDay: true, autoApply: true };
                    // Extra safe extraction
                    let codeStr = 'ABS';
                    if (c && c.code) {
                        if (typeof c.code === 'object') codeStr = String(c.code.code || c.code.label || 'ABS');
                        else codeStr = String(c.code);
                    }
                    return { 
                        code: codeStr, 
                        isFullDay: !!c?.isFullDay,
                        autoApply: c.autoApply ?? !!c?.isFullDay,
                        color: c.color || (codeStr === 'REPOS' ? '#000000' : '#ffe39b')
                    };
                })
                : ABSENCE_TYPES.map(c => ({ code: c, isFullDay: true, autoApply: true, color: '#ffe39b' }));
            const nextExtraTypes = Array.isArray(settings.extraTypes) && settings.extraTypes.length > 0
                ? settings.extraTypes.map((c: any) => String(c)).filter(Boolean)
                : ['Hôtesse LBE', 'Agent de sécurité', 'Extra Service', 'Extra Cuisine'];
            const nextRolesOrder = Array.isArray(settings.rolesOrder) ? Array.from(new Set(settings.rolesOrder.map((v: any) => String(v)))) : [];

            setSettingsPayload(settings);
            setWeeklyDefaults(nextDefaults);
            setAbsenceCodes(nextAbsences);
            setExtraTypes(nextExtraTypes);
            setRolesOrder(nextRolesOrder);
            setChangedDefaults(new Set());
        } catch (e) {
            console.error('Failed to load planning settings', e);
        }
    };

    const loadLongAbsences = async () => {
        setIsLoadingAbsences(true);
        try {
            const data = await planningApi.getAbsences();
            setLongAbsences(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingAbsences(false);
        }
    };

    const persistSettings = async (nextDefaults: Record<string, Record<string, string>>, nextAbsences: { code: string; isFullDay: boolean }[], nextExtraTypes: string[], nextRolesOrder?: string[]) => {
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
            onDataChanged?.({ 
                applyWeeklyDefaults: true, 
                changedEmployees: Array.from(changedDefaults) 
            });
            setChangedDefaults(new Set());
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

    const handleStartEditAbsence = (abs: any) => {
        setEditingAbsenceId(abs.id);
        setEditStart(abs.start_date);
        setEditEnd(abs.end_date);
    };

    const handleSaveAbsenceDates = async (abs: any) => {
        if (!editStart || !editEnd) return;
        setIsSavingAbsence(true);
        try {
            await planningApi.saveAbsence({
                id: abs.id,
                employee_id: abs.employee_id,
                start_date: editStart,
                end_date: editEnd,
                absence_type: abs.absence_type
            });
            setEditingAbsenceId(null);
            loadLongAbsences();
            onDataChanged?.();
        } catch (e) {
            console.error('Failed to update absence', e);
            alert('Erreur lors de la modification');
        } finally {
            setIsSavingAbsence(false);
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
        const filtered = (Array.isArray(employees) ? employees : []).filter((e: any) => String(e?.position || '') === selectedRole);
        return [...filtered].sort((a, b) => {
            const nameA = `${a.last_name || ''} ${a.first_name || ''}`.trim().toUpperCase();
            const nameB = `${b.last_name || ''} ${b.first_name || ''}`.trim().toUpperCase();
            return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
        });
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
        setChangedDefaults(prev => new Set(prev).add(employeeId));
    };

    const addAbsenceCode = () => {
        const code = newAbsenceCode.trim();
        if (!code) return;
        if (absenceCodes.some(a => a.code === code)) return;
        setAbsenceCodes((prev) => [...prev, { code, isFullDay: true, autoApply: true, color: newAbsenceColor }]);
        setNewAbsenceCode('');
    };

    const removeAbsenceCode = (code: string) => {
        setAbsenceCodes((prev) => prev.filter((c) => c.code !== code));
    };

    const toggleAbsenceFullDay = (code: string) => {
        setAbsenceCodes((prev) => prev.map(a => a.code === code ? { ...a, isFullDay: !a.isFullDay } : a));
    };

    const toggleAbsenceAutoApply = (code: string) => {
        setAbsenceCodes((prev) => prev.map(a => a.code === code ? { ...a, autoApply: !a.autoApply } : a));
    };

    const updateAbsenceColor = (code: string, color: string) => {
        setAbsenceCodes((prev) => prev.map(a => a.code === code ? { ...a, color } : a));
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

    const handleDeleteLongAbsence = async (id: string) => {
        if (!confirm('Voulez-vous vraiment supprimer cette absence ? Cela ne restaurera pas automatiquement les plannings déjà enregistrés, mais arrêtera l\'application automatique sur les futurs plannings.')) return;
        try {
            await planningApi.deleteAbsence(id);
            setLongAbsences(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            console.error('Failed to delete long absence', e);
        }
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
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-white/10">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white">Paramètres du Planning</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400"><X size={18} /></button>
                </div>

                <div className="flex border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 overflow-x-auto shrink-0 scrollbar-hide text-[11px]">
                    <button className={`px-3 py-2 font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${activeTab === 'templates' ? 'border-b-2 border-[#4AA3A2] text-[#4AA3A2] bg-[#4AA3A2]/5' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('templates')}>Modèles Horaires</button>
                    <button className={`px-3 py-2 font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${activeTab === 'defaults' ? 'border-b-2 border-[#4AA3A2] text-[#4AA3A2] bg-[#4AA3A2]/5' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('defaults')}>Défauts Hebdo</button>
                    {canManageGlobalTypes && (
                        <button className={`px-3 py-2 font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${activeTab === 'absences' ? 'border-b-2 border-[#4AA3A2] text-[#4AA3A2] bg-[#4AA3A2]/5' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('absences')}>Gestion Absences</button>
                    )}
                    <button className={`px-3 py-2 font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${activeTab === 'longAbsences' ? 'border-b-2 border-[#4AA3A2] text-[#4AA3A2] bg-[#4AA3A2]/5' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('longAbsences')}>Absences longue durée</button>
                    <button className={`px-3 py-2 font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${activeTab === 'order' ? 'border-b-2 border-[#4AA3A2] text-[#4AA3A2] bg-[#4AA3A2]/5' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('order')}>Ordre d'Affichage</button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 bg-slate-50/70 text-xs">
                    {(activeTab === 'templates' || activeTab === 'defaults') && (
                        <div className="flex flex-wrap gap-1.5 pb-0.5 mb-3">
                            <button
                                onClick={() => { setSelectedRole('GÉNÉRAL'); resetTemplateForm(); }}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all ${selectedRole === 'GÉNÉRAL' ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-400'}`}
                            >
                                GÉNÉRAL
                            </button>
                            {roles.map((role) => (
                                <button
                                    key={role.id}
                                    onClick={() => { setSelectedRole(role.id); resetTemplateForm(); }}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all ${selectedRole === role.id ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-400'}`}
                                >
                                    {role.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(90vh-140px)] max-h-[580px]">
                            <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col overflow-hidden">
                                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-slate-200 flex justify-between items-center text-xs">
                                    <span>MODÈLES EXISTANTS</span>
                                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-600 dark:text-slate-400">{visibleTemplates.length}</span>
                                </div>
                                <div className="p-2.5 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                                    {visibleTemplates.map((t) => (
                                        <div key={t.id} className="border rounded-lg p-2.5 relative group bg-white dark:bg-slate-900 hover:shadow-md border-slate-200 dark:border-white/5 transition-all">
                                            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        setEditingTplId(t.id);
                                                        setNewTplName(t.name);
                                                        setNewTplService(t.serviceType);
                                                        setNewTplSlots(t.slots);
                                                        setNewTplColor(t.color || PASTEL_COLORS[6]);
                                                    }}
                                                    className="text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 p-1 rounded bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-white/10"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button onClick={() => handleDeleteTemplate(t.id)} className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-white/10">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color || '#ccc' }} />
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">{t.name}</h4>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {t.slots.map((s, i) => (
                                                    <div key={i} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                                                        {s.start} - {s.end}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col overflow-hidden">
                                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-slate-200 text-xs">
                                    {editingTplId ? 'MODIFIER LE MODÈLE' : 'NOUVEAU MODÈLE'}
                                </div>
                                <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block">Nom du modèle</label>
                                        <input value={newTplName} onChange={(e) => setNewTplName(e.target.value)} className="w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:border-black dark:focus:border-white/30" placeholder="Ex: Matin, Soir..." />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block">Service</label>
                                        <select value={newTplService} onChange={(e) => setNewTplService(e.target.value as ShiftServiceType)} className="w-full h-8 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded px-2 text-xs text-slate-800 dark:text-white outline-none focus:border-black dark:focus:border-white/30">
                                            <option value="midi+soir">Midi + Soir</option>
                                            <option value="midi">Midi</option>
                                            <option value="soir">Soir</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">Couleur</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {PASTEL_COLORS.map((c) => (
                                                <button key={c} onClick={() => setNewTplColor(c)} className={`w-6 h-6 rounded-full border-2 ${newTplColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block">Horaires</label>
                                        <div className="space-y-1.5">
                                            {newTplSlots.map((slot, i) => (
                                                <div key={i} className="flex gap-1.5 items-center">
                                                    <input type="time" value={slot.start} onChange={(e) => { const n = [...newTplSlots]; n[i].start = e.target.value; setNewTplSlots(n); }} className="h-8 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded px-1.5 text-xs text-slate-800 dark:text-white flex-1 outline-none" />
                                                    <span className="text-slate-400">-</span>
                                                    <input type="time" value={slot.end} onChange={(e) => { const n = [...newTplSlots]; n[i].end = e.target.value; setNewTplSlots(n); }} className="h-8 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded px-1.5 text-xs text-slate-800 dark:text-white flex-1 outline-none" />
                                                    {newTplSlots.length > 1 && (
                                                        <button onClick={() => { const n = [...newTplSlots]; n.splice(i, 1); setNewTplSlots(n); }} className="text-slate-400 hover:text-red-500 p-0.5"><X size={14} /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => setNewTplSlots([...newTplSlots, { start: '18:00', end: '23:00' }])} className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1.5 flex items-center gap-1 hover:underline"><Plus size={10} /> Ajouter plage</button>
                                    </div>
                                </div>
                                <div className="p-2 border-t border-slate-200 dark:border-white/10 flex justify-end gap-1.5 bg-slate-50 dark:bg-slate-900 shrink-0">
                                    {editingTplId && <button onClick={resetTemplateForm} className="h-8 px-3 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 rounded font-bold transition-colors">Annuler</button>}
                                    <button onClick={handleSaveTemplate} className="h-8 px-3 text-[10px] bg-[#4AA3A2] text-white hover:brightness-95 rounded font-bold shadow-sm transition-all active:scale-[0.98]">{editingTplId ? 'Mettre à jour' : 'Créer'}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'defaults' && (
                        <div className="space-y-3">
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 p-2.5 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Défauts Hebdomadaires</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Configure les horaires par défaut de chaque employé.</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto h-[calc(90vh-220px)] max-h-[500px]">
                                    <table className="w-full text-[10px] min-w-[800px]">
                                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 sticky top-0 z-20">
                                            <tr>
                                                <th className="p-2 text-left text-slate-600 dark:text-slate-400 font-bold sticky left-0 bg-slate-50 dark:bg-slate-900 z-30">Employé ({selectedRole})</th>
                                                {DAYS.map((day) => (
                                                    <th key={day} className="p-2 text-center text-slate-600 dark:text-slate-400 font-bold">{day}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {employeesForSelectedRole.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="p-4 text-center text-slate-400 italic">Aucun employé pour ce poste.</td>
                                                </tr>
                                            ) : employeesForSelectedRole.map((emp: any) => {
                                                const lastName = (emp.last_name || '').toUpperCase();
                                                const firstName = emp.first_name || '';
                                                const employeeName = `${lastName} ${firstName}`.trim() || String(emp?.name || 'Employé');
                                                const empDefaults = weeklyDefaults[String(emp.id)] || {};
                                                const options = getTemplateOptionsForRole(String(emp?.position || selectedRole));
                                                return (
                                                    <tr key={String(emp.id)} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                                                        <td className="p-2 text-slate-800 dark:text-slate-200 font-bold sticky left-0 bg-white dark:bg-slate-800 z-10">{employeeName}</td>
                                                        {DAYS.map((_, dayIdx) => (
                                                            <td key={`${emp.id}-${dayIdx}`} className="p-1">
                                                                <select
                                                                    value={empDefaults[String(dayIdx)] || 'REPOS'}
                                                                    onChange={(e) => updateDefaultForEmployeeDay(String(emp.id), dayIdx, e.target.value)}
                                                                    className="w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded px-1.5 py-1 text-[10px] text-slate-800 dark:text-white outline-none focus:border-black dark:focus:border-white/30"
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
                            </div>
                        </div>
                    )}

                    {canManageGlobalTypes && activeTab === 'absences' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(90vh-140px)] max-h-[580px]">
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 p-3 shadow-sm flex flex-col overflow-hidden">
                                <h3 className="text-xs font-bold text-slate-800 dark:text-white mb-2 uppercase tracking-wide">Codes d'Absence</h3>
                                <div className="flex gap-2 mb-3">
                                    <input type="color" value={newAbsenceColor} onChange={(e) => setNewAbsenceColor(e.target.value)} className="h-8 w-8 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-0.5 cursor-pointer shrink-0" />
                                    <input value={newAbsenceCode} onChange={(e) => setNewAbsenceCode(e.target.value)} placeholder="Code (ex: RTT)" className="flex-1 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-white outline-none focus:border-black" onKeyDown={e => e.key === 'Enter' && addAbsenceCode()} />
                                    <button onClick={addAbsenceCode} className="h-8 px-3 bg-orange-500 text-white rounded text-[10px] font-bold hover:brightness-95 transition-all active:scale-[0.98]">Ajouter</button>
                                </div>
                                <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
                                    {absenceCodes.map((item) => (
                                        <div key={item.code} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                                            <div className="flex items-center gap-2">
                                                <input type="color" value={item.color || '#ffe39b'} onChange={(e) => updateAbsenceColor(item.code, e.target.value)} className="w-5 h-5 rounded border-none bg-transparent cursor-pointer" />
                                                <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px] min-w-[40px]">{item.code}</span>
                                                <div className="flex gap-1 ml-2">
                                                    <button onClick={() => toggleAbsenceFullDay(item.code)} className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tight transition-colors ${item.isFullDay ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>Journée</button>
                                                    <button onClick={() => toggleAbsenceAutoApply(item.code)} className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tight transition-colors ${item.autoApply ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>Auto</button>
                                                </div>
                                            </div>
                                            <button onClick={() => removeAbsenceCode(item.code)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 p-3 shadow-sm flex flex-col overflow-hidden">
                                <h3 className="text-xs font-bold text-slate-800 dark:text-white mb-2 uppercase tracking-wide">Types de Renfort</h3>
                                <div className="flex gap-2 mb-3">
                                    <input value={newExtraType} onChange={(e) => setNewExtraType(e.target.value)} placeholder="Type (ex: Sécurité)" className="flex-1 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-white outline-none focus:border-black" onKeyDown={e => e.key === 'Enter' && addExtraType()} />
                                    <button onClick={addExtraType} className="h-8 px-3 bg-purple-600 text-white rounded text-[10px] font-bold hover:brightness-95 transition-all active:scale-[0.98]">Ajouter</button>
                                </div>
                                <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
                                    {extraTypes.map((code) => (
                                        <div key={code} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">{code}</span>
                                            <button onClick={() => removeExtraType(code)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
 
                    {activeTab === 'longAbsences' && (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 p-4 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">Liste des Absences Longue Durée</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Gérez ici les absences déjà posées. Pour en ajouter une nouvelle, utilisez le bouton "Ajouter" sur le planning principal.</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto max-h-[450px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Employé</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Type</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Début</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Fin</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {longAbsences.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 italic text-xs">Aucune absence longue durée enregistrée.</td>
                                                </tr>
                                            ) : longAbsences.map((abs) => {
                                                const emp = employees.find(e => String(e.id) === String(abs.employee_id));
                                                const empName = emp ? `${(emp.last_name || '').toUpperCase()} ${emp.first_name || ''}`.trim() : 'Employé inconnu';
                                                
                                                return (
                                                    <tr key={abs.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                        <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 text-xs">{empName}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">{abs.absence_type}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                                                            {editingAbsenceId === abs.id ? (
                                                                <input 
                                                                    type="date" 
                                                                    className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#4AA3A2]"
                                                                    value={editStart}
                                                                    onChange={(e) => setEditStart(e.target.value)}
                                                                />
                                                            ) : format(parseISO(abs.start_date), 'dd/MM/yyyy')}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                                                            {editingAbsenceId === abs.id ? (
                                                                <input 
                                                                    type="date" 
                                                                    className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#4AA3A2]"
                                                                    value={editEnd}
                                                                    onChange={(e) => setEditEnd(e.target.value)}
                                                                />
                                                            ) : format(parseISO(abs.end_date), 'dd/MM/yyyy')}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {editingAbsenceId === abs.id ? (
                                                                    <>
                                                                        <button 
                                                                            onClick={() => handleSaveAbsenceDates(abs)}
                                                                            disabled={isSavingAbsence}
                                                                            className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                                                            title="Enregistrer"
                                                                        >
                                                                            {isSavingAbsence ? <Clock size={16} className="animate-spin" /> : <Check size={16} />}
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => setEditingAbsenceId(null)}
                                                                            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                                                            title="Annuler"
                                                                        >
                                                                            <X size={16} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button 
                                                                            onClick={() => handleStartEditAbsence(abs)}
                                                                            className="p-1.5 text-slate-300 hover:text-[#4AA3A2] hover:bg-[#4AA3A2]/10 rounded-lg transition-all"
                                                                            title="Modifier les dates"
                                                                        >
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleDeleteLongAbsence(abs.id)}
                                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                                                            title="Supprimer"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'order' && (
                        <div className="max-w-md mx-auto space-y-3">
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 p-3 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-800 dark:text-white mb-0.5 uppercase tracking-wide">Ordre d'Affichage</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">Glissez-déposez pour réorganiser l'ordre des postes.</p>
                                
                                <div className="space-y-1 overflow-y-auto max-h-[calc(90vh-240px)] pr-1">
                                    {orderedRolesForDisplay.map((role, idx) => (
                                        <div
                                            key={role.id}
                                            draggable
                                            onDragStart={() => setDragIdx(idx)}
                                            onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                                            onDrop={() => handleDropRoleAt(idx)}
                                            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                                            className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${dragOverIdx === idx ? 'border-[#4AA3A2] bg-[#4AA3A2]/10 scale-[1.01]' : 'border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900'} ${dragIdx === idx ? 'opacity-40' : 'opacity-100 cursor-grab active:cursor-grabbing'}`}
                                        >
                                            <GripVertical size={14} className="text-slate-300" />
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex-1">{role.label}</span>
                                            <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full font-black">#{idx + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-4 py-2 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 flex justify-end gap-2 shrink-0">
                    <button onClick={onClose} className="h-8 px-4 rounded-lg border border-slate-300 dark:border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Fermer</button>
                    {activeTab !== 'templates' && (
                        <button
                            onClick={() => {
                                if (activeTab === 'order') {
                                    const orderedRoles = orderedRolesForDisplay.map((r) => r.id);
                                    persistSettings(weeklyDefaults, absenceCodes, extraTypes, orderedRoles);
                                    setRolesOrder(orderedRoles);
                                } else {
                                    persistSettings(weeklyDefaults, absenceCodes, extraTypes);
                                }
                            }}
                            disabled={savingSettings}
                            className="h-8 inline-flex items-center gap-2 px-6 rounded-lg bg-[#4AA3A2] text-white font-black text-[10px] uppercase tracking-wider hover:brightness-95 disabled:opacity-60 shadow-sm transition-all active:scale-[0.98]"
                        >
                            <Save size={12} /> {savingSettings ? '...' : activeTab === 'order' ? "Enregistrer" : "Enregistrer"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlanningSettings;
