import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Download, FileText, LayoutPanelLeft, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Planning, PlanningRow, Shift } from './types';

const HEADER_BG_COLORS = ['#4da8ad', '#a8dadc', '#253b6e', '#f2c6de', '#c48197', '#241416', '#dbc5a1', '#a7ab84', '#ffffff', '#b7d09c', '#7dc8bf', '#64acd8'];
const HEADER_TEXT_COLORS = ['#000000', '#ffffff', '#253b6e', '#241416'];

type ExportMode = 'week' | 'day';

interface PlanningExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    planning: Planning | null;
    roles: { id: string; label: string }[];
    rolesOrder: string[];
    currentWeekStart: Date;
    weekDates: string[];
    selectedDayIndex: number;
}

const normalizeRoleKey = (value: string) => String(value || '').trim().toLowerCase();

const getShiftSlots = (shift?: Shift) => {
    const horaires = (shift?.segments || []).filter((segment) => segment.type === 'horaire' && segment.start && segment.end);
    if (horaires.length === 0) return null;
    return {
        arrival: String(horaires[0].start || ''),
        departure: String(horaires[horaires.length - 1].end || ''),
    };
};

const hasWorkingShift = (shift?: Shift) => Boolean(getShiftSlots(shift));

export const PlanningExportModal: React.FC<PlanningExportModalProps> = ({
    isOpen,
    onClose,
    planning,
    roles,
    rolesOrder,
    currentWeekStart,
    weekDates,
    selectedDayIndex,
}) => {
    const [exportMode, setExportMode] = useState<ExportMode>('week');
    const [weekViewType, setWeekViewType] = useState<'grid' | 'details'>('grid');
    const [dayDate, setDayDate] = useState('');
    const [headerBgColor, setHeaderBgColor] = useState(HEADER_BG_COLORS[9]);
    const [headerTextColor, setHeaderTextColor] = useState(HEADER_TEXT_COLORS[0]);
    const [includeArrival, setIncludeArrival] = useState(true);
    const [includeDeparture, setIncludeDeparture] = useState(true);
    const [includeSignature, setIncludeSignature] = useState(true);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [exporting, setExporting] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    const orderedRoles = useMemo(() => {
        const ordered: { id: string; label: string }[] = [];
        const seen = new Set<string>();
        const pushRole = (role?: { id: string; label: string }) => {
            if (!role) return;
            if (seen.has(role.id)) return;
            seen.add(role.id);
            ordered.push(role);
        };

        rolesOrder.forEach((roleId) => pushRole(roles.find((role) => role.id === roleId)));
        roles.forEach((role) => pushRole(role));
        return ordered;
    }, [roles, rolesOrder]);

    useEffect(() => {
        if (!isOpen) return;
        setExportMode('week');
        setDayDate(weekDates[selectedDayIndex] || weekDates[0] || '');
        setSelectedRoles(orderedRoles.map((role) => role.id));
    }, [isOpen, orderedRoles, selectedDayIndex, weekDates]);

    const pages = useMemo(() => {
        if (!planning) return [];

        const selectedRoleKeys = new Set(selectedRoles.map(normalizeRoleKey));

        // MODE GRILLE (Hebdomadaire)
        if (exportMode === 'week' && weekViewType === 'grid') {
            const rows = planning.rows
                .filter((row) => {
                    const role = orderedRoles.find((item) => item.id === row.employeeRole || item.label === row.employeeRole);
                    const roleKey = normalizeRoleKey(role?.id || row.employeeRole);
                    return selectedRoleKeys.has(roleKey);
                })
                .map((row) => {
                    const role = orderedRoles.find((item) => item.id === row.employeeRole || item.label === row.employeeRole);
                    return {
                        ...row,
                        roleLabel: role?.label || row.employeeRole,
                    };
                })
                .sort((a, b) => {
                    const roleIndexA = orderedRoles.findIndex((role) => role.label === a.roleLabel || role.id === a.employeeRole);
                    const roleIndexB = orderedRoles.findIndex((role) => role.label === b.roleLabel || role.id === b.employeeRole);
                    if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB;
                    return a.employeeName.localeCompare(b.employeeName);
                });

            // Group by roles for grid view headers
            const groupedByRole: Record<string, typeof rows> = {};
            rows.forEach(r => {
                if (!groupedByRole[r.roleLabel]) groupedByRole[r.roleLabel] = [];
                groupedByRole[r.roleLabel].push(r);
            });

            return [{
                type: 'grid' as const,
                label: `Semaine du ${format(parseISO(weekDates[0]), 'dd/MM')} au ${format(parseISO(weekDates[6]), 'dd/MM/yyyy')}`,
                groupedRows: groupedByRole
            }];
        }

        // MODE DETAILS (Un jour par page)
        const dates = exportMode === 'day' ? (dayDate ? [dayDate] : []) : weekDates;
        return dates.map((date) => {
            const rows = planning.rows
                .filter((row) => {
                    const role = orderedRoles.find((item) => item.id === row.employeeRole || item.label === row.employeeRole);
                    const roleKey = normalizeRoleKey(role?.id || row.employeeRole);
                    return selectedRoleKeys.has(roleKey) && hasWorkingShift(row.shifts[date]);
                })
                .map((row) => {
                    const role = orderedRoles.find((item) => item.id === row.employeeRole || item.label === row.employeeRole);
                    const slot = getShiftSlots(row.shifts[date]);
                    const shift = row.shifts[date];
                    
                    // Format special pour split shifts ou codes
                    let displayTime = '';
                    if (shift?.type === 'travail') {
                        const h = (shift.segments || []).filter(s => s.type === 'horaire' && s.start && s.end);
                        displayTime = h.map(s => `${s.start}-${s.end}`).join(' / ');
                    } else if (shift?.segments?.[0]?.label) {
                        displayTime = shift.segments[0].label;
                    }

                    return {
                        ...row,
                        roleLabel: role?.label || row.employeeRole,
                        displayTime,
                        arrival: slot?.arrival || '',
                        departure: slot?.departure || '',
                    };
                })
                .sort((a, b) => {
                    const roleIndexA = orderedRoles.findIndex((role) => role.label === a.roleLabel || role.id === a.employeeRole);
                    const roleIndexB = orderedRoles.findIndex((role) => role.label === b.roleLabel || role.id === b.employeeRole);
                    if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB;
                    return a.employeeName.localeCompare(b.employeeName);
                });

            return {
                type: 'details' as const,
                date,
                label: format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr }),
                rows,
            };
        }).filter((page) => page.type === 'details' && page.rows.length > 0);
    }, [planning, exportMode, weekViewType, dayDate, weekDates, selectedRoles, orderedRoles]);

    if (!isOpen) return null;

    const toggleRole = (roleId: string) => {
        setSelectedRoles((prev) => prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]);
    };

    const handleExport = async () => {
        if (!previewRef.current || pages.length === 0) return;
        try {
            setExporting(true);
            const { default: html2canvas } = await import('html2canvas');
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageNodes = Array.from(previewRef.current.querySelectorAll('[data-export-page="true"]')) as HTMLElement[];

            for (let index = 0; index < pageNodes.length; index += 1) {
                const node = pageNodes[index];
                const isLandscape = node.getAttribute('data-landscape') === 'true';
                
                const canvas = await html2canvas(node, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    onclone: (clonedDoc) => {
                        const allElements = clonedDoc.getElementsByTagName('*');
                        for (let i = 0; i < allElements.length; i++) {
                            const el = allElements[i] as HTMLElement;
                            if (el.style) {
                                // On s'assure qu'aucune couleur oklch ne traîne
                            }
                        }
                    }
                });
                const imgData = canvas.toDataURL('image/png');
                
                if (index > 0) pdf.addPage(isLandscape ? 'l' : 'p');
                else if (isLandscape) pdf.setPage(1);
                
                if (index === 0 && isLandscape) {
                    pdf.deletePage(1);
                    pdf.addPage('l', 'mm', 'a4');
                }

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
                const imageWidth = canvas.width * ratio;
                const imageHeight = canvas.height * ratio;
                const x = (pdfWidth - imageWidth) / 2;
                const y = (pdfHeight - imageHeight) / 2;

                pdf.addImage(imgData, 'PNG', x, y, imageWidth, imageHeight, undefined, 'FAST');
            }

            const fileName = exportMode === 'week'
                ? `planning-semaine-${format(currentWeekStart, 'yyyy-MM-dd')}.pdf`
                : `planning-jour-${dayDate || format(currentWeekStart, 'yyyy-MM-dd')}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('Planning export failed', error);
            alert('Erreur lors de l\'export PDF.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-[24px] bg-white shadow-2xl border border-slate-200 flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">Paramètres d'export</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-1"><X size={24} /></button>
                </div>

                <div className="px-6 pt-4 overflow-y-auto">
                    <div className="inline-flex w-full rounded-xl bg-slate-100 p-1">
                        <button onClick={() => setExportMode('week')} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${exportMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Semaine complète</button>
                        <button onClick={() => setExportMode('day')} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${exportMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Jour unique</button>
                    </div>

                    {exportMode === 'week' && (
                        <div className="mt-4 inline-flex w-full rounded-xl bg-slate-100 p-1">
                            <button onClick={() => setWeekViewType('grid')} className={`flex-1 rounded-lg px-4 py-2 text-xs font-bold transition-all ${weekViewType === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Vue Grille (Recap)</button>
                            <button onClick={() => setWeekViewType('details')} className={`flex-1 rounded-lg px-4 py-2 text-xs font-bold transition-all ${weekViewType === 'details' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Vue Détails (Émargement)</button>
                        </div>
                    )}

                    {exportMode === 'day' && (
                        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                            <label className="block text-xs font-bold text-blue-800 mb-2">Sélectionnez le jour :</label>
                            <select value={dayDate} onChange={(e) => setDayDate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none">
                                {weekDates.map((date) => (
                                    <option key={date} value={date}>{format(parseISO(date), 'EEEE d MMMM', { locale: fr })}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="mt-6 space-y-6 pb-6">
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <CheckSquare size={18} className="text-slate-700" />
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Personnalisation</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-slate-200 p-3">
                                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Fond Entêtes</p>
                                    <div className="flex flex-wrap gap-2">
                                        {HEADER_BG_COLORS.map((color) => (
                                            <button key={color} onClick={() => setHeaderBgColor(color)} className={`h-7 w-7 rounded-full border-2 transition-all ${headerBgColor === color ? 'border-blue-500 scale-110' : 'border-white shadow-sm'}`} style={{ backgroundColor: color }} />
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 p-3">
                                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Texte Entêtes</p>
                                    <div className="flex flex-wrap gap-2">
                                        {HEADER_TEXT_COLORS.map((color) => (
                                            <button key={color} onClick={() => setHeaderTextColor(color)} className={`h-7 w-7 rounded-full border-2 transition-all ${headerTextColor === color ? 'border-blue-500 scale-110' : 'border-slate-200'}`} style={{ backgroundColor: color }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <LayoutPanelLeft size={18} className="text-slate-700" />
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Colonnes à afficher</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {[
                                    { label: 'Heure arrivée', checked: includeArrival, setChecked: setIncludeArrival },
                                    { label: 'Heure départ', checked: includeDeparture, setChecked: setIncludeDeparture },
                                    { label: 'Signature', checked: includeSignature, setChecked: setIncludeSignature },
                                ].map((item) => (
                                    <button key={item.label} onClick={() => item.setChecked(!item.checked)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${item.checked ? 'border-blue-300 bg-blue-50 text-slate-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                                        <input type="checkbox" readOnly checked={item.checked} className="h-4 w-4 accent-blue-600" />
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Postes à inclure</h3>
                                <div className="flex items-center gap-3 text-xs font-bold">
                                    <button onClick={() => setSelectedRoles(orderedRoles.map((role) => role.id))} className="text-blue-600 hover:underline">Tout cocher</button>
                                    <button onClick={() => setSelectedRoles([])} className="text-slate-400 hover:underline">Tout décocher</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                                {orderedRoles.map((role) => {
                                    const checked = selectedRoles.includes(role.id);
                                    return (
                                        <button key={role.id} onClick={() => toggleRole(role.id)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${checked ? 'border-blue-300 bg-blue-50 text-slate-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                                            <input type="checkbox" readOnly checked={checked} className="h-4 w-4 accent-blue-600" />
                                            <span>{role.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </div>

                <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50/50">
                    <button onClick={onClose} className="rounded-xl border border-slate-300 px-6 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors">Annuler</button>
                    <button onClick={handleExport} disabled={exporting || pages.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]">
                        <Download size={18} /> {exporting ? 'Export...' : 'Exporter PDF'}
                    </button>
                </div>
            </div>

            <div className="fixed left-[-10000px] top-0 opacity-0 pointer-events-none">
                <div ref={previewRef}>
                    {pages.map((page: any) => (
                        <div 
                            key={page.label} 
                            data-export-page="true" 
                            data-landscape={page.type === 'grid' ? 'true' : 'false'}
                            className={`${page.type === 'grid' ? 'w-[1123px] min-h-[794px]' : 'w-[794px] min-h-[1123px]'} bg-white px-10 py-8`}
                            style={{ color: '#000000', backgroundColor: '#ffffff' }}
                        >
                            <div className="mb-6 px-6 py-5 flex items-center justify-between" style={{ backgroundColor: headerBgColor, color: headerTextColor, borderRadius: '0px' }}>
                                <div>
                                    <div className="text-2xl font-bold" style={{ color: headerTextColor }}>Planning {exportMode === 'week' ? 'Semaine' : 'Jour'}</div>
                                    <div className="mt-1 text-base font-medium capitalize" style={{ color: headerTextColor }}>{page.label}</div>
                                </div>
                                <div className="text-right opacity-80">
                                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: headerTextColor }}>IAmani SaaS</p>
                                    <p className="text-[10px]" style={{ color: headerTextColor }}>{new Date().toLocaleDateString()}</p>
                                </div>
                            </div>

                            {page.type === 'grid' ? (
                                <div className="border border-[#000000]" style={{ borderRadius: '0px' }}>
                                    <table className="w-full border-collapse text-[10px]">
                                        <thead>
                                            <tr style={{ backgroundColor: headerBgColor, color: headerTextColor }}>
                                                <th className="border border-[#000000] px-2 py-2 text-left font-bold w-[120px]" style={{ borderColor: '#000000', color: headerTextColor }}>Poste / Employé</th>
                                                {weekDates.map(date => (
                                                    <th key={date} className="border border-[#000000] px-1 py-2 text-center font-bold" style={{ borderColor: '#000000', color: headerTextColor }}>
                                                        <div className="capitalize">{format(parseISO(date), 'EEEE', { locale: fr })}</div>
                                                        <div className="opacity-80">{format(parseISO(date), 'dd/MM')}</div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(page.groupedRows).map(([role, employees]: [string, any]) => (
                                                <React.Fragment key={role}>
                                                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                        <td colSpan={8} className="border border-[#000000] px-2 py-1 font-bold uppercase text-[9px]" style={{ borderColor: '#000000', color: '#1e40af' }}>{role}</td>
                                                    </tr>
                                                    {employees.map((emp: any) => (
                                                        <tr key={emp.employeeId}>
                                                            <td className="border border-[#000000] px-2 py-1.5 font-medium" style={{ borderColor: '#000000', color: '#000000' }}>{emp.employeeName}</td>
                                                            {weekDates.map(date => {
                                                                const shift = emp.shifts[date];
                                                                let text = '';
                                                                let textColor = '#000000';
                                                                let isBold = false;
                                                                
                                                                if (shift?.type === 'travail') {
                                                                    const h = (shift.segments || []).filter((s: any) => s.type === 'horaire' && s.start && s.end);
                                                                    text = h.map((s: any) => `${s.start}-${s.end}`).join('\n');
                                                                } else if (shift?.segments?.[0]?.label) {
                                                                    text = shift.segments[0].label;
                                                                    textColor = '#94a3b8';
                                                                    isBold = true;
                                                                }

                                                                return (
                                                                    <td key={date} className="border border-[#000000] px-1 py-1.5 text-center whitespace-pre-line" style={{ borderColor: '#000000', color: textColor, fontWeight: isBold ? 'bold' : 'normal' }}>
                                                                        {text || '—'}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="border border-[#000000]" style={{ borderRadius: '0px' }}>
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                            <tr style={{ backgroundColor: headerBgColor, color: headerTextColor }}>
                                                <th className="border border-[#000000] px-4 py-3 text-left text-base font-bold" style={{ borderColor: '#000000', color: headerTextColor }}>Employé</th>
                                                <th className="border border-[#000000] px-4 py-3 text-left text-base font-bold" style={{ borderColor: '#000000', color: headerTextColor }}>Poste</th>
                                                <th className="border border-[#000000] px-4 py-3 text-left text-base font-bold" style={{ borderColor: '#000000', color: headerTextColor }}>Horaires</th>
                                                {includeSignature && <th className="border border-[#000000] px-4 py-3 text-left text-base font-bold" style={{ borderColor: '#000000', color: headerTextColor }}>Signature</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {page.rows.map((row: any) => (
                                                <tr key={`${page.date}-${row.employeeId}`}>
                                                    <td className="border border-[#000000] px-4 py-3 text-base" style={{ borderColor: '#000000', color: '#000000' }}>{row.employeeName}</td>
                                                    <td className="border border-[#000000] px-4 py-3 text-base" style={{ borderColor: '#000000', color: '#000000' }}>{row.roleLabel}</td>
                                                    <td className="border border-[#000000] px-4 py-3 text-base font-medium" style={{ borderColor: '#000000', color: '#000000' }}>{row.displayTime || '—'}</td>
                                                    {includeSignature && <td className="border border-[#000000] px-4 py-3 h-[45px]" style={{ borderColor: '#000000' }} />}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {(!page.rows || (page.type === 'grid' && Object.keys(page.groupedRows).length === 0)) && (
                                <div className="mt-8 border border-dashed border-[#cccccc] px-6 py-10 text-center text-lg" style={{ color: '#94a3b8', borderRadius: '0px' }}>Aucun employé planifié pour cette sélection.</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PlanningExportModal;