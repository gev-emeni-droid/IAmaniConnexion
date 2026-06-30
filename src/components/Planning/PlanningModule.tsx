import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Settings, Users, Plus, Search, Edit2, Clock, Trash2, MoreHorizontal, Copy, Clipboard, RefreshCw, ChevronLeft, FileDown, LayoutPanelLeft, ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO, addDays, startOfWeek, subWeeks, addWeeks, isSameDay, isBefore, getISOWeek, getYear, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Planning, PlanningRow, Shift, Template, ExtraShift, ShiftSegment, ShiftType, ShiftServiceType, ABSENCE_TYPES } from './types';
import ShiftCell from './ShiftCell';
import ShiftEditor from './ShiftEditor';
import AddShiftModal from './AddShiftModal';
import PlanningSettings from './PlanningSettings';
import { PlanningExportModal } from './PlanningExportModal';

import { planningApi, moduleApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { InfoModal } from '../InfoModal';
import { generatePlanningGridPDF } from './pdfExportUtils';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export const PlanningModule = () => {
    const { user } = useAuth();
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [planning, setPlanning] = useState<Planning | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [absenceTypes, setAbsenceTypes] = useState<{ code: string; isFullDay: boolean; autoApply: boolean; color?: string }[]>([]);
    const [extraTypes, setExtraTypes] = useState<string[]>(['Hôtesse LBE', 'Agent de sécurité', 'Extra Service', 'Extra Cuisine']);

    // Core data from CRM/RH
    const [dbEmployees, setDbEmployees] = useState<any[]>([]);
    const [roles, setRoles] = useState<{ id: string, label: string }[]>([]);

    const [viewMode, setViewMode] = useState<'SEMAINE' | 'JOUR'>('SEMAINE');
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isNewPlanningModalOpen, setIsNewPlanningModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'dashboard' | 'grid'>('dashboard');
    const [weeksList, setWeeksList] = useState<any[]>([]);
    const [isLoadingWeeks, setIsLoadingWeeks] = useState(false);
    const [archives, setArchives] = useState<any[]>([]);
    const [archiveSearch, setArchiveSearch] = useState('');
    const [archiveYearFilter, setArchiveYearFilter] = useState<string>('');
    const [weeklyDefaults, setWeeklyDefaults] = useState<Record<string, any>>({});
    const [dbAbsences, setDbAbsences] = useState<any[]>([]);
    const [showInfoModal, setShowInfoModal] = useState(true);

    const getDefaultShiftForEmployeeDay = useCallback((employeeId: string, date: string, dayIndex: number, currentTemplates: Template[], currentDefaults: any): Shift => {
        const defaultMap = (currentDefaults || {})[String(employeeId)] || {};
        const defaultKey = defaultMap[String(dayIndex)] || defaultMap[['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][dayIndex]];
        if (!defaultKey || defaultKey === 'REPOS') {
            return {
                date,
                type: 'repos',
                serviceType: 'none',
                segments: [{ type: 'code', label: 'REPOS' }],
            };
        }

        const template = (Array.isArray(currentTemplates) ? currentTemplates : []).find((t: Template) => String(t.id) === String(defaultKey));
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
    }, []);

    const [editingShift, setEditingShift] = useState<{ shift: Shift, employeeId: string, employeeName: string, employeeRole: string, date: string } | null>(null);
    const [editorPos, setEditorPos] = useState({ x: 0, y: 0 });

    const [openDayMenu, setOpenDayMenu] = useState<string | null>(null);
    const [clipboardDay, setClipboardDay] = useState<{ shifts: Record<string, Shift> } | null>(null);
    const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(new Set());
    const [rolesOrder, setRolesOrder] = useState<string[]>([]);
    const planningTableRef = useRef<HTMLDivElement>(null);

    const triggerAutoArchive = useCallback(async (weekStart: string, emps: any[], jobPosts: any[], sets: any) => {
        try {
            const p = await planningApi.getWeek(weekStart);
            if (!p) return;

            const roles = jobPosts.map((jp: any) => ({ id: jp.id, label: jp.title }));
            const rolesOrder = sets?.rolesOrder || [];

            const doc = await generatePlanningGridPDF({
                planning: p,
                roles,
                rolesOrder,
                employees: emps,
                companyName: user?.company_name || "Votre Établissement"
            });

            const pdfBase64 = doc.output('datauristring');
            const weekDate = parseISO(weekStart);
            const year = getYear(weekDate);
            const weekNum = getISOWeek(weekDate);
            const filename = `Planning_Hebdo_S${weekNum}_${year}.pdf`;

            await planningApi.archiveWeek({
                week_start: weekStart,
                year,
                week_number: weekNum,
                pdf_base64: pdfBase64,
                filename
            });

            const updatedArchs = await planningApi.getArchives();
            setArchives(updatedArchs || []);
        } catch (e) {
            console.error('Failed auto archive', e);
        }
    }, []);

    const handleOpenArchive = async (weekStart: string) => {
        try {
            const arch = await planningApi.getArchive(weekStart);
            if (arch && arch.pdf_base64) {
                const link = document.createElement('a');
                link.href = arch.pdf_base64;
                link.download = arch.filename;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (e) {
            console.error('Failed to open archive', e);
            alert('Impossible de charger l\'archive PDF.');
        }
    };

    const isWeekLocked = (weekStart: string | Date) => {
        const start = typeof weekStart === 'string' ? parseISO(weekStart) : weekStart;
        const end = addDays(start, 7); // Monday 00:00 next week
        return isBefore(end, new Date());
    };

    const loadData = useCallback(async () => {
        try {
            const [posts, emps, tpls, planningSettings, archs, absencesData] = await Promise.all([
                moduleApi.getJobPosts(),
                moduleApi.getEmployes(),
                planningApi.getTemplates(),
                planningApi.getSettings(),
                planningApi.getArchives(),
                planningApi.getAbsences()
            ]);
            setArchives(archs || []);
            setDbAbsences(Array.isArray(absencesData) ? absencesData : []);

            const finalRoles = (posts || []).map((p: any) => ({ id: p.id, label: p.title }));

            setRoles(finalRoles);
            setDbEmployees(emps || []);
            setTemplates(Array.isArray(tpls) ? tpls : []);

            const fetchedWeeklyDefaults = (planningSettings && typeof planningSettings === 'object' && (planningSettings as any).weeklyDefaults && typeof (planningSettings as any).weeklyDefaults === 'object')
                ? (planningSettings as any).weeklyDefaults
                : {};
            setWeeklyDefaults(fetchedWeeklyDefaults);
            const weeklyDefaultsRef = fetchedWeeklyDefaults; // local ref for current function scope
            const configuredAbsenceTypes = Array.isArray((planningSettings as any)?.absenceCodes)
                ? (planningSettings as any).absenceCodes.map((v: any) => {
                    const codeStr = v?.code || v?.label || (typeof v === 'string' ? v : 'ABS');
                    return {
                        code: String(codeStr),
                        isFullDay: v?.isFullDay ?? true,
                        autoApply: v?.autoApply ?? true,
                        color: v?.color || (String(codeStr) === 'REPOS' ? '#000000' : '#ffe39b')
                    };
                })
                : ABSENCE_TYPES.map(c => ({ code: c, isFullDay: true, autoApply: true, color: (String(c) === 'REPOS' ? '#000000' : '#ffe39b') }));

            const configuredExtraTypes = Array.isArray((planningSettings as any)?.extraTypes)
                ? (planningSettings as any).extraTypes.map((v: any) => String(v)).filter(Boolean)
                : ['Hôtesse LBE', 'Agent de sécurité', 'Extra Service', 'Extra Cuisine'];

            setAbsenceTypes(configuredAbsenceTypes);
            setExtraTypes(configuredExtraTypes);

            const configuredRolesOrder = Array.isArray((planningSettings as any)?.rolesOrder)
                ? (planningSettings as any).rolesOrder.map((v: any) => String(v))
                : [];
            setRolesOrder(Array.from(new Set(configuredRolesOrder)));

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
                const lastName = (emp.last_name || '').toUpperCase();
                const firstName = emp.first_name || '';
                const fullName = `${lastName} ${firstName}`.trim();
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
                        const defaultShift = getDefaultShiftForEmployeeDay(String(emp.id), d, i, templates, weeklyDefaultsRef);
                        
                        // Check for long term absence
                        const activeAbs = (absencesData || []).find((abs: any) => 
                            String(abs.employee_id) === String(emp.id) && 
                            d >= abs.start_date && d <= abs.end_date
                        );

                        if (activeAbs && defaultShift.type !== 'repos') {
                            shifts[d] = {
                                date: d,
                                type: 'absence',
                                serviceType: 'none',
                                segments: [{ type: 'code', label: activeAbs.absence_type || 'CP' }]
                            };
                        } else {
                            shifts[d] = defaultShift;
                        }
                    }
                    newRows.push({
                        employeeId: emp.id, employeeName: fullName, employeeRole: roleId,
                        isExtra: false, shifts
                    });
                }
            });

            // Remove rows of employees who are no longer active (only for non-locked weeks)
            if (!isWeekLocked(currentWeekStart)) {
                const activeEmpIds = new Set((emps || []).map((e: any) => String(e.id)));
                const filteredRows = newRows.filter(r => r.isExtra || activeEmpIds.has(String(r.employeeId)));
                if (filteredRows.length !== newRows.length) {
                    newRows = filteredRows;
                    hasChanges = true;
                }
            }

            // 5. If brand new planning, apply all defaults
            if (!pData) {
                newRows = newRows.map((row) => {
                    const shifts: Record<string, Shift> = {};
                    for (let i = 0; i < 7; i++) {
                        const d = format(addDays(currentWeekStart, i), 'yyyy-MM-dd');
                        const defaultShift = getDefaultShiftForEmployeeDay(String(row.employeeId), d, i, templates, fetchedWeeklyDefaults);
                        
                        // Check for long term absence
                        const activeAbs = (absencesData || []).find((abs: any) => 
                            String(abs.employee_id) === String(row.employeeId) && 
                            d >= abs.start_date && d <= abs.end_date
                        );

                        if (activeAbs && defaultShift.type !== 'repos') {
                            shifts[d] = {
                                date: d,
                                type: 'absence',
                                serviceType: 'none',
                                segments: [{ type: 'code', label: activeAbs.absence_type || 'CP' }]
                            };
                        } else {
                            shifts[d] = defaultShift;
                        }
                    }
                    return { ...row, shifts };
                });
                hasChanges = true;
            } else {
                // If existing Active/Future planning, ensure new employees or empty rows get defaults
                const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
                if (currentWeekStart >= monday) {
                    newRows = newRows.map(row => {
                        // Check if this row is essentially "empty" (only REPOS or no shifts)
                        const hasWork = Object.values(row.shifts || {}).some(s => s.type === 'travail');
                        if (!hasWork) {
                            const shifts: Record<string, Shift> = { ...row.shifts };
                            for (let i = 0; i < 7; i++) {
                                const d = format(addDays(currentWeekStart, i), 'yyyy-MM-dd');
                                if (!shifts[d] || shifts[d].type === 'repos') {
                                    const defaultShift = getDefaultShiftForEmployeeDay(String(row.employeeId), d, i, templates, fetchedWeeklyDefaults);
                                    
                                    // Check for long term absence
                                    const activeAbs = (absencesData || []).find((abs: any) => 
                                        String(abs.employee_id) === String(row.employeeId) && 
                                        d >= abs.start_date && d <= abs.end_date
                                    );

                                    if (activeAbs && defaultShift.type !== 'repos') {
                                        shifts[d] = {
                                            date: d,
                                            type: 'absence',
                                            serviceType: 'none',
                                            segments: [{ type: 'code', label: activeAbs.absence_type || 'CP' }]
                                        };
                                    } else {
                                        shifts[d] = defaultShift;
                                    }
                                }
                            }
                            hasChanges = true;
                            return { ...row, shifts };
                        }
                        return row;
                    });
                }
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

    const fetchWeeksList = useCallback(async () => {
        setIsLoadingWeeks(true);
        try {
            const [list, archs, sets, emps, jobPosts] = await Promise.all([
                planningApi.listWeeks(),
                planningApi.getArchives(),
                planningApi.getSettings(),
                moduleApi.getEmployes(),
                moduleApi.getJobPosts()
            ]);

            setWeeksList(list || []);
            setArchives(archs || []);

            // Auto-archive check
            const now = new Date();
            const finishedWeeks = (list || []).filter((w: any) => {
                const end = addDays(parseISO(w.week_start), 7);
                return isBefore(end, now);
            });

            for (const fw of finishedWeeks) {
                const alreadyArchived = (archs || []).some((a: any) => a.week_start === fw.week_start);
                if (!alreadyArchived) {
                    await triggerAutoArchive(fw.week_start, emps, jobPosts, sets);
                }
            }
        } catch (e) {
            console.error('Failed to fetch weeks list:', e);
        } finally {
            setIsLoadingWeeks(false);
        }
    }, [triggerAutoArchive]);

    useEffect(() => {
        if (view === 'dashboard') {
            fetchWeeksList();
        } else {
            loadData();
        }
    }, [view, loadData, fetchWeeksList]);

    const handleOpenWeek = (week: any) => {
        const dateStr = typeof week === 'string' ? week : week?.week_start;
        if (!dateStr) return;
        setCurrentWeekStart(parseISO(dateStr));
        setView('grid');
    };

    const handleDeleteWeek = async (id: string) => {
        if (!confirm('Voulez-vous vraiment supprimer ce planning ?')) return;
        try {
            await planningApi.deleteWeek(id);
            fetchWeeksList();
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const handleDeleteArchive = async (weekStart: string) => {
        if (!confirm('Voulez-vous vraiment supprimer cette archive ?')) return;
        try {
            // Dans planning_archives, l'id est souvent le week_start ou un UUID. 
            // ListWeeks nous renvoie les archives aussi.
            // On va chercher l'archive correspondante dans weeksList
            const arch = archives.find(w => w.week_start === weekStart);
            if (arch) {
                await planningApi.deleteArchive(arch.id);
                fetchWeeksList();
            }
        } catch (e) {
            alert('Erreur lors de la suppression de l\'archive');
        }
    };

    const handleCreateNewPlanning = (monday: string) => {
        setCurrentWeekStart(parseISO(monday));
        setIsNewPlanningModalOpen(false);
        setView('grid');
    };

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

    const handleAddShiftData = async (data: any) => {
        if (!planning) return;

        if (data.mode === 'absenceRange') {
            const startDateStr = String(data.startDate || '');
            const endDateStr = String(data.endDate || '');
            const employeeId = String(data.employeeId || '');
            const absenceCode = String(data.absenceType || 'CP');
            if (!employeeId || !startDateStr || !endDateStr) return;

            const start = parseISO(startDateStr);
            const end = parseISO(endDateStr);

            // 1. Enregistrer l'absence dans la table centrale pour gestion future
            try {
                await planningApi.saveAbsence({
                    employee_id: employeeId,
                    start_date: startDateStr,
                    end_date: endDateStr,
                    absence_type: absenceCode
                });
            } catch (e) {
                console.error('Failed to save central absence', e);
            }

            // 2. Collect all weeks affected
            const weekMondays: string[] = [];
            let curr = startOfWeek(start, { weekStartsOn: 1 });
            while (curr <= end) {
                weekMondays.push(format(curr, 'yyyy-MM-dd'));
                curr = addWeeks(curr, 1);
            }

            for (const monday of weekMondays) {
                try {
                    let p: Planning | null = null;
                    if (monday === format(currentWeekStart, 'yyyy-MM-dd')) {
                        p = planning;
                    } else {
                        p = await planningApi.getWeek(monday);
                    }

                    if (!p) continue; // NE PAS CRÉER de plannings manquants

                    // Apply absence to existing planning
                    let hasChanges = false;
                    const updatedRows = p.rows.map(row => {
                        if (String(row.employeeId) !== employeeId) return row;
                        const newShifts = { ...row.shifts };

                        const weekStart = parseISO(monday);
                        for (let i = 0; i < 7; i++) {
                            const dayDate = addDays(weekStart, i);
                            const dStr = format(dayDate, 'yyyy-MM-dd');

                            if (dStr >= startDateStr && dStr <= endDateStr) {
                                const existingShift = newShifts[dStr];
                                const isRepos = existingShift?.type === 'repos' ||
                                    existingShift?.segments?.some(s => s.label === 'REPOS') ||
                                    !existingShift;

                                if (!isRepos) {
                                    newShifts[dStr] = {
                                        date: dStr,
                                        type: 'absence',
                                        serviceType: 'none',
                                        segments: [{ type: 'code', label: absenceCode }],
                                    };
                                    hasChanges = true;
                                }
                            }
                        }
                        return { ...row, shifts: newShifts };
                    });

                    if (hasChanges) {
                        const finalPlanning = { ...p, rows: updatedRows };
                        await planningApi.saveWeek(finalPlanning);
                        if (monday === format(currentWeekStart, 'yyyy-MM-dd')) {
                            setPlanning(finalPlanning);
                        }
                    }
                } catch (e) {
                    console.error('Failed to apply absence to week', monday, e);
                }
            }
            
            // Recharger les absences locales pour les futurs affichages
            try {
                const updatedAbs = await planningApi.getAbsences();
                setDbAbsences(updatedAbs);
            } catch (e) {}

            fetchWeeksList();
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
            shifts: { 
                ...row.shifts, 
                [date]: { 
                    date, 
                    type: 'repos' as const, 
                    serviceType: 'none' as const, 
                    segments: [{ type: 'code' as const, label: 'REPOS' }],
                    isManual: true
                } 
            }
        }));
        savePlanning({ ...planning, rows: newRows });
        setOpenDayMenu(null);
    };

    const getShiftCounts = (shift: Shift | undefined) => {
        if (!shift) return { midi: 0, soir: 0 };
        let m = 0; let s = 0;
        const hasAbsence = shift.segments?.some(seg => (seg.label && absenceTypes.some(at => at.code === seg.label)) || seg.label === 'REPOS');
        if (hasAbsence) return { midi: 0, soir: 0 };

        const horaires = shift.segments?.filter(seg => seg.type === 'horaire') || [];
        if (horaires.length === 0) return { midi: 0, soir: 0 };

        const firstStart = horaires[0].start;
        const lastEnd = horaires[horaires.length - 1].end;
        if (!firstStart) return { midi: 0, soir: 0 };

        const isEvening = (time: string | undefined) => {
            if (!time || typeof time !== 'string') return false;
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

    const getMinutes = (time: string | undefined) => {
        if (!time || typeof time !== 'string') return 0;
        const [h, m] = time.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
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
            const counts = getShiftCounts(row?.shifts?.[dayDate]);
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
            const weeklyDefaults = (settings && typeof settings === 'object' && (settings as any).weeklyDefaults && typeof (settings as any).weeklyDefaults === 'object')
                ? (settings as any).weeklyDefaults
                : {};
            const templatesList = Array.isArray(tpls) ? tpls : [];
            const weekStartDates = Array.from({ length: 7 }, (_, i) => format(addDays(currentWeekStart, i), 'yyyy-MM-dd'));

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

    const applyWeeklyDefaultsToCurrentWeek = useCallback(async (targetEmployeeIds?: string[]) => {
        if (!planning) return;
        try {
            const [settings, tpls] = await Promise.all([planningApi.getSettings(), planningApi.getTemplates()]);
            const weeklyDefaults = (settings && typeof settings === 'object' && (settings as any).weeklyDefaults && typeof (settings as any).weeklyDefaults === 'object')
                ? (settings as any).weeklyDefaults
                : {};
            const templatesList = Array.isArray(tpls) ? tpls : [];
            const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(currentWeekStart, i), 'yyyy-MM-dd'));

            const newRows = planning.rows.map((row) => {
                if (targetEmployeeIds && !targetEmployeeIds.includes(String(row.employeeId))) return row;

                const newShifts: Record<string, Shift> = { ...row.shifts };
                for (let i = 0; i < 7; i++) {
                    const date = weekDates[i];

                    // PRESERVER LES ABSENCES : Si le jour a déjà une absence ou un code manuel, on ne touche à rien
                    const existingShift = row.shifts[date];
                    const isAbsence = existingShift?.type === 'absence' || existingShift?.segments?.some(seg => seg.type === 'code' && seg.label !== 'REPOS');
                    if (isAbsence) continue;

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

    const syncDefaultsToAllFutureWeeks = useCallback(async (targetEmployeeIds?: string[]) => {
        try {
            const [weeks, settings, tpls] = await Promise.all([
                planningApi.listWeeks(),
                planningApi.getSettings(),
                planningApi.getTemplates()
            ]);
            
            const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
            const futureWeeks = weeks.filter((w: any) => parseISO(w.week_start) >= monday);
            const weeklyDefaults = (settings as any)?.weeklyDefaults || {};
            const templatesList = Array.isArray(tpls) ? tpls : [];

            for (const w of futureWeeks) {
                const p = await planningApi.getWeek(w.week_start);
                if (!p) continue;

                const weekStart = parseISO(w.week_start);
                const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

                let hasChanges = false;
                const updatedRows = p.rows.map((row: any) => {
                    const rowEmpId = String(row.employeeId);
                    if (targetEmployeeIds && !targetEmployeeIds.includes(rowEmpId)) return row;

                    const hasManualWork = Object.values(row.shifts || {}).some((s: any) => (s as any).type === 'travail');
                    if (hasManualWork && !targetEmployeeIds) return row; // Don't overwrite manual work unless explicitly targeted

                    hasChanges = true;
                    const newShifts: Record<string, Shift> = { ...row.shifts };
                    for (let i = 0; i < 7; i++) {
                        const date = weekDates[i];

                        // PRESERVER LES ABSENCES : Si le jour a déjà une absence ou un code manuel, on ne touche à rien
                        const existingShift = row.shifts[date];
                        const isAbsence = existingShift?.type === 'absence' || existingShift?.segments?.some((seg: any) => seg.type === 'code' && seg.label !== 'REPOS');
                        if (isAbsence) continue;

                        const defaultMap = weeklyDefaults[rowEmpId] || {};
                        const defaultKey = defaultMap[String(i)];
                        if (!defaultKey || defaultKey === 'REPOS') {
                            newShifts[date] = { date, type: 'repos', serviceType: 'none', segments: [{ type: 'code', label: 'REPOS' }] };
                        } else {
                            const tpl = templatesList.find((t: any) => String(t.id) === String(defaultKey));
                            if (tpl) {
                                newShifts[date] = {
                                    date, type: 'travail', serviceType: tpl.serviceType || 'midi+soir',
                                    segments: tpl.slots.map((slot: any) => ({
                                        type: 'horaire', start: slot.start, end: slot.end, templateId: tpl.id, color: tpl.color
                                    }))
                                };
                            }
                        }
                    }
                    return { ...row, shifts: newShifts };
                });

                if (hasChanges) {
                    await planningApi.saveWeek({ ...p, rows: updatedRows, weekStart: w.week_start });
                }
            }
        } catch (e) {
            console.error('Failed to sync defaults to future weeks', e);
        }
    }, []);

    const handleSettingsDataChanged = useCallback(async (options?: { applyWeeklyDefaults?: boolean, changedEmployees?: string[] }) => {
        if (options?.applyWeeklyDefaults) {
            await applyWeeklyDefaultsToCurrentWeek(options.changedEmployees);
            await syncDefaultsToAllFutureWeeks(options.changedEmployees);
        }
        await loadData();
    }, [applyWeeklyDefaultsToCurrentWeek, syncDefaultsToAllFutureWeeks, loadData]);

    const groupedRows = useMemo(() => {
        if (!planning) return {};

        // 1. Map for normalization (id -> role, label.toLowerCase() -> role)
        const roleMap = new Map<string, { id: string; label: string }>();
        roles.forEach(r => {
            const rid = String(r.id);
            roleMap.set(rid, r);
            roleMap.set(r.label.toLowerCase(), r);
        });

        // 2. Filter employees by search term
        const filtered = planning.rows.filter(r => {
            const search = searchTerm.toLowerCase();
            if (!search) return true;
            if (r.employeeName.toLowerCase().includes(search)) return true;
            const role = roleMap.get(String(r.employeeRole)) || roleMap.get(String(r.employeeRole).toLowerCase());
            if (role && role.label.toLowerCase().includes(search)) return true;
            if (String(r.employeeRole).toLowerCase().includes(search)) return true;
            return false;
        });

        // 3. Group employees by Role ID (if possible) or standardized key
        const groups = new Map<string, PlanningRow[]>();
        filtered.forEach(r => {
            const role = roleMap.get(String(r.employeeRole)) || roleMap.get(String(r.employeeRole).toLowerCase());
            const key = role ? String(role.id) : String(r.employeeRole);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(r);
        });

        // 4. Sort employees within each group by name
        groups.forEach(rows => {
            rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'fr', { sensitivity: 'base' }));
        });

        const sortedGroups: { roleId: string; rows: PlanningRow[] }[] = [];
        const handledKeys = new Set<string>();

        // 5. Apply explicit rolesOrder
        if (rolesOrder && rolesOrder.length > 0) {
            rolesOrder.forEach(id => {
                const sid = String(id);
                if (!handledKeys.has(sid)) {
                    sortedGroups.push({ roleId: sid, rows: groups.get(sid) || [] });
                    handledKeys.add(sid);
                }
            });
        }

        // 6. Add remaining roles from the 'roles' list in order
        roles.forEach(r => {
            const rid = String(r.id);
            if (!handledKeys.has(rid)) {
                sortedGroups.push({ roleId: rid, rows: groups.get(rid) || [] });
                handledKeys.add(rid);
            }
        });

        // 7. Add any remaining groups from the data that were not in the roles list
        groups.forEach((rows, key) => {
            const skey = String(key);
            if (!handledKeys.has(skey)) {
                sortedGroups.push({ roleId: skey, rows });
            }
        });

        return sortedGroups;
    }, [planning, searchTerm, roles, rolesOrder]);

    const getRoleLabel = (roleId: string) => roles.find(r => String(r.id) === String(roleId))?.label || roleId;

    if (view === 'dashboard') {
        return (
            <div className="max-w-[1700px] mx-auto p-4">
                <DashboardView
                    user={user}
                    weeks={weeksList}
                    onOpen={handleOpenWeek}
                    onDelete={handleDeleteWeek}
                    onDeleteArchive={handleDeleteArchive}
                    onNew={() => setIsNewPlanningModalOpen(true)}
                    setIsSettingsOpen={setIsSettingsOpen}
                    isLoading={isLoadingWeeks}
                    handleOpenArchive={handleOpenArchive}
                />
                <NewPlanningModal
                    isOpen={isNewPlanningModalOpen}
                    onClose={() => setIsNewPlanningModalOpen(false)}
                    onCreate={handleCreateNewPlanning}
                />
            </div>
        );
    }

    if (!planning) return <div className="p-10 text-center text-slate-500 dark:text-slate-400">Chargement du planning...</div>;
    const weekStartDates = Array.from({ length: 7 }, (_, i) => format(addDays(currentWeekStart, i), 'yyyy-MM-dd'));
    const displayedDates = viewMode === 'JOUR' ? [weekStartDates[selectedDayIndex]] : weekStartDates;

    return (
        <div className="p-4 md:p-8 min-h-screen dark:bg-[#0A0A0A]">
            <div className="space-y-5 font-sans text-slate-800 dark:text-slate-200 max-w-[1700px] mx-auto bg-slate-100 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                <header className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm px-4 py-3 md:px-5 md:py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setView('dashboard')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold transition-all"
                        >
                            <ArrowLeft size={18} /> Dashboard
                        </button>
                        <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 mx-1" />
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{user?.company_name || 'PLANNING'}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Semaine du</span>
                                <span className="text-sm font-bold text-[#4AA3A2]">{format(currentWeekStart, 'dd MMMM yyyy', { locale: fr })}</span>
                            </div>
                        </div>
                        <div className="hidden md:flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg ml-4">
                            <button onClick={() => setViewMode('SEMAINE')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'SEMAINE' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#4AA3A2]' : 'text-slate-500 dark:text-slate-400'}`}>Semaine</button>
                            <button onClick={() => setViewMode('JOUR')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'JOUR' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#4AA3A2]' : 'text-slate-500 dark:text-slate-400'}`}>Jour</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input className="pl-8 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-xl outline-none focus:border-[#4AA3A2] transition-all w-full lg:w-56" placeholder="Filtrer employé..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1 bg-[#4AA3A2] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:brightness-95"><Plus size={16} /> Ajouter</button>
                        <button onClick={handleResetWeek} className="p-2 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 rounded-xl" title="Réinitialiser semaine"><RefreshCw size={18} /></button>
                        <button onClick={() => setIsExportModalOpen(true)} className="p-2 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 rounded-xl" title="Exporter PDF"><FileDown size={18} /></button>
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl"><Settings size={18} /></button>
                    </div>
                </header>

                <div className="py-2 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-4 pb-2 px-1">
                        {weekStartDates.map((date, idx) => {
                            const kpi = getKPIs(date);
                            const isSelected = viewMode === 'JOUR' && idx === selectedDayIndex;
                            return (
                                <div
                                    key={date}
                                    onClick={() => {
                                        setViewMode('JOUR');
                                        setSelectedDayIndex(idx);
                                    }}
                                    className={`flex flex-col p-3 rounded-xl border transition-all min-w-[140px] cursor-pointer ${isSelected ? 'bg-white dark:bg-slate-800 border-[#4AA3A2] shadow-md ring-1 ring-[#4AA3A2]/20' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 shadow-sm'}`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">
                                            {format(parseISO(date), 'EEE dd', { locale: fr }).toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="flex gap-3 items-center mb-2">
                                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            Midi : <strong className="text-[#ea580c] dark:text-orange-400 ml-1">{kpi.midi}</strong>
                                        </div>
                                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            Soir : <strong className="text-[#2563eb] dark:text-blue-400 ml-1">{kpi.soir}</strong>
                                        </div>
                                    </div>

                                    {kpi.extras.length > 0 && (
                                        <div className="space-y-1 mt-1">
                                            {kpi.extras.map((extra) => (
                                                <div key={extra.id} className="group relative bg-[#f5f3ff] dark:bg-purple-500/10 rounded-lg p-2 border border-purple-100 dark:border-purple-500/20 transition-all hover:shadow-sm">
                                                    <div className="flex justify-between items-center gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[11px] font-black text-purple-900 dark:text-purple-300 uppercase leading-tight truncate">
                                                                {extra.count}x {extra.label}
                                                            </div>
                                                            <div className="text-[9px] text-purple-500 dark:text-purple-400 font-bold mt-0.5">
                                                                {extra.start}-{extra.end}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteExtra(extra.id); }}
                                                            className="text-purple-300 hover:text-red-500 transition-colors p-0.5"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>



                <div ref={planningTableRef} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[980px]">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-40 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-white/10 p-3 text-left w-72 text-slate-500 font-semibold">Employé</th>
                                {displayedDates.map((d, i) => {
                                    const originalIndex = weekStartDates.indexOf(d);
                                    const kpi = getKPIs(d);
                                    return (
                                        <th key={d} className="border-b border-r border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-2 min-w-[120px] text-center relative group">
                                            <div className="flex justify-center items-center gap-1">
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{DAYS[originalIndex]}</span>
                                                <span className="text-xs text-slate-400 font-normal">{format(parseISO(d), 'dd/MM')}</span>
                                                <button onClick={() => setOpenDayMenu(openDayMenu === d ? null : d)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded absolute right-1 top-2"><MoreHorizontal size={14} /></button>
                                            </div>
                                            <div className="flex justify-center gap-3 text-[11px] mt-1 font-medium">
                                                <span className="text-orange-600">{kpi.midi} m</span>
                                                <span className="text-indigo-600">{kpi.soir} s</span>
                                            </div>

                                            {openDayMenu === d && (
                                                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-lg rounded-lg py-1 z-50 w-40 text-left font-normal text-sm">
                                                    <button onClick={() => handleCopyDay(d)} className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Copy size={14} /> Copier jour</button>
                                                    <button onClick={() => handlePasteDay(d)} disabled={!clipboardDay} className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50"><Clipboard size={14} /> Coller jour</button>
                                                    <div className="border-t border-slate-100 dark:border-white/10 my-1"></div>
                                                    <button onClick={() => handleClearDay(d)} className="w-full px-4 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center gap-2"><Trash2 size={14} /> Vider jour</button>
                                                </div>
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.isArray(groupedRows) && groupedRows.map(({ roleId, rows }) => (
                                <React.Fragment key={roleId}>
                                    <tr className="cursor-pointer hover:opacity-90 transition-opacity" onClick={() => toggleRoleCollapse(roleId)}>
                                        <td colSpan={displayedDates.length + 1} className="p-3 bg-[#A7E0E0] dark:bg-[#2A5A5A] text-[#1f3a4a] dark:text-[#E0FFFF] text-sm font-bold border-b dark:border-white/10 tracking-wider uppercase sticky left-0 z-20 text-center transition-colors">
                                            <div className="flex items-center justify-center gap-2">
                                                {collapsedRoles.has(roleId) ? <ChevronRight size={18} /> : <ChevronDown size={18} />} {getRoleLabel(roleId)}
                                                <span className="text-[10px] font-normal bg-white/40 dark:bg-white/10 px-2 py-0.5 rounded-full">{rows.length}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {!collapsedRoles.has(roleId) && rows.map(row => {
                                        const totalMinutes = displayedDates.reduce((acc, d) => acc + calculateShiftDuration(row.shifts[d]), 0);
                                        return (
                                            <tr key={row.employeeId} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                                <td className="sticky left-0 z-30 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-white/10 p-3 font-medium text-slate-800 dark:text-slate-200">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold">{row.employeeName}</span>
                                                        {totalMinutes > 0 && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1 mt-0.5"><Clock size={10} /> {formatDuration(totalMinutes)}</span>}
                                                    </div>
                                                </td>
                                                {displayedDates.map(date => {
                                                    const isLocked = isWeekLocked(date);
                                                    return (
                                                        <td key={date} className={`border-b border-r border-slate-200 dark:border-white/10 p-1 h-14 relative ${isLocked ? 'cursor-default bg-slate-50/30 dark:bg-white/5' : 'cursor-pointer'}`} onClick={(e) => {
                                                            if (isLocked) return;
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setEditorPos({ x: rect.left, y: rect.bottom + window.scrollY });
                                                            setEditingShift({
                                                                shift: row.shifts[date] || { date, type: 'repos', serviceType: 'none', segments: [] },
                                                                employeeId: row.employeeId, employeeName: row.employeeName, employeeRole: row.employeeRole, date
                                                            });
                                                        }}>
                                                            <ShiftCell shift={row.shifts[date]} templates={templates} absenceTypes={absenceTypes} />
                                                            {isLocked && <div className="absolute inset-0 bg-slate-100/5 z-10" />}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                    {!collapsedRoles.has(roleId) && (
                                        <tr className="bg-slate-50/70 dark:bg-slate-900/50">
                                            <td className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-white/10 p-2 text-right text-xs font-bold text-slate-500 uppercase tracking-tighter">TOTAL {getRoleLabel(roleId)}</td>
                                            {displayedDates.map((date) => {
                                                const totals = getGroupTotals(rows as PlanningRow[], date);
                                                return (
                                                    <td key={`${roleId}-total-${date}`} className="border-b border-r border-slate-200 dark:border-white/10 p-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                        {(totals.midi > 0 || totals.soir > 0)
                                                            ? <span><span className={totals.midi > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-300 dark:text-slate-700'}>{totals.midi} m</span><span className="mx-1 text-slate-300 dark:text-slate-700">/</span><span className={totals.soir > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-700'}>{totals.soir} s</span></span>
                                                            : <span className="text-slate-300 dark:text-slate-700">-</span>
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
                                    <tr><td colSpan={displayedDates.length + 1} className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-bold border-b dark:border-white/10 tracking-wider uppercase sticky left-0 z-20">RENFORTS (EXTRAS)</td></tr>
                                    <tr>
                                        <td className="sticky left-0 z-30 bg-purple-50/30 dark:bg-purple-900/10 border-b border-r dark:border-white/10 p-3"></td>
                                        {displayedDates.map(date => {
                                            const dayExtras = planning.extraShifts.filter(e => e.date === date);
                                            return (
                                                <td key={date} className="border-b border-r dark:border-white/10 p-1 align-top bg-purple-50/10 dark:bg-purple-900/5">
                                                    <div className="space-y-1">
                                                        {dayExtras.map(extra => (
                                                            <div key={extra.id} className="group flex justify-between items-center text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 rounded px-1.5 py-1 transition-colors">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold">{extra.count}x {extra.label}</span>
                                                                    <span className="opacity-70">{extra.start}-{extra.end}</span>
                                                                </div>
                                                                <button onClick={() => handleDeleteExtra(extra.id)} className="text-purple-400 dark:text-purple-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Trash2 size={12} /></button>
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
                        availableTemplates={templates}
                        onSave={(updated) => handleShiftUpdate(updated)}
                        onClose={() => setEditingShift(null)}
                        position={editorPos}
                        currentDate={editingShift.date}
                        absenceTypes={absenceTypes}
                    />
                )}

                {isAddModalOpen && (
                    <AddShiftModal
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        employees={dbEmployees.map(e => ({ 
                            id: e.id, 
                            name: `${(e.last_name || '').toUpperCase()} ${e.first_name || ''}`.trim(), 
                            role: e.position 
                        })).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))}
                        currentDate={format(currentWeekStart, 'yyyy-MM-dd')}
                        weekDates={weekStartDates}
                        extraTypes={extraTypes}
                        absenceTypes={absenceTypes}
                        onAdd={handleAddShiftData}
                    />
                )}

                {isSettingsOpen && (
                    <PlanningSettings
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        employees={dbEmployees}
                        roles={roles}
                        canManageGlobalTypes={user?.type === 'admin'}
                        onDataChanged={handleSettingsDataChanged}
                    />
                )}

                {isExportModalOpen && (
                    <PlanningExportModal
                        isOpen={isExportModalOpen}
                        onClose={() => setIsExportModalOpen(false)}
                        planning={planning}
                        roles={roles}
                        rolesOrder={rolesOrder}
                        currentWeekStart={currentWeekStart}
                        weekDates={weekStartDates}
                        selectedDayIndex={selectedDayIndex}
                        employees={dbEmployees}
                    />
                )}
            </div>
        </div>
    );
};

// --- Sub-Components for Dashboard ---

function DashboardView({ user, weeks, onOpen, onDelete, onDeleteArchive, onNew, isLoading, setIsSettingsOpen, handleOpenArchive }: any) {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'recent' | 'old'>('recent');
    const [archiveYearFilter, setArchiveYearFilter] = useState<string>('');

    const filteredWeeks = useMemo(() => {
        let list = [...weeks];
        if (search) {
            const s = search.toLowerCase();
            list = list.filter(w => w.id.toLowerCase().includes(s) || (w.status || '').toLowerCase().includes(s) || (w.label || '').toLowerCase().includes(s));
        }
        if (archiveYearFilter) {
            list = list.filter(w => {
                const date = parseISO(w.week_start || w.id);
                return String(getYear(date)) === archiveYearFilter;
            });
        }
        list.sort((a, b) => {
            if (sortBy === 'recent') return b.week_start.localeCompare(a.week_start);
            return a.week_start.localeCompare(b.week_start);
        });
        return list;
    }, [weeks, search, sortBy, archiveYearFilter]);

    const activeWeeks = useMemo(() => {
        const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
        return filteredWeeks.filter(w => parseISO(w.week_start) >= monday);
    }, [filteredWeeks]);

    const archivedWeeks = useMemo(() => {
        const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
        return filteredWeeks.filter(w => parseISO(w.week_start) < monday);
    }, [filteredWeeks]);

    const years = useMemo(() => {
        const y = new Set<string>();
        weeks.forEach((w: any) => {
            const date = parseISO(w.week_start);
            if (!isNaN(date.getTime())) y.add(String(getYear(date)));
        });
        return Array.from(y).sort().reverse();
    }, [weeks]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Planning</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Gérez les plannings hebdomadaires de votre établissement.</p>
                </div>
                <div className="flex items-center gap-3">

                    <button
                        onClick={onNew}
                        className="flex items-center gap-2 px-6 py-3 bg-[#4AA3A2] text-white rounded-2xl font-bold shadow-lg shadow-[#4AA3A2]/20 hover:brightness-95 transition-all active:scale-95"
                    >
                        <Plus size={20} /> Nouvelle semaine
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500"><CalendarIcon size={24} /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Semaines</p>
                        <p className="text-xl font-black text-slate-800 dark:text-white">{weeks.length}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500"><CheckCircle2 size={24} /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Actifs</p>
                        <p className="text-xl font-black text-slate-800 dark:text-white">{weeks.filter((w: any) => parseISO(w.week_start) >= startOfWeek(new Date(), { weekStartsOn: 1 })).length}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-100 dark:border-white/10 w-full md:w-96">
                        <Search size={18} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher une semaine..."
                            className="bg-transparent border-none outline-none text-sm font-medium w-full text-slate-600 dark:text-slate-300 placeholder:text-slate-400"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={archiveYearFilter}
                            onChange={(e) => setArchiveYearFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none"
                        >
                            <option value="">Toutes les années</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none"
                        >
                            <option value="recent">Plus récent</option>
                            <option value="old">Plus ancien</option>
                        </select>
                    </div>
                </div>

                <div className="p-6">
                    {isLoading ? (
                        <div className="py-20 text-center flex flex-col items-center gap-3">
                            <RefreshCw size={32} className="animate-spin text-slate-300" />
                            <p className="text-slate-400 font-medium">Chargement des plannings...</p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            <section>
                                <div className="flex items-center gap-2 mb-6 ml-2">
                                    <div className="h-4 w-1 rounded-full bg-emerald-500" />
                                    <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Plannings Actifs</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {activeWeeks.length > 0 ? activeWeeks.map(w => (
                                        <WeekCard key={w.id} week={w} user={user} onOpen={() => onOpen(w.week_start)} onDelete={() => onDelete(w.id)} />
                                    )) : (
                                        <div className="col-span-full py-16 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-white/50 dark:bg-white/5">
                                            <LayoutPanelLeft size={48} className="mb-4 opacity-10" />
                                            <p className="font-bold text-lg">Aucun planning actif</p>
                                            <button onClick={onNew} className="text-sm text-[#4AA3A2] font-black underline mt-2 hover:text-[#3d8786]">Créer ma première semaine</button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {archivedWeeks.length > 0 && (
                                <section>
                                    <div className="flex items-center gap-2 mb-6 ml-2">
                                        <div className="h-4 w-1 rounded-full bg-slate-400" />
                                        <h2 className="text-lg font-black text-slate-400 tracking-tight">Archives</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {archivedWeeks.map(w => (
                                            <WeekCard
                                                key={w.id}
                                                week={w}
                                                user={user}
                                                onOpen={() => onOpen(w.week_start)}
                                                onDelete={() => onDeleteArchive(w.week_start)}
                                                isArchived
                                                handleOpenArchive={handleOpenArchive}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function WeekCard({ week, user, onOpen, onDelete, isArchived, handleOpenArchive }: any) {
    const isAdmin = user?.type === 'admin';
    const date = parseISO(week.week_start);
    const dateEnd = addDays(date, 6);
    const isCurrentWeek = isSameDay(date, startOfWeek(new Date(), { weekStartsOn: 1 }));

    return (
        <div
            onClick={() => isArchived ? handleOpenArchive(week.week_start) : onOpen()}
            className={`group relative bg-white dark:bg-slate-800 border-x border-b border-slate-200 dark:border-white/10 rounded-[1.5rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden border-t-4 ${isArchived ? 'border-t-slate-300 dark:border-t-slate-600' : 'border-t-blue-500'}`}
        >
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarIcon size={12} /> SEMAINE {getISOWeek(date)}
                    </div>
                    {isCurrentWeek && (
                        <div className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded text-[9px] font-black uppercase">En cours</div>
                    )}
                </div>

                <h4 className="text-lg font-black text-slate-800 dark:text-white leading-tight mb-1">{format(date, 'MMMM yyyy', { locale: fr }).toUpperCase()}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Du {format(date, 'dd', { locale: fr })} au {format(dateEnd, 'dd MMMM', { locale: fr })}</p>

                <div className="mt-6 flex items-center justify-between border-t border-slate-50 dark:border-white/5 pt-4">
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-900 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                <Users size={12} />
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {(!isArchived || isAdmin) && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                title="Supprimer"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        <div className={`p-2 rounded-xl transition-all ${isArchived ? 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 group-hover:bg-slate-100 dark:group-hover:bg-slate-700' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 dark:group-hover:bg-blue-500 group-hover:text-white'}`}>
                            <ChevronRight size={18} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const CheckCircle2 = ({ size, className }: any) => <RefreshCw size={size} className={className} />;

const NewPlanningModal = ({ isOpen, onClose, onCreate }: any) => {
    const [selectedDate, setSelectedDate] = useState<string>('');

    const handleDateChange = (date: string) => {
        if (!date) return;
        const d = parseISO(date);
        const monday = startOfWeek(d, { weekStartsOn: 1 });
        setSelectedDate(format(monday, 'yyyy-MM-dd'));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10">
                <div className="p-10 text-center">
                    <div className="h-20 w-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <CalendarIcon size={36} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Nouveau Planning</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-3 font-medium px-4">Choisissez une semaine pour commencer. La date sera automatiquement ajustée au lundi.</p>

                    <div className="mt-10 space-y-4 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6">Choisir une date</label>
                        <div className="relative">
                            <input
                                type="date"
                                className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-white/10 rounded-[1.5rem] px-6 py-5 text-slate-700 dark:text-white font-bold focus:border-[#4AA3A2] focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-[#4AA3A2]/5 outline-none transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-6 [&::-webkit-calendar-picker-indicator]:w-6 [&::-webkit-calendar-picker-indicator]:h-6 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert"
                                value={selectedDate}
                                onClick={(e) => {
                                    try {
                                        if ('showPicker' in HTMLInputElement.prototype) {
                                            (e.target as HTMLInputElement).showPicker();
                                        }
                                    } catch (err) { }
                                }}
                                onChange={(e) => handleDateChange(e.target.value)}
                            />
                        </div>

                        {selectedDate && (
                            <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-[1.5rem] p-5 flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="h-12 w-12 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm font-black text-lg border border-emerald-50 dark:border-white/5">
                                    {format(parseISO(selectedDate), 'dd')}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">Semaine du lundi</p>
                                    <p className="text-base font-black text-slate-700 dark:text-white">{format(parseISO(selectedDate), 'dd MMMM yyyy', { locale: fr })}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50 flex gap-4 border-t border-slate-100 dark:border-white/5">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-4 rounded-2xl font-black text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all uppercase text-xs tracking-widest"
                    >
                        Annuler
                    </button>
                    <button
                        disabled={!selectedDate}
                        onClick={() => onCreate(selectedDate)}
                        className="flex-1 px-6 py-4 rounded-2xl font-black bg-[#4AA3A2] text-white shadow-xl shadow-[#4AA3A2]/30 disabled:opacity-30 disabled:shadow-none hover:brightness-110 active:scale-[0.98] transition-all uppercase text-xs tracking-widest"
                    >
                        Confirmer
                    </button>
                </div>
            </div>
        </div>
    );
};
