import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Download, FileText, LayoutPanelLeft, X } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Planning, PlanningRow, Shift } from './types';
import { useAuth } from '../../context/AuthContext';
import { planningApi } from '../../lib/api';


const HEADER_BG_COLORS = [
    '#C1D5AF', '#4AA3A2', '#A7E0E0', '#212E53', '#F4CFDF', 
    '#C08493', '#1C0F12', '#D4C2A1', '#A1A27E', '#FFFFFF', 
    '#88C7BC', '#5FACD3', '#000000'
];
const HEADER_TEXT_COLORS = ['#000000', '#FFFFFF', '#212E53', '#1C0F12'];

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
    employees?: any[];
}

const normalizeRoleKey = (value: string) => String(value || '').trim().toLowerCase();

export const PlanningExportModal: React.FC<PlanningExportModalProps> = ({
    isOpen,
    onClose,
    planning,
    roles,
    rolesOrder,
    currentWeekStart,
    weekDates,
    selectedDayIndex,
    employees = []
}) => {
    const { user } = useAuth();
    const [exportMode, setExportMode] = useState<ExportMode>('week');

    const [weekViewType, setWeekViewType] = useState<'grid' | 'details'>('details');
    const [dayDate, setDayDate] = useState('');
    const [headerBgColor, setHeaderBgColor] = useState(HEADER_BG_COLORS[0]); // #C1D5AF
    const [headerTextColor, setHeaderTextColor] = useState(HEADER_TEXT_COLORS[0]); // #000000
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

        const allRows: any[] = [];
        const roleMap = new Map<string, { id: string; label: string }>();
        orderedRoles.forEach(r => roleMap.set(normalizeRoleKey(r.id), r));

        employees.forEach(emp => {
            const roleKey = normalizeRoleKey(emp.position || 'GENERAL');
            if (selectedRoleKeys.has(roleKey)) {
                const role = roleMap.get(roleKey);
                const existingPlanningRow = planning.rows.find(r => r.employeeId === emp.id);
                
                allRows.push({
                    employeeId: emp.id,
                    firstName: emp.first_name || '',
                    lastName: emp.last_name || '',
                    employeeName: `${(emp.last_name || '').toUpperCase()} ${emp.first_name || ''}`.trim(),
                    employeeRole: emp.position || 'GENERAL',
                    roleLabel: role?.label || emp.position || 'GENERAL',
                    shifts: existingPlanningRow?.shifts || {},
                    isExtra: existingPlanningRow?.isExtra || false
                });
            }
        });

        allRows.sort((a, b) => {
            const roleIndexA = orderedRoles.findIndex((role) => role.id === a.employeeRole || role.label === a.employeeRole);
            const roleIndexB = orderedRoles.findIndex((role) => role.id === b.employeeRole || role.label === b.employeeRole);
            if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB;
            
            // Sort by LAST NAME primarily
            const nameSort = (a.lastName || '').localeCompare(b.lastName || '', 'fr', { sensitivity: 'base' });
            if (nameSort !== 0) return nameSort;
            return (a.firstName || '').localeCompare(b.firstName || '', 'fr', { sensitivity: 'base' });
        });

        if (exportMode === 'week' && weekViewType === 'grid') {
            const groupedByRole: Record<string, any[]> = {};
            allRows.forEach(r => {
                if (!groupedByRole[r.roleLabel]) groupedByRole[r.roleLabel] = [];
                groupedByRole[r.roleLabel].push(r);
            });

            return [{
                type: 'grid' as const,
                label: `Semaine du ${format(parseISO(weekDates[0]), 'dd/MM')} au ${format(parseISO(weekDates[6]), 'dd/MM/yyyy')}`,
                groupedRows: groupedByRole
            }];
        }

        const dates = exportMode === 'day' ? (dayDate ? [dayDate] : []) : weekDates;
        
        if (exportMode === 'day') {
            const date = dayDate || weekDates[0];
            if (!date) return [];

            const services: ('midi' | 'soir')[] = ['midi', 'soir'];
            return services.map(service => {
                const detailRows = allRows.map(row => {
                    const shift = row.shifts[date];
                    let displayTime = '';
                    let isRepos = false;
                    let isAbsence = false;
                    let absenceCodes: string[] = [];

                    if (shift) {
                        // Check if the shift belongs to this service
                        const matchesService = (service === 'midi' && (shift.serviceType === 'midi' || shift.serviceType === 'midi+soir')) ||
                                               (service === 'soir' && (shift.serviceType === 'soir' || shift.serviceType === 'midi+soir'));
                        
                        if (matchesService) {
                            const h = (shift.segments || []).filter((s: any) => {
                                if (s.type !== 'horaire' || !s.start || !s.end) return false;
                                if (service === 'midi') {
                                    return s.start < "16:00";
                                } else {
                                    return s.end > "18:00" || s.end < s.start || s.start >= "16:00";
                                }
                            });
                            if (h.length > 0) {
                                displayTime = h.map((s: any) => `${s.start}-${s.end}`).join(' / ');
                            }
                        }

                        const codes = (shift.segments || []).filter((s: any) => s.label && s.label !== 'REPOS');
                        if (codes.length > 0) {
                            absenceCodes = codes.map((s: any) => s.label);
                            isAbsence = true;
                        }

                        if (shift.type === 'repos') {
                            isRepos = true;
                            displayTime = 'REPOS';
                        }
                    }

                    return { ...row, displayTime, isRepos, isAbsence, absenceCodes };
                });

                const groupedByRole: Record<string, any[]> = {};
                detailRows.forEach(r => {
                    if (!groupedByRole[r.roleLabel]) groupedByRole[r.roleLabel] = [];
                    groupedByRole[r.roleLabel].push(r);
                });

                return {
                    type: 'details' as const,
                    date,
                    serviceLabel: service.toUpperCase(),
                    label: `FEUILLE DE PRÉSENCE - ${service.toUpperCase()} - ${format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr })}`,
                    groupedRows: groupedByRole,
                };
            });
        }

        return dates.map((date) => {
            const detailRows = allRows.map(row => {
                const shift = row.shifts[date];
                let displayTime = '';
                let isRepos = false;
                let isAbsence = false;
                let absenceCodes: string[] = [];

                if (shift) {
                    const h = (shift.segments || []).filter((s: any) => s.type === 'horaire' && s.start && s.end);
                    if (h.length > 0) {
                        displayTime = h.map((s: any) => `${s.start}-${s.end}`).join(' / ');
                    }
                    
                    const codes = (shift.segments || []).filter((s: any) => s.label && s.label !== 'REPOS');
                    if (codes.length > 0) {
                        absenceCodes = codes.map((s: any) => s.label);
                        isAbsence = true;
                    }

                    if (shift.type === 'repos') {
                        isRepos = true;
                        displayTime = 'REPOS';
                    }
                }

                return { ...row, displayTime, isRepos, isAbsence, absenceCodes };
            });

            const groupedByRole: Record<string, any[]> = {};
            detailRows.forEach(r => {
                if (!groupedByRole[r.roleLabel]) groupedByRole[r.roleLabel] = [];
                groupedByRole[r.roleLabel].push(r);
            });

            return {
                type: 'details' as const,
                date,
                label: format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr }),
                groupedRows: groupedByRole,
            };
        }).filter((page) => page.type === 'details' && Object.keys(page.groupedRows).length > 0);
    }, [planning, employees, exportMode, weekViewType, dayDate, weekDates, selectedRoles, orderedRoles]);

    if (!isOpen) return null;

    const handleExport = async () => {
        if (!planning) return;
        setExporting(true);

        try {
            const { jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');
            
            const hexToRgb = (hex: string): [number, number, number] => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
            };

            const headerColorRgb = hexToRgb(headerBgColor);
            const textColorRgb = hexToRgb(headerTextColor);

            const [settings, rawAbsenceData] = await Promise.all([
                planningApi.getSettings(),
                Promise.resolve(null) // placeholder
            ]);

            const dynamicAbsences = Array.isArray(settings?.absenceCodes) ? settings.absenceCodes : [];
            
            const getDynamicStyles = (hexColor: string): { bg: [number, number, number], text: [number, number, number] } => {
                const bg = hexToRgb(hexColor);
                const [r, g, b] = bg;
                const hex = hexColor.toUpperCase().replace('#', '');
                
                // Noir absolu
                if (hex === '000000') return { bg, text: [255, 255, 255] };
                // Blanc absolu
                if (hex === 'FFFFFF') return { bg, text: [0, 0, 0] };
                
                // Calcul du texte foncé (Version assombrie de la couleur de fond)
                // On réduit la luminosité de ~60% pour garantir le contraste
                const text: [number, number, number] = [
                    Math.max(0, Math.floor(r * 0.35)),
                    Math.max(0, Math.floor(g * 0.35)),
                    Math.max(0, Math.floor(b * 0.35))
                ];
                
                return { bg, text };
            };

            const dayDateStr = dayDate || weekDates[0];

            if (exportMode === 'day') {
                const doc = new jsPDF('portrait');
                const dayDateObj = parseISO(dayDateStr);
                const dayStr = format(dayDateObj, 'eeee d MMMM yyyy', { locale: fr }).toUpperCase();
                const drawServicePage = (serviceName: 'MIDI' | 'SOIR') => {
                    const PAGE_WIDTH = 210;
                    const PAGE_HEIGHT = 297;
                    const MARGIN_X = 10;
                    const TOP_MARGIN = 5; // Réduit à 5mm du haut
                    const BOTTOM_MARGIN = 5;
                    const USABLE_HEIGHT = 287; // 297 - 5 - 5
                    
                    // --- TITRE OPTIMISÉ (Petit, Gras, Surligné Jaune) ---
                    const companyName = user?.company_name || "";
                    const titleText = `${companyName} - FEUILLE DE PRÉSENCE - ${serviceName} - ${dayStr}`;
                    doc.setFontSize(10); // Plus petit
                    doc.setFont('helvetica', 'bold');
                    
                    const textWidth = doc.getTextWidth(titleText);
                    const textHeight = 6;
                    const xPos = (PAGE_WIDTH - textWidth) / 2;
                    
                    // Dessin du surlignage jaune
                    doc.setFillColor(255, 255, 0); // Jaune vif
                    doc.rect(xPos - 2, TOP_MARGIN - 4, textWidth + 4, textHeight, 'F');
                    
                    // Texte du titre par-dessus
                    doc.setTextColor(0);
                    doc.text(titleText, PAGE_WIDTH / 2, TOP_MARGIN, { align: 'center' });

                    // --- CONFIGURATION TABLEAU ---
                    const headRow = ['Employé', 'Horaires'];
                    const usableWidth = PAGE_WIDTH - (MARGIN_X * 2);
                    const columnStyles: any = {
                        0: { cellWidth: usableWidth * 0.22, fontStyle: 'bold', halign: 'left' }, // Employé
                        1: { cellWidth: usableWidth * 0.10, halign: 'center' }  // Horaires
                    };

                    let colIndex = 2;
                    if (includeArrival) { headRow.push('Arrivée'); columnStyles[colIndex++] = { cellWidth: usableWidth * 0.18, halign: 'center' }; }
                    if (includeDeparture) { headRow.push('Départ'); columnStyles[colIndex++] = { cellWidth: usableWidth * 0.18, halign: 'center' }; }
                    if (includeSignature) { headRow.push('Signature'); columnStyles[colIndex++] = { cellWidth: usableWidth * 0.32, halign: 'left' }; }

                    // Préparation des données
                    const bodyData: any[] = [];
                    let currentRole = '';

                    const filteredRows = employees.map(emp => {
                        const existingPlanningRow = planning.rows.find(r => r.employeeId === emp.id);
                        return {
                            employeeId: emp.id,
                            employeeName: `${(emp.last_name || '').toUpperCase()} ${emp.first_name || ''}`.trim().replace(/\n/g, ' '),
                            employeeRole: emp.position || 'GENERAL',
                            shifts: existingPlanningRow?.shifts || {}
                        };
                    }).filter(r => selectedRoles.includes(r.employeeRole));

                    filteredRows.sort((a, b) => {
                        const idxA = rolesOrder.indexOf(a.employeeRole);
                        const idxB = rolesOrder.indexOf(b.employeeRole);
                        if (idxA !== idxB) return idxA - idxB;
                        return a.employeeName.localeCompare(b.employeeName);
                    });

                    filteredRows.forEach(row => {
                        const shift = row.shifts[dayDateStr];
                        let cellContent = '';
                        let aaSegment = null;
                        let displayName = row.employeeName.replace(/\n/g, ' ');

                        if (shift?.segments) {
                            const serviceSegments = shift.segments.filter(s => {
                                if (s.type === 'code') return true;
                                if (s.type === 'horaire' && s.start && s.end) {
                                    if (serviceName === 'MIDI') return s.start < "16:00";
                                    return s.end > "18:00" || s.end < s.start || s.start >= "16:00";
                                }
                                return false;
                            });

                            const notes = serviceSegments.filter(s => s.note?.trim()).map(s => s.note!.trim());
                            if (notes.length > 0) {
                                // Add a specific prefix to segment notes so the PDF drawer can distinguish them from name parentheses
                                displayName += ` [SEG_NOTE:(${notes.join(', ')})]`;
                            }

                            aaSegment = serviceSegments.find(s => s.label === 'AA');
                            
                            // On cherche un code prioritaire (autre que AA ou REPOS)
                            const priorityCode = serviceSegments.find(s => s.label && s.label !== 'AA' && s.label !== 'REPOS');

                            if (priorityCode) {
                                cellContent = priorityCode.label;
                            } else {
                                // On affiche les horaires même si AA est présent sur le segment
                                const horaires = serviceSegments.filter(s => s.type === 'horaire' && s.start && s.end);
                                if (horaires.length > 0) {
                                    cellContent = horaires.map(s => `${s.start}-${s.end}`).join(' ');
                                } else if (serviceSegments.some(s => s.label === 'REPOS')) {
                                    cellContent = 'REPOS';
                                } else if (aaSegment) {
                                    cellContent = ''; // Garder vide si c'est juste un code AA sans horaires
                                }
                            }
                        }
                        // Ajout du titre de catégorie (Poste) - COLORÉ ET CENTRÉ
                        if (row.employeeRole !== currentRole) {
                            currentRole = row.employeeRole;
                            const roleLabel = (roles.find(r => r.id === currentRole)?.label || currentRole).toUpperCase();
                            bodyData.push([{
                                content: roleLabel,
                                colSpan: headRow.length,
                                styles: { 
                                    fillColor: headerColorRgb, 
                                    textColor: textColorRgb, 
                                    fontStyle: 'bold', 
                                    halign: 'center', 
                                    fontSize: 8.5,
                                    minCellHeight: 6
                                }
                            }]);
                        }

                        const rowData: any[] = [displayName, cellContent.replace(/\n/g, ' ')];
                        if (includeArrival) rowData.push(aaSegment ? 'AA' : '');
                        if (includeDeparture) rowData.push('');
                        if (includeSignature) rowData.push('');
                        
                        bodyData.push(rowData);
                    });

                    // --- CALCUL DYNAMIQUE DE LA HAUTEUR STRICT (MÉTHODE ÉLASTIQUE V3) ---
                    const totalRowsCount = bodyData.length;
                    
                    // Zone utile hyper-sécurisée : 250mm pour éviter tout saut de page fantôme
                    const availableTableHeight = 250; 
                    
                    // Calcul de la hauteur idéale
                    let rowHeight = availableTableHeight / totalRowsCount;
                    if (rowHeight > 8) rowHeight = 8;
                    if (rowHeight < 4.0) rowHeight = 4.0;
                    
                    // Ajustement intelligent de la police et du padding
                    let fontSize = 9;
                    let cellPadding = 1.0;
                    
                    if (totalRowsCount > 45) {
                        fontSize = 6.5;
                        cellPadding = 0.4;
                    } else if (totalRowsCount > 35) {
                        fontSize = 7.5;
                        cellPadding = 0.6;
                    } else if (rowHeight > 7.0) {
                        fontSize = 9;
                        cellPadding = 1.6;
                    } else if (rowHeight > 6.0) {
                        fontSize = 8.5;
                        cellPadding = 1.2;
                    }

                    autoTable(doc, {
                        startY: TOP_MARGIN + 10, // Un peu plus bas pour le titre
                        head: [headRow],
                        body: bodyData,
                        theme: 'grid',
                        styles: { 
                            fontSize: fontSize, 
                            cellPadding: cellPadding, 
                            minCellHeight: rowHeight, 
                            valign: 'middle', 
                            lineColor: [80, 80, 80], 
                            lineWidth: 0.1,
                            overflow: 'hidden'
                        },
                        didParseCell: function(data) {
                            if (data.section === 'body') {
                                // 1. Noms toujours en NOIR
                                if (data.column.index === 0) {
                                    data.cell.styles.textColor = [0, 0, 0];
                                    const rawText = String(data.cell.raw || '');
                                    if (rawText.includes('[SEG_NOTE:')) {
                                        // Save the original text with marker on a custom property so didDrawCell can read it
                                        (data.cell as any)._originalRawText = rawText;
                                        // Set the cell text to just the name part so autoTable does not render the [SEG_NOTE:...] part or truncate it
                                        const match = rawText.match(/^(.*?)\s*\[SEG_NOTE:\((.*?)\)\]$/);
                                        if (match) {
                                            data.cell.text = [match[1].trim()];
                                            data.cell.styles.halign = 'left';
                                        }
                                    }
                                }
 
                                // 2. Colonne Horaires / Absences (Colonne 1)
                                if (data.column.index === 1) {
                                    const cellValue = String(data.cell.raw || "").toUpperCase();
                                    
                                        // REPOS : Toujours Noir/Blanc par défaut
                                        if (cellValue === "REPOS") {
                                            data.cell.styles.fillColor = [0, 0, 0];
                                            data.cell.styles.textColor = [255, 255, 255];
                                            data.cell.styles.fontStyle = 'bold';
                                            data.cell.styles.halign = 'center';
                                        } else {
                                            // Get raw employee name from row cells (which might contain the segment note marker)
                                            let empName = String(data.row.cells[0].raw || "").trim();
                                            if (empName.includes('[SEG_NOTE:')) {
                                                const cleanMatch = empName.match(/^(.*?)\s*\[SEG_NOTE:\((.*?)\)\]$/);
                                                if (cleanMatch) {
                                                    empName = cleanMatch[1].trim();
                                                }
                                            }
                                            const empData = filteredRows.find(r => r.employeeName === empName);
                                            const shift = empData?.shifts[dayDateStr];
                                            // On filtre les segments pour ce service uniquement
                                            const serviceSegments = shift?.segments?.filter((s: any) => {
                                                if (s.type === 'code') return true;
                                                if (s.type === 'horaire' && s.start && s.end) {
                                                    if (serviceName === 'MIDI') return s.start < "16:00";
                                                    return s.end > "18:00" || s.end < s.start || s.start >= "16:00";
                                                }
                                                return false;
                                            }) || [];

                                            // On cherche un code d'absence (AA, CP, etc.)
                                            const absSeg = serviceSegments.find((s: any) => s.label && s.label !== 'REPOS');
                                            const absConfig = absSeg ? dynamicAbsences.find((a: any) => a.code === absSeg.label) : null;
                                            
                                            let targetColor = absSeg?.colorOverride || absConfig?.color;

                                            // Si ce n'est pas une absence, on regarde s'il y a un horaire ROUGE
                                            const hasRedShift = serviceSegments.some((s: any) => {
                                                const color = s.colorOverride || s.color || '';
                                                // Vérifie si la couleur est rouge (ex: #ef4444, #ff0000, red, etc.)
                                                return color && (
                                                    color.toLowerCase() === 'red' ||
                                                    color.toLowerCase() === '#ef4444' ||
                                                    color.toLowerCase() === '#ff0000' ||
                                                    color.toLowerCase() === '#f87171' ||
                                                    color.toLowerCase() === '#dc2626' ||
                                                    color.toLowerCase() === '#b91c1c'
                                                );
                                            });

                                            if (hasRedShift) {
                                                // Appliquer le style rouge (fond rouge, texte blanc)
                                                data.cell.styles.fillColor = [239, 68, 68]; // #ef4444
                                                data.cell.styles.textColor = [255, 255, 255];
                                                data.cell.styles.fontStyle = 'bold';
                                                data.cell.styles.halign = 'center';
                                            } else if (absSeg && targetColor && targetColor.toUpperCase() !== '#FFFFFF') {
                                                // Appliquer la couleur de l'absence UNIQUEMENT si la cellule affiche
                                                // le code d'absence lui-même (ex: "CM", "CP") et NON un horaire (ex: "11:45-15:00").
                                                // Si la cellule affiche un horaire, on laisse blanc même si le salarié a un code AA en plus.
                                                const cellIsAbsenceCode = !cellValue.includes(':') && !cellValue.includes('-');
                                                if (cellIsAbsenceCode) {
                                                    const styles = getDynamicStyles(targetColor);
                                                    data.cell.styles.fillColor = styles.bg;
                                                    data.cell.styles.textColor = styles.text;
                                                    data.cell.styles.fontStyle = 'bold';
                                                    data.cell.styles.halign = 'center';
                                                } else {
                                                    // Horaire + absence code : on garde blanc
                                                    data.cell.styles.fillColor = [255, 255, 255];
                                                    data.cell.styles.textColor = [0, 0, 0];
                                                }
                                            } else {
                                                // Toutes les autres couleurs (vert, bleu, etc.) ignorées
                                                data.cell.styles.fillColor = [255, 255, 255];
                                                data.cell.styles.textColor = [0, 0, 0];
                                            }
                                        }
                                }

                                // 3. Colonnes Arrivée/Départ (2 et 3) : Centrage et AA en rouge
                                if (data.column.index === 2 || data.column.index === 3) {
                                    data.cell.styles.halign = 'center';
                                    const absCode = String(data.cell.raw).toUpperCase();
                                    const absConfig = dynamicAbsences.find((a: any) => absCode === String(a.code).toUpperCase());
                                    
                                    if (absConfig && absConfig.color) {
                                        const styles = getDynamicStyles(absConfig.color);
                                        data.cell.styles.fillColor = styles.bg;
                                        data.cell.styles.textColor = styles.text;
                                        data.cell.styles.fontStyle = 'bold';
                                    } else if (absCode === 'AA') {
                                        // Fallback historique si non configuré dans les codes dynamiques
                                        data.cell.styles.fontStyle = 'bold';
                                        data.cell.styles.textColor = [255, 255, 255];
                                        data.cell.styles.fillColor = [211, 47, 47]; // Rouge AA
                                    }
                                }
                            }
                        },
                        // Custom drawing to render the note part in bold + italic + underline
                        didDrawCell: function(data) {
                            if (data.section === 'body' && data.column.index === 0) {
                                const originalText = (data.cell as any)._originalRawText || '';
                                if (originalText.includes('[SEG_NOTE:')) {
                                    const match = originalText.match(/^(.*?)\s*\[SEG_NOTE:\((.*?)\)\]$/);
                                    if (match) {
                                        const namePart = match[1].trim();
                                        const notePart = `(${match[2].trim()})`;

                                        // autoTable already drew the name at the correct position.
                                        // We measure the name width then place the note immediately after.
                                        data.doc.setFont('helvetica', 'bold');
                                        data.doc.setFontSize(fontSize);
                                        const nameWidth = data.doc.getTextWidth(namePart);

                                        // Use cell vertical center with baseline:'middle' so it aligns with the row text.
                                        // X = cell.x + cellPadding (same offset autoTable uses for left-aligned text).
                                        const midY = data.cell.y + data.cell.height / 2;
                                        const startX = data.cell.x + cellPadding;

                                        // Note goes right after the name
                                        const noteX = startX + nameWidth + 2;
                                        data.doc.setFont('helvetica', 'bolditalic');
                                        data.doc.setTextColor(0, 0, 0);
                                        data.doc.text(notePart, noteX, midY, { baseline: 'middle' });

                                        // Underline the note
                                        data.doc.setFont('helvetica', 'bolditalic');
                                        data.doc.setFontSize(fontSize);
                                        const noteWidth = data.doc.getTextWidth(notePart);
                                        data.doc.setLineWidth(0.1);
                                        data.doc.setDrawColor(0, 0, 0);
                                        data.doc.line(noteX, midY + (fontSize * 0.3), noteX + noteWidth, midY + (fontSize * 0.3));
                                    }
                                }
                            }
                        },
                        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                        columnStyles: columnStyles,
                        margin: { left: MARGIN_X, right: MARGIN_X, bottom: BOTTOM_MARGIN },
                        pageBreak: 'avoid',
                        showFoot: 'never',
                        showHead: 'firstPage'
                    });
                };

                drawServicePage('MIDI');
                doc.addPage();
                drawServicePage('SOIR');
                
                const fileName = `Feuille_de_presence_${dayDateStr}.pdf`;
                doc.save(fileName);

            } else {
                // WEEK MODE - GRID
                const doc = new jsPDF('landscape');
                const weekStartDate = parseISO(weekDates[0]);
                
                doc.setFontSize(18);
                const companyName = user?.company_name || "Votre Établissement";
                doc.text(`Planning ${companyName} - ${planning.service}`, 14, 15);
                doc.setFontSize(11);
                doc.setTextColor(100);
                doc.text(`Semaine du ${format(weekStartDate, 'dd MMMM yyyy', { locale: fr })} au ${format(addDays(weekStartDate, 6), 'dd MMMM yyyy', { locale: fr })}`, 14, 22);
                
                const weekDatesArr = Array.from({ length: 7 }, (_, i) => format(addDays(weekStartDate, i), 'yyyy-MM-dd'));
                const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
                
                const bodyData: any[] = [];
                const sortedEmployees = employees.filter(e => selectedRoles.includes(e.position || 'GENERAL')).sort((a, b) => {
                    const idxA = rolesOrder.indexOf(a.position || 'GENERAL');
                    const idxB = rolesOrder.indexOf(b.position || 'GENERAL');
                    if (idxA !== idxB) return idxA - idxB;
                    return (a.last_name || '').localeCompare(b.last_name || '');
                });

                let currentRole = '';
                sortedEmployees.forEach(emp => {
                    const role = emp.position || 'GENERAL';
                    if (role !== currentRole) {
                        currentRole = role;
                        const label = roles.find(r => r.id === currentRole)?.label || role;
                        bodyData.push([{ content: label.toUpperCase(), colSpan: 8, styles: { fillColor: headerColorRgb, textColor: textColorRgb, fontStyle: 'bold', halign: 'center', fontSize: 10 } }]);
                    }

                    const planningRow = planning.rows.find(r => r.employeeId === emp.id);
                    const rowData: any[] = [`${(emp.last_name || '').toUpperCase()} ${emp.first_name || ''}`.trim()];

                    weekDatesArr.forEach(date => {
                        const s = planningRow?.shifts[date];
                        if (!s?.segments?.length) { rowData.push(''); return; }
                        
                        const text = s.segments.map(seg => seg.type === 'horaire' ? `${seg.start}-${seg.end}` : seg.label).join('\n');
                        const seg = s.segments[0]; // Logic based on the first segment's color
                        
                        let cellBgColor: string | null = null;

                        const isAbsence = seg.label === 'REPOS' || (seg.label && dynamicAbsences.some((t: any) => t.code === seg.label));

                        if (isAbsence && seg.label) {
                            if (seg.label === 'REPOS') {
                                cellBgColor = '#000000';
                            } else {
                                const absConfig = dynamicAbsences.find((a: any) => a.code === seg.label);
                                cellBgColor = absConfig?.color || '#000000';
                            }
                        } else if (seg.type === 'horaire') {
                            cellBgColor = seg.colorOverride || seg.color || null;
                        }

                        if (cellBgColor && cellBgColor.toUpperCase() !== '#FFFFFF' && text.trim() !== '') {
                            const styles = getDynamicStyles(cellBgColor);
                            rowData.push({ 
                                content: text, 
                                styles: { 
                                    fillColor: styles.bg, 
                                    textColor: styles.text, 
                                    fontStyle: 'bold' 
                                } 
                            });
                        } else {
                            rowData.push(text);
                        }
                    });
                    bodyData.push(rowData);
                });

                // KPI ROW with ExtraShifts
                const kpiRow = ['TOTAL STAFF'];
                weekDatesArr.forEach(date => {
                    let midi = 0, soir = 0;
                    planning.rows.forEach(r => {
                        if (selectedRoles.includes(r.employeeRole || 'GENERAL')) {
                            const s = r.shifts[date];
                            s?.segments?.forEach(seg => {
                                if (seg.type === 'horaire' && seg.start && seg.end) {
                                    if (seg.start < "16:00") midi++;
                                    if (seg.end >= "16:00" || seg.end < seg.start) soir++;
                                }
                            });
                        }
                    });
                    (planning.extraShifts || []).forEach(e => {
                        if (e.date === date) {
                            if (e.start < "16:00") midi += e.count;
                            if (e.end >= "16:00" || e.end < e.start) soir += e.count;
                        }
                    });
                    kpiRow.push(`M: ${midi} / S: ${soir}`);
                });
                bodyData.push(kpiRow);

                autoTable(doc, {
                    startY: 30,
                    head: [['Employé', ...days]],
                    body: bodyData,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', halign: 'center', valign: 'middle' },
                    headStyles: { fillColor: headerColorRgb, textColor: textColorRgb, fontStyle: 'bold' },
                    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 } }
                });

                const pdfBlob = doc.output('blob');
                const url = URL.createObjectURL(pdfBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Planning_${planning.service}_${format(weekStartDate, 'yyyy-MM-dd')}.pdf`;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
            }
        } catch (error) {
            console.error('Export failed', error);
            alert('Erreur lors de l\'export PDF.');
        } finally {
            setExporting(false);
        }
    };

    const toggleRole = (roleId: string) => {
        setSelectedRoles((prev) => prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]);
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white">Export Planning</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1"><X size={18} /></button>
                </div>

                <div className="px-4 py-3 overflow-y-auto text-sm">
                    <div className="inline-flex w-full rounded-lg bg-slate-100 dark:bg-slate-900 p-0.5 mb-3">
                        <button onClick={() => setExportMode('week')} className={`flex-1 rounded-md px-3 py-1 text-xs font-bold transition-all ${exportMode === 'week' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-500'}`}>Semaine</button>
                        <button onClick={() => setExportMode('day')} className={`flex-1 rounded-md px-3 py-1 text-xs font-bold transition-all ${exportMode === 'day' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-500'}`}>Jour</button>
                    </div>

                    {exportMode === 'day' && (
                        <div className="mt-2 rounded-lg border border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 p-2">
                            <select value={dayDate} onChange={(e) => setDayDate(e.target.value)} className="w-full h-9 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-xs text-slate-800 dark:text-white outline-none">
                                {weekDates.map((date) => (
                                    <option key={date} value={date}>{format(parseISO(date), 'EEEE d MMMM', { locale: fr })}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="mt-4 space-y-4 pb-4">
                        <section>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckSquare size={14} className="text-slate-600 dark:text-slate-400" />
                                        <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Fond Entêtes</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {HEADER_BG_COLORS.map((color) => (
                                            <button key={color} onClick={() => setHeaderBgColor(color)} className={`h-6 w-6 rounded-full border-2 transition-all ${headerBgColor === color ? 'border-blue-500 scale-110' : 'border-white shadow-sm'}`} style={{ backgroundColor: color }} />
                                        ))}
                                    </div>
                                </div>
                                <div className="w-[100px]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText size={14} className="text-slate-600 dark:text-slate-400" />
                                        <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Texte</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {HEADER_TEXT_COLORS.map((color) => (
                                            <button key={color} onClick={() => setHeaderTextColor(color)} className={`h-6 w-6 rounded-full border-2 transition-all ${headerTextColor === color ? 'border-blue-500 scale-110' : 'border-white shadow-sm'}`} style={{ backgroundColor: color }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center gap-2 mb-2">
                                <LayoutPanelLeft size={14} className="text-slate-600 dark:text-slate-400" />
                                <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Colonnes à afficher</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Heure arrivée', checked: includeArrival, setChecked: setIncludeArrival },
                                    { label: 'Heure départ', checked: includeDeparture, setChecked: setIncludeDeparture },
                                    { label: 'Signature', checked: includeSignature, setChecked: setIncludeSignature },
                                ].map((item) => (
                                    <button key={item.label} onClick={() => item.setChecked(!item.checked)} className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[10px] font-bold transition-colors ${item.checked ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-500'}`}>
                                        <input type="checkbox" readOnly checked={item.checked} className="h-3 w-3 accent-blue-600" />
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Postes</h3>
                                <div className="flex items-center gap-3 text-[9px] font-black">
                                    <button onClick={() => setSelectedRoles(orderedRoles.map((role) => role.id))} className="text-blue-600 dark:text-blue-400 hover:underline uppercase">Tout</button>
                                    <button onClick={() => setSelectedRoles([])} className="text-slate-400 dark:text-slate-600 hover:underline uppercase">Aucun</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                                {orderedRoles.map((role) => {
                                    const checked = selectedRoles.includes(role.id);
                                    return (
                                        <button key={role.id} onClick={() => toggleRole(role.id)} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[10px] font-bold transition-colors ${checked ? 'border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 text-blue-700 dark:text-blue-400' : 'border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-600'}`}>
                                            <input type="checkbox" readOnly checked={checked} className="h-3 w-3 accent-blue-600" />
                                            <span className="truncate">{role.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </div>

                <div className="border-t border-slate-200 dark:border-white/10 px-4 py-2.5 flex items-center justify-end gap-2 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
                    <button onClick={onClose} className="h-9 rounded-lg border border-slate-300 dark:border-white/10 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Fermer</button>
                    <button onClick={handleExport} disabled={exporting || !planning} className="h-9 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]">
                        <Download size={14} /> {exporting ? '...' : 'Exporter PDF'}
                    </button>
                </div>
            </div>
        </div>
    );
};