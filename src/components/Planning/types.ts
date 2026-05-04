export type ServiceType = 'Salle' | 'Cuisine';
export type ShiftServiceType = 'midi' | 'soir' | 'midi+soir' | 'none';
export type ShiftType = 'travail' | 'repos' | 'absence';

export const ABSENCE_TYPES = [
  "Ecole", "AA", "RN", "JF", "RJF", "AT", "AM", "CM", "SUSPENDU", "RCF", "CP", "HAB/DES", "MISE A DISPO"
] as const;

export interface TimeSlot {
  start: string;
  end: string;
}

export interface Template {
  id: string;
  name: string;
  role: string;
  serviceType: ShiftServiceType;
  slots: TimeSlot[];
  color?: string; // Hex code
}

export interface ShiftSegment {
  type: 'horaire' | 'code';
  start?: string; // HH:MM
  end?: string;   // HH:MM
  label?: string; // REPOS, AA, etc.
  templateId?: string; // Link to original template for coloring
  color?: string; // Color from template (auto-synced)
  colorOverride?: string; // Custom color for this specific segment instance
  hasOverride?: boolean;
  note?: string;
}

export interface Shift {
  date: string; // YYYY-MM-DD
  type: ShiftType;
  serviceType: ShiftServiceType;
  segments: ShiftSegment[];
}

export interface PlanningRow {
  employeeId: string;
  employeeName: string;
  employeeRole: string; // job_post_title or position
  isExtra: boolean;
  shifts: Record<string, Shift>;
}

export interface ExtraShift {
  id: string;
  planningId?: string;
  label: "Hôtesse LBE" | "Brigad Plage" | "Agent de sécurité" | string;
  date: string;
  start: string;
  end: string;
  count: number;
}

export interface Planning {
  id: string;
  weekStart: string;
  weekEnd: string;
  service: ServiceType;
  status: 'active' | 'archived';
  rows: PlanningRow[];
  extraShifts: ExtraShift[];
  createdAt: number;
}
