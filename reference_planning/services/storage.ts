
import { Employee, Planning, Template, STANDARD_ROLES, ShiftServiceType, ShiftSegment, ShiftType, LongAbsence } from '../types';
import { addDays, format, parseISO, startOfWeek, endOfWeek, isBefore, startOfDay, getDay } from 'date-fns';
import * as api from './api';

// --- ROLES ---

const ROLE_ORDER_SETTING_KEY = 'roles_display_order';

const sortRolesByDisplayOrder = (
  roles: { id: string; label: string }[],
  displayOrder: string[]
) => {
  const rank = new Map(displayOrder.map((id, index) => [id, index]));
  return [...roles].sort((a, b) => {
    const aRank = rank.get(a.id);
    const bRank = rank.get(b.id);

    if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
    if (aRank !== undefined) return -1;
    if (bRank !== undefined) return 1;
    return a.label.localeCompare(b.label, 'fr');
  });
};

export const getRoleDisplayOrder = async (): Promise<string[]> => {
  try {
    const value = await api.getSetting(ROLE_ORDER_SETTING_KEY);
    return Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

export const saveRoleDisplayOrder = async (orderedRoleIds: string[]) => {
  await api.setSetting(ROLE_ORDER_SETTING_KEY, orderedRoleIds);
};

export const getRoles = async () => {
  let roles = await api.listRoles();
  const rolesMap = new Map(roles.map(r => [r.id, r]));

  // Get blacklist to prevent resurrection of deleted roles
  const blacklist = await getDeletedRolesBlacklist();
  const blacklistSet = new Set(blacklist);

  // Ensure all STANDARD_ROLES exist (UNLESS blacklisted)
  // REMOVED: Backend 'bootstrap' handles this. Client should not override/reset permissions.
  // for (const roleId of STANDARD_ROLES) { ... }

  // Collect all roles actually used by employees and templates
  const usedRoles = new Set<string>();

  try {
    const employees = await api.listEmployees();
    if (Array.isArray(employees)) {
      for (const emp of employees) {
        if (emp.role) {
          usedRoles.add(emp.role);
          // Only restore if NOT blacklisted
          if (!rolesMap.has(emp.role) && !blacklistSet.has(emp.role)) {
            const newRole = { id: emp.role, label: emp.role };
            await api.saveRole(newRole);
            rolesMap.set(emp.role, newRole);
          }
        }
      }
    }

    const templates = await api.listTemplates();
    if (Array.isArray(templates)) {
      for (const tpl of templates) {
        if (tpl.role && tpl.role !== 'GÉNÉRAL') {
          usedRoles.add(tpl.role);
          // Only restore if NOT blacklisted
          if (!rolesMap.has(tpl.role) && !blacklistSet.has(tpl.role)) {
            const newRole = { id: tpl.role, label: tpl.role };
            await api.saveRole(newRole);
            rolesMap.set(tpl.role, newRole);
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to sync roles from employees/templates:', err);
  }

  // Filter return values one last time to be safe
  // Filter return values:
  // 1. Keep if it exists in the active DB list (roles)
  // 2. Otherwise (restored), keep only if NOT blacklisted
  const filtered = Array.from(rolesMap.values()).filter(r => {
    // Active in DB? Keep it.
    if (roles.some(dbR => dbR.id === r.id)) return true;
    // Restored? Check blacklist.
    return !blacklistSet.has(r.id);
  });

  const displayOrder = await getRoleDisplayOrder();
  return sortRolesByDisplayOrder(filtered, displayOrder);
};

export const saveRoles = async (roles: { id: string, label: string }[]) => {
  // The current UI might send the whole list, but our API is likely item-based or we need to adapt.
  // If the UI expects to save the whole list, we should probably check what changed.
  // However, looking at the previous implementation, it just overwrote the key.
  // Since we don't have a bulk save endpoint in the visible API, we might need to iterate.
  // BUT, `saveRole` in api.ts saves a single role.
  // If the usage of `saveRoles` is just to update the list, we might need to be careful.
  // Let's assume for now we iterate and save each.
  // Optimization: In a real app we'd want a bulk endpoint.
  for (const role of roles) {
    await api.saveRole(role);
  }
};

export const addRole = async (label: string) => {
  const roles = await getRoles();
  const roleId = label.trim();  // Use label as ID directly - no transformation
  if (roles.find((r: any) => r.id === roleId)) return;

  await api.saveRole({ id: roleId, label });

  // Remove from blacklist in case it was previously deleted
  await removeRoleFromBlacklist(roleId);

  // Keep display order in sync (new role goes at the end)
  const currentOrder = await getRoleDisplayOrder();
  if (!currentOrder.includes(roleId)) {
    await saveRoleDisplayOrder([...currentOrder, roleId]);
  }

  // Cascade Update: Update any employees using this role (in case they were using it before it was officially added)
  const employees = await getEmployees();
  const employeeUpdates = employees
    .filter(e => e.role === roleId)
    .map(e => api.saveEmployee({ ...e, role: roleId }));
  if (employeeUpdates.length > 0) {
    await Promise.all(employeeUpdates);
  }

  // Cascade Update: Update any templates using this role
  const templates = await getTemplates();
  const templateUpdates = templates
    .filter(t => t.role === roleId)
    .map(t => api.saveTemplate({ ...t, role: roleId }));
  if (templateUpdates.length > 0) {
    await Promise.all(templateUpdates);
  }

  // Note: No need to update plannings for new roles since they wouldn't exist yet
  // Plannings will use the new role when employees are assigned to it
};

// Blacklist management for deleted roles
const BLACKLIST_KEY = 'deleted_roles_blacklist';

async function getDeletedRolesBlacklist(): Promise<string[]> {
  try {
    const value = await api.getSetting(BLACKLIST_KEY);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function addRoleToBlacklist(roleId: string): Promise<void> {
  const blacklist = await getDeletedRolesBlacklist();
  if (!blacklist.includes(roleId)) {
    blacklist.push(roleId);
    await api.setSetting(BLACKLIST_KEY, blacklist);
  }
}

async function removeRoleFromBlacklist(roleId: string): Promise<void> {
  const blacklist = await getDeletedRolesBlacklist();
  const updated = blacklist.filter(id => id !== roleId);
  if (updated.length !== blacklist.length) {
    await api.setSetting(BLACKLIST_KEY, updated);
  }
}

export const updateRole = async (id: string, newLabel: string) => {
  // Direct Upsert/Update: Bypass getRole check to ensure robustness
  await api.saveRole({ id, label: newLabel });
};

export const saveRole = async (role: { id: string, label: string }) => {
  return await api.saveRole(role);
};

export const deleteRole = async (id: string, reassignRoleId?: string) => {
  await api.deleteRole(id);

  // Keep display order in sync when a role is removed
  const currentOrder = await getRoleDisplayOrder();
  if (currentOrder.includes(id)) {
    await saveRoleDisplayOrder(currentOrder.filter(roleId => roleId !== id));
  }

  // Add to blacklist so it doesn't reappear via auto-discovery
  await addRoleToBlacklist(id);

  // Delete all templates for this role (parallel) - with normalized matching
  const templates = await getTemplates();
  const normalizedId = id.toLowerCase().trim();
  const templatesForRole = templates.filter(t => t.role === id || t.role.toLowerCase().trim() === normalizedId);
  if (templatesForRole.length > 0) {
    await Promise.all(templatesForRole.map(t => api.deleteTemplate(t.id)));
  }

  if (reassignRoleId) {
    // Reassign Employees (parallel) - with normalized matching
    const employees = await getEmployees();
    const employeesToReassign = employees.filter(e => e.role === id || e.role.toLowerCase().trim() === normalizedId);
    if (employeesToReassign.length > 0) {
      await Promise.all(employeesToReassign.map(e => api.saveEmployee({ ...e, role: reassignRoleId })));
    }

    // Update active plannings to reflect the role change immediately
    const plannings = await getPlannings();
    const updates = plannings.map(async (p) => {
      // Skip archived to save time/bandwidth
      if (p.status === 'archived') return;

      let changed = false;
      const newRows = p.rows.map(row => {
        if (row.employeeRole === id || row.employeeRole.toLowerCase().trim() === normalizedId) {
          changed = true;
          return { ...row, employeeRole: reassignRoleId };
        }
        return row;
      });

      if (changed) {
        await api.savePlanning({ ...p, rows: newRows });
      }
    });
    await Promise.all(updates);
  } else {
    // Even if we think it's unused, force a cleanup to prevent resurrection
    // This handles cases where case-sensitivity or whitespace might have hidden the usage
    const employees = await getEmployees();
    const stragglers = employees.filter(e => e.role === id || e.role.toLowerCase().trim() === normalizedId);

    if (stragglers.length > 0) {
      // Reassign stragglers to "AUCUN" or empty to indicate no role
      const fallbackRole = "";
      await Promise.all(stragglers.map(e => api.saveEmployee({ ...e, role: fallbackRole })));
    }

    // Determine planning rows to clean up
    const plannings = await getPlannings();
    const cleanupUpdates = plannings.map(async (p) => {
      if (p.status === 'archived') return;
      if (!p.rows || !Array.isArray(p.rows)) return;

      let changed = false;
      // HARD DELETE: Filter out rows belonging to the deleted role
      const newRows = p.rows.filter(row => {
        const match = row.employeeRole === id || row.employeeRole.toLowerCase().trim() === normalizedId;
        if (match) {
          changed = true;
          return false; // Remove!
        }
        return true;
      });

      if (changed) {
        await api.savePlanning({ ...p, rows: newRows });
      }
    });

    // Cleanup Templates preventing resurrection
    const templates = await getTemplates();
    const templatesToDelete = templates.filter(t => t.role === id || t.role.toLowerCase().trim() === normalizedId);
    if (templatesToDelete.length > 0) {
      await Promise.all(templatesToDelete.map(t => api.deleteTemplate(t.id)));
    }

    if (cleanupUpdates.length > 0) {
      await Promise.all(cleanupUpdates);
    }

    // ACTUALLY DELETE: Remove from DB and blacklist to prevent auto-discovery resurrection
    await api.deleteRole(id);
    await addRoleToBlacklist(id);
  }
};

// --- EMPLOYEES ---

// --- EMPLOYEES ---

export const getEmployees = async (): Promise<Employee[]> => {
  const employees = await api.listEmployees();
  if (!Array.isArray(employees)) return [];

  // Sanitization on read
  return employees.map(e => {
    if (e.role === "ENCADREMENT /" || e.role.trim() === "ENCADREMENT /") {
      return { ...e, role: "ENCADREMENT" };
    }
    return e;
  });
};

export const saveEmployees = async (employees: Employee[]) => {
  // Sanitization on write
  for (const emp of employees) {
    const sanitized = { ...emp };
    if (sanitized.role === "ENCADREMENT /" || sanitized.role.trim() === "ENCADREMENT /") {
      sanitized.role = "ENCADREMENT";
    }
    await api.saveEmployee(sanitized);
  }
};

export const deleteEmployee = async (id: string) => {
  // Get employee being deleted to find their name
  const employeeToDelete = await api.getEmployee(id);
  if (!employeeToDelete) return;

  // Get all employees to find similar names (case-insensitive, ignoring spaces and special chars)
  const allEmployees = await getEmployees();
  const normalizeName = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');

  const duplicateIds = allEmployees
    .filter(e => normalizeName(e.name) === normalizeName(employeeToDelete.name))
    .map(e => e.id);

  // Delete ALL employees with similar names
  for (const empId of duplicateIds) {
    await api.deleteEmployee(empId);
  }

  // Cascade: Remove ALL employees with this name pattern from ALL plannings
  const plannings = await getPlannings();
  const planningUpdates = [];

  for (const p of plannings) {
    const originalRowCount = p.rows.length;
    const newRows = p.rows.filter(row =>
      !duplicateIds.includes(row.employeeId) &&
      normalizeName(row.employeeName) !== normalizeName(employeeToDelete.name)
    );

    // Only update if rows were actually removed
    if (newRows.length < originalRowCount) {
      planningUpdates.push(api.savePlanning({ ...p, rows: newRows }));
    }
  }

  if (planningUpdates.length > 0) {
    await Promise.all(planningUpdates);
  }
};

export const updateEmployeeDetails = async (id: string, name: string, role: string) => {
  // 1. Update Global Employee List
  const employee = await api.getEmployee(id);
  if (employee) {
    await api.saveEmployee({ ...employee, name, role });
  }

  // 2. Cascade Update to ALL Plannings (Rows)
  const plannings = await getPlannings();
  for (const p of plannings) {
    const rowIdx = p.rows.findIndex(r => r.employeeId === id);
    if (rowIdx !== -1) {
      const updatedRows = [...p.rows];
      updatedRows[rowIdx] = {
        ...updatedRows[rowIdx],
        employeeName: name,
        employeeRole: role
      };
      await api.savePlanning({ ...p, rows: updatedRows });
    }
  }
};

// --- WEEKLY DEFAULTS PROPAGATION ---
export const updateEmployeeWeeklyDefault = async (empId: string, dayIndex: string, tplId: string) => {
  // 1. Update Employee config
  const employee = await api.getEmployee(empId);
  if (!employee) return;

  const newDefaults = { ...(employee.weeklyDefault || {}) };
  if (tplId === 'repos' || !tplId) {
    newDefaults[dayIndex] = 'repos';
  } else {
    newDefaults[dayIndex] = tplId;
  }

  await api.saveEmployee({ ...employee, weeklyDefault: newDefaults });

  // 2. Propagate to Plannings
  const plannings = await getPlannings();
  const templates = await getTemplates();

  for (const p of plannings) {
    // Only update active plannings
    if (p.status !== 'active') continue;

    const rowIdx = p.rows.findIndex(r => r.employeeId === empId);
    if (rowIdx === -1) continue;

    const row = p.rows[rowIdx];
    const newShifts = { ...row.shifts };
    const start = parseISO(p.weekStart);

    const targetDate = addDays(start, parseInt(dayIndex));
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');

    const existingShift = newShifts[targetDateStr];
    const hasManualOverride = existingShift?.segments?.some(s => s.hasOverride);

    if (!hasManualOverride) {
      // Apply new default
      let newSegments: ShiftSegment[] = [];
      let serviceType: ShiftServiceType = 'none';
      let type: ShiftType = 'repos';

      if (tplId && tplId !== 'repos') {
        const tpl = templates.find(t => t.id === tplId);
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
        type = 'repos';
        newSegments = [{ type: 'code', label: 'REPOS' }];
      }

      newShifts[targetDateStr] = {
        date: targetDateStr,
        type,
        serviceType,
        segments: newSegments
      };

      const updatedRows = [...p.rows];
      updatedRows[rowIdx] = { ...row, shifts: newShifts };
      await api.savePlanning({ ...p, rows: updatedRows });
    }
  }
};

// --- TEMPLATES ---
export const getTemplates = async (): Promise<Template[]> => {
  return await api.listTemplates();
};

export const addTemplate = async (template: Template) => {
  return await api.saveTemplate(template);
};

export const saveTemplates = async (templates: Template[]) => {
  for (const t of templates) {
    await api.saveTemplate(t);
  }
};

export const updateTemplate = async (updated: Template) => {
  await api.saveTemplate(updated);

  // Cascade: Update segments in plannings (parallel)
  const plannings = await getPlannings();
  const planningUpdates = [];

  plannings.forEach(p => {
    let rowChanged = false;
    const newRows = p.rows.map(row => {
      let shiftChanged = false;
      const newShifts = { ...row.shifts };

      Object.keys(newShifts).forEach(date => {
        const shift = newShifts[date];
        if (shift.segments) {
          const newSegments: ShiftSegment[] = [];
          let segChanged = false;

          shift.segments.forEach(seg => {
            if (seg.templateId === updated.id && !seg.hasOverride) {
              // Update color for segments using this template (if no manual override)
              newSegments.push({
                ...seg,
                color: updated.color
              });
              segChanged = true;
            } else {
              newSegments.push(seg);
            }
          });

          if (segChanged) {
            newShifts[date] = {
              ...shift,
              segments: newSegments
            };
            shiftChanged = true;
          }
        }
      });

      if (shiftChanged) {
        rowChanged = true;
        return { ...row, shifts: newShifts };
      }
      return row;
    });

    if (rowChanged) {
      planningUpdates.push(api.savePlanning({ ...p, rows: newRows }));
    }
  });

  if (planningUpdates.length > 0) {
    await Promise.all(planningUpdates);
  }
};

export const deleteTemplate = async (id: string, reassignTplId?: string) => {
  await api.deleteTemplate(id);

  const employees = await getEmployees();
  const employeeUpdates = [];

  employees.forEach(emp => {
    if (!emp.weeklyDefault) return;
    const newDef = { ...emp.weeklyDefault };
    let modified = false;

    Object.keys(newDef).forEach(day => {
      if (newDef[day] === id) {
        if (reassignTplId && reassignTplId !== 'repos') {
          newDef[day] = reassignTplId;
        } else {
          delete newDef[day];
        }
        modified = true;
      }
    });

    if (modified) {
      employeeUpdates.push(api.saveEmployee({ ...emp, weeklyDefault: newDef }));
    }
  });

  if (employeeUpdates.length > 0) {
    await Promise.all(employeeUpdates);
  }
};

// --- LONG ABSENCES ---

export const getLongAbsences = async (): Promise<LongAbsence[]> => {
  return await api.listLongAbsences();
};

export const saveLongAbsences = async (absences: LongAbsence[]) => {
  for (const a of absences) {
    await api.saveLongAbsence(a);
  }
};

export const addLongAbsence = async (absence: Omit<LongAbsence, 'id'>) => {
  const newAbsence = { ...absence, id: crypto.randomUUID() };
  await api.saveLongAbsence(newAbsence);

  // Propagate to plannings (Apply Absence)
  await applyAbsenceRangeToPlannings(newAbsence);
};

export const deleteLongAbsence = async (id: string) => {
  const absence = await api.getLongAbsence(id);
  if (!absence) return;

  await api.deleteLongAbsence(id);

  // Propagate revert (Apply Default/Repos)
  await revertAbsenceRangeInPlannings(absence);
};

// Apply absence code to all affected days in all plannings
const applyAbsenceRangeToPlannings = async (absence: LongAbsence) => {
  const plannings = await getPlannings();

  for (const p of plannings) {
    // Skip archived if preferred, but usually we want consistency
    if (p.status === 'archived') continue;

    const rowIdx = p.rows.findIndex(r => r.employeeId === absence.employeeId);
    if (rowIdx === -1) continue;

    let rowChanged = false;
    const row = p.rows[rowIdx];
    const newShifts = { ...row.shifts };

    // Check if this week overlaps with absence
    if (absence.endDate < p.weekStart || absence.startDate > p.weekEnd) continue;

    // Iterate days of week
    for (let i = 0; i < 7; i++) {
      const current = addDays(parseISO(p.weekStart), i);
      const currentStr = format(current, 'yyyy-MM-dd');

      if (currentStr >= absence.startDate && currentStr <= absence.endDate) {
        // Apply Absence
        newShifts[currentStr] = {
          date: currentStr,
          type: 'absence',
          serviceType: 'none',
          segments: [{ type: 'code', label: absence.type }]
        };
        rowChanged = true;
      }
    }

    if (rowChanged) {
      const updatedRows = [...p.rows];
      updatedRows[rowIdx] = { ...row, shifts: newShifts };
      await api.savePlanning({ ...p, rows: updatedRows });
    }
  }
};

// Revert absence: check weekly default for that day and apply it
const revertAbsenceRangeInPlannings = async (absence: LongAbsence) => {
  const plannings = await getPlannings();
  const employee = await api.getEmployee(absence.employeeId);
  const templates = await getTemplates();

  for (const p of plannings) {
    if (p.status === 'archived') continue;
    const rowIdx = p.rows.findIndex(r => r.employeeId === absence.employeeId);
    if (rowIdx === -1) continue;

    let rowChanged = false;
    const row = p.rows[rowIdx];
    const newShifts = { ...row.shifts };

    if (absence.endDate < p.weekStart || absence.startDate > p.weekEnd) continue;

    for (let i = 0; i < 7; i++) {
      const current = addDays(parseISO(p.weekStart), i);
      const currentStr = format(current, 'yyyy-MM-dd');

      if (currentStr >= absence.startDate && currentStr <= absence.endDate) {
        // Determine what to put back (Weekly Default)
        const dayOfWeek = getDay(current);
        const dayIndex = (dayOfWeek + 6) % 7;

        const defaultTplId = employee?.weeklyDefault?.[dayIndex.toString()];

        let newSegments: ShiftSegment[] = [];
        let type: ShiftType = 'repos';
        let serviceType: ShiftServiceType = 'none';

        if (defaultTplId && defaultTplId !== 'repos') {
          const tpl = templates.find(t => t.id === defaultTplId);
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

        newShifts[currentStr] = {
          date: currentStr,
          type,
          serviceType,
          segments: newSegments
        };
        rowChanged = true;
      }
    }

    if (rowChanged) {
      const updatedRows = [...p.rows];
      updatedRows[rowIdx] = { ...row, shifts: newShifts };
      await api.savePlanning({ ...p, rows: updatedRows });
    }
  }
};

// --- PLANNINGS ---

export const getPlannings = async (): Promise<Planning[]> => {
  let plannings = await api.listPlannings();

  // Filter out invalid plannings
  plannings = plannings.filter(p => p.weekStart && p.weekEnd && p.id);



  const today = startOfDay(new Date());
  let changed = false;

  // Archive old plannings
  for (const p of plannings) {
    if (!p.weekEnd) {
      console.warn('Planning missing weekEnd:', p);
      continue;
    }
    const weekEnd = parseISO(p.weekEnd);
    if (p.status === 'active' && isBefore(weekEnd, today)) {
      // Note: We are saving the potentially healed version here too, which is good
      await api.savePlanning({ ...p, status: 'archived' });
      changed = true;
    }
  }

  if (changed) {
    plannings = await api.listPlannings();
  }

  return plannings;
};

export const savePlannings = async (plannings: Planning[]) => {
  for (const p of plannings) {
    await api.savePlanning(p);
  }
};

export const createPlanning = async (inputDate: Date, service: 'Salle' | 'Cuisine'): Promise<Planning> => {
  const weekStart = startOfWeek(inputDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const employees = (await getEmployees()).filter(e => e.isActive);
  const templates = await getTemplates();
  const longAbsences = await getLongAbsences();

  const newPlanning: Planning = {
    id: crypto.randomUUID(),
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    service,
    status: 'active',
    createdAt: Date.now(),
    rows: employees.map(emp => {
      const shifts: Record<string, any> = {};

      for (let i = 0; i < 7; i++) {
        const dateObj = addDays(weekStart, i);
        const dateStr = format(dateObj, 'yyyy-MM-dd');

        // 1. Check Long Absence First
        const absence = longAbsences.find(a => a.employeeId === emp.id && dateStr >= a.startDate && dateStr <= a.endDate);

        if (absence) {
          shifts[dateStr] = {
            date: dateStr,
            type: 'absence',
            serviceType: 'none',
            segments: [{ type: 'code', label: absence.type }]
          };
          continue;
        }

        // 2. Weekly Default
        const defaultTplId = emp.weeklyDefault?.[i.toString()];
        const tpl = defaultTplId ? templates.find(t => t.id === defaultTplId) : null;

        const segments: ShiftSegment[] = [];
        let shiftType = 'repos';
        let shiftServiceType = 'none';

        if (tpl) {
          shiftType = 'travail';
          const firstStart = tpl.slots[0]?.start;
          const lastEnd = tpl.slots[tpl.slots.length - 1]?.end;
          if (firstStart) {
            if (firstStart < "12:00") {
              shiftServiceType = lastEnd && lastEnd > "18:00" ? 'midi+soir' : 'midi';
            } else if (firstStart >= "16:00") {
              shiftServiceType = 'soir';
            } else {
              shiftServiceType = lastEnd && lastEnd > "18:00" ? 'soir' : 'midi';
            }
          }
          tpl.slots.forEach(slot => {
            segments.push({
              type: 'horaire',
              start: slot.start,
              end: slot.end,
              templateId: tpl.id,
              color: tpl.color,
              hasOverride: false
            });
          });
        } else if (defaultTplId === 'repos') {
          shiftType = 'repos';
          segments.push({ type: 'code', label: 'REPOS' });
        } else {
          shiftType = 'repos';
          segments.push({ type: 'code', label: 'REPOS' });
        }

        shifts[dateStr] = {
          date: dateStr,
          type: shiftType,
          serviceType: shiftServiceType,
          segments: segments
        };
      }

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        isExtra: false,
        shifts
      };
    }),
    extraShifts: []
  };

  await api.savePlanning(newPlanning);
  return newPlanning;
};

export const updatePlanning = async (updated: Planning) => {
  await api.savePlanning(updated);
};

export const deletePlanning = async (id: string) => {
  await api.deletePlanning(id);
};

export const migrateLocalStorageToD1 = async () => {
  // No-op for now
  console.log('Migration skipped');
};

// --- THEME ---
const THEME_KEY = 'app_theme_color';
export const getTheme = async (): Promise<string> => {
  try {
    const val = await api.getSetting(THEME_KEY);
    return (typeof val === 'string' && val) ? val : '#4AA3A2'; // Default teal-ish
  } catch {
    return '#4AA3A2';
  }
};

export const saveTheme = async (color: string) => {
  await api.setSetting(THEME_KEY, color);
};

export const initMockData = async () => {
  try {
    const roles = await getRoles();
    // If roles exist, assume data is initialized
    if (roles.length > 0) return;

    // Initialize default roles
    const defaultRoles = STANDARD_ROLES.map(r => ({ id: r, label: r }));
    for (const r of defaultRoles) {
      await api.saveRole(r);
    }

    let existingEmps = await getEmployees();
    if (existingEmps.length === 0) {
      const rawData = [
        { role: 'DIRECTION', name: 'LOUISET FRANCOIS' },
        { role: 'DIRECTION', name: 'SENG PHILIPPE' },
        { role: 'DIRECTION', name: 'MINGUI REGIS' },
        { role: 'DIRECTION', name: 'LEBIHAN MATTHEU' },
        { role: 'DIRECTION', name: 'MANGANE LUCAS' },
        { role: 'COMMERCIAL', name: 'GLOUX JULIETTE' },
        { role: 'COMMERCIAL', name: 'MINIAOUI MAELLE' },
        { role: 'COMMERCIAL', name: 'MBOCK HANG JULIENNE' },

        { role: 'ACCUEIL', name: 'HESLOT EMENI' },
        { role: 'ACCUEIL', name: 'DRIDI SARAH' },
        { role: 'ACCUEIL', name: 'KROTN SHEILHANE' },
        { role: 'MANAGER', name: 'GUILLOTTE NICOLAS' },
        { role: 'BARMAN', name: 'BARUA JEWEL' },
        { role: 'BARMAN', name: 'BARUA SWAJAN' },
        { role: 'BARMAN', name: 'DAS SRI POLAS' },
        { role: 'BARMAN', name: 'MANGEON MATHEO' },
        { role: 'CHEF DE RANG', name: 'POLLET SAMANTHA' },
        { role: 'CHEF DE RANG', name: 'MAGASSA MODY' },
        { role: 'CHEF DE RANG', name: 'BARUA SAGAR' },
        { role: 'CHEF DE RANG', name: 'BARUA SHUVA' },
        { role: 'CHEF DE RANG', name: 'KONATE IBRAHIMA' },
        { role: 'CHEF DE RANG', name: 'NDRI ABRAHAM' },
        { role: 'CHEF DE RANG', name: 'TAJUDDIN HASIM' },
        { role: 'CHEF DE RANG', name: 'LIN CHLOE' },
        { role: 'CHEF DE RANG', name: 'LAMINE MOHAMED' },
        { role: 'CHEF DE RANG', name: 'PENIN MAGALI' },
        { role: 'APPRENTI', name: 'SAADA RANDY' },
        { role: 'RUNNER', name: 'BARUA ROPAN RONY' },
        { role: 'RUNNER', name: 'SACKO DJABE' },
        { role: 'RUNNER', name: 'BARUA SAJU' },
        { role: 'RUNNER', name: 'BARUA BADAN' },
        { role: 'RUNNER', name: 'BARUA HRIDAY' },
        { role: 'RUNNER', name: 'KANTE DAOUBA' },
        { role: 'RUNNER', name: 'BARUA EMON (2)' },
        { role: 'RUNNER', name: 'BARUA EMON (1)' },
        { role: 'RUNNER', name: 'LE PICARD GAEL' },
        { role: 'RUNNER', name: 'DIDIORTAS YAROSLAV' },
        { role: 'PLAGE', name: 'IHOR IHNATENKO' },
      ];

      const newEmps = rawData.map((d, i) => ({
        id: `emp_${i + 1}`,
        name: d.name,
        role: d.role,
        isActive: true,
        weeklyDefault: {}
      }));

      for (const e of newEmps) {
        await api.saveEmployee(e);
      }
      existingEmps = newEmps;
    }

    // 2. Init Templates
    let templates: Template[] = [];
    const add = (role: string, name: string, serviceType: ShiftServiceType, slots: { start: string, end: string }[], color: string) => {
      const id = `${role}-${name}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      templates.push({ id, name, role, serviceType, slots, color });
    };

    const C_MIDI = '#fed7aa';
    const C_SOIR = '#c7d2fe';
    const C_COUPURE = '#bae6fd';
    const C_OUV = '#bbf7d0';
    const C_FERM = '#fbcfe8';
    const C_DIR = '#ddd6fe';
    const C_PLAGE = '#fde68a';

    add('ACCUEIL', 'Coupure', 'midi+soir', [{ start: '10:00', end: '15:00' }, { start: '18:30', end: '23:00' }], C_COUPURE);
    add('ACCUEIL', 'Midi', 'midi', [{ start: '10:00', end: '18:00' }], C_MIDI);
    add('ACCUEIL', 'Soir', 'soir', [{ start: '16:30', end: '23:00' }], C_SOIR);

    add('BARMAN', 'Fermeture', 'soir', [{ start: '17:00', end: '23:30' }], C_FERM);
    add('BARMAN', 'Midi', 'midi', [{ start: '10:00', end: '11:00' }, { start: '11:45', end: '16:30' }], C_MIDI);
    add('BARMAN', 'Ouverture-coupure', 'midi+soir', [{ start: '09:00', end: '14:30' }, { start: '18:00', end: '23:30' }], C_OUV);

    add('CHEF DE RANG', 'Coupure', 'midi+soir', [{ start: '11:45', end: '15:00' }, { start: '19:00', end: '00:00' }], C_COUPURE);
    add('CHEF DE RANG', 'Fermeture', 'soir', [{ start: '17:00', end: '00:00' }], C_FERM);
    add('CHEF DE RANG', 'Midi', 'midi', [{ start: '11:45', end: '18:00' }], C_MIDI);
    add('CHEF DE RANG', 'Ouverture', 'midi', [{ start: '09:00', end: '17:00' }], C_OUV);

    ['DIRECTION', 'MANAGER'].forEach(role => {
      add(role, 'Direction', 'midi', [{ start: '10:00', end: '19:00' }], C_DIR);
      add(role, 'Fermeture', 'soir', [{ start: '16:30', end: '01:00' }], C_FERM);
      add(role, 'Midi', 'midi+soir', [{ start: '11:45', end: '22:00' }], C_MIDI);
      add(role, 'Ouverture', 'midi', [{ start: '09:00', end: '17:00' }], C_OUV);
    });

    const PLAGE_ROLE = 'PLAGE';
    add(PLAGE_ROLE, '11h-21h30', 'midi+soir', [{ start: '11:00', end: '21:30' }], C_PLAGE);
    add(PLAGE_ROLE, '11h-23h30', 'midi+soir', [{ start: '11:00', end: '23:30' }], C_PLAGE);
    add(PLAGE_ROLE, '16h-00h30', 'soir', [{ start: '16:00', end: '00:30' }], C_SOIR);
    add(PLAGE_ROLE, '16h-23h30', 'soir', [{ start: '16:00', end: '23:30' }], C_SOIR);
    add(PLAGE_ROLE, '17h-00h', 'soir', [{ start: '17:00', end: '00:00' }], C_SOIR);

    add('RUNNER', 'Coupure', 'midi+soir', [{ start: '11:45', end: '15:00' }, { start: '19:00', end: '00:00' }], C_COUPURE);
    add('RUNNER', 'Fermeture', 'soir', [{ start: '17:00', end: '00:00' }], C_FERM);
    add('RUNNER', 'Ouverture', 'midi', [{ start: '09:00', end: '17:00' }], C_OUV);

    for (const t of templates) {
      await api.saveTemplate(t);
    }

    const defaultMap: Record<string, (string | null)[]> = {
      "KROTN SHEILHANE": ["REPOS", "REPOS", "Coupure", "Coupure", "Midi", "Soir", "Soir"],
      "HESLOT EMENI": ["Coupure", "Coupure", "REPOS", "REPOS", "Soir", "Midi", "Midi"],
      "DRIDI SARAH": [null, null, null, null, null, null, null],
      "MAGASSA MODY": ["REPOS", "Coupure", "Ouverture", "Ouverture", "Fermeture", "Fermeture", "REPOS"],
      "BARUA SHUVA": ["REPOS", "REPOS", "Coupure", "Ouverture", "Fermeture", "Coupure", "Midi"],
      "POLLET SAMANTHA": [null, null, null, null, null, null, null],
      "NDRI ABRAHAM": ["Coupure", "REPOS", "REPOS", "Ouverture", "Coupure", "Fermeture", "Fermeture"],
      "TAJUDDIN HASIM": [null, null, "REPOS", "REPOS", "Coupure", "Coupure", "Coupure"],
      "LIN CHLOE": ["Ouverture", "Fermeture", "REPOS", "REPOS", null, "Ouverture", "Midi"],
      "LAMINE MOHAMED": ["Coupure", "Coupure", "Coupure", "REPOS", "REPOS", "Ouverture", "Ouverture"],
      "KONATE IBRAHIMA": ["Fermeture", "REPOS", "REPOS", "Ouverture", "Coupure", "Coupure", "Midi"],
      "PENIN MAGALI": ["Ouverture", "Ouverture", "Coupure", "Ouverture", "Ouverture", "REPOS", "REPOS"],
      "BARUA SAGAR": ["REPOS", "REPOS", "Coupure", "Coupure", "Fermeture", "Coupure", "Fermeture"],
      "LOUISET FRANCOIS": ["REPOS", "Direction", "Direction", "Direction", "Direction", "Direction", "REPOS"],
      "SENG PHILIPPE": ["Ouverture", "REPOS", "REPOS", "Fermeture", "Fermeture", "Fermeture", "Midi"],
      "MINGUI REGIS": ["Fermeture", "Fermeture", "Fermeture", "REPOS", "REPOS", "Ouverture", "Ouverture"],
      "LEBIHAN MATTHEU": ["REPOS", "Ouverture", "Ouverture", "Ouverture", "Ouverture", "Fermeture", "REPOS"],
      "MANGANE LUCAS": ["REPOS", "REPOS", "Midi", "Fermeture", "Fermeture", "Fermeture", "Fermeture"],
    };

    const updatedEmployees = existingEmps.map(emp => {
      const configKey = Object.keys(defaultMap).find(k =>
        emp.name.toUpperCase().includes(k.toUpperCase()) || k.toUpperCase().includes(emp.name.toUpperCase())
      );

      if (configKey) {
        const defaults = defaultMap[configKey];
        const newWeeklyDefault: Record<string, string> = { ...(emp.weeklyDefault || {}) };
        let hasChanges = false;

        defaults.forEach((val, dayIndex) => {
          if (val === null) return;
          const key = dayIndex.toString();

          if (val === 'REPOS') {
            newWeeklyDefault[key] = 'repos';
            hasChanges = true;
          } else {
            const tpl = templates.find(t => t.name.toLowerCase() === val.toLowerCase() &&
              (t.role === emp.role || emp.role.includes(t.role) || t.role.includes(emp.role) || t.role === 'PLAGE')); // Loose matching

            if (tpl) {
              newWeeklyDefault[key] = tpl.id;
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          return { ...emp, weeklyDefault: newWeeklyDefault };
        }
      }
      return emp;
    });

    for (const emp of updatedEmployees) {
      await api.saveEmployee(emp);
    }

  } catch (error) {
    console.error('Error initializing mock data:', error);
  }
};
