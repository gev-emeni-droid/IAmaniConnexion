
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Settings, Users, Download, Plus, Search, ArrowLeft, Edit2, LogOut, Clock, Trash2, MoreHorizontal, Copy, Clipboard, Calculator, RefreshCw, FileText } from 'lucide-react';
import { getPlannings, updatePlanning, getTemplates, getRoles, getEmployees } from '../services/storage';
import { Planning, PlanningRow, Shift, Template, ExtraShift, ABSENCE_TYPES, ShiftSegment, ShiftType, ShiftServiceType } from '../types';
import { format, parseISO, addDays, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import ShiftEditor from '../components/ShiftEditor';
import SettingsModal from '../components/SettingsModal';
import AddShiftModal from '../components/AddShiftModal';
import EditEmployeeModal from '../components/EditEmployeeModal';
import ExportModal from '../components/ExportModal';
import { generatePDF } from '../services/pdfService';
import { applyTheme } from '../services/theme';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];


const PlanningView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [roles, setRoles] = useState<{ id: string; label: string }[]>([]);
  const [viewMode, setViewMode] = useState<'SEMAINE' | 'JOUR'>('SEMAINE');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // 0 = Monday
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [editingEmployee, setEditingEmployee] = useState<{ id: string, name: string, role: string } | null>(null);
  const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(new Set());
  const [editingShift, setEditingShift] = useState<{ shift: Shift, employeeId: string, employeeName: string, employeeRole: string, date: string } | null>(null);
  const [editorPos, setEditorPos] = useState({ x: 0, y: 0 });

  // Day Menu State
  const [openDayMenu, setOpenDayMenu] = useState<string | null>(null);
  const [clipboardDay, setClipboardDay] = useState<{ shifts: Record<string, Shift> } | null>(null);

  const loadPlanningData = useCallback(async () => {
    try {
      const rolesData = await getRoles();
      const finalRoles = Array.isArray(rolesData) ? rolesData : [];
      const roleIndexMap = new Map(finalRoles.map((role, index) => [role.id, index]));
      const getRoleRank = (roleId: string) => {
        const rank = roleIndexMap.get(roleId);
        return rank === undefined ? Number.MAX_SAFE_INTEGER : rank;
      };

      if (id) {
        const all = await getPlannings();
        let p = Array.isArray(all) ? all.find(x => x.id === id) : null;
        const loadedTemplates = await getTemplates();

        if (p) {
          // SYNC: Ensure planning reflects current employees
          const employees = await getEmployees();
          const activeEmployees = employees.filter(e => e.isActive);
          let hasChanges = false;
          let newRows = [...p.rows];

          // 1. Update existing rows with latest employee details AND remove deleted employees
          const activeEmployeeIds = new Set(activeEmployees.map(e => e.id));

          // Filter out rows for employees that no longer exist or are inactive
          const filteredRows = newRows.filter(row => activeEmployeeIds.has(row.employeeId));

          if (filteredRows.length !== newRows.length) {
            hasChanges = true;
            newRows = filteredRows;
          }

          newRows = newRows.map(row => {
            const emp = employees.find(e => e.id === row.employeeId);
            if (emp) {
              if (row.employeeName !== emp.name || row.employeeRole !== emp.role) {
                hasChanges = true;
                return { ...row, employeeName: emp.name, employeeRole: emp.role };
              }
            }
            return row;
          });

          // 2. Add missing active employees
          const weekStart = parseISO(p.weekStart);
          activeEmployees.forEach(emp => {
            if (!newRows.find(r => r.employeeId === emp.id)) {
              hasChanges = true;
              const shifts: Record<string, any> = {};

              for (let i = 0; i < 7; i++) {
                const dateObj = addDays(weekStart, i);
                const d = format(dateObj, 'yyyy-MM-dd');

                // --- APPLY WEEKLY DEFAULT ---
                const defaultTplId = emp.weeklyDefault?.[i.toString()];
                let newSegments: ShiftSegment[] = [];
                let type: ShiftType = 'repos';
                let serviceType: ShiftServiceType = 'none';

                if (defaultTplId && defaultTplId !== 'repos') {
                  const tpl = loadedTemplates.find(t => t.id === defaultTplId);
                  if (tpl) {
                    type = 'travail';
                    // Recalculate serviceType based on actual slot times
                    const firstStart = tpl.slots[0]?.start;
                    const lastEnd = tpl.slots[tpl.slots.length - 1]?.end;
                    if (firstStart) {
                      if (firstStart < "12:00") {
                        serviceType = lastEnd && lastEnd > "18:00" ? 'midi+soir' : 'midi';
                      } else if (firstStart >= "16:00") {
                        serviceType = 'soir';
                      } else {
                        serviceType = lastEnd && lastEnd > "18:00" ? 'soir' : 'midi';
                      }
                    }
                    newSegments = tpl.slots.map(slot => ({
                      type: 'horaire',
                      start: slot.start,
                      end: slot.end,
                      templateId: tpl.id,
                      color: tpl.color,
                      hasOverride: false
                    }));
                  } else {
                    newSegments = [{ type: 'code', label: 'REPOS' }];
                  }
                } else {
                  newSegments = [{ type: 'code', label: 'REPOS' }];
                }

                shifts[d] = {
                  date: d,
                  type,
                  serviceType,
                  segments: newSegments
                };
              }

              newRows.push({
                employeeId: emp.id,
                employeeName: emp.name,
                employeeRole: emp.role,
                isExtra: false,
                shifts
              });
            }
          });

          // Keep planning row order aligned with current roles order from settings.
          newRows.sort((a, b) => {
            const roleIndexA = getRoleRank(a.employeeRole);
            const roleIndexB = getRoleRank(b.employeeRole);
            if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB;
            return a.employeeName.localeCompare(b.employeeName);
          });

          if (hasChanges) {
            p = { ...p, rows: newRows };
            await updatePlanning(p);
          }

          setPlanning(p);
        } else {
          navigate('/');
        }
      }
      const tmpls = await getTemplates();
      setTemplates(Array.isArray(tmpls) ? tmpls : []);

      console.log('Roles loaded:', finalRoles);
      setRoles(finalRoles);
    } catch (err) {
      console.error('Failed to load planning data:', err);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadPlanningData();
  }, [loadPlanningData, isSettingsOpen, editingEmployee]);

  const savePlanning = async (updated: Planning) => {
    try {
      await updatePlanning(updated);
      setPlanning(updated);
    } catch (err) {
      console.error('Failed to save planning:', err);
    }
  };

  const handleShiftUpdate = (updatedShift: Shift) => {
    if (!planning || !editingShift) return;
    const newRows = planning.rows.map(row => {
      if (row.employeeId === editingShift.employeeId) {
        return {
          ...row,
          shifts: {
            ...row.shifts,
            [editingShift.date]: updatedShift
          }
        };
      }
      return row;
    });
    savePlanning({ ...planning, rows: newRows });
  };

  const handleBatchShiftUpdate = (dates: string[], shift: Shift) => {
    if (!planning || !editingShift) return;
    const newRows = planning.rows.map(row => {
      if (row.employeeId === editingShift.employeeId) {
        const newShifts = { ...row.shifts };
        dates.forEach(d => {
          newShifts[d] = { ...shift, date: d };
        });
        return { ...row, shifts: newShifts };
      }
      return row;
    });
    savePlanning({ ...planning, rows: newRows });
  };

  const handleAddShiftData = (data: {
    employeeId: string;
    employeeName: string;
    employeeRole: string;
    isExtra: boolean;
    date?: string;
    dates?: string[];
    shift: Shift;
    extraCount?: number;
    extraType?: "Hôtesse LBE" | "Brigad Plage" | "Agent de sécurité";
  }) => {
    if (!planning) return;

    if (data.isExtra && data.date) {
      const segment = data.shift.segments.find(s => s.type === 'horaire');
      if (segment && segment.start && segment.end) {
        const newExtra: ExtraShift = {
          id: crypto.randomUUID(),
          planningId: planning.id,
          label: data.extraType || "Hôtesse LBE",
          date: data.date,
          start: segment.start,
          end: segment.end,
          count: data.extraCount || 1
        };
        savePlanning({
          ...planning,
          extraShifts: [...(planning.extraShifts || []), newExtra]
        });
      }
    } else if (data.dates && data.dates.length > 0) {
      // This block handles batch shift adding (not Long Absence which is handled via storage directly, 
      // but if AddShiftModal passes dates for standard shifts, this handles it)
      let updatedRows = [...planning.rows];
      const existingRowIndex = updatedRows.findIndex(r => r.employeeId === data.employeeId);
      if (existingRowIndex !== -1) {
        const row = { ...updatedRows[existingRowIndex], shifts: { ...updatedRows[existingRowIndex].shifts } };
        data.dates.forEach(d => {
          row.shifts[d] = { ...data.shift, date: d };
        });
        updatedRows[existingRowIndex] = row;
      }
      savePlanning({ ...planning, rows: updatedRows });
    } else if (data.date) {
      let updatedRows = [...planning.rows];
      const existingRowIndex = updatedRows.findIndex(r => r.employeeId === data.employeeId);
      if (existingRowIndex !== -1) {
        updatedRows[existingRowIndex] = {
          ...updatedRows[existingRowIndex],
          shifts: { ...updatedRows[existingRowIndex].shifts, [data.date]: data.shift }
        };
      } else {
        const newRow: PlanningRow = {
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          employeeRole: data.employeeRole,
          isExtra: data.isExtra,
          shifts: {}
        };
        const start = parseISO(planning.weekStart);
        for (let i = 0; i < 7; i++) {
          const d = format(addDays(start, i), 'yyyy-MM-dd');
          newRow.shifts[d] = { date: d, type: 'repos' as const, serviceType: 'none' as const, segments: [{ type: 'code' as const, label: 'REPOS' }] };
        }
        newRow.shifts[data.date] = data.shift;
        updatedRows.push(newRow);
      }
      savePlanning({ ...planning, rows: updatedRows });
    }
  };

  const handleDeleteExtra = (extraId: string) => {
    if (!planning) return;
    if (!confirm("Supprimer ce renfort ?")) return;
    const updatedExtras = (planning.extraShifts || []).filter(e => e.id !== extraId);
    savePlanning({ ...planning, extraShifts: updatedExtras });
  };

  const handleCopyDay = (date: string) => {
    if (!planning) return;
    const shifts: Record<string, Shift> = {};
    planning.rows.forEach(row => {
      if (row.shifts[date]) {
        shifts[row.employeeId] = row.shifts[date];
      }
    });
    setClipboardDay({ shifts });
    setOpenDayMenu(null);
  };

  const handlePasteDay = (targetDate: string) => {
    if (!planning || !clipboardDay) return;
    const newRows = planning.rows.map(row => {
      const shiftToPaste = clipboardDay.shifts[row.employeeId];
      if (shiftToPaste) {
        return {
          ...row,
          shifts: {
            ...row.shifts,
            [targetDate]: { ...shiftToPaste, date: targetDate }
          }
        };
      }
      return row;
    });
    savePlanning({ ...planning, rows: newRows });
    setOpenDayMenu(null);
  };

  const handleClearDay = (date: string) => {
    if (!planning) return;
    if (!confirm('Voulez-vous vraiment vider cette journée ?')) return;
    const newRows = planning.rows.map(row => ({
      ...row,
      shifts: {
        ...row.shifts,
        [date]: { date, type: 'repos' as const, serviceType: 'none' as const, segments: [{ type: 'code' as const, label: 'REPOS' }] }
      }
    }));
    savePlanning({ ...planning, rows: newRows });
    setOpenDayMenu(null);
  };

  const handleResetWeek = async () => {
    if (!planning) return;
    if (!confirm("Voulez-vous vraiment réinitialiser toute la semaine avec les horaires par défaut ?\n\nAttention : toutes les modifications manuelles de cette semaine seront perdues.")) return;

    try {
      const employees = await getEmployees();
      const weekStart = parseISO(planning.weekStart);
      const loadedTemplates = await getTemplates();

      const newRows = planning.rows.map(row => {
        const emp = employees.find(e => e.id === row.employeeId);
        if (!emp) return row;

        const newShifts = { ...row.shifts };

        for (let i = 0; i < 7; i++) {
          const dateObj = addDays(weekStart, i);
          const d = format(dateObj, 'yyyy-MM-dd');

          // --- APPLY WEEKLY DEFAULT ---
          const defaultTplId = emp.weeklyDefault?.[i.toString()];
          let newSegments: ShiftSegment[] = [];
          let type: ShiftType = 'repos';
          let serviceType: ShiftServiceType = 'none';

          if (defaultTplId && defaultTplId !== 'repos') {
            const tpl = loadedTemplates.find(t => t.id === defaultTplId);
            if (tpl) {
              type = 'travail';
              const firstStart = tpl.slots[0]?.start;
              const lastEnd = tpl.slots[tpl.slots.length - 1]?.end;
              if (firstStart) {
                if (firstStart < "12:00") {
                  serviceType = lastEnd && lastEnd > "18:00" ? 'midi+soir' : 'midi';
                } else if (firstStart >= "16:00") {
                  serviceType = 'soir';
                } else {
                  serviceType = lastEnd && lastEnd > "18:00" ? 'soir' : 'midi';
                }
              }
              newSegments = tpl.slots.map(slot => ({
                type: 'horaire',
                start: slot.start,
                end: slot.end,
                templateId: tpl.id,
                color: tpl.color,
                hasOverride: false
              }));
            } else {
              newSegments = [{ type: 'code', label: 'REPOS' }];
            }
          } else {
            newSegments = [{ type: 'code', label: 'REPOS' }];
          }

          newShifts[d] = {
            date: d,
            type,
            serviceType,
            segments: newSegments
          };
        }

        return { ...row, shifts: newShifts };
      });

      savePlanning({ ...planning, rows: newRows });
    } catch (err) {
      console.error('Failed to reset week:', err);
      alert('Erreur lors de la réinitialisation de la semaine');
    }
  };

  const handleExportConfirm = async (options: any) => {
    if (!planning) return;
    const planningToExport = {
      ...planning,
      rows: planning.rows.filter(r => options.roles.includes(r.employeeRole))
    };
    const roles = await getRoles();
    const roleMap: Record<string, string> = {};
    roles.forEach(r => roleMap[r.id] = r.label);
    generatePDF(planningToExport, templates, { ...options, roleLabels: roleMap });
  };

  const toggleRoleCollapse = (role: string) => {
    const newSet = new Set(collapsedRoles);
    if (newSet.has(role)) newSet.delete(role);
    else newSet.add(role);
    setCollapsedRoles(newSet);
  };

  // Get role label from role ID
  const getRoleLabel = (roleId: string): string => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.label : roleId;
  };

  // Helper to check if time is considered "evening" (strictly AFTER 19:00)
  const isEveningTime = (time: string | undefined) => {
    if (!time) return false;

    // Times like "00:00" to "05:00" are early morning (after midnight) = evening
    // 19:00 = 19 * 60 = 1140 minutes.
    // We want STRICTLY > 19:00.

    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours)) return false;

    if (hours < 6) return true; // After midnight (e.g. 01:00)

    const totalMinutes = hours * 60 + (minutes || 0);
    return totalMinutes > 1140;
  };

  useEffect(() => {
    // Debug log to verify deployed version
    console.log('PlanningView v4: Strict Absence Fix applied (ignoring segment type)');
  }, []);

  // Calculate serviceType from shift segments (dynamic, not from stored value)
  const calculateServiceType = (shift: Shift | undefined) => {
    if (!shift || !shift.segments) return 'none';

    // STRICT: If any segment is an absence or repose, DO NOT COUNT the person
    // Check LABEL regardless of type (because Editor might save CP as 'horaire' if times are present)
    const hasAbsence = shift.segments.some(s =>
      (s.label && ABSENCE_TYPES.includes(s.label as any)) ||
      (s.label === 'REPOS')
    );
    if (hasAbsence) return 'none';

    const horairesSegments = shift.segments.filter(s => s.type === 'horaire');
    if (horairesSegments.length === 0) return 'none';

    const firstStart = horairesSegments[0]?.start;
    const lastEnd = horairesSegments[horairesSegments.length - 1]?.end;

    if (!firstStart) return 'none';

    const hasEveningEnd = isEveningTime(lastEnd);

    if (firstStart < "12:00") {
      return hasEveningEnd ? 'midi+soir' : 'midi';
    } else if (firstStart >= "16:00") {
      return 'soir';
    } else {
      return hasEveningEnd ? 'soir' : 'midi';
    }
  };

  const getShiftCounts = (shift: Shift | undefined) => {
    if (!shift) return { midi: 0, soir: 0 };
    let m = 0;
    let s = 0;

    // Calculate serviceType from segments instead of relying on stored value
    const serviceType = calculateServiceType(shift);

    if (serviceType === 'midi' || serviceType === 'midi+soir') {
      m = 1;
    }
    if (serviceType === 'soir' || serviceType === 'midi+soir') {
      s = 1;
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
    let midi = 0;
    let soir = 0;
    planning.rows.forEach(row => {
      const counts = getShiftCounts(row.shifts[dayDate]);
      midi += counts.midi;
      soir += counts.soir;
    });
    const dayExtras = (planning.extraShifts || []).filter(e => e.date === dayDate);
    dayExtras.forEach(e => {
      // Calculate serviceType for extras using same logic as shifts
      let extraServiceType: 'midi' | 'soir' | 'midi+soir' | 'none' = 'none';

      if (e.start < "12:00") {
        extraServiceType = isEveningTime(e.end) ? 'midi+soir' : 'midi';
      } else if (e.start >= "16:00") {
        extraServiceType = 'soir';
      } else {
        extraServiceType = isEveningTime(e.end) ? 'soir' : 'midi';
      }

      // Count using same logic as getShiftCounts
      if (extraServiceType === 'midi' || extraServiceType === 'midi+soir') {
        midi += e.count;
      }
      if (extraServiceType === 'soir' || extraServiceType === 'midi+soir') {
        soir += e.count;
      }
    });
    return { midi, soir, extras: dayExtras };
  };

  const groupedRows = useMemo(() => {
    if (!planning) return {};

    // Filtrer les employés correspondant à la recherche
    const filtered = planning.rows.filter(r =>
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getRoleLabel(r.employeeRole).toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort alphabetically by name
    filtered.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    // Créer les groupes seulement avec les employés filtrés
    const groups: Record<string, PlanningRow[]> = {};
    filtered.forEach(r => {
      const g = r.employeeRole;
      if (!groups[g]) groups[g] = [];
      groups[g].push(r);
    });

    // Keep group order aligned with settings modal order.
    const sortedGroups: Record<string, PlanningRow[]> = {};

    roles.forEach(role => {
      sortedGroups[role.id] = groups[role.id] || [];
    });

    // 2. Add any groups that exist in rows but weren't in the roles list (legacy or deleted roles)
    Object.keys(groups).forEach(roleId => {
      if (!sortedGroups[roleId]) {
        sortedGroups[roleId] = groups[roleId];
      }
    });

    return sortedGroups;
  }, [planning, searchTerm, roles]);

  const getGroupTotals = (rows: PlanningRow[], date: string) => {
    let midi = 0; let soir = 0;
    rows.forEach(r => {
      const counts = getShiftCounts(r.shifts[date]);
      midi += counts.midi;
      soir += counts.soir;
    });
    return { midi, soir };
  };

  if (!planning) return <div className="p-10 text-center">Chargement...</div>;

  const weekStartDates = Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(planning.weekStart), i), 'yyyy-MM-dd'));

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <header className="bg-white border-b border-slate-200 shrink-0 z-[60]">
        <div className="max-w-[1920px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-lg font-bold text-brand flex items-center gap-2">
                Planning {planning.service}
                <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  Semaine du {format(parseISO(planning.weekStart), 'dd/MM')}
                </span>
              </h1>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('SEMAINE')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'SEMAINE' ? 'bg-white shadow-sm text-brand' : 'text-slate-500'}`}>Semaine</button>
            <button onClick={() => setViewMode('JOUR')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'JOUR' ? 'bg-white shadow-sm text-brand' : 'text-slate-500'}`}>Jour</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input className="pl-8 pr-3 py-1.5 text-sm bg-slate-100 border-transparent focus:bg-white border focus:border-brand/30 rounded-lg outline-none w-48 transition-all" placeholder="Filtrer employé..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1 bg-brand text-white hover:opacity-90 px-4 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors"><Plus size={16} /> Ajouter</button>
            <button onClick={() => navigate('/facture')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Factures"><FileText size={20} /></button>
            <button onClick={handleResetWeek} className="p-2 text-slate-500 hover:bg-slate-100 hover:text-orange-600 rounded-lg" title="Réinitialiser la Semaine (Défauts)"><RefreshCw size={20} /></button>
            <button onClick={() => setIsExportModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Export PDF"><Download size={20} /></button>

            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Paramètres"><Settings size={20} /></button>
            <button onClick={() => window.location.href = 'https://polpo.connexion.l-iamani.com/'} className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg ml-1" title="Déconnexion"><LogOut size={20} /></button>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/50 py-3 overflow-x-auto scrollbar-hide">
          <div className="max-w-[1920px] mx-auto px-4 flex justify-center min-w-max">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mr-4 self-center"><Users size={14} /> Effectifs</div>
              {weekStartDates.map((date, idx) => {
                const kpi = getKPIs(date);
                const isSelected = viewMode === 'JOUR' && idx === selectedDayIndex;
                const hasExtras = kpi.extras.length > 0;
                return (
                  <div key={date} onClick={() => { if (viewMode === 'JOUR') setSelectedDayIndex(idx); }} className={`flex flex-col px-3 py-2 rounded-lg border cursor-pointer transition-all min-w-[180px] ${isSelected ? 'bg-brand-light border-brand/20 ring-2 ring-brand/30' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
                      <span className="text-xs font-bold text-slate-800 uppercase">{DAYS[idx].substring(0, 3)} {format(parseISO(date), 'dd')}</span>
                    </div>
                    <div className="flex gap-3 text-xs justify-between mb-1">
                      <span className="text-slate-600 font-medium">Midi : <strong className="text-orange-600 text-sm">{kpi.midi}</strong></span>
                      <span className="text-slate-600 font-medium">Soir : <strong className="text-indigo-600 text-sm">{kpi.soir}</strong></span>
                    </div>
                    {hasExtras && (
                      <div className="mt-1 pt-1 border-t border-purple-100 bg-purple-50 rounded px-1 space-y-1">
                        {kpi.extras.map(extra => (
                          <div key={extra.id} className="group flex justify-between items-center text-[10px] text-purple-800 py-0.5">
                            <div className="flex flex-col leading-tight">
                              <span className="font-bold text-purple-900">{extra.count}x {extra.label}</span>
                              <span className="text-[9px] opacity-75">{extra.start}-{extra.end}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteExtra(extra.id); }} className="ml-1 text-purple-400 hover:text-red-600 opacity-50 group-hover:opacity-100 transition-opacity p-1 hover:bg-white rounded" title="Supprimer"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-4">
        {viewMode === 'SEMAINE' ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden h-full">
            <div className="flex-1 overflow-auto w-full max-h-full">
              <table className="w-full text-sm border-collapse relative">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-50 bg-slate-50 border-b border-r p-3 text-left w-64 font-semibold text-slate-600 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">Employé</th>
                    {weekStartDates.map((d, i) => (
                      <th key={d} className="sticky top-0 z-40 border-b border-r bg-slate-50 p-2 min-w-[140px] text-center font-medium text-slate-800 shadow-sm relative group">
                        <div className="flex items-center justify-center gap-2">
                          <span>{DAYS[i]}</span>
                          <button onClick={(e) => { e.stopPropagation(); setOpenDayMenu(openDayMenu === d ? null : d); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-opacity">
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                        <span className="text-xs font-normal text-slate-400">{format(parseISO(d), 'dd/MM')}</span>

                        {openDayMenu === d && (
                          <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg py-1 z-50 w-40 text-left">
                            <button onClick={() => handleCopyDay(d)} className="w-full px-4 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-700">
                              <Copy size={12} /> Copier la journée
                            </button>
                            <button onClick={() => handlePasteDay(d)} disabled={!clipboardDay} className="w-full px-4 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-700 disabled:opacity-50">
                              <Clipboard size={12} /> Coller la journée
                            </button>
                            <div className="border-t border-slate-100 my-1"></div>
                            <button onClick={() => handleClearDay(d)} className="w-full px-4 py-2 text-xs hover:bg-red-50 flex items-center gap-2 text-red-600">
                              <Trash2 size={12} /> Vider la journée
                            </button>
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedRows).map(([role, rows]) => {
                    const isCollapsed = collapsedRoles.has(role);
                    return (
                      <React.Fragment key={role}>
                        <tr className="cursor-pointer hover:opacity-90 transition-opacity" onClick={() => toggleRoleCollapse(role)}>
                          <td colSpan={8} className="p-3 bg-brand text-white text-center font-bold text-lg border-b sticky left-0 z-20">
                            <div className="flex items-center justify-center gap-2">
                              {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />} {getRoleLabel(role)} <span className="text-xs font-normal opacity-80 bg-white/20 px-2 py-0.5 rounded-full">{(rows as PlanningRow[]).length}</span>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && (rows as PlanningRow[]).map(row => {
                          const totalWeeklyMinutes = weekStartDates.reduce((acc, date) => acc + calculateShiftDuration(row.shifts[date]), 0);
                          const totalWeeklyStr = formatDuration(totalWeeklyMinutes);
                          return (
                            <tr key={row.employeeId} className="hover:bg-slate-50/50">
                              <td className="sticky left-0 z-30 bg-white border-b border-r p-3 font-medium text-slate-800 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)] group">
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col">
                                    <span>{row.employeeName}</span>
                                    {totalWeeklyStr && <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 mt-0.5"><Clock size={10} /> {totalWeeklyStr}</span>}
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); setEditingEmployee({ id: row.employeeId, name: row.employeeName, role: row.employeeRole }); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"><Edit2 size={14} /></button>
                                </div>
                              </td>
                              {weekStartDates.map(date => (
                                <td key={date} className="border-b border-r p-1 h-16 relative group cursor-pointer" onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setEditorPos({ x: rect.left, y: rect.bottom + window.scrollY });
                                  setEditingShift({ shift: row.shifts[date] || { date, type: 'repos', serviceType: 'none', segments: [] }, employeeId: row.employeeId, employeeName: row.employeeName, employeeRole: row.employeeRole, date });
                                }}>
                                  <ShiftCell shift={row.shifts[date]} templates={templates} />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        {!isCollapsed && (
                          <tr className="bg-slate-100/50">
                            <td className="sticky left-0 z-30 bg-slate-100/90 border-b border-r p-2 text-right text-xs font-bold text-slate-500 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">TOTAL {getRoleLabel(role)}</td>
                            {weekStartDates.map(date => {
                              const totals = getGroupTotals((rows as PlanningRow[]), date);
                              return (
                                <td key={date} className="border-b border-r p-2 text-center text-xs font-semibold text-slate-600">
                                  {totals.midi > 0 || totals.soir > 0 ? (
                                    <span><span className={totals.midi > 0 ? "text-orange-600" : "text-slate-300"}>{totals.midi} m</span><span className="mx-1 text-slate-300">/</span><span className={totals.soir > 0 ? "text-indigo-600" : "text-slate-300"}>{totals.soir} s</span></span>
                                  ) : <span className="text-slate-300">-</span>}
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto flex-1 overflow-auto w-full">
            <div className="flex justify-center mb-6">
              <div className="flex bg-white rounded-full shadow p-1 sticky top-0 z-10">
                {DAYS.map((d, i) => <button key={d} onClick={() => setSelectedDayIndex(i)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedDayIndex === i ? 'bg-brand text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{d.substring(0, 3)}</button>)}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b bg-slate-50 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <h2 className="font-bold text-slate-700">{DAYS[selectedDayIndex]} {format(parseISO(weekStartDates[selectedDayIndex]), 'dd MMMM', { locale: fr })}</h2>
                <div className="text-sm text-slate-500">Effectif: <strong className="text-slate-800">{getKPIs(weekStartDates[selectedDayIndex]).midi + getKPIs(weekStartDates[selectedDayIndex]).soir}</strong> shifts</div>
              </div>
              <div className="divide-y">
                {Object.entries(groupedRows).map(([role, untypedRows]) => {
                  const rows = untypedRows as PlanningRow[];
                  return (
                    <div key={role}>
                      <div className="bg-brand text-white px-4 py-3 text-lg font-bold text-center uppercase tracking-wide flex justify-center items-center sticky top-14 z-10 relative">
                        <span>{getRoleLabel(role)}</span>
                        <span className="absolute right-4 text-xs bg-white/20 px-2 py-1 rounded text-white font-mono">{getGroupTotals(rows, weekStartDates[selectedDayIndex]).midi}m / {getGroupTotals(rows, weekStartDates[selectedDayIndex]).soir}s</span>
                      </div>
                      {rows.map(row => {
                        const shift = row.shifts[weekStartDates[selectedDayIndex]];
                        const dailyStr = formatDuration(calculateShiftDuration(shift));
                        return (
                          <div key={row.employeeId} className="px-4 py-4 flex items-center justify-between hover:bg-brand-light/30 cursor-pointer border-b last:border-0" onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setEditorPos({ x: rect.left + 100, y: rect.bottom + window.scrollY });
                            setEditingShift({ shift, employeeId: row.employeeId, employeeName: row.employeeName, employeeRole: row.employeeRole, date: weekStartDates[selectedDayIndex] });
                          }}>
                            <div className="font-medium text-slate-800 w-1/3 flex flex-col">
                              <span>{row.employeeName}</span>
                              {dailyStr && <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 mt-1"><Clock size={12} /> {dailyStr}</span>}
                            </div>
                            <div className="flex-1 h-12">
                              <ShiftCell shift={shift} isDayView templates={templates} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onDataChanged={loadPlanningData} onThemeChanged={applyTheme} />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onConfirm={handleExportConfirm} weekDates={weekStartDates} />
      <AddShiftModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} weekStart={planning.weekStart} weekDates={weekStartDates} onSave={handleAddShiftData} onSuccess={loadPlanningData} />
      {editingEmployee && <EditEmployeeModal isOpen={true} employeeId={editingEmployee.id} initialName={editingEmployee.name} initialRoleId={templates.find(t => t.role === editingEmployee.role)?.role || editingEmployee.role} onClose={() => setEditingEmployee(null)} />}

      {editingShift && (
        <ShiftEditor
          shift={editingShift.shift}
          employeeName={editingShift.employeeName}
          employeeRoleId={editingShift.employeeRole}
          position={editorPos}
          currentDate={editingShift.date}
          onSave={handleShiftUpdate}
          onBatchSave={handleBatchShiftUpdate}
          onClose={() => setEditingShift(null)}
        />
      )}
    </div>
  );
};

const ShiftCell: React.FC<{ shift: Shift, isDayView?: boolean, templates?: Template[] }> = ({ shift, isDayView, templates }) => {
  if (!shift || !shift.segments || shift.segments.length === 0) return null;

  // Get note from first segment that has one
  const shiftNote = shift.segments.find(s => s.note)?.note;

  return (
    <div className={`w-full h-full flex items-center justify-center gap-1 ${isDayView ? 'flex-row' : 'flex-col justify-center'}`}>
      {shiftNote && !isDayView && (
        <span className="text-[9px] text-slate-600 font-medium mb-0.5 truncate max-w-full leading-tight">
          {shiftNote}
        </span>
      )}
      {shift.segments.map((seg, i) => {
        let bg = '#ffffff';
        let textStyle: React.CSSProperties = { color: '#1e293b' };
        let borderClass = 'border-slate-200';

        if (seg.type === 'code') {
          if (seg.label === 'REPOS') { bg = '#000000'; textStyle = { color: '#FFFFFF', fontWeight: 'bold' }; borderClass = 'border-black'; }
          else if (seg.label === 'Ecole') { bg = '#EFEBE9'; textStyle = { color: '#5D4037', fontWeight: 'bold' }; borderClass = 'border-stone-300'; }
          else if (seg.label === 'mise à dispo') { bg = '#5ee8d7'; textStyle = { color: '#FFFFFF', fontWeight: 'bold' }; borderClass = 'border-teal-300'; }
          else if (seg.label && ABSENCE_TYPES.includes(seg.label as any)) { bg = '#FFEBEE'; textStyle = { color: '#D32F2F', fontWeight: 'bold' }; borderClass = 'border-red-100'; }
        } else if (seg.type === 'horaire') {
          // If segment has a code label (absence), show it in its color
          if (seg.label === 'REPOS') { bg = '#000000'; textStyle = { color: '#FFFFFF', fontWeight: 'bold' }; borderClass = 'border-black'; }
          else if (seg.label === 'Ecole') { bg = '#EFEBE9'; textStyle = { color: '#5D4037', fontWeight: 'bold' }; borderClass = 'border-stone-300'; }
          else if (seg.label === 'mise à dispo') { bg = '#5ee8d7'; textStyle = { color: '#FFFFFF', fontWeight: 'bold' }; borderClass = 'border-teal-300'; }
          else if (seg.label && ABSENCE_TYPES.includes(seg.label as any)) {
            bg = '#FFEBEE';
            textStyle = { color: '#D32F2F', fontWeight: 'bold' };
            borderClass = 'border-red-100';
          } else if (seg.colorOverride) {
            bg = seg.colorOverride; borderClass = 'border-transparent';
          } else if (seg.templateId && templates) {
            const tpl = templates.find(t => t.id === seg.templateId);
            if (tpl && tpl.color) {
              bg = tpl.color;
              borderClass = 'border-transparent';
            } else if (seg.color) {
              // Fallback to stored color if template not found
              bg = seg.color; borderClass = 'border-transparent';
            }
          } else if (seg.color) { bg = seg.color; borderClass = 'border-transparent'; }
          else { bg = '#ffffff'; borderClass = 'border-blue-200'; }
        }
        const content = seg.type === 'horaire' ? (seg.label ? seg.label : `${seg.start}-${seg.end}`) : seg.label;

        return (
          <div key={i} className="flex flex-col items-center w-full max-w-[90%]">
            <div className={`rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap border shadow-sm flex items-center justify-center w-full`} style={{ backgroundColor: bg }}>
              <span className="truncate" style={textStyle}>{content}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlanningView;
