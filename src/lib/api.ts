// --- API Admin ---
export const adminApi = {
    getStats: () => apiFetch('/admin/stats'),
    getSentinelLogs: (category?: string, clientId?: string) => {
        let url = '/admin/sentinel/logs';
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (clientId) params.append('clientId', clientId);
        const qs = params.toString();
        return apiFetch(qs ? `${url}?${qs}` : url);
    },
    getClients: () => apiFetch('/admin/clients'),
    getClient: (clientId: string) => apiFetch(`/admin/clients/${clientId}`),
    uploadLogo: (logoBase64: string, mimeType: string) => apiFetch('/admin/upload-logo', { method: 'POST', body: JSON.stringify({ logoBase64, mimeType }) }),
    createClient: (payload: any) => apiFetch('/admin/clients', { method: 'POST', body: JSON.stringify(payload) }),
    impersonateClient: (clientId: string) => apiFetch(`/admin/clients/${clientId}/impersonate`, { method: 'POST' }),
    getClientFactures: (clientId: string) => apiFetch(`/admin/clients/${clientId}/factures`),
    deleteClientFacture: (clientId: string, factureId: string) => apiFetch(`/admin/clients/${clientId}/factures/${factureId}`, { method: 'DELETE' }),
    previewImportExcel: (clientId: string, formData: FormData) => apiFetch(`/admin/import-excel/${clientId}/preview`, { method: 'POST', body: formData, timeoutMs: 30000 }),
    executeImportExcel: (clientId: string, formData: FormData) => apiFetch(`/admin/import-excel/${clientId}/execute`, { method: 'POST', body: formData, timeoutMs: 120000 }),
    previewImportEvenementiel: (clientId: string, formData: FormData) => apiFetch(`/admin/import-evenementiel/${clientId}/preview`, { method: 'POST', body: formData, timeoutMs: 30000 }),
    executeImportEvenementiel: (clientId: string, payload: any) => apiFetch(`/admin/import-evenementiel/${clientId}/execute`, { method: 'POST', body: JSON.stringify(payload), timeoutMs: 120000 }),
    getClientModules: (clientId: string) => apiFetch(`/admin/clients/${clientId}/modules`),
    getClientEmployes: (clientId: string) => apiFetch(`/admin/clients/${clientId}/employes`),
    updateClientModules: (clientId: string, modules: any[]) => apiFetch(`/admin/clients/${clientId}/modules`, { method: 'PUT', body: JSON.stringify(modules) }),
    getCollaborators: (clientId: string) => apiFetch(`/admin/clients/${clientId}/collaborators`),
    updateCollaborator: (clientId: string, collaboratorId: string, collaborator: any) => apiFetch(`/admin/clients/${clientId}/collaborators/${collaboratorId}`, { method: 'PATCH', body: JSON.stringify(collaborator) }),
    createCollaborator: (clientId: string, collaborator: any) => apiFetch(`/admin/clients/${clientId}/collaborators`, { method: 'POST', body: JSON.stringify(collaborator) }),
    deleteCollaborator: (clientId: string, collaboratorId: string) => apiFetch(`/admin/clients/${clientId}/collaborators/${collaboratorId}`, { method: 'DELETE' }),
    getSpaces: (clientId: string) => apiFetch(`/admin/clients/${clientId}/spaces`),
    createSpace: (clientId: string, space: any) => apiFetch(`/admin/clients/${clientId}/spaces`, { method: 'POST', body: JSON.stringify(space) }),
    updateSpace: (clientId: string, spaceId: string, payload: any) => apiFetch(`/admin/clients/${clientId}/spaces/${spaceId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteSpace: (clientId: string, spaceId: string) => apiFetch(`/admin/clients/${clientId}/spaces/${spaceId}`, { method: 'DELETE' }),
    getClientAuditLogs: (clientId: string) => apiFetch(`/admin/clients/${clientId}/audit-logs`),
    getStaffTypes: (clientId: string) => apiFetch(`/admin/clients/${clientId}/staff-types`),
    createStaffType: (clientId: string, staff: any) => apiFetch(`/admin/clients/${clientId}/staff-types`, { method: 'POST', body: JSON.stringify(staff) }),
    deleteStaffType: (clientId: string, staffId: string) => apiFetch(`/admin/clients/${clientId}/staff-types/${staffId}`, { method: 'DELETE' }),
    updateClient: (clientId: string, payload: any) => apiFetch(`/admin/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteClient: (clientId: string) => apiFetch(`/admin/clients/${clientId}`, { method: 'DELETE' }),
    resetClientPassword: (clientId: string) => apiFetch(`/admin/clients/${clientId}/reset-password`, { method: 'POST' }),
    forceResetClientPassword: (clientId: string) => apiFetch(`/admin/clients/${clientId}/force-reset-password`, { method: 'POST' }),
    resetCollaboratorPassword: (clientId: string, collaboratorId: string) => apiFetch(`/admin/clients/${clientId}/collaborators/${collaboratorId}/reset-password`, { method: 'POST' }),
    forceResetCollaboratorPassword: (clientId: string, collaboratorId: string) => apiFetch(`/admin/clients/${clientId}/collaborators/${collaboratorId}/force-reset-password`, { method: 'POST' }),
    getClientPlanningConfig: (clientId: string) => apiFetch(`/admin/clients/${clientId}/planning-config`),
    saveClientPlanningConfig: (clientId: string, payload: { absenceCodes?: any[]; extraTypes?: string[] }) => apiFetch(`/admin/clients/${clientId}/planning-config`, { method: 'POST', body: JSON.stringify({ ...payload, client_id: clientId }) }),
    getClientPlanningArchives: (clientId: string) => apiFetch(`/admin/clients/${clientId}/planning/archives`),
    getClientPlanningArchiveDetail: (clientId: string, archiveId: string) => apiFetch(`/admin/clients/${clientId}/planning/archives/${archiveId}`),
    deleteClientPlanningArchive: (clientId: string, archiveId: string) => apiFetch(`/admin/clients/${clientId}/planning/archives/${archiveId}`, { method: 'DELETE' }),
    getClientDiagnostics: (clientId: string) => apiFetch(`/admin/clients/${clientId}/diagnostics`),
    sanitizeClientAccount: (clientId: string) => apiFetch(`/admin/clients/${clientId}/sanitize`, { method: 'POST' }),
    clearClientLogo: (clientId: string) => apiFetch(`/admin/clients/${clientId}/clear-logo`, { method: 'POST' }),
    logAction: (payload: { action: string; category?: string; severity?: string; message: string; details?: any }) => apiFetch('/admin/sentinel/log-action', { method: 'POST', body: JSON.stringify(payload) }),
    banIp: (ip: string, reason?: string) => apiFetch('/admin/sentinel/ban-ip', { method: 'POST', body: JSON.stringify({ ip, reason }) }),
};
const API_URL = '/api';

type ApiFetchOptions = RequestInit & { timeoutMs?: number };

let writeQueue = Promise.resolve();

export async function apiFetch(endpoint: string, options: ApiFetchOptions = {}, retryCount = 2) {
    const token = localStorage.getItem('token');
    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...((options.headers as Record<string, string>) || {}),
    };

    if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const executeFetch = async () => {
        // Debounce/Queue for write operations to stabilize HTTP2
        if (options.method && options.method !== 'GET') {
            // Chain to the existing queue
            const currentWrite = writeQueue.then(async () => {
                await new Promise(r => setTimeout(r, 50)); // Reduced security gap for stability
            });
            writeQueue = currentWrite;
            await currentWrite;
        }

        const controller = new AbortController();
        const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 10000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = { error: text || 'Non-JSON response received' };
            }

            if (!response.ok) {
                // If it's a 5xx or network error, we might want to retry, but for now we follow the retry logic
                throw { status: response.status, message: data.error || `Error ${response.status}` };
            }

            return data;
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw error;
        }
    };

    let lastError: any;
    for (let i = 0; i <= retryCount; i++) {
        try {
            return await executeFetch();
        } catch (error: any) {
            lastError = error;

            // AbortError = intentional cancellation (navigation, cleanup, timeout on polling)
            // Never retry, never log — just rethrow silently
            if (error?.name === 'AbortError' || error instanceof DOMException) {
                throw error;
            }

            // Only retry on network errors or 5xx. Don't retry on 4xx (except maybe 429)
            const isNetworkError = error instanceof TypeError || !error.status;
            const isRetryableStatus = error.status >= 500 || error.status === 429;
            
            if (i < retryCount && (isNetworkError || isRetryableStatus)) {
                console.warn(`API retry ${i + 1}/${retryCount} for ${endpoint}`, error);
                // Wait before retrying (exponential backoff) - 2s, 4s
                await new Promise(res => setTimeout(res, 2000 * (i + 1)));
                continue;
            }
            break;
        }
    }

    if (lastError?.name === 'AbortError' || lastError instanceof DOMException) {
        // Propagate silently — caller's useEffect cleanup will ignore it
        throw lastError;
    }
    throw new Error(lastError?.message || lastError?.toString() || 'Erreur réseau');
}

export const authApi = {
    login: (credentials: any) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    changePassword: (newPassword: string) => apiFetch('/change-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
    forceChangePassword: (newPassword: string) => apiFetch('/auth/force-change-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
    updateProfile: (payload: any) => apiFetch('/user/profile', { method: 'PUT', body: JSON.stringify(payload) }),
    getMe: () => apiFetch('/auth/me'),
    getMyModules: () => apiFetch('/me/modules'),
};

export const moduleApi = {
    getPlanning: () => apiFetch('/planning'),
    getEvenementiel: () => apiFetch('/evenementiel'),
    getEvenementielConfig: () => apiFetch('/evenementiel/config'),
    saveEvenementielConfig: (payload: any) => apiFetch('/evenementiel/config', { method: 'PUT', body: JSON.stringify(payload) }),
    getEvenementielCalendars: () => apiFetch('/evenementiel/calendars'),
    createEvenementielCalendar: (calendar: any) => apiFetch('/evenementiel/calendars', { method: 'POST', body: JSON.stringify(calendar) }),
    archiveEvenementielCalendar: (id: string) => apiFetch(`/evenementiel/calendars/${id}/archive`, { method: 'PATCH' }),
    deleteEvenementielCalendar: (id: string) => apiFetch(`/evenementiel/calendars/${id}`, { method: 'DELETE' }),
    getEvenementielCalendarEvents: (id: string) => apiFetch(`/evenementiel/calendars/${id}/events`),
    getEvenementielSpaces: () => apiFetch('/evenementiel/spaces'),
    createEvenementielSpace: (space: any) => apiFetch('/evenementiel/spaces', { method: 'POST', body: JSON.stringify(space) }),
    deleteEvenementielSpace: (id: string) => apiFetch(`/evenementiel/spaces/${id}`, { method: 'DELETE' }),
    getEvenementielStaffTypes: () => apiFetch('/evenementiel/staff-types'),
    getStaffCategoryMappings: () => apiFetch('/evenementiel/staff-mappings'),
    saveStaffCategoryMappings: (mappings: any[]) => apiFetch('/evenementiel/staff-mappings', { method: 'PUT', body: JSON.stringify({ mappings }) }),
    createEvenementielStaffType: (data: any) => apiFetch('/evenementiel/staff-types', { method: 'POST', body: JSON.stringify(data) }),
    deleteEvenementielStaffType: (id: string) => apiFetch(`/evenementiel/staff-types/${id}`, { method: 'DELETE' }),
    createEvenementiel: (event: any) => apiFetch('/evenementiel', { method: 'POST', body: JSON.stringify(event) }),
    updateEvenementiel: (id: string, event: any) => apiFetch(`/evenementiel/${id}`, { method: 'PUT', body: JSON.stringify(event) }),
    notifyEvenementielUpdate: (payload: any) => apiFetch('/evenementiel/notify-update', { method: 'POST', body: JSON.stringify(payload) }),
    deleteEvenementiel: (id: string) => apiFetch(`/evenementiel/${id}`, { method: 'DELETE' }),
    getCRMContacts: () => apiFetch('/crm/contacts'),
    searchCRMContacts: (q: string) => apiFetch(`/crm/contacts/search?q=${encodeURIComponent(q)}`),
    getCRMContact: (id: string) => apiFetch(`/crm/contacts/${id}`),
    updateCRMContact: (id: string, payload: any) => apiFetch(`/crm/contacts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteCRMContact: (id: string) => apiFetch(`/crm/contacts/${id}`, { method: 'DELETE' }),
    getFacture: () => apiFetch('/facture'),
    getFactures: () => apiFetch('/facture'),
    searchFactureCRMContacts: (q: string) => apiFetch(`/facture/crm-search?q=${encodeURIComponent(q)}`),
    createFacture: (payload: any) => apiFetch('/facture', { method: 'POST', body: JSON.stringify(payload) }),
    sendFactureEmail: (id: string, payload: any) => apiFetch(`/facture/${id}/send-email`, { method: 'POST', body: JSON.stringify(payload), timeoutMs: 30000 }),
    // Nouvelle version : envoi de facture par email (PDF généré côté serveur)
    sendFactureEmailServer: (factureId: string, to: string, invoicePayload: any, pdfBase64?: string, filename?: string) =>
        apiFetch(`/facture/${factureId}/send-email`, {
            method: 'POST',
            body: JSON.stringify({ to, invoicePayload, pdfBase64, filename }),
        }),
    deleteFacture: (id: string) => apiFetch(`/facture/${id}`, { method: 'DELETE' }),
    getBillingSettings: () => apiFetch('/facture/billing-settings'),
    saveBillingSettings: (payload: any) => apiFetch('/facture/billing-settings', { method: 'PUT', body: JSON.stringify(payload) }),
    getEmployes: () => apiFetch('/employes'),
    createEmploye: (payload: any) => apiFetch('/employes', { method: 'POST', body: JSON.stringify(payload) }),
    updateEmploye: (id: string, payload: any) => apiFetch(`/employes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteEmploye: (id: string) => apiFetch(`/employes/${id}`, { method: 'DELETE' }),
    getJobPosts: () => apiFetch('/employes/posts'),
    createJobPost: (payload: any) => apiFetch('/employes/posts', { method: 'POST', body: JSON.stringify(payload) }),
    deleteJobPost: (id: string) => apiFetch(`/employes/posts/${id}`, { method: 'DELETE' }),
    getClientStats: () => apiFetch('/client/stats'),
};

export const dashboardApi = {
    getClientStats: () => apiFetch('/dashboard/stats'),
};

export const supportApi = {
    getOpenTicket: () => apiFetch('/support/ticket/open'),
    getClientUnreadCount: () => apiFetch('/support/unread-count'),
    sendClientMessage: (payload: any) => apiFetch('/support/messages', { method: 'POST', body: JSON.stringify(payload), timeoutMs: 30000 }),
    uploadFile: (formData: FormData) => apiFetch('/support/upload', { method: 'POST', body: formData, timeoutMs: 60000 }),
    getAdminUnreadCount: () => apiFetch('/admin/support/unread-count'),
    getAdminTickets: (status: 'OPEN' | 'CLOSED' = 'OPEN') => apiFetch(`/admin/support/tickets?status=${status}`),
    getAdminTicketMessages: (ticketId: string) => apiFetch(`/admin/support/tickets/${ticketId}/messages`),
    sendAdminMessage: (ticketId: string, payload: any) => apiFetch(`/admin/support/tickets/${ticketId}/messages`, { method: 'POST', body: JSON.stringify(payload) }),
    closeTicket: (ticketId: string) => apiFetch(`/admin/support/tickets/${ticketId}/close`, { method: 'PATCH' }),
    deleteTicket: (ticketId: string) => apiFetch(`/admin/support/tickets/${ticketId}`, { method: 'DELETE' }),
    markAsRead: (messageIds: string[]) => apiFetch('/support/messages/read', { method: 'POST', body: JSON.stringify({ messageIds }) }),
};

export const planningApi = {
    getWeek: (date: string) => apiFetch(`/planning/week/${date}`),
    saveWeek: (payload: any) => apiFetch('/planning/week', { method: 'POST', body: JSON.stringify(payload) }),
    getTemplates: () => apiFetch('/planning/templates'),
    saveTemplates: (payload: any) => apiFetch('/planning/templates', { method: 'POST', body: JSON.stringify(payload) }),
    getSettings: () => apiFetch('/planning/settings'),
    saveSettings: (payload: any) => apiFetch('/planning/settings', { method: 'POST', body: JSON.stringify(payload) }),
    listWeeks: () => apiFetch('/planning/weeks'),
    deleteWeek: (id: string) => apiFetch(`/planning/week/${id}`, { method: 'DELETE' }),
    // Archiving
    getArchives: () => apiFetch('/planning/archives'),
    getArchive: (weekStart: string) => apiFetch(`/planning/archive/${weekStart}`),
    archiveWeek: (payload: any) => apiFetch('/planning/archive', { method: 'POST', body: JSON.stringify(payload) }),
    deleteArchive: (id: string) => apiFetch(`/planning/archive/${id}`, { method: 'DELETE' }),
    // Absences Longue Durée
    getAbsences: () => apiFetch('/planning/absences'),
    saveAbsence: (payload: any) => apiFetch('/planning/absences', { method: 'POST', body: JSON.stringify(payload) }),
    deleteAbsence: (id: string) => apiFetch(`/planning/absences/${id}`, { method: 'DELETE' }),
};
