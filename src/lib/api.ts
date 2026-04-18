// --- API Admin ---
export const adminApi = {
    getStats: () => apiFetch('/admin/stats'),
    getClients: () => apiFetch('/admin/clients'),
    uploadLogo: (formData: FormData) => apiFetch('/admin/upload-logo', { method: 'POST', body: formData }),
    createClient: (payload: any) => apiFetch('/admin/clients', { method: 'POST', body: JSON.stringify(payload) }),
    impersonateClient: (clientId: string) => apiFetch(`/admin/clients/${clientId}/impersonate`, { method: 'POST' }),
    getClientFactures: (clientId: string) => apiFetch(`/admin/clients/${clientId}/factures`),
    deleteClientFacture: (clientId: string, factureId: string) => apiFetch(`/admin/clients/${clientId}/factures/${factureId}`, { method: 'DELETE' }),
    previewImportExcel: (clientId: string, formData: FormData) => apiFetch(`/admin/import-excel/${clientId}/preview`, { method: 'POST', body: formData, timeoutMs: 30000 }),
    executeImportExcel: (clientId: string, formData: FormData) => apiFetch(`/admin/import-excel/${clientId}/execute`, { method: 'POST', body: formData, timeoutMs: 120000 }),
    getClientModules: (clientId: string) => apiFetch(`/admin/clients/${clientId}/modules`),
    updateClientModules: (clientId: string, modules: any) => apiFetch(`/admin/clients/${clientId}/modules`, { method: 'PUT', body: JSON.stringify(modules) }),
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
};
const API_URL = '/api';

type ApiFetchOptions = RequestInit & { timeoutMs?: number };

export async function apiFetch(endpoint: string, options: ApiFetchOptions = {}) {
    const token = localStorage.getItem('token');
    const controller = new AbortController();
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...((options.headers as Record<string, string>) || {}),
    };

    if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
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
            throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
        }

        return data;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('La requête a expiré (timeout)');
        }
        throw error;
    }
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
    sendFactureEmail: (id: string, payload: any) => apiFetch(`/facture/${id}/send-email`, { method: 'POST', body: JSON.stringify(payload) }),
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
};

export const supportApi = {
    getOpenTicket: () => apiFetch('/support/ticket/open'),
    getClientUnreadCount: () => apiFetch('/support/unread-count'),
    sendClientMessage: (payload: any) => apiFetch('/support/messages', { method: 'POST', body: JSON.stringify(payload) }),
    uploadFile: (formData: FormData) => apiFetch('/support/upload', { method: 'POST', body: formData }),
    getAdminUnreadCount: () => apiFetch('/admin/support/unread-count'),
    getAdminTickets: (status: 'OPEN' | 'CLOSED' = 'OPEN') => apiFetch(`/admin/support/tickets?status=${status}`),
    getAdminTicketMessages: (ticketId: string) => apiFetch(`/admin/support/tickets/${ticketId}/messages`),
    sendAdminMessage: (ticketId: string, payload: any) => apiFetch(`/admin/support/tickets/${ticketId}/messages`, { method: 'POST', body: JSON.stringify(payload) }),
    closeTicket: (ticketId: string) => apiFetch(`/admin/support/tickets/${ticketId}/close`, { method: 'PATCH' }),
};
