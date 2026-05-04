// file: src/services/excelService.ts
import * as XLSX from 'xlsx';
import { Planning, PlanningRow, Template } from '../types';
import { format, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ExcelOptions {
  roles: string[];
  roleLabels?: Record<string, string>;
}

// Même ordre de rôles que pour le PDF
const ROLE_ORDER = [
  'ENCADREMENT',
  'COMMERCIALE + ADMIN',
  'MANAGERS',
  'APPRENTI',
  'CHEF DE RANG',
  'ACCUEIL',
  'RUNNER',
  'PLAGE / RUNNER',
  'BARMAN',
];

const getRoleOrderIndex = (roleId: string): number => {
  const idx = ROLE_ORDER.indexOf(roleId);
  return idx === -1 ? ROLE_ORDER.length + 1 : idx;
};

const getRoleLabel = (roleId: string, map?: Record<string, string>) =>
  map && map[roleId] ? map[roleId] : roleId;

const getMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

export const exportPlanningToExcel = (
  planning: Planning,
  templates: Template[],
  options: ExcelOptions
) => {
  const wb = XLSX.utils.book_new();
  const wsName = 'Planning semaine';

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(planning.weekStart), i), 'yyyy-MM-dd')
  );

  const rows: any[][] = [];

  // Titre
  rows.push([
    `Planning ${planning.service}`,
    `Semaine du ${format(parseISO(planning.weekStart), 'dd/MM/yyyy', {
      locale: fr,
    })} au ${format(parseISO(planning.weekEnd), 'dd/MM/yyyy', { locale: fr })}`,
  ]);

  rows.push([]);

  // Ligne d’en-tête
  const headerRow = ['NOMS / PRÉNOMS'];
  weekDates.forEach((d, i) => {
    const dateObj = parseISO(d);
    headerRow.push(`${days[i]} ${format(dateObj, 'dd/MM', { locale: fr })}`);
  });
  rows.push(headerRow);

  // Tri des lignes (mêmes règles que PDF semaine)
  const sortedRows: PlanningRow[] = [...planning.rows]
    .filter((r) => options.roles.includes(r.employeeRole))
    .sort((a, b) => {
      const orderDiff = getRoleOrderIndex(a.employeeRole) - getRoleOrderIndex(b.employeeRole);
      if (orderDiff !== 0) return orderDiff;
      return a.employeeName.localeCompare(b.employeeName);
    });

  let currentRole = '';

  sortedRows.forEach((row) => {
    if (row.employeeRole !== currentRole) {
      currentRole = row.employeeRole;
      rows.push([getRoleLabel(currentRole, options.roleLabels).toUpperCase()]);
    }

    const line: any[] = [row.employeeName];

    weekDates.forEach((date) => {
      const s = row.shifts[date];
      if (!s || !s.segments || s.segments.length === 0) {
        line.push('');
        return;
      }

      const parts = s.segments
        .map((seg) => {
          if (seg.type === 'horaire') return `${seg.start}-${seg.end}`;
          return seg.label || '';
        })
        .filter(Boolean)
        .join(' / ');

      line.push(parts);
    });

    rows.push(line);
  });

  // Lignes SERVICE MIDI / SERVICE SOIR (avec extras)
  const SOIR_START_MIN = 16 * 60;
  const midiRow: any[] = ['SERVICE MIDI'];
  const soirRow: any[] = ['SERVICE SOIR'];

  weekDates.forEach((date) => {
    let midi = 0;
    let soir = 0;

    planning.rows.forEach((r) => {
      if (!options.roles.includes(r.employeeRole)) return;
      const s = r.shifts[date];
      if (!s?.segments) return;

      s.segments.forEach((seg) => {
        if (seg.type === 'horaire' && seg.start && seg.end) {
          const startMin = getMinutes(seg.start);
          if (startMin < SOIR_START_MIN) midi++;
          else soir++;
        }
      });
    });

    (planning.extraShifts || [])
      .filter((e) => e.date === date)
      .forEach((e) => {
        const startMin = getMinutes(e.start);
        if (startMin < SOIR_START_MIN) midi += e.count;
        else soir += e.count;
      });

    midiRow.push(midi || '');
    soirRow.push(soir || '');
  });

  rows.push([]);
  rows.push(midiRow);
  rows.push(soirRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, wsName);

  const fileName = `Planning_${planning.service}_${planning.weekStart}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
