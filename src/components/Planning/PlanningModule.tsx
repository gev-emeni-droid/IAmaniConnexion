import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Settings, Users, Plus, Search, Edit2, Clock, Trash2, MoreHorizontal, Copy, Clipboard, RefreshCw, ChevronLeft, FileDown } from 'lucide-react';
import { format, parseISO, addDays, startOfWeek, subWeeks, addWeeks, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Planning, PlanningRow, Shift, Template, ExtraShift, ShiftSegment, ShiftType, ShiftServiceType, ABSENCE_TYPES } from './types';
import ShiftCell from './ShiftCell';
import ShiftEditor from './ShiftEditor';
import AddShiftModal from './AddShiftModal';
import PlanningSettings from './PlanningSettings';
import PlanningExportModal from './PlanningExportModal';

import { planningApi, moduleApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export const PlanningModule = () => {
    const { user } = useAuth();
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [planning, setPlanning] = useState<Planning | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [absenceTypes, setAbsenceTypes] = useState<string[]>([...ABSENCE_TYPES]);
    const [extraTypes, setExtraTypes] = useState<string[]>(['Hôtesse LBE', 'Agent de sécurité', 'Extra Service', 'Extra Cuisine']);
    
    // Core data from CRM/RH
    const [dbEmployees, setDbEmployees] = useState<any[]>([]);
    const [roles, setRoles] = useState<{ id: string, label: string }[]>([]);

    const [viewMode, setViewMode] = useState<'SEMAINE' | 'JOUR'>('SEMAINE');
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [editingShift, setEditingShift] = useState<{ shift: Shift, employeeId: string, employeeName: string, employeeRole: string, date: string } | null>(null);
    const [editorPos, setEditorPos] = useState({ x: 0, y: 0 });

    const [openDayMenu, setOpenDayMenu] = useState<string | null>(null);
    const [clipboardDay, setClipboardDay] = useState<{ shifts: Record<string, Shift> } | null>(null);
    const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(new Set());
    const [rolesOrder, setRolesOrder] = useState<string[]>([]);
    const planningTableRef = useRef<HTMLDivElement>(null);

    const loadData = useCallback(async () => {
        try {
            const [posts, emps, tpls, planningSettings] = await Promise.all([
                moduleApi.getJobPosts(),
                moduleApi.getEmployes(),
                planningApi.getTemplates(),
                planningApi.getSettings()
            ]);

            const finalRoles = (posts || []).map((p: any) => ({ id: p.id, label: p.title }));
            
            setRoles(finalRoles);
            setDbEmployees(emps || []);
            setTemplates(Array.isArray(tpls) ? tpls : []);

            const weeklyDefaults = (planningSettings && typeof planningSettings === 'object' && planningSettings.weeklyDefaults && typeof planningSettings.weeklyDefaults === 'object')
                ? planningSettings.weeklyDefaults
                : {};
            const configuredAbsenceTypes = Array.isArray((planningSettings as any)?.absenceCodes) && (planningSettings as any).absenceCodes.length > 0
                ? (planningSettings as any).absenceCodes.map((v: any) => String(v)).filter(Boolean)
                : [...ABSENCE_TYPES];
            const configuredExtraTypes = Array.isArray((planningSettings as any)?.extraTypes) && (planningSettings as any).extraTypes.length > 0
                ? (planningSettings as any).extraTypes.map((v: any) => String(v)).filter(Boolean)
                : ['Hôtesse LBE', 'Agent de sécurité', 'Extra Service', 'Extra Cuisine'];

            setAbsenceTypes(configuredAbsenceTypes);
            setExtraTypes(configuredExtraTypes);
            const configuredRolesOrder = Array.isArray((planningSettings as any)?.rolesOrder) && (planningSettings as any).rolesOrder.length > 0
                ? Array.from(new Set((planningSettings as any).rolesOrder.map((v: any) => String(v))))
                : [];
            setRolesOrder(configuredRolesOrder);

            const getDefaultShiftForEmployeeDay = (employeeId: string, date: string, dayIndex: number): Shift => {
                const defaultMap = weeklyDefaults[String(employeeId)] || {};
                const defaultKey = defaultMap[String(dayIndex)] || defaultMap[['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][dayIndex]];
                if (!defaultKey || defaultKey === 'REPOS') {
                    return {
                        date,
                        type: 'repos',
                        serviceType: 'none',
                        segments: [{ type: 'code', label: 'REPOS' }],
                    };
                }

                const template = (Array.isArray(tpls) ? tpls : []).find((t: Template) => String(t.id) === String(defaultKey));
                if (!template || !Array.isArray(template.slots) || template.slots.length === 0) {
                    return {
                        date,
                        type: 'repos',
                        serviceType: 'none',
                        segments: [{ type: 'code', label: 'REPOS' }],
                    };
                }

                return {
                    date,
                    type: 'travail',
                    serviceType: template.serviceType || 'midi+soir',
                    segments: template.slots.map((slot: any) => ({
                        type: 'horaire' as const,
                        start: String(slot?.start || '10:00'),
                        end: String(slot?.end || '15:00'),
                        templateId: template.id,
                        color: template.color,
                    })),
                };
            };

            const weekStr = format(currentWeekStart, 'yyyy-MM-dd');
            let pData = await planningApi.getWeek(weekStr);

            // Create or update planning for the week
            let p: Planning = pData || {
                id: crypto.randomUUID(),
                weekStart: weekStr,
                weekEnd: format(addDays(currentWeekStart, 6), 'yyyy-MM-dd'),
                service: 'Salle',
                status: 'active',
                rows: [],
                extraShifts: [],
                createdAt: Date.now()
            };

            // Synchronize rows with current active employees
            let newRows = [...p.rows];
            const activeEmps = (emps || []).filter((e: any) => e.first_name); // basic filter
            let hasChanges = false;

            activeEmps.forEach((emp: any) => {
                const fullName = `${emp.first_name} ${emp.last_name || ''}`.trim();
                const roleId = emp.position || 'GENERAL';

                let existingRow = newRows.find(r => r.employeeId === emp.id);
                if (existingRow) {
                    if (existingRow.employeeName !== fullName || existingRow.employeeRole !== roleId) {
                        existingRow.employeeName = fullName;
                        existingRow.employeeRole = roleId;
                        hasChanges = true;
                    }
                } else {
                    hasChanges = true;
                    const shifts: Record<string, Shift> = {};
                    for (let i = 0; i < 7; i++) {
                        const d = format(addDays(currentWeekStart, i), 'yyyy-MM-dd');
                        shifts[d] = getDefaultShiftForEmployeeDay(String(emp.id), d, i);
                    }
                    newRows.push({
                        employeeId: emp.id, employeeName: fullName, employeeRole: roleId,
                        isExtra: false, shifts
                    });
                }
            });

            if (!pData) {
                newRows = newRows.map((row) => {
                    const shifts: Record<string, Shift> = {};
                    for (let i = 0; i < 7; i++) {
                        const d = format(addDays(currentWeekStart, i), 'yyyy-MM-dd');
                        shifts[d] = getDefaultShiftForEmployeeDay(String(row.employeeId), d, i);
                    }
                    return { ...row, shifts };
                });
                hasChanges = true;
            }

            if (hasChanges || !pData) {
                p.rows = newRows;
                await planningApi.saveWeek({ ...p, weekStart: weekStr });
            }

            setPlanning(p);
        } catch (e) {
            console.error('Failed to load planning data:', e);
        }
    }, [currentWeekStart]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const savePlanning = async (updated: Planning) => {
        try {
            await planningApi.saveWeek({ ...updated, weekStart: format(currentWeekStart, 'yyyy-MM-dd') });
            setPlanning(updated);
        } catch (err) {
            console.error('Failed to save planning:', err);
        }
    };

    const handleShiftUpdate = (updatedShift: Shift) => {
        if (!planning || !editingShift) return;
        const newRows = planning.rows.map(row => {
            if (row.employeeId === editingShift.employeeId) {
                return { ...row, shifts: { ...row.shifts, [editingShift.date]: updatedShift } };
            }
            return row;
        });
        savePlanning({ ...planning, rows: newRows });
    };

    const handleAddShiftData = (data: any) => {
        if (!planning) return;

        if (data.mode === 'absenceRange') {
            const startDate = String(data.startDate || '');
            const endDate = String(data.endDate || '');
            const employeeId = String(data.employeeId || '');
            const absenceCode = String(data.absenceType || 'CP');
            if (!employeeId || !startDate || !endDate) return;

            const newRows = planning.rows.map((row) => {
                if (String(row.employeeId) !== employeeId) return row;
                const newShifts: Record<string, Shift> = { ...row.shifts };

                const cursor = new Date(startDate);
                const end = new Date(endDate);
                while (cursor <= end) {
                    const date = format(cursor, 'yyyy-MM-dd');
                    newShifts[date] = {
                        date,
                        type: 'absence',
                        serviceType: 'none',
                        segments: [{ type: 'code', label: absenceCode }],
                    };
                    cursor.setDate(cursor.getDate() + 1);
                }

                return { ...row, shifts: newShifts };
            });

            savePlanning({ ...planning, rows: newRows });
            return;
        }

        if (data.isExtra && data.date) {
            const segment = data.shift.segments[0];
            if (segment && segment.start && segment.end) {
                const newExtra: ExtraShift = {
                    id: crypto.randomUUID(),
                    label: data.extraType || "Extra",
                    date: data.date,
                    start: segment.start,
                    end: segment.end,
                    count: data.extraCount || 1
                };
                savePlanning({ ...planning, extraShifts: [...(planning.extraShifts || []), newExtra] });
            }
        } else if (data.date) {
            let updatedRows = [...planning.rows];
            const existingRowIndex = updatedRows.findIndex(r => r.employeeId === data.employeeId);
            if (existingRowIndex !== -1) {
                updatedRows[existingRowIndex] = {
                    ...updatedRows[existingRowIndex],
                    shifts: { ...updatedRows[existingRowIndex].shifts, [data.date]: data.shift }
                };
                savePlanning({ ...planning, rows: updatedRows });
            }
        }
    };

    const handleDeleteExtra = (extraId: string) => {
        if (!planning || !confirm("Supprimer ce renfort ?")) return;
        savePlanning({ ...planning, extraShifts: (planning.extraShifts || []).filter(e => e.id !== extraId) });
    };

    const handleCopyDay = (date: string) => {
        if (!planning) return;
        const shifts: Record<string, Shift> = {};
        planning.rows.forEach(row => { if (row.shifts[date]) shifts[row.employeeId] = row.shifts[date]; });
        setClipboardDay({ shifts });
        setOpenDayMenu(null);
    };

    const handlePasteDay = (targetDate: string) => {
        if (!planning || !clipboardDay) return;
        const newRows = planning.rows.map(row => {
            const shiftToPaste = clipboardDay.shifts[row.employeeId];
            if (shiftToPaste) return { ...row, shifts: { ...row.shifts, [targetDate]: { ...shiftToPaste, date: targetDate } } };
            return row;
        });
        savePlanning({ ...planning, rows: newRows });
        setOpenDayMenu(null);
    };

    const handleClearDay = (date: string) => {
        if (!planning || !confirm('Voulez-vous vraiment vider cette journée ?')) return;
        const newRows = planning.rows.map(row => ({
            ...row,
            shifts: { ...row.shifts, [date]: { date, type: 'repos' as const, serviceType: 'none' as const, segments: [{ type: 'code' as const, label: 'REPOS' }] } }
        }));
        savePlanning({ ...planning, rows: newRows });
        setOpenDayMenu(null);
    };

    const getShiftCounts = (shift: Shift | undefined) => {
        if (!shift) return { midi: 0, soir: 0 };
        let m = 0; let s = 0;
        const hasAbsence = shift.segments?.some(seg => (seg.label && absenceTypes.includes(seg.label as any)) || seg.label === 'REPOS');
        if (hasAbsence) return { midi: 0, soir: 0 };

        const horaires = shift.segments?.filter(seg => seg.type === 'horaire') || [];
        if (horaires.length === 0) return { midi: 0, soir: 0 };

        const firstStart = horaires[0].start;
        const lastEnd = horaires[horaires.length - 1].end;
        if (!firstStart) return { midi: 0, soir: 0 };

        const isEvening = (time: string | undefined) => {
            if (!time) return false;
            const [h, min] = time.split(':').map(Number);
            if (isNaN(h)) return false;
            if (h < 6) return true; // past midnight
            return (h * 60 + (min || 0)) > 1140; // > 19:00
        };

        const hasEveningEnd = isEvening(lastEnd);

        if (firstStart < "12:00") {
            m = 1;
            if (hasEveningEnd) s = 1;
        } else if (firstStart >= "16:00") {
            s = 1;
        } else {
            if (hasEveningEnd) s = 1; else m = 1;
        }
        return { midi: m, soir: s };
    };

    const getMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const calculateShiftDuration = (shift: Shift | undefined) => {
        if (!shift || !shift.segments) return 0;
        return shift.segments.reduce((acc, seg) => {
            if (seg.type === 'horaire' && seg.start && seg.end) {
                let start = getMinutes(seg.start);
                let end = getMinutes(seg.end);
                if (end < start) end += 24 * 60;
                return acc + (end - start);
            }
            return acc;
        }, 0);
    };

    const formatDuration = (minutes: number) => {
        if (minutes === 0) return null;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}`;
    };

    const getKPIs = (dayDate: string) => {
        if (!planning) return { midi: 0, soir: 0, extras: [] as ExtraShift[] };
        let midi = 0; let soir = 0;
        planning.rows.forEach(row => {
            const counts = getShiftCounts(row.shifts[dayDate]);
            midi += counts.midi;
            soir += counts.soir;
        });
        const dayExtras = (planning.extraShifts || []).filter(e => e.date === dayDate);
        dayExtras.forEach(e => {
            let m = 0; let s = 0;
            const isEvening = (e.end && (getMinutes(e.end) < 360 || getMinutes(e.end) > 1140));
            if (e.start < "12:00") { m = e.count; if (isEvening) s = e.count; }
            else if (e.start >= "16:00") { s = e.count; }
            else { if (isEvening) s = e.count; else m = e.count; }
            midi += m; soir += s;
        });
        return { midi, soir, extras: dayExtras };
    };

    const getGroupTotals = (rows: PlanningRow[], date: string) => {
        let midi = 0;
        let soir = 0;
        rows.forEach((r) => {
            const counts = getShiftCounts(r.shifts[date]);
            midi += counts.midi;
            soir += counts.soir;
        });
        return { midi, soir };
    };

    const toggleRoleCollapse = (roleId: string) => {
        setCollapsedRoles((prev) => {
            const next = new Set(prev);
            if (next.has(roleId)) next.delete(roleId);
            else next.add(roleId);
            return next;
        });
    };

    const handleResetWeek = async () => {
        if (!planning) return;
        if (!confirm('Voulez-vous vraiment réinitialiser toute la semaine avec les défauts hebdomadaires ?')) return;
        try {
            const [settings, tpls] = await Promise.all([planningApi.getSettings(), planningApi.getTemplates()]);
            const weeklyDefaults = (settings && typeof settings === 'object' && settings.weeklyDefaults && typeof settings.weeklyDefaults === 'object')
                ? settings.weeklyDefaults
                : {};
            const templatesList = Array.isArray(tpls) ? tpls : [];

            const newRows = planning.rows.map((row) => {
                const newShifts: Record<string, Shift> = { ...row.shifts };
                for (let i = 0; i < 7; i++) {
                    const date = weekStartDates[i];
                    const defaultMap = weeklyDefaults[String(row.employeeId)] || {};
                    const defaultKey = defaultMap[String(i)] || defaultMap[['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i]];
                    if (!defaultKey || defaultKey === 'REPOS') {
                        newShifts[date] = { date, type: 'repos', serviceType: 'none', segments: [{ type: 'code', label: 'REPOS' }] };
                        continue;
                    }
                    const tpl = templatesList.find((t: Template) => String(t.id) === String(defaultKey));
                    if (!tpl || !Array.isArray(tpl.slots) || tpl.slots.length === 0) {
                        newShifts[date] = { date, type: 'repos', serviceType: 'none', segments: [{ type: 'code', label: 'REPOS' }] };
                        continue;
                    }
                    newShifts[date] = {
                        date,
                        type: 'travail',
                        serviceType: tpl.serviceType || 'midi+soir',
                        segments: tpl.slots.map((slot: any) => ({
                            type: 'horaire',
                            start: String(slot?.start || '10:00'),
                            end: String(slot?.end || '15:00'),
                            templateId: tpl.id,
                            color: tpl.color,
                        })),
                    };
                }
                return { ...row, shifts: newShifts };
            });

            savePlanning({ ...planning, rows: newRows });
        } catch (e) {
            console.error('Failed to reset week', e);
        }
    };

    const applyWeeklyDefaultsToCurrentWeek = useCallback(async () => {
        if (!planning) return;
        try {
            const [settings, tpls] = await Promise.all([planningApi.getSettings(), planningApi.getTemplates()]);
            const weeklyDefaults = (settings && typeof settings === 'object' && settings.weeklyDefaults && typeof settings.weeklyDefaults === 'object')
                ? settings.weeklyDefaults
                : {};
            const templatesList = Array.isArray(tpls) ? tpls : [];
            const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(currentWeekStart, i), 'yyyy-MM-dd'));

            const newRows = planning.rows.map((row) => {
                const newShifts: Record<string, Shift> = { ...row.shifts };
                for (let i = 0; i < 7; i++) {
                    const date = weekDates[i];
                    const defaultMap = weeklyDefaults[String(row.employeeId)] || {};
                    const defaultKey = defaultMap[String(i)] || defaultMap[['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i]];
                    if (!defaultKey || defaultKey === 'REPOS') {
                        newShifts[date] = { date, type: 'repos', serviceType: 'none', segments: [{ type: 'code', label: 'REPOS' }] };
                        continue;
                    }
                    const tpl = templatesList.find((t: Template) => String(t.id) === String(defaultKey));
                    if (!tpl || !Array.isArray(tpl.slots) || tpl.slots.length === 0) {
                        newShifts[date] = { date, type: 'repos', serviceType: 'none', segments: [{ type: 'code', label: 'REPOS' }] };
                        continue;
                    }
                    newShifts[date] = {
                        date,
                        type: 'travail',
                        serviceType: tpl.serviceType || 'midi+soir',
                        segments: tpl.slots.map((slot: any) => ({
                            type: 'horaire',
                            start: String(slot?.start || '10:00'),
                            end: String(slot?.end || '15:00'),
                            templateId: tpl.id,
                            color: tpl.color,
                        })),
                    };
                }
                return { ...row, shifts: newShifts };
            });

            await savePlanning({ ...planning, rows: newRows });
        } catch (e) {
            console.error('Failed to apply weekly defaults to current week', e);
        }
    }, [planning, currentWeekStart]);

    const handleSettingsDataChanged = useCallback(async (options?: { applyWeeklyDefaults?: boolean }) => {
        if (options?.applyWeeklyDefaults) {
            await applyWeeklyDefaultsToCurrentWeek();
            return;
        }
        await loadData();
    }, [applyWeeklyDefaultsToCurrentWeek, loadData]);

    const groupedRows = useMemo(() => {
        if (!planning) return {};

        // 1. Map for normalization (id -> role, label.toLowerCase() -> role)
        const roleMap = new Map<string, { id: string; label: string }>();
        roles.forEach(r => {
            roleMap.set(r.id, r);
            roleMap.set(r.label.toLowerCase(), r);
        });

        // 2. Filter employees by search term
        const filtered = planning.rows.filter(r => {
            const search = searchTerm.toLowerCase();
            if (!search) return true;
            if (r.employeeName.toLowerCase().includes(search)) return true;
            const role = roleMap.get(r.employeeRole) || roleMap.get(r.employeeRole.toLowerCase());
            if (role && role.label.toLowerCase().includes(search)) return true;
            if (r.employeeRole.toLowerCase().includes(search)) return true;
            return false;
        });

        // 3. Group employees by Role ID (if possible) or standardized key
        const groups = new Map<string, PlanningRow[]>();
        filtered.forEach(r => {
            const role = roleMap.get(r.employeeRole) || roleMap.get(r.employeeRole.toLowerCase());
            const key = role ? role.id : r.employeeRole;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(r);
        });

        // 4. Sort employees within each group by name
        groups.forEach(rows => {
            rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
        });

        const sortedGroups: Record<string, PlanningRow[]> = {};
        const handledKeys = new Set<string>();

        // 5. Apply explicit rolesOrder
        if (rolesOrder && rolesOrder.length > 0) {
            rolesOrder.forEach(id => {
                if (groups.has(id)) {
                    sortedGroups[id] = groups.get(id)!;
                    handledKeys.add(id);
                } else {
                    // Check if it's stored by label instead of ID in groups
                    const role = roleMap.get(id);
                    if (role && groups.has(role.label)) {
                        sortedGroups[role.label] = groups.get(role.label)!;
                        handledKeys.add(role.label);
                    }
                }
            });
        }

        // 6. Add remaining roles from the 'roles' list in order
        roles.forEach(r => {
            if (!handledKeys.has(r.id) && groups.has(r.id)) {
                sortedGroups[r.id] = groups.get(r.id)!;
                handledKeys.add(r.id);
            }
            if (r.label && !handledKeys.has(r.label) && groups.has(r.label)) {
                sortedGroups[r.label] = groups.get(r.label)!;
                handledKeys.add(r.label);
            }
        });

        // 7. Add any leftovers (roles that don't match any known ID or label)
        groups.forEach((rows, key) => {
            if (!handledKeys.has(key)) {
                sortedGroups[key] = rows;
            }
        });

        return sortedGroups;
    }, [planning, searchTerm, roles, rolesOrder]);

    const getRoleLabel = (roleId: string) => roles.find(r => r.id === roleId)?.label || roleId;

    if (!planning) return <div className="p-10 text-center text-slate-500">Chargement du planning...</div>;

    const weekStartDates = Array.from({ length: 7 }, (_, i) => format(addDays(currentWeekStart, i), 'yyyy-MM-dd'));
    const displayedDates = viewMode === 'JOUR' ? [weekStartDates[selectedDayIndex]] : weekStartDates;

    return (
        <div className="space-y-5 font-sans text-slate-800 max-w-[1700px] mx-auto bg-slate-100 p-4 rounded-2xl border border-slate-200">
            <header className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 md:px-5 md:py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="p-1.5 hover:bg-white rounded"><ChevronLeft size={16} /></button>
                        <span className="px-3 py-1.5 text-sm font-bold">Semaine du {format(currentWeekStart, 'dd/MM')}</span>
                        <button onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} className="p-1.5 hover:bg-white rounded"><ChevronRight size={16} /></button>
                    </div>
                    <div className="hidden md:flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('SEMAINE')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'SEMAINE' ? 'bg-white shadow-sm text-[#4AA3A2]' : 'text-slate-500'}`}>Semaine</button>
                        <button onClick={() => setViewMode('JOUR')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'JOUR' ? 'bg-white shadow-sm text-[#4AA3A2]' : 'text-slate-500'}`}>Jour</button>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input className="pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#4AA3A2] transition-all w-full lg:w-56" placeholder="Filtrer employé..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1 bg-[#4AA3A2] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:brightness-95"><Plus size={16} /> Ajouter</button>
                    <button onClick={handleResetWeek} className="p-2 text-slate-500 border border-slate-200 hover:bg-orange-50 hover:text-orange-600 rounded-xl" title="Réinitialiser semaine"><RefreshCw size={18} /></button>
                    <button onClick={() => setIsExportModalOpen(true)} className="p-2 text-slate-500 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 rounded-xl" title="Exporter PDF"><FileDown size={18} /></button>
                    <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 border border-slate-200 hover:bg-slate-50 rounded-xl"><Settings size={18} /></button>
                </div>
            </header>

            <div className="border border-slate-200 bg-slate-50/70 py-3 rounded-xl">
                <div className="px-3 md:px-4 flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mr-2"><Users size={14} /> Effectifs</div>
                    {weekStartDates.map((date, idx) => {
                        const kpi = getKPIs(date);
                        const isSelected = viewMode === 'JOUR' && idx === selectedDayIndex;
                        return (
                            <button
                                key={date}
                                onClick={() => {
                                    setViewMode('JOUR');
                                    setSelectedDayIndex(idx);
                                }}
                                className={`flex flex-col px-3 py-2 rounded-lg border transition-all flex-1 min-w-[120px] text-left ${isSelected ? 'bg-[#A7E0E0]/40 border-[#4AA3A2]/30 ring-2 ring-[#4AA3A2]/20' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}
                            >
                                <span className="text-xs font-bold text-slate-800 uppercase">{DAYS[idx].substring(0, 3)} {format(parseISO(date), 'dd')}</span>
                                <div className="flex gap-3 text-xs mt-1">
                                    <span className="text-slate-600">Midi : <strong className="text-orange-600">{kpi.midi}</strong></span>
                                    <span className="text-slate-600">Soir : <strong className="text-indigo-600">{kpi.soir}</strong></span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>



            <div ref={planningTableRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[980px]">
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-40 bg-slate-50 border-b border-r p-3 text-left w-72 text-slate-500 font-semibold">Employé</th>
                            {displayedDates.map((d, i) => {
                                const originalIndex = weekStartDates.indexOf(d);
                                const kpi = getKPIs(d);
                                return (
                                    <th key={d} className="border-b border-r bg-slate-50 p-2 min-w-[120px] text-center relative group">
                                        <div className="flex justify-center items-center gap-1">
                                            <span className="font-bold text-slate-700">{DAYS[originalIndex]}</span>
                                            <span className="text-xs text-slate-400 font-normal">{format(parseISO(d), 'dd/MM')}</span>
                                            <button onClick={() => setOpenDayMenu(openDayMenu === d ? null : d)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded absolute right-1 top-2"><MoreHorizontal size={14} /></button>
                                        </div>
                                        <div className="flex justify-center gap-3 text-[11px] mt-1 font-medium">
                                            <span className="text-orange-600">{kpi.midi} m</span>
                                            <span className="text-indigo-600">{kpi.soir} s</span>
                                        </div>
                                        
                                        {openDayMenu === d && (
                                            <div className="absolute top-full right-0 mt-1 bg-white border shadow-lg rounded-lg py-1 z-50 w-40 text-left font-normal text-sm">
                                                <button onClick={() => handleCopyDay(d)} className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><Copy size={14} /> Copier jour</button>
                                                <button onClick={() => handlePasteDay(d)} disabled={!clipboardDay} className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"><Clipboard size={14} /> Coller jour</button>
                                                <div className="border-t my-1"></div>
                                                <button onClick={() => handleClearDay(d)} className="w-full px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Vider jour</button>
                                            </div>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(groupedRows).map(([roleId, rows]) => (
                            <React.Fragment key={roleId}>
                                <tr className="cursor-pointer hover:opacity-90 transition-opacity" onClick={() => toggleRoleCollapse(roleId)}>
                                    <td colSpan={displayedDates.length + 1} className="p-3 bg-[#A7E0E0] text-[#1f3a4a] text-sm font-bold border-b tracking-wider uppercase sticky left-0 z-20 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {collapsedRoles.has(roleId) ? <ChevronRight size={18} /> : <ChevronDown size={18} />} {getRoleLabel(roleId)}
                                            <span className="text-[10px] font-normal bg-white/40 px-2 py-0.5 rounded-full">{rows.length}</span>
                                        </div>
                                    </td>
                                </tr>
                                {!collapsedRoles.has(roleId) && rows.map(row => {
                                    const totalMinutes = displayedDates.reduce((acc, d) => acc + calculateShiftDuration(row.shifts[d]), 0);
                                    return (
                                        <tr key={row.employeeId} className="hover:bg-slate-50/50">
                                            <td className="sticky left-0 z-30 bg-white border-b border-r p-3 font-medium text-slate-800">
                                                <div className="flex flex-col">
                                                    <span className="text-sm">{row.employeeName}</span>
                                                    {totalMinutes > 0 && <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5"><Clock size={10} /> {formatDuration(totalMinutes)}</span>}
                                                </div>
                                            </td>
                                            {displayedDates.map(date => (
                                                <td key={date} className="border-b border-r p-1 h-14 relative cursor-pointer" onClick={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setEditorPos({ x: rect.left, y: rect.bottom + window.scrollY });
                                                    setEditingShift({
                                                        shift: row.shifts[date] || { date, type: 'repos', serviceType: 'none', segments: [] },
                                                        employeeId: row.employeeId, employeeName: row.employeeName, employeeRole: row.employeeRole, date
                                                    });
                                                }}>
                                                    <ShiftCell shift={row.shifts[date]} templates={templates} />
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                                {!collapsedRoles.has(roleId) && (
                                    <tr className="bg-slate-50/70">
                                        <td className="sticky left-0 z-30 bg-slate-50 border-b border-r p-2 text-right text-xs font-bold text-slate-500">TOTAL {getRoleLabel(roleId)}</td>
                                        {displayedDates.map((date) => {
                                            const totals = getGroupTotals(rows as PlanningRow[], date);
                                            return (
                                                <td key={`${roleId}-total-${date}`} className="border-b border-r p-2 text-center text-xs font-semibold text-slate-600">
                                                    {(totals.midi > 0 || totals.soir > 0)
                                                        ? <span><span className={totals.midi > 0 ? 'text-orange-600' : 'text-slate-300'}>{totals.midi} m</span><span className="mx-1 text-slate-300">/</span><span className={totals.soir > 0 ? 'text-indigo-600' : 'text-slate-300'}>{totals.soir} s</span></span>
                                                        : <span className="text-slate-300">-</span>
                                                    }
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        {/* Extras display below grouped roles */}
                        {(planning.extraShifts && planning.extraShifts.length > 0) && (
                            <>
                                <tr><td colSpan={displayedDates.length + 1} className="p-2 bg-purple-50 text-purple-800 text-xs font-bold border-b tracking-wider uppercase sticky left-0 z-20">RENFORTS (EXTRAS)</td></tr>
                                <tr>
                                    <td className="sticky left-0 z-30 bg-purple-50/30 border-b border-r p-3"></td>
                                    {displayedDates.map(date => {
                                        const dayExtras = planning.extraShifts.filter(e => e.date === date);
                                        return (
                                            <td key={date} className="border-b border-r p-1 align-top bg-purple-50/10">
                                                <div className="space-y-1">
                                                    {dayExtras.map(extra => (
                                                        <div key={extra.id} className="group flex justify-between items-center text-[10px] bg-purple-100 text-purple-900 rounded px-1.5 py-1">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold">{extra.count}x {extra.label}</span>
                                                                <span>{extra.start}-{extra.end}</span>
                                                            </div>
                                                            <button onClick={() => handleDeleteExtra(extra.id)} className="text-purple-400 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"><Trash2 size={12}/></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {editingShift && (
                <ShiftEditor
                    shift={editingShift.shift}
                    employeeName={editingShift.employeeName}
                    employeeRoleId={editingShift.employeeRole}
                    availableTemplates={templates.filter(t => t.role === editingShift.employeeRole || t.role === 'GÉNÉRAL')}
                    position={editorPos}
                    currentDate={editingShift.date}
                    onSave={handleShiftUpdate}
                    onClose={() => setEditingShift(null)}
                />
            )}

            <AddShiftModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddShiftData}
                employees={dbEmployees.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name || ''}`, role: e.position || 'GENERAL' }))}
                currentDate={format(currentWeekStart, 'yyyy-MM-dd')}
                weekDates={weekStartDates}
                extraTypes={extraTypes}
                absenceTypes={absenceTypes}
            />

            <PlanningSettings
                isOpen={isSettingsOpen}
                onClose={() => { setIsSettingsOpen(false); loadData(); }}
                onDataChanged={handleSettingsDataChanged}
                employees={dbEmployees}
                roles={roles}
                canManageGlobalTypes={user?.type === 'admin'}
            />

            <PlanningExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                planning={planning}
                roles={roles}
                rolesOrder={rolesOrder}
                currentWeekStart={currentWeekStart}
                weekDates={weekStartDates}
                selectedDayIndex={selectedDayIndex}
            />
        </div>
    );
};
