
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Planning, Template, ABSENCE_TYPES, PlanningRow, getRoleIndex } from '../types';
import { format, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ExportOptions {
    roles: string[];
    period: 'WEEK' | 'DAY';
    selectedDay: string;
    columns: {
        arrival: boolean;
        departure: boolean;
        signature: boolean;
    };
    colors: {
        header: string;
        text: string;
    };
    roleLabels?: Record<string, string>;
}

export const generatePDF = (planning: Planning, templates: Template[], options: ExportOptions) => {
    if (options.period === 'DAY' && options.selectedDay) {
        generateDayPDF(planning, templates, options);
    } else {
        generatePlanningPDF(planning, templates, options);
    }
};

const getRoleLabel = (roleId: string, map?: Record<string, string>) => map && map[roleId] ? map[roleId] : roleId;

const worksInService = (row: PlanningRow, date: string, service: 'midi' | 'soir'): boolean => {
    const shift = row.shifts[date];
    if (!shift || !shift.segments || shift.segments.length === 0) return false;
    const hasCode = shift.segments.some(s => s.type === 'code');
    if (hasCode) return true;
    return shift.segments.some(s => {
        if (s.type === 'horaire' && s.start) {
            if (service === 'midi') return s.start < "14:00";
            if (service === 'soir') return s.start >= "14:00";
        }
        return false;
    });
};

const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
};

const generateDayPDF = (planning: Planning, templates: Template[], options: ExportOptions) => {
    const doc = new jsPDF('portrait');
    const dayDate = parseISO(options.selectedDay);
    const dayStr = format(dayDate, 'eeee d MMMM yyyy', { locale: fr }).toUpperCase();

    // STRICT: Minimize spacing to fit on exactly 1 page per service
    const PAGE_HEIGHT = 297;
    const PAGE_WIDTH = 210;
    const MARGIN_TOP = 12;
    const MARGIN_BOTTOM = 3;
    const MARGIN_LEFT = 13;
    const MARGIN_RIGHT = 13;

    const drawServicePage = (serviceName: 'MIDI' | 'SOIR', isFirstPage: boolean) => {
        // Add title at the top, centered - smaller
        doc.setFontSize(12);
        doc.setTextColor(0);
        const title = `ÉMARGEMENT - ${serviceName}`;
        const titleWidth = doc.getTextWidth(title);
        doc.text(title, (PAGE_WIDTH - titleWidth) / 2, 8);

        doc.setFontSize(9);
        doc.setTextColor(0);
        const subtitle = `${dayStr}`;
        const subtitleWidth = doc.getTextWidth(subtitle);
        doc.text(subtitle, (PAGE_WIDTH - subtitleWidth) / 2, 12);

        const headRow = ['Employé', 'Horaires'];
        let colIndex = 2;
        const columnStyles: any = {
            0: { cellWidth: 47, fontStyle: 'bold' }, // Nom
            1: { cellWidth: 34, halign: 'center' },  // Horaires
        };

        if (options.columns.arrival) {
            headRow.push('Arrivée');
            columnStyles[colIndex] = { cellWidth: 21 };
            colIndex++;
        }
        if (options.columns.departure) {
            headRow.push('Départ');
            columnStyles[colIndex] = { cellWidth: 21 };
            colIndex++;
        }
        // Signature takes remaining space implicitly by not defining width
        if (options.columns.signature) {
            headRow.push('Signature');
            columnStyles[colIndex] = { cellWidth: 37 };
        }

        // Get ALL employees for selected roles, not just those working in this service
        const allServiceRows = planning.rows.filter(row =>
            options.roles.includes(row.employeeRole)
        );

        allServiceRows.sort((a, b) => {
            const roleIndexA = getRoleIndex(a.employeeRole);
            const roleIndexB = getRoleIndex(b.employeeRole);
            if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB;
            return a.employeeName.localeCompare(b.employeeName);
        });

        const bodyData: any[] = [];
        let currentRole = '';

        allServiceRows.forEach(row => {
            if (row.employeeRole !== currentRole) {
                currentRole = row.employeeRole;
                const headerColorRgb = hexToRgb(options.colors?.header || '#C1D5AF');
                const textColorRgb = hexToRgb(options.colors?.text || '#000000');

                bodyData.push([{
                    content: getRoleLabel(currentRole, options.roleLabels).toUpperCase(),
                    colSpan: headRow.length,
                    styles: {
                        fillColor: headerColorRgb,
                        textColor: textColorRgb,
                        fontStyle: 'bold',
                        halign: 'center',
                        cellPadding: 2,
                        fontSize: 8,
                        minCellHeight: 6
                    }
                }]);
            }
            const shift = row.shifts[options.selectedDay];
            let cellContent: any = '';

            // Check if this is an AA segment for the current service
            let aaSegmentForDeparture = null;
            let otherSegments = [];

            if (shift && shift.segments && shift.segments.length > 0) {
                const serviceSegments = shift.segments.filter(s => {
                    if (s.type === 'code') return true;
                    if (s.type === 'horaire' && s.start) {
                        if (serviceName === 'MIDI') return s.start < "14:00";
                        if (serviceName === 'SOIR') return s.start >= "14:00" || (s.start < "14:00" && s.end >= "18:00");
                    }
                    return false;
                });

                // Separate AA segments from others (including horaire segments with AA label)
                serviceSegments.forEach(s => {
                    if ((s.type === 'code' && s.label === 'AA') || (s.type === 'horaire' && s.label === 'AA')) {
                        aaSegmentForDeparture = s;
                    } else {
                        otherSegments.push(s);
                    }
                });

                // Display all segments except AA codes in horaires column
                if (shift && shift.segments && shift.segments.length > 0) {
                    // Get code segments except AA (these should replace horaires)
                    const codeSegments = shift.segments.filter(s => {
                        if (s.type === 'code') {
                            if (s.label === 'AA') return false; // Exclude AA - handled separately
                            return true;
                        }
                        if (s.type === 'horaire' && s.label) {
                            if (s.label === 'AA') return false; // Exclude AA - handled separately

                            // Force include absence types (except AA) for both services
                            if (ABSENCE_TYPES.includes(s.label as any)) return true;

                            // Filter other horaire segments with labels by service
                            if (serviceName === 'MIDI') return s.start < "14:00";
                            if (serviceName === 'SOIR') return s.start >= "14:00" || (s.start < "14:00" && s.end >= "18:00");
                            return false;
                        }
                        return false;
                    });

                    // Get horaire segments for this service
                    let horaireSegments = shift.segments.filter(s => {
                        if (s.type !== 'horaire' || !s.start) return false;

                        // Validate that start time is reasonable (between 00:00 and 23:59)
                        const [startHour, startMin] = s.start.split(':').map(Number);
                        if (startHour < 0 || startHour > 23 || startMin < 0 || startMin > 59) {
                            return false; // Exclude invalid times
                        }

                        if (serviceName === 'MIDI') {
                            return s.start < "14:00";
                        }
                        if (serviceName === 'SOIR') {
                            // Convert times to minutes for proper comparison
                            const startMinutes = startHour * 60 + startMin;
                            // Include only if start >= 14:00 (strict)
                            return startMinutes >= 14 * 60;
                        }
                        return false;
                    });

                    // If there are code segments (except AA), they replace horaires
                    if (codeSegments.length > 0) {
                        // Filter code segments by service for horaire segments with labels
                        const filteredCodeSegments = codeSegments.filter(s => {
                            if (s.type === 'code') return true; // Pure codes show on both pages
                            if (s.type === 'horaire' && s.label) {
                                // Force include absence types (except AA) for both services
                                if (ABSENCE_TYPES.includes(s.label as any)) return true;

                                // Filter horaire segments with labels by service
                                if (serviceName === 'MIDI') return s.start < "14:00";
                                if (serviceName === 'SOIR') return s.start >= "14:00" || (s.start < "14:00" && s.end >= "18:00");
                                return false;
                            }
                            return false;
                        });

                        // Use only filtered code segments, not horaires
                        const displaySegments = filteredCodeSegments;

                        if (displaySegments.length > 0) {
                            const text = displaySegments.map(s => s.label).join(' / ');

                            let styles: any = {};
                            const first = displaySegments[0];
                            if (first.type === 'code') {
                                if (first.label === 'REPOS') { styles = { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'Ecole') { styles = { fillColor: [239, 235, 233], textColor: [93, 64, 55], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'mise à dispo') { styles = { fillColor: [94, 232, 215], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'HAB/DES') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'MISE A DISPO') { styles = { fillColor: [94, 232, 215], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'CP') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'AM') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'CM') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'RN') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'JF') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'RJF') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'AT') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'SUSPENDU') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'RCF') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else {
                                    // Display ALL other codes with the same style (including YAROSLAV, etc.)
                                    styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' };
                                }
                            } else if (first.type === 'horaire' && first.label) {
                                // Handle horaire segments with labels (like HAB/DES)
                                if (first.label === 'REPOS') { styles = { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'Ecole') { styles = { fillColor: [239, 235, 233], textColor: [93, 64, 55], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'mise à dispo') { styles = { fillColor: [94, 232, 215], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'HAB/DES') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'MISE A DISPO') { styles = { fillColor: [94, 232, 215], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'CP') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'AM') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'CM') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'RN') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'JF') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'RJF') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'AT') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'SUSPENDU') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else if (first.label === 'RCF') { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                                else {
                                    // Display ALL other labels with the same style
                                    styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' };
                                }
                            }
                            if (Object.keys(styles).length > 0) { cellContent = { content: text, styles }; }
                            else { cellContent = text; }
                        }
                    } else {
                        // No code segments (except AA), so show horaires for this service only
                        // Get all horaire segments for this service (without any filtering)
                        horaireSegments = shift.segments.filter(s => {
                            if (s.type !== 'horaire' || !s.start) return false;
                            if (serviceName === 'MIDI') return s.start < "14:00";
                            if (serviceName === 'SOIR') return s.start >= "14:00" || (s.start < "14:00" && s.end >= "18:00");
                            return false;
                        });

                        if (aaSegmentForDeparture && horaireSegments.length === 0) {
                            // Look for any horaire segments in the entire day
                            const allHoraireSegments = shift.segments.filter(s => {
                                if (s.type !== 'horaire' || !s.start) return false;
                                return true; // Get all horaire segments regardless of service
                            });

                            // Filter them for the current service only
                            horaireSegments = allHoraireSegments.filter(s => {
                                if (serviceName === 'MIDI') return s.start < "14:00";
                                if (serviceName === 'SOIR') return s.start >= "14:00" || (s.start < "14:00" && s.end >= "18:00");
                                return false;
                            });

                            // If still no horaires found, create default for AA employees
                            if (horaireSegments.length === 0) {
                                const defaultStart = "09:00";
                                const defaultEnd = "17:00";

                                if (serviceName === 'MIDI') {
                                    horaireSegments.push({
                                        type: 'horaire' as const,
                                        start: defaultStart,
                                        end: defaultEnd
                                    });
                                } else if (serviceName === 'SOIR') {
                                    horaireSegments.push({
                                        type: 'horaire' as const,
                                        start: defaultStart,
                                        end: defaultEnd
                                    });
                                }
                            }
                        }

                        if (horaireSegments.length > 0) {
                            const text = horaireSegments.map(s => `${s.start}-${s.end}`).join(' / ');
                            cellContent = text;
                        }
                    }
                }
            }

            const rowData = [row.employeeName, cellContent];

            // Handle arrival column - show AA here if present
            if (options.columns.arrival) {
                if (aaSegmentForDeparture) {
                    rowData.push({
                        content: 'AA',
                        styles: {
                            fillColor: [255, 235, 238],
                            textColor: [211, 47, 47],
                            fontStyle: 'bold',
                            halign: 'center'
                        }
                    });
                } else {
                    rowData.push('');
                }
            }

            // Handle departure column
            if (options.columns.departure) {
                rowData.push('');
            }

            if (options.columns.signature) rowData.push('');
            bodyData.push(rowData);
        });

        if (bodyData.length === 0) {
            bodyData.push([{ content: "Aucun personnel pour ce service.", colSpan: headRow.length, styles: { halign: 'center', fontStyle: 'italic', textColor: 150 } }]);
        }

        // OPTIMIZE FOR SINGLE PAGE: Calculate row height to fit all data on ONE page
        const startTableY = 14;
        const bottomMargin = MARGIN_BOTTOM;
        const availablePageHeight = PAGE_HEIGHT - startTableY - bottomMargin;

        // Header row takes ~5mm
        const headerHeight = 5;
        const roleHeaderHeight = 5;

        // Count role headers (section headers)
        let roleHeaderCount = 0;
        let lastRole = '';
        for (const row of bodyData) {
            if (row[0].colSpan === headRow.length) roleHeaderCount++;
        }

        // Total height needed for role headers
        const totalRoleHeaderHeight = roleHeaderCount * roleHeaderHeight;

        // Available height for employee rows
        const availableForEmployees = availablePageHeight - headerHeight - totalRoleHeaderHeight;

        // Employee rows only
        const employeeRowCount = bodyData.filter(r => !r[0].colSpan || r[0].colSpan !== headRow.length).length;

        // Dynamic row height - calculated to fit in available space
        const calculatedRowHeight = availableForEmployees / Math.max(employeeRowCount, 1);

        // Target settings: Bigger Fonts (+1) with 5.8mm Row Height
        let rowHeight = 5.8;
        let bodyFontSize = 7.5; // Increased legibility
        let headerFontSize = 8;
        let roleFontSize = 9;
        let cellPadding = 1;

        // CRITICAL: Dynamic scaling to GUARANTEE strictly one page
        // If the number of employees forces the row height below 5.8mm,
        // we strictly reduce font size and padding to fit everything.
        if (calculatedRowHeight < 5.8) {
            rowHeight = calculatedRowHeight;

            // Thresholds for reducing font size to prevent overlap
            if (rowHeight < 5.0) {
                bodyFontSize = 6.5;
                cellPadding = 0.8;
            }
            if (rowHeight < 4.0) {
                bodyFontSize = 5.5;
                cellPadding = 0.5;
            }
            if (rowHeight < 3.2) {
                bodyFontSize = 4.5;
                cellPadding = 0.3;
            }
        }

        // Apply larger font to Role Headers dynamically
        bodyData.forEach(row => {
            if (row[0].colSpan === headRow.length) {
                row[0].styles.fontSize = roleFontSize;
            }
        });

        // Calculate total table width to center it
        let totalTableWidth = 47 + 34; // Base cols
        if (options.columns.arrival) totalTableWidth += 21;
        if (options.columns.departure) totalTableWidth += 21;
        if (options.columns.signature) totalTableWidth += 37;

        const centeredMarginLeft = (PAGE_WIDTH - totalTableWidth) / 2;

        const headerColorRgb = hexToRgb(options.colors?.header || '#C1D5AF');
        const textColorRgb = hexToRgb(options.colors?.text || '#000000');

        autoTable(doc, {
            startY: startTableY,
            head: [headRow],
            body: bodyData,
            theme: 'grid',
            margin: { top: 0, right: centeredMarginLeft, bottom: bottomMargin, left: centeredMarginLeft },
            styles: {
                fontSize: bodyFontSize,
                cellPadding: cellPadding,
                minCellHeight: rowHeight,
                valign: 'middle',
                lineColor: [180, 180, 180],
                overflow: 'hidden',
                lineWidth: 0.3
            },
            headStyles: {
                fillColor: headerColorRgb,
                textColor: textColorRgb,
                fontStyle: 'bold',
                fontSize: headerFontSize,
                halign: 'center',
                minCellHeight: headerHeight,
                cellPadding: 1
            },
            columnStyles: columnStyles,
            pageBreak: 'avoid',
            didDrawPage: (data: any) => {
                // Ensure we don't overflow - if content is larger than available space, it will be cut
                // But with pageBreak: 'avoid' and our calculations, this shouldn't happen
            }
        });
    };

    drawServicePage('MIDI', true);
    doc.addPage();
    drawServicePage('SOIR', false);

    // Télécharger le PDF - utiliser doc.save() comme fallback principal
    doc.save(`Emargement_${options.selectedDay}_Midi_Soir.pdf`);
};

export const generatePlanningPDF = (planning: Planning, templates: Template[], options: ExportOptions) => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text(`Planning Polpo - ${planning.service}`, 14, 15);
    doc.setFontSize(11);
    doc.setTextColor(100);
    const start = format(parseISO(planning.weekStart), 'dd MMMM yyyy', { locale: fr });
    const end = format(parseISO(planning.weekEnd), 'dd MMMM yyyy', { locale: fr });
    doc.text(`Semaine du ${start} au ${end}`, 14, 22);

    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(planning.weekStart), i), 'yyyy-MM-dd'));

    const bodyData: any[] = [];
    const sortedRows = [...planning.rows].sort((a, b) => {
        const roleIndexA = getRoleIndex(a.employeeRole);
        const roleIndexB = getRoleIndex(b.employeeRole);
        if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB;
        return a.employeeName.localeCompare(b.employeeName);
    });
    let currentRole = '';

    sortedRows.forEach(row => {
        if (row.employeeRole !== currentRole) {
            currentRole = row.employeeRole;
            const headerColorRgb = hexToRgb(options.colors?.header || '#C1D5AF');
            const textColorRgb = hexToRgb(options.colors?.text || '#000000');
            bodyData.push([{ content: getRoleLabel(currentRole, options.roleLabels).toUpperCase(), colSpan: 8, styles: { fillColor: headerColorRgb, textColor: textColorRgb, fontStyle: 'bold', halign: 'center', fontSize: 10 } }]);
        }

        const rowData: any[] = [row.employeeName];

        weekDates.forEach(date => {
            const s = row.shifts[date];
            if (!s || !s.segments || s.segments.length === 0) { rowData.push(''); return; }
            const parts = s.segments.map(seg => {
                if (seg.type === 'horaire') return `${seg.start}-${seg.end}`;
                return seg.label || '';
            }).filter(Boolean).join('\n');

            let cellColor: string | null = null;
            let textColor = null;
            const seg = s.segments[0];

            if (seg.type === 'code') {
                if (seg.label === 'REPOS') { cellColor = '#000000'; textColor = '#FFFFFF'; }
                else if (seg.label === 'Ecole') { cellColor = '#EFEBE9'; textColor = '#5D4037'; }
                else if (seg.label === 'mise à dispo') { cellColor = '#5ee8d7'; textColor = '#FFFFFF'; }
                else if (seg.label && ABSENCE_TYPES.includes(seg.label as any)) { cellColor = '#FFEBEE'; textColor = '#D32F2F'; }
            } else if (seg.type === 'horaire') {
                const coloredSegment = s.segments.find(seg => seg.type === 'horaire' && (seg.colorOverride || seg.color || seg.templateId));
                if (coloredSegment) {
                    if (coloredSegment.colorOverride) { cellColor = coloredSegment.colorOverride; }
                    else if (coloredSegment.color) { cellColor = coloredSegment.color; }
                    else if (coloredSegment.templateId) {
                        const tpl = templates.find(t => t.id === coloredSegment.templateId);
                        if (tpl && tpl.color) { cellColor = tpl.color; }
                    }
                }
            }

            const styles: any = {};
            if (cellColor) {
                const rgb = hexToRgb(cellColor);
                if (rgb) styles.fillColor = rgb;
            }
            if (textColor) {
                const rgb = hexToRgb(textColor);
                if (rgb) styles.textColor = rgb;
            }
            if (Object.keys(styles).length > 0) { rowData.push({ content: parts, styles }); } else { rowData.push(parts); }
        });

        bodyData.push(rowData);
    });

    const kpiRow = ['TOTAL STAFF'];
    weekDates.forEach(date => {
        let midi = 0; let soir = 0;
        planning.rows.forEach(r => {
            const s = r.shifts[date];
            if (s?.segments) {
                s.segments.forEach(seg => {
                    if (seg.type === 'horaire' && seg.start && seg.end) {
                        if (seg.start < "16:00") midi++;
                        if (seg.end >= "16:00" || seg.end < seg.start) soir++;
                    }
                });
            }
        });
        const extras = (planning.extraShifts || []).filter(e => e.date === date);
        extras.forEach(e => {
            if (e.start < "16:00") midi += e.count;
            if (e.end >= "16:00" || e.end < e.start) soir += e.count;
        });
        kpiRow.push(`M: ${midi} / S: ${soir}`);
    });

    bodyData.push([{ content: '', colSpan: 8, styles: { fillColor: [255, 255, 255], lineColor: [255, 255, 255] } }]);
    bodyData.push(kpiRow);

    const headerColorRgb = hexToRgb(options.colors?.header || '#C1D5AF');
    const textColorRgb = hexToRgb(options.colors?.text || '#000000');

    autoTable(doc, {
        startY: 30,
        head: [['Employé', ...days]],
        body: bodyData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', halign: 'center', valign: 'middle' },
        headStyles: { fillColor: headerColorRgb, textColor: textColorRgb, fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 } }
    });

    // Télécharger le PDF
    setTimeout(() => {
        try {
            const pdfBlob = doc.output('blob');
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Planning_${planning.service}_${planning.weekStart}.pdf`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
        } catch (error) {
            console.error('Erreur lors du téléchargement du PDF:', error);
        }
    }, 0);
};
