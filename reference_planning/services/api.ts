// Robust API client with proper error handling and JSON validation

export interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export interface ApiError extends Error {
  status?: number;
  url?: string;
  response?: string;
}

/**
 * Robust JSON fetch with error handling
 * - Validates response.ok
 * - Checks Content-Type
 * - Properly parses JSON or throws error
 */
export async function fetchJson<T = any>(
  url: string,
  options?: FetchOptions
): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await response.text();
      const error: ApiError = new Error(
        `Expected JSON but got ${contentType}. Response: ${text.slice(0, 100)}`
      );
      error.status = response.status;
      error.url = url;
      error.response = text;
      throw error;
    }

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = new Error(
        data.error || `API error: ${response.status}`
      );
      error.status = response.status;
      error.url = url;
      error.response = JSON.stringify(data);
      throw error;
    }

    return data as T;
  } catch (err) {
    if (err instanceof Error && 'status' in err && 'url' in err) throw err;

    const error = new Error(
      err instanceof Error ? err.message : 'Unknown fetch error'
    ) as ApiError;
    error.url = url;
    throw error;
  }
}

// ==================== EMPLOYEES ====================

export async function listEmployees() {
  try {
    const response = await fetchJson('/api/employees');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    return [];
  }
}

export async function getEmployee(id: string) {
  try {
    return await fetchJson(`/api/employees/${id}`);
  } catch (error) {
    console.error(`Failed to fetch employee ${id}:`, error);
    return null;
  }
}

export async function saveEmployee(employee: any) {
  try {
    if (employee.id) {
      return await fetchJson(`/api/employees/${employee.id}`, {
        method: 'PUT',
        body: JSON.stringify(employee),
      });
    } else {
      return await fetchJson('/api/employees', {
        method: 'POST',
        body: JSON.stringify(employee),
      });
    }
  } catch (error) {
    console.error('Failed to save employee:', error);
    throw error;
  }
}

export async function deleteEmployee(id: string) {
  try {
    return await fetchJson(`/api/employees/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error(`Failed to delete employee ${id}:`, error);
    throw error;
  }
}

// ==================== TEMPLATES ====================

export async function listTemplates() {
  try {
    const response = await fetchJson('/api/templates');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return [];
  }
}

export async function getTemplate(id: string) {
  try {
    return await fetchJson(`/api/templates/${id}`);
  } catch (error) {
    console.error(`Failed to fetch template ${id}:`, error);
    return null;
  }
}

export async function saveTemplate(template: any) {
  try {
    if (template.id) {
      return await fetchJson(`/api/templates/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify(template),
      });
    } else {
      return await fetchJson('/api/templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });
    }
  } catch (error) {
    console.error('Failed to save template:', error);
    throw error;
  }
}

export async function deleteTemplate(id: string) {
  try {
    return await fetchJson(`/api/templates/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error(`Failed to delete template ${id}:`, error);
    throw error;
  }
}

// ==================== PLANNINGS ====================

export async function listPlannings() {
  try {
    const response = await fetchJson('/api/plannings');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Failed to fetch plannings:', error);
    return [];
  }
}

export async function getPlanning(id: string) {
  try {
    return await fetchJson(`/api/plannings/${id}`);
  } catch (error) {
    console.error(`Failed to fetch planning ${id}:`, error);
    return null;
  }
}

export async function savePlanning(planning: any) {
  try {
    if (planning.id) {
      return await fetchJson(`/api/plannings/${planning.id}`, {
        method: 'PUT',
        body: JSON.stringify(planning),
      });
    } else {
      return await fetchJson('/api/plannings', {
        method: 'POST',
        body: JSON.stringify(planning),
      });
    }
  } catch (error) {
    console.error('Failed to save planning:', error);
    throw error;
  }
}

export async function deletePlanning(id: string) {
  try {
    return await fetchJson(`/api/plannings/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error(`Failed to delete planning ${id}:`, error);
    throw error;
  }
}

// ==================== ROLES ====================

export async function listRoles() {
  try {
    const response = await fetchJson('/api/roles');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    return [];
  }
}

export async function getRole(id: string) {
  try {
    return await fetchJson(`/api/roles/${encodeURIComponent(id)}`);
  } catch (error) {
    console.error(`Failed to fetch role ${id}:`, error);
    return null;
  }
}

export async function saveRole(role: any) {
  try {
    if (role.id) {
      return await fetchJson(`/api/roles/${encodeURIComponent(role.id)}`, {
        method: 'PUT',
        body: JSON.stringify(role),
      });
    } else {
      return await fetchJson('/api/roles', {
        method: 'POST',
        body: JSON.stringify(role),
      });
    }
  } catch (error) {
    console.error('Failed to save role:', error);
    throw error;
  }
}

export async function deleteRole(id: string) {
  try {
    return await fetchJson(`/api/roles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error(`Failed to delete role ${id}:`, error);
    throw error;
  }
}

// ==================== LONG ABSENCES ====================

export async function listLongAbsences() {
  try {
    const response = await fetchJson('/api/longabsences');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Failed to fetch long absences:', error);
    return [];
  }
}

export async function getLongAbsence(id: string) {
  try {
    return await fetchJson(`/api/longabsences/${id}`);
  } catch (error) {
    console.error(`Failed to fetch long absence ${id}:`, error);
    return null;
  }
}

export async function saveLongAbsence(absence: any) {
  try {
    if (absence.id) {
      return await fetchJson(`/api/longabsences/${absence.id}`, {
        method: 'PUT',
        body: JSON.stringify(absence),
      });
    } else {
      return await fetchJson('/api/longabsences', {
        method: 'POST',
        body: JSON.stringify(absence),
      });
    }
  } catch (error) {
    console.error('Failed to save long absence:', error);
    throw error;
  }
}

export async function deleteLongAbsence(id: string) {
  try {
    return await fetchJson(`/api/longabsences/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error(`Failed to delete long absence ${id}:`, error);
    throw error;
  }
}

// ==================== SETTINGS ====================

export async function getAllSettings() {
  try {
    const response = await fetchJson('/api/settings');
    return response && typeof response === 'object' ? response : {};
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return {};
  }
}

export async function getSetting(key: string) {
  try {
    const response = await fetchJson(`/api/settings/${key}`);
    return response?.value ?? null;
  } catch (error) {
    console.error(`Failed to fetch setting ${key}:`, error);
    return null;
  }
}

export async function setSetting(key: string, value: any) {
  try {
    return await fetchJson(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  } catch (error) {
    console.error(`Failed to save setting ${key}:`, error);
    throw error;
  }
}

export async function deleteSetting(key: string) {
  try {
    return await fetchJson(`/api/settings/${key}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error(`Failed to delete setting ${key}:`, error);
    throw error;
  }
}

// ==================== MIGRATION ====================

export async function performMigration(payload: any) {
  try {
    return await fetchJson('/api/migrate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// ==================== BOOTSTRAP ====================

export async function bootstrap() {
  try {
    const response = await fetchJson('/api/bootstrap');
    return {
      employees: Array.isArray(response.employees) ? response.employees : [],
      templates: Array.isArray(response.templates) ? response.templates : [],
      plannings: Array.isArray(response.plannings) ? response.plannings : [],
      roles: Array.isArray(response.roles) ? response.roles : [],
      longAbsences: Array.isArray(response.longAbsences) ? response.longAbsences : [],
      settings: response.settings && typeof response.settings === 'object' ? response.settings : {},
    };
  } catch (error) {
    console.error('Bootstrap failed:', error);
    throw error;
  }
}
