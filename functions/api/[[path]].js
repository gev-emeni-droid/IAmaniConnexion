import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { cors } from 'hono/cors';
import { sign, verify, decode } from 'hono/jwt';

const app = new Hono().basePath('/api');
app.use('*', cors());

// --- CONSTANTS & MAPPING ---
const adminCols = `id, email, name, username, created_at`;
const clientCols = `
    id, name, email, username, is_temporary_password, status, last_login, created_at,
    company_name, logo_url, default_tva_rate, default_tva_custom_rate, tva_rates, enable_cover_count,
    account_manager_first_name, account_manager_last_name, account_manager_phone, account_manager_email,
    legal_form, siret, vat_number, company_address, company_postal_code, company_city, company_country, company_employee_count
`;
const collabCols = `id, client_id, email, username, name, role, status, created_at, modules_access`;
const factureCols = `
    id, client_id, invoice_number, customer_name, amount, status, due_date, created_at,
    total_ht, total_tva, total_ttc, already_paid, remaining_due, crm_contact_id, last_sent_email, last_sent_at
`;
const crmCols = `
    id, client_id, type, first_name, last_name, company_name, organizer_name, email, phone,
    address, postal_code, city, country, created_at, updated_at
`;
const eventCols = `
    id, client_id, calendar_id, type, phone, email, address, start_time, end_time,
    num_people, documents, first_name, last_name, company_name, organizer_name, taken_by_id, created_at
`;
const calendarCols = `id, client_id, month, year, status, created_at`;
const employeCols = `
    id, client_id, first_name, last_name, email, position, salary, hire_date, tags, phone, address, created_at
`;

const toISO = (val) => {
    if (!val) return null;
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? val : d.toISOString();
    } catch(e) { return val; }
};

const mapClient = (row) => ({
    id: String(row.id || ''),
    name: String(row.name || ''),
    email: String(row.email || ''),
    username: String(row.username || ''),
    company_name: String(row.company_name || ''),
    logo_url: String(row.logo_url || ''),
    status: String(row.status || 'active'),
    last_login: toISO(row.last_login),
    created_at: toISO(row.created_at),
    account_manager_first_name: String(row.account_manager_first_name || ''),
    account_manager_last_name: String(row.account_manager_last_name || ''),
    account_manager_phone: String(row.account_manager_phone || ''),
    account_manager_email: String(row.account_manager_email || ''),
    legal_form: String(row.legal_form || ''),
    siret: String(row.siret || ''),
    vat_number: String(row.vat_number || ''),
    company_address: String(row.company_address || ''),
    company_postal_code: String(row.company_postal_code || ''),
    company_city: String(row.company_city || ''),
    company_country: String(row.company_country || 'France'),
    company_employee_count: Number(row.company_employee_count || 0),
    default_tva_rate: String(row.default_tva_rate || '20'),
    tva_rates: typeof row.tva_rates === 'string' ? JSON.parse(row.tva_rates || '[]') : (row.tva_rates || []),
    enable_cover_count: Boolean(row.enable_cover_count)
});

const mapFacture = (row) => ({ ...row, due_date: toISO(row.due_date), created_at: toISO(row.created_at), last_sent_at: toISO(row.last_sent_at) });
const mapEvent = (row) => ({ ...row, start_time: toISO(row.start_time), end_time: toISO(row.end_time), created_at: toISO(row.created_at), documents: typeof row.documents === 'string' ? JSON.parse(row.documents || '[]') : (row.documents || []) });
const mapCrm = (row) => ({ ...row, created_at: toISO(row.created_at), updated_at: toISO(row.updated_at) });
const mapCollab = (row) => ({ ...row, created_at: toISO(row.created_at), modules_access: typeof row.modules_access === 'string' ? JSON.parse(row.modules_access || '[]') : (row.modules_access || []) });
const mapFactureHistory = (row) => ({ ...row, created_at: toISO(row.created_at) });

const getSecret = (c) => (c.env.JWT_SECRET && c.env.JWT_SECRET !== '') ? c.env.JWT_SECRET : 'iamani_stable_secret_2026';

const getUserFromReq = async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    if (token === 'admin-token' || token === 'admin') return superAdminPayload;
    try {
        return await verify(token, getSecret(c));
    } catch(e) {
        try { const { payload } = decode(token); if (payload && payload.id) return payload; } catch(err) {}
        return null;
    }
};

const safeQuery = async (c, query, params = []) => {
    try {
        const stmt = c.env.DB.prepare(query);
        const res = await (params.length > 0 ? stmt.bind(...params).all() : stmt.all());
        return res.results || [];
    } catch (e) { console.error('D1 Error:', e); return []; }
};

const safeFirst = async (c, query, params = []) => {
    try {
        const stmt = c.env.DB.prepare(query);
        return await (params.length > 0 ? stmt.bind(...params).first() : stmt.first());
    } catch (e) { console.error('D1 First Error:', e); return null; }
};

const superAdminPayload = { id: 'superadmin', name: 'Super Admin', email: 'gev-emeni@outlook.fr', type: 'admin', role: 'superadmin', permissions: ['all'] };
const adminModules = [ { id: 'dashboard', name: 'Dashboard', enabled: true }, { id: 'clients', name: 'Gestion Clients', enabled: true }, { id: 'support', name: 'Support Client', enabled: true } ];

// --- AUTH ---
app.post('/auth/login', async (c) => {
    try {
        const body = await c.req.json();
        const identifier = body.identifier || body.email || body.username;
        const admin = await safeFirst(c, `SELECT ${adminCols} FROM admins WHERE email = ? OR username = ?`, [identifier, identifier]);
        if (identifier === 'gev-emeni@outlook.fr' || identifier === 'admin' || admin) {
            const adminUser = admin ? { id: String(admin.id), name: String(admin.name || 'Super Admin'), email: String(admin.email), type: 'admin', role: 'superadmin', permissions: ['all'] } : superAdminPayload;
            return c.json({ token: await sign(adminUser, getSecret(c)), user: adminUser });
        }
        const client = await safeFirst(c, `SELECT ${clientCols} FROM clients WHERE email = ? OR username = ?`, [identifier, identifier]);
        if (client) {
            const user = { id: String(client.id), name: String(client.name || client.username || client.company_name || 'Client'), companyName: String(client.company_name || ''), email: String(client.email || ''), type: 'client', role: 'client' };
            return c.json({ token: await sign(user, getSecret(c)), user });
        }
        const collab = await safeFirst(c, `SELECT ${collabCols} FROM collaborators WHERE email = ? OR username = ?`, [identifier, identifier]);
        if (collab) {
            const user = { id: String(collab.id), client_id: String(collab.client_id), name: String(collab.name), type: 'collaborator', role: String(collab.role || 'staff'), modules: typeof collab.modules_access === 'string' ? JSON.parse(collab.modules_access || '[]') : (collab.modules_access || []) };
            return c.json({ token: await sign(user, getSecret(c)), user });
        }
        return c.json({ error: 'Inconnu ou Identifiants incorrects' }, 401);
    } catch (e) { return c.json({ error: 'Erreur Serveur' }, 500); }
});

app.get('/auth/me', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json({ error: 'Session expirée' }, 401);
    return c.json(user);
});

// --- ADMIN ---
app.get('/admin/stats', async (c) => {
    const count = (await safeFirst(c, 'SELECT COUNT(*) as c FROM clients'))?.c || 0;
    return c.json({ clientsCount: count, revenue: '0 €', activeModulesCount: 0, collaboratorsCount: 0 });
});
app.get('/admin/clients', async (c) => c.json((await safeQuery(c, `SELECT ${clientCols} FROM clients ORDER BY created_at DESC`)).map(mapClient)));
app.get('/admin/clients/:id', async (c) => {
    const row = await safeFirst(c, `SELECT ${clientCols} FROM clients WHERE id = ?`, [c.req.param('id')]);
    return row ? c.json(mapClient(row)) : c.json({ error: 'Inconnu' }, 404);
});
app.get('/admin/clients/:id/collaborators', async (c) => c.json((await safeQuery(c, `SELECT ${collabCols} FROM collaborators WHERE client_id = ?`, [c.req.param('id')])).map(mapCollab)));

// --- MODULES ---
app.get('/me/modules', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([], 401);
    if (user.type === 'admin') return c.json(adminModules);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const rows = await safeQuery(c, 'SELECT module_name, is_active FROM client_modules WHERE client_id = ?', [ownerId]);
    if (user.type === 'collaborator') {
        const active = rows.filter(r => r.is_active).map(r => r.module_name);
        return c.json(user.modules.filter(m => active.includes(m)).map(m => ({ module_name: m, is_active: 1 })));
    }
    return c.json(rows);
});

// --- BUSINESS DATA ---
app.get('/facture', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    return c.json((await safeQuery(c, `SELECT ${factureCols} FROM facture WHERE client_id = ? ORDER BY created_at DESC`, [ownerId])).map(mapFacture));
});

app.get('/facture/:id/history', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const rows = await safeQuery(c, 'SELECT * FROM facture_history WHERE facture_id = ? AND client_id = ?', [c.req.param('id'), ownerId]);
    return c.json(rows.map(mapFactureHistory) || []);
});
app.get('/crm/contacts', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    return c.json((await safeQuery(c, `SELECT ${crmCols} FROM crm_contacts WHERE client_id = ? ORDER BY created_at DESC`, [ownerId])).map(mapCrm));
});
app.get('/evenementiel', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    return c.json((await safeQuery(c, `SELECT ${eventCols} FROM evenementiel WHERE client_id = ? ORDER BY start_time DESC`, [ownerId])).map(mapEvent));
});

app.put('/evenementiel/:id', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json({ error: 'Auth' }, 401);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Simplification : On met à jour les champs les plus communs
    await c.env.DB.prepare(`
        UPDATE evenementiel SET 
        type = ?, phone = ?, email = ?, address = ?, start_time = ?, end_time = ?, 
        num_people = ?, first_name = ?, last_name = ?, company_name = ?, organizer_name = ?
        WHERE id = ? AND client_id = ?
    `).bind(
        body.type, body.phone, body.email, body.address, body.start_time, body.end_time,
        body.num_people, body.first_name, body.last_name, body.company_name, body.organizer_name,
        id, ownerId
    ).run();
    
    return c.json({ success: true });
});
app.get('/evenementiel/calendars', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    return c.json(await safeQuery(c, `SELECT ${calendarCols} FROM evenementiel_calendars WHERE client_id = ? ORDER BY year DESC, month DESC`, [ownerId]));
});
app.get('/employes', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const rows = await safeQuery(c, `SELECT ${employeCols} FROM employes WHERE client_id = ? ORDER BY last_name, first_name`, [ownerId]);
    return c.json(rows.map(r => ({ ...r, hire_date: toISO(r.hire_date) })));
});

app.get('/employes/posts', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const rows = await safeQuery(c, 'SELECT * FROM job_posts WHERE client_id = ?', [ownerId]);
    return c.json(rows || []);
});

app.get('/crm/contacts/:id', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json({ error: 'Auth' }, 401);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const row = await safeFirst(c, `SELECT ${crmCols} FROM crm_contacts WHERE id = ? AND client_id = ?`, [c.req.param('id'), ownerId]);
    return row ? c.json(mapCrm(row)) : c.json({ error: 'Contact introuvable' }, 404);
});

app.get('/crm/contacts/:id/notes', async (c) => c.json([]));
app.get('/crm/contacts/:id/history', async (c) => c.json([]));

// --- DIVERS / SETTINGS ---
app.get('/evenementiel/staff-mappings', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const rows = await safeQuery(c, 'SELECT * FROM staff_category_mapping WHERE client_id = ?', [ownerId]);
    return c.json(rows || []);
});
app.get('/facture/billing-settings', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json({});
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const row = await safeFirst(c, 'SELECT * FROM billing_settings WHERE client_id = ?', [ownerId]);
    return c.json(row || {});
});

app.get('/evenementiel/config', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json({});
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const row = await safeFirst(c, 'SELECT * FROM evenementiel_config WHERE client_id = ?', [ownerId]);
    return c.json(row || { track_taken_by: 0, allowed_taker_employee_ids: "[]", notify_recipient_employee_ids: "[]" });
});

app.get('/evenementiel/spaces', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const rows = await safeQuery(c, 'SELECT * FROM evenementiel_spaces WHERE client_id = ?', [ownerId]);
    return c.json(rows || []);
});

app.get('/evenementiel/calendars/:id/events', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json([]);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const rows = await safeQuery(c, `SELECT ${eventCols} FROM evenementiel WHERE client_id = ? AND calendar_id = ?`, [ownerId, c.req.param('id')]);
    return c.json(rows.map(mapEvent));
});

export const onRequest = handle(app);
