import { format, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Planning, Template, Shift } from './types';

const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
};

const ABSENCE_COLORS: Record<string, { bg: [number, number, number], text: [number, number, number] }> = {
    'REPOS': { bg: [0, 0, 0], text: [255, 255, 255] },
    'Ecole': { bg: [239, 235, 233], text: [93, 64, 55] },
    'mise à dispo': { bg: [94, 232, 215], text: [255, 255, 255] },
    'MISE A DISPO': { bg: [94, 232, 215], text: [255, 255, 255] },
    'HAB/DES': { bg: [255, 235, 238], text: [211, 47, 47] },
    'AA': { bg: [255, 235, 238], text: [211, 47, 47] },
    'DEFAULT_ABSENCE': { bg: [255, 235, 238], text: [211, 47, 47] }
};

export const generatePlanningGridPDF = async (options: {
    planning: Planning;
    roles: { id: string; label: string }[];
    rolesOrder: string[];
    employees: any[];
    companyName?: string;
    headerBgColor?: string;
    headerTextColor?: string;
}) => {
    const { planning, roles, rolesOrder, employees, companyName = "Votre Établissement", headerBgColor = '#C1D5AF', headerTextColor = '#000000' } = options;
    
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const headerColorRgb = hexToRgb(headerBgColor);
    const textColorRgb = hexToRgb(headerTextColor);

    const doc = new jsPDF('landscape');
    const weekStartDate = parseISO(planning.week_start);
    
    doc.setFontSize(18);
    doc.text(`Planning ${companyName} - ${planning.service}`, 14, 15);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Semaine du ${format(weekStartDate, 'dd MMMM yyyy', { locale: fr })} au ${format(addDays(weekStartDate, 6), 'dd MMMM yyyy', { locale: fr })}`, 14, 22);
    
    const weekDatesArr = Array.from({ length: 7 }, (_, i) => format(addDays(weekStartDate, i), 'yyyy-MM-dd'));
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    
    const bodyData: any[] = [];
    const selectedRoles = roles.map(r => r.id); // All roles for archive
    
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
            const label = String(roles.find(r => r.id === currentRole)?.label || role || '');
            bodyData.push([{ content: label.toUpperCase(), colSpan: 8, styles: { fillColor: headerColorRgb, textColor: textColorRgb, fontStyle: 'bold', halign: 'center', fontSize: 10 } }]);
        }

        const planningRow = planning.rows.find(r => r.employeeId === emp.id);
        const rowData: any[] = [String(`${(emp.last_name || '').toUpperCase()} ${emp.first_name || ''}`).trim()];

        weekDatesArr.forEach(date => {
            const s = planningRow?.shifts[date];
            if (!s?.segments?.length) { rowData.push(''); return; }
            
            const text = String(s.segments.map(seg => seg.type === 'horaire' ? `${seg.start}-${seg.end}` : seg.label).join('\n') || '');
            const seg = s.segments[0];
            let styles: any = {};
            
            if (seg.type === 'code' || (seg.type === 'horaire' && seg.label)) {
                const label = seg.label || '';
                const style = ABSENCE_COLORS[label] || ABSENCE_COLORS['DEFAULT_ABSENCE'];
                styles = { fillColor: style.bg, textColor: style.text };
                
                // If it's a dynamic absence color from settings, we'd need to fetch it, 
                // but for now we follow the user's specific request for contrast.
            } else if (seg.type === 'horaire') {
                const color = seg.colorOverride || seg.color;
                if (color) { 
                    const bg = hexToRgb(color);
                    // Dynamic contrast for PDF
                    const luminance = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255;
                    const textColor = luminance > 0.65 ? [0, 0, 0] : [255, 255, 255];
                    styles = { fillColor: bg, textColor: textColor }; 
                }
            }
            
            if (Object.keys(styles).length) rowData.push({ content: text, styles });
            else rowData.push(text);
        });
        bodyData.push(rowData);
    });

    // KPI ROW
    const kpiRow = ['TOTAL STAFF'];
    weekDatesArr.forEach(date => {
        let midi = 0, soir = 0;
        planning.rows.forEach(r => {
            const s = r.shifts[date];
            s?.segments?.forEach(seg => {
                if (seg.type === 'horaire' && seg.start && seg.end) {
                    if (seg.start < "16:00") midi++;
                    if (seg.end >= "16:00" || seg.end < seg.start) soir++;
                }
            });
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

    return doc;
};
