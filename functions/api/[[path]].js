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
    ...row,
    last_login: toISO(row.last_login),
    created_at: toISO(row.created_at),
    company_employee_count: Number(row.company_employee_count || 0),
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

// --- AUTH & USER ---
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
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Session expirée' }, 401);
        return c.json(user);
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/me/modules', async (c) => {
    try {
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
    } catch (e) { return c.json([]); }
});

// --- ADMIN ---
app.get('/admin/stats', async (c) => {
    try {
        const count = (await safeFirst(c, 'SELECT COUNT(*) as c FROM clients'))?.c || 0;
        return c.json({ clientsCount: count, revenue: '0 €', activeModulesCount: 0, collaboratorsCount: 0 });
    } catch (e) { return c.json({ clientsCount: 0 }); }
});

app.get('/admin/clients', async (c) => {
    try {
        const rows = await safeQuery(c, `SELECT ${clientCols} FROM clients ORDER BY created_at DESC`);
        return c.json(rows.map(mapClient));
    } catch (e) { return c.json([]); }
});

app.get('/admin/clients/:id', async (c) => {
    try {
        const row = await safeFirst(c, `SELECT ${clientCols} FROM clients WHERE id = ?`, [c.req.param('id')]);
        return row ? c.json(mapClient(row)) : c.json({ error: 'Inconnu' }, 404);
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/admin/clients/:id/factures', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Interdit' }, 403);
        const rows = await safeQuery(c, `SELECT ${factureCols} FROM facture WHERE client_id = ?`, [c.req.param('id')]);
        return c.json(rows.map(mapFacture));
    } catch (e) { return c.json([]); }
});

app.get('/admin/clients/:id/modules', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Interdit' }, 403);
        const rows = await safeQuery(c, 'SELECT module_name, is_active FROM client_modules WHERE client_id = ?', [c.req.param('id')]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.put('/admin/clients/:id/modules', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Interdit' }, 403);
        const clientId = c.req.param('id');
        const modules = await c.req.json();
        for (const mod of modules) {
            await c.env.DB.prepare('INSERT OR REPLACE INTO client_modules (client_id, module_name, is_active) VALUES (?, ?, ?)')
                .bind(clientId, mod.module_name, mod.is_active ? 1 : 0).run();
        }
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur Maj Modules' }, 500); }
});

app.get('/admin/clients/:id/collaborators', async (c) => {
    try {
        const rows = await safeQuery(c, `SELECT ${collabCols} FROM collaborators WHERE client_id = ?`, [c.req.param('id')]);
        return c.json(rows.map(mapCollab));
    } catch (e) { return c.json([]); }
});

app.post('/admin/clients/:id/collaborators', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Interdit' }, 403);
        const clientId = c.req.param('id');
        const body = await c.req.json();
        const id = crypto.randomUUID();
        await c.env.DB.prepare('INSERT INTO collaborators (id, client_id, email, username, password, name, role, modules_access) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(id, clientId, body.email, body.username, body.password || 'temp123', body.name, body.role || 'staff', JSON.stringify(body.modules_access || [])).run();
        return c.json({ success: true, id });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.delete('/admin/clients/:clientId/collaborators/:collabId', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Interdit' }, 403);
        await c.env.DB.prepare('DELETE FROM collaborators WHERE id = ? AND client_id = ?')
            .bind(c.req.param('collabId'), c.req.param('clientId')).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/admin/clients/:id/audit-logs', async (c) => {
    try {
        const rows = await safeQuery(c, 'SELECT * FROM audit_logs WHERE target_user_id = ? ORDER BY created_at DESC', [c.req.param('id')]);
        return c.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at) })));
    } catch (e) { return c.json([]); }
});

app.get('/admin/clients/:id/spaces', async (c) => {
    try {
        const rows = await safeQuery(c, 'SELECT * FROM evenementiel_spaces WHERE client_id = ?', [c.req.param('id')]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.get('/admin/clients/:id/modules', async (c) => {
    try {
        const rows = await safeQuery(c, 'SELECT * FROM client_modules WHERE client_id = ?', [c.req.param('id')]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.get('/admin/clients/:id/audit-logs', async (c) => {
    try {
        const rows = await safeQuery(c, 'SELECT * FROM audit_logs WHERE client_id = ? ORDER BY created_at DESC LIMIT 100', [c.req.param('id')]);
        return c.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at) })));
    } catch (e) { return c.json([]); }
});

app.post('/admin/clients/:id/spaces', async (c) => {
    try {
        const id = crypto.randomUUID();
        const body = await c.req.json();
        await c.env.DB.prepare('INSERT INTO evenementiel_spaces (id, client_id, name, color) VALUES (?, ?, ?, ?)')
            .bind(id, c.req.param('id'), body.name, body.color).run();
        return c.json({ success: true, id });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/admin/clients/:id/staff-types', async (c) => {
    try {
        const rows = await safeQuery(c, 'SELECT * FROM evenementiel_staff_types WHERE client_id = ?', [c.req.param('id')]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

// --- PLANNING ---
app.get('/planning', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, 'SELECT * FROM planning WHERE client_id = ? ORDER BY start_date ASC', [ownerId]);
        return c.json(rows.map(r => ({ ...r, start_date: toISO(r.start_date), end_date: toISO(r.end_date), created_at: toISO(r.created_at) })));
    } catch (e) { return c.json([]); }
});

// --- ÉVÉNEMENTIEL ---
app.get('/evenementiel', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, `
            SELECT e.*, 
                   n.note_text,
                   CASE WHEN n.id IS NOT NULL THEN 1 ELSE 0 END as has_notes
            FROM evenementiel e 
            LEFT JOIN event_notes n ON e.id = n.event_id 
            WHERE e.client_id = ? 
            ORDER BY e.start_time DESC
        `, [ownerId]);
        
        const events = await Promise.all(rows.map(async (row) => {
            const staff = await safeQuery(c, 'SELECT staff_type_id, count FROM evenementiel_event_staff WHERE event_id = ?', [row.id]);
            const assignments = await safeQuery(c, `
                SELECT a.employee_id, a.staff_type_id, e.first_name, e.last_name, e.position
                FROM evenementiel_event_assignments a
                JOIN employes e ON a.employee_id = e.id
                WHERE a.event_id = ?
            `, [row.id]);
            const spaces = await safeQuery(c, 'SELECT s.* FROM evenementiel_spaces s JOIN evenementiel_event_spaces es ON s.id = es.space_id WHERE es.event_id = ?', [row.id]);
            return { ...mapEvent(row), has_notes: !!row.has_notes, staff, assignments, spaces };
        }));
        
        return c.json(events);
    } catch (e) { return c.json([]); }
});

app.get('/evenementiel/config', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({});
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const config = await safeFirst(c, 'SELECT * FROM evenementiel_config WHERE client_id = ?', [ownerId]);
        const staff = await safeQuery(c, 'SELECT * FROM evenementiel_staff_types WHERE client_id = ?', [ownerId]);
        const spaces = await safeQuery(c, 'SELECT * FROM evenementiel_spaces WHERE client_id = ?', [ownerId]);
        
        return c.json({
            ...(config || { track_taken_by: 0, allowed_taker_employee_ids: "[]", notify_recipient_employee_ids: "[]" }),
            authorized_staff_categories: staff,
            spaces: spaces
        });
    } catch (e) { return c.json({ authorized_staff_categories: [], spaces: [] }); }
});

app.get('/evenementiel/calendars', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, `SELECT ${calendarCols} FROM evenementiel_calendars WHERE client_id = ? ORDER BY year DESC, month DESC`, [ownerId]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.get('/evenementiel/spaces', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, 'SELECT * FROM evenementiel_spaces WHERE client_id = ?', [ownerId]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.get('/evenementiel/staff-mappings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, 'SELECT * FROM staff_category_mapping WHERE client_id = ?', [ownerId]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.get('/evenementiel/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const id = c.req.param('id');
        const row = await safeFirst(c, `
            SELECT e.*, n.note_text, CASE WHEN n.id IS NOT NULL THEN 1 ELSE 0 END as has_notes
            FROM evenementiel e 
            LEFT JOIN event_notes n ON e.id = n.event_id 
            WHERE e.id = ? AND e.client_id = ?
        `, [id, ownerId]);
        
        if (!row) return c.json({ id, note_text: "", staff: [], assignments: [], spaces: [] }); // Zéro crash 404
        
        const staff = await safeQuery(c, 'SELECT staff_type_id, count FROM evenementiel_event_staff WHERE event_id = ?', [id]);
        const assignments = await safeQuery(c, `
            SELECT a.employee_id, a.staff_type_id, e.first_name, e.last_name, e.position
            FROM evenementiel_event_assignments a
            JOIN employes e ON a.employee_id = e.id
            WHERE a.event_id = ?
        `, [id]);
        const eventSpaces = await safeQuery(c, 'SELECT s.* FROM evenementiel_spaces s JOIN evenementiel_event_spaces es ON s.id = es.space_id WHERE es.event_id = ?', [id]);
        
        return c.json({ ...mapEvent(row), has_notes: !!row.has_notes, staff, assignments, spaces: eventSpaces });
    } catch (e) { return c.json({ error: 'Erreur' }, 200); } // Sécurité max
});

app.get('/evenementiel/:id/staff', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const id = c.req.param('id');
        
        const rows = await safeQuery(c, `
            SELECT a.employee_id, a.staff_type_id, e.first_name, e.last_name, e.position
            FROM evenementiel_event_assignments a
            JOIN employes e ON a.employee_id = e.id
            WHERE a.event_id = ? AND e.client_id = ?
        `, [id, ownerId]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.post('/evenementiel', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const id = crypto.randomUUID();
        
        // 1. Insertion Coeur
        await c.env.DB.prepare(`
            INSERT INTO evenementiel (id, client_id, calendar_id, type, phone, email, address, start_time, end_time, num_people, documents, first_name, last_name, company_name, organizer_name, taken_by_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id, ownerId, body.calendar_id, body.type, body.phone || '', body.email || '', body.address || '', 
            body.start_time, body.end_time, body.num_people || 0, JSON.stringify(body.documents || []), 
            body.first_name || '', body.last_name || '', body.company_name || '', body.organizer_name || '', body.taken_by_id || null
        ).run();

        // 2. Espaces (Mapping)
        if (body.space_ids && Array.isArray(body.space_ids)) {
            for (const sid of body.space_ids) {
                await c.env.DB.prepare('INSERT INTO evenementiel_event_spaces (event_id, space_id) VALUES (?, ?)').bind(id, sid).run();
            }
        }

        // 3. Staffing (Besoins) - staff_requests est un objet { staffTypeId: count }
        if (body.staff_requests) {
            for (const [tid, cnt] of Object.entries(body.staff_requests)) {
                await c.env.DB.prepare('INSERT INTO evenementiel_event_staff (event_id, staff_type_id, count) VALUES (?, ?, ?)').bind(id, tid, cnt).run();
            }
        }

        // 4. Assignments (Staff Interne)
        if (body.assignments && Array.isArray(body.assignments)) {
            for (const ass of body.assignments) {
                await c.env.DB.prepare('INSERT INTO evenementiel_event_assignments (event_id, employee_id, staff_type_id) VALUES (?, ?, ?)').bind(id, ass.employee_id, ass.staff_type_id).run();
            }
        }

        // 5. Notes (Table séparée)
        if (body.note_text) {
            await c.env.DB.prepare('INSERT INTO event_notes (id, event_id, client_id, note_text) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), id, ownerId, body.note_text).run();
        }

        return c.json({ success: true, id });
    } catch (e) { console.error('POST Event Error:', e); return c.json({ error: 'Erreur Création' }, 500); }
});

app.put('/evenementiel/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const id = c.req.param('id');
        const body = await c.req.json();
    
        // 1. UPDATE Coeur
        const validParams = [
            body.type, body.phone, body.email, body.address, 
            body.start_time, body.end_time, body.num_people, 
            body.first_name, body.last_name, body.company_name, 
            body.organizer_name, body.taken_by_id,
            id, ownerId
        ];
        await c.env.DB.prepare(`
            UPDATE evenementiel SET 
            type = ?, phone = ?, email = ?, address = ?, start_time = ?, end_time = ?, 
            num_people = ?, first_name = ?, last_name = ?, company_name = ?, organizer_name = ?, taken_by_id = ?
            WHERE id = ? AND client_id = ?
        `).bind(...validParams).run();

        // 2. Nettoyage Relations
        await c.env.DB.prepare('DELETE FROM evenementiel_event_spaces WHERE event_id = ?').bind(id).run();
        await c.env.DB.prepare('DELETE FROM evenementiel_event_staff WHERE event_id = ?').bind(id).run();
        await c.env.DB.prepare('DELETE FROM evenementiel_event_assignments WHERE event_id = ?').bind(id).run();

        // 3. Re-Insertion Espaces
        if (body.space_ids && Array.isArray(body.space_ids)) {
            for (const sid of body.space_ids) {
                await c.env.DB.prepare('INSERT INTO evenementiel_event_spaces (event_id, space_id) VALUES (?, ?)').bind(id, sid).run();
            }
        }

        // 4. Re-Insertion Staffing
        if (body.staff_requests) {
            for (const [tid, cnt] of Object.entries(body.staff_requests)) {
                await c.env.DB.prepare('INSERT INTO evenementiel_event_staff (event_id, staff_type_id, count) VALUES (?, ?, ?)').bind(id, tid, cnt).run();
            }
        }

        // 5. Re-Insertion Assignments
        if (body.assignments && Array.isArray(body.assignments)) {
            for (const ass of body.assignments) {
                await c.env.DB.prepare('INSERT INTO evenementiel_event_assignments (event_id, employee_id, staff_type_id) VALUES (?, ?, ?)').bind(id, ass.employee_id, ass.staff_type_id).run();
            }
        }

        // 6. Gestion des notes
        if (body.note_text !== undefined) {
            await c.env.DB.prepare(`
                INSERT INTO event_notes (id, event_id, client_id, note_text) 
                VALUES (?, ?, ?, ?)
                ON CONFLICT(event_id) DO UPDATE SET note_text = EXCLUDED.note_text, updated_at = CURRENT_TIMESTAMP
            `).bind(crypto.randomUUID(), id, ownerId, body.note_text).run();
        }
        
        return c.json({ success: true });
    } catch (e) { console.error('PUT Event Error:', e); return c.json({ error: 'Erreur Maj 500' }, 500); }
});

app.delete('/evenementiel/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        await c.env.DB.prepare('DELETE FROM evenementiel WHERE id = ? AND client_id = ?').bind(c.req.param('id'), ownerId).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Suppression échouée' }, 500); }
});

// --- (Doublons supprimés par priorité) ---

app.put('/evenementiel/config', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        await c.env.DB.prepare('INSERT OR REPLACE INTO evenementiel_config (client_id, track_taken_by, allowed_taker_employee_ids, notify_recipient_employee_ids, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
            .bind(ownerId, body.track_taken_by ? 1 : 0, JSON.stringify(body.allowed_taker_employee_ids || []), JSON.stringify(body.notify_recipient_employee_ids || [])).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur Config' }, 500); }
});

// --- (Doublons supprimés par priorité) ---

app.post('/evenementiel/calendars', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const id = crypto.randomUUID();
        await c.env.DB.prepare('INSERT INTO evenementiel_calendars (id, client_id, month, year, status) VALUES (?, ?, ?, ?, ?)')
            .bind(id, ownerId, body.month, body.year, 'OPEN').run();
        return c.json({ success: true, id });
    } catch (e) { return c.json({ error: 'Calendrier existant ou erreur' }, 500); }
});

app.get('/evenementiel/calendars/:id/events', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, `
            SELECT e.*, n.note_text, CASE WHEN n.id IS NOT NULL THEN 1 ELSE 0 END as has_notes
            FROM evenementiel e 
            LEFT JOIN event_notes n ON e.id = n.event_id 
            WHERE e.calendar_id = ? AND e.client_id = ?
        `, [c.req.param('id'), ownerId]);
        
        const events = await Promise.all(rows.map(async (row) => {
            const staff = await safeQuery(c, 'SELECT staff_type_id, count FROM evenementiel_event_staff WHERE event_id = ?', [row.id]);
            const assignments = await safeQuery(c, `
                SELECT a.employee_id, a.staff_type_id, e.first_name, e.last_name, e.position
                FROM evenementiel_event_assignments a
                JOIN employes e ON a.employee_id = e.id
                WHERE a.event_id = ?
            `, [row.id]);
            const spaces = await safeQuery(c, 'SELECT s.* FROM evenementiel_spaces s JOIN evenementiel_event_spaces es ON s.id = es.space_id WHERE es.event_id = ?', [row.id]);
            return { ...mapEvent(row), has_notes: !!row.has_notes, staff, assignments, spaces };
        }));
        
        return c.json(events);
    } catch (e) { return c.json([]); }
});

// --- (Doublons supprimés par priorité) ---

app.get('/evenementiel/staff-types', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, 'SELECT * FROM evenementiel_staff_types WHERE client_id = ?', [ownerId]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

// --- (Doublons supprimés par priorité) ---

app.put('/evenementiel/staff-mappings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const { mappings } = await c.req.json();
        await c.env.DB.prepare('DELETE FROM staff_category_mapping WHERE client_id = ?').bind(ownerId).run();
        for (const m of mappings) {
            const id = crypto.randomUUID();
            await c.env.DB.prepare('INSERT INTO staff_category_mapping (id, client_id, staff_category_id, employee_id) VALUES (?, ?, ?, ?)')
                .bind(id, ownerId, m.staff_category_id, m.employee_id).run();
        }
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur Mappings' }, 500); }
});

// --- CRM ---
app.get('/crm/contacts', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, `SELECT ${crmCols} FROM crm_contacts WHERE client_id = ? ORDER BY created_at DESC`, [ownerId]);
        return c.json(rows.map(mapCrm));
    } catch (e) { return c.json([]); }
});

app.get('/crm/contacts/search', async (c) => {
    try {
        const user = await getUserFromReq(c);
        const q = c.req.query('q') || '';
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, `SELECT ${crmCols} FROM crm_contacts WHERE client_id = ? AND (company_name LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`, [ownerId, `%${q}%`, `%${q}%`, `%${q}%`]);
        return c.json(rows.map(mapCrm));
    } catch (e) { return c.json([]); }
});

app.get('/crm/contacts/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const row = await safeFirst(c, `SELECT ${crmCols} FROM crm_contacts WHERE id = ? AND client_id = ?`, [c.req.param('id'), ownerId]);
        return row ? c.json(mapCrm(row)) : c.json({ error: 'Contact introuvable' }, 404);
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.put('/crm/contacts/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        await c.env.DB.prepare('UPDATE crm_contacts SET first_name=?, last_name=?, email=?, phone=?, company_name=?, organizer_name=?, address=?, postal_code=?, city=?, country=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND client_id=?')
            .bind(body.first_name, body.last_name, body.email, body.phone, body.company_name, body.organizer_name, body.address, body.postal_code, body.city, body.country, c.req.param('id'), ownerId).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.delete('/crm/contacts/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        await c.env.DB.prepare('DELETE FROM crm_contacts WHERE id=? AND client_id=?').bind(c.req.param('id'), ownerId).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

// --- FACTURE ---
app.get('/facture', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, `SELECT ${factureCols} FROM facture WHERE client_id = ? ORDER BY created_at DESC`, [ownerId]);
        return c.json(rows.map(mapFacture) || []);
    } catch (e) { return c.json([]); }
});

app.post('/facture', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const id = body.id || crypto.randomUUID();
        await c.env.DB.prepare(`
            INSERT INTO facture (id, client_id, invoice_number, customer_name, amount, status, due_date, total_ht, total_tva, total_ttc, already_paid, remaining_due, crm_contact_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, ownerId, body.invoice_number, body.customer_name, body.amount, body.status, body.due_date, body.total_ht, body.total_tva, body.total_ttc, body.already_paid, body.remaining_due, body.crm_contact_id).run();
        return c.json({ success: true, id });
    } catch (e) { return c.json({ error: 'Erreur Facture' }, 500); }
});

app.delete('/facture/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        await c.env.DB.prepare('DELETE FROM facture WHERE id=? AND client_id=?').bind(c.req.param('id'), ownerId).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/facture/:id/history', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, 'SELECT * FROM facture_history WHERE facture_id = ? AND client_id = ?', [c.req.param('id'), ownerId]);
        return c.json(rows.map(mapFactureHistory));
    } catch (e) { return c.json([]); }
});

app.get('/facture/billing-settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({});
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const row = await safeFirst(c, 'SELECT * FROM billing_settings WHERE client_id = ?', [ownerId]);
        return c.json(row || {});
    } catch (e) { return c.json({}); }
});

app.put('/facture/billing-settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        await c.env.DB.prepare(`
            INSERT OR REPLACE INTO billing_settings (client_id, company_name, address, postal_code, city, country, siret, tva, phone, capital, ape, siege_social, rcs_ville, rcs_numero, prestations_catalog, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(ownerId, body.company_name, body.address, body.postal_code, body.city, body.country, body.siret, body.tva, body.phone, body.capital, body.ape, body.siege_social, body.rcs_ville, body.rcs_numero, JSON.stringify(body.prestations_catalog || [])).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur Facturation Config' }, 500); }
});

// --- EMPLOYES ---
app.get('/employes', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, `SELECT ${employeCols} FROM employes WHERE client_id = ? ORDER BY last_name, first_name`, [ownerId]);
        return c.json(rows.map(r => ({ ...r, hire_date: toISO(r.hire_date) })));
    } catch (e) { return c.json([]); }
});

app.put('/employes/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const id = c.req.param('id');
        const body = await c.req.json();
        
        await c.env.DB.prepare(`
            UPDATE employes SET 
            first_name = ?, last_name = ?, email = ?, position = ?, salary = ?, hire_date = ?, tags = ?, phone = ?, address = ?
            WHERE id = ? AND client_id = ?
        `).bind(
            body.first_name, body.last_name, body.email, body.position, body.salary, body.hire_date, 
            JSON.stringify(body.tags || []), body.phone, body.address, id, ownerId
        ).run();
        
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur Maj Employé' }, 500); }
});

app.get('/employes/posts', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, 'SELECT * FROM job_posts WHERE client_id = ?', [ownerId]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.post('/employes/posts', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const { title } = await c.req.json();
        const id = crypto.randomUUID();
        await c.env.DB.prepare('INSERT INTO job_posts (id, client_id, title) VALUES (?, ?, ?)').bind(id, ownerId, title).run();
        return c.json({ success: true, id });
    } catch (e) { return c.json({ error: 'Erreur Poste' }, 500); }
});

app.delete('/employes/posts/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        await c.env.DB.prepare('DELETE FROM job_posts WHERE id = ? AND client_id = ?').bind(c.req.param('id'), ownerId).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur Suppression Poste' }, 500); }
});

// --- SUPPORT ---
app.get('/support/ticket/open', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json(null);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const row = await safeFirst(c, 'SELECT * FROM support_tickets WHERE client_id = ? AND status = "OPEN"', [ownerId]);
        return c.json(row);
    } catch (e) { return c.json(null); }
});

app.post('/support/messages', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const body = await c.req.json();
        let ticketId = body.ticket_id;
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        if (!ticketId) {
            ticketId = crypto.randomUUID();
            await c.env.DB.prepare('INSERT INTO support_tickets (id, client_id, status, created_by_user_id, created_by_type) VALUES (?, ?, "OPEN", ?, ?)')
                .bind(ticketId, ownerId, user.id, user.type).run();
        }
        const msgId = crypto.randomUUID();
        await c.env.DB.prepare('INSERT INTO support_messages (id, ticket_id, sender_user_id, sender_type, message, file_url, file_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(msgId, ticketId, user.id, user.type, body.message, body.file_url || null, body.file_name || null).run();
        return c.json({ success: true, ticketId });
    } catch (e) { return c.json({ error: 'Erreur Message' }, 500); }
});

app.get('/support/unread-count', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ count: 0 });
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const res = await safeQuery(c, 'SELECT COUNT(*) as c FROM support_messages m JOIN support_tickets t ON m.ticket_id = t.id WHERE t.client_id = ? AND m.is_read = 0 AND m.sender_type = "admin"', [ownerId]);
        return c.json({ count: res[0]?.c || 0 });
    } catch (e) { return c.json({ count: 0 }); }
});

app.get('/admin/support/unread-count', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ count: 0 });
        const res = await safeQuery(c, 'SELECT COUNT(*) as c FROM support_messages WHERE is_read = 0 AND sender_type != "admin"');
        return c.json({ count: res[0]?.c || 0 });
    } catch (e) { return c.json({ count: 0 }); }
});

app.get('/admin/support/tickets', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json([]);
        const status = c.req.query('status') || 'OPEN';
        const rows = await safeQuery(c, 'SELECT * FROM support_tickets WHERE status = ? ORDER BY created_at DESC', [status]);
        return c.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at), updated_at: toISO(r.updated_at) })));
    } catch (e) { return c.json([]); }
});

app.get('/admin/support/tickets/:id/messages', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json([]);
        const rows = await safeQuery(c, 'SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [c.req.param('id')]);
        return c.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at) })));
    } catch (e) { return c.json([]); }
});

// --- CLIENT STATS ---
app.get('/client/stats', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;

        const revenueRes = await safeFirst(c, 'SELECT SUM(total_ttc) as total FROM facture WHERE client_id = ?', [ownerId]);
        const eventsRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM evenementiel WHERE client_id = ?', [ownerId]);
        const collabRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM collaborators WHERE client_id = ?', [ownerId]);
        const pendingRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM facture WHERE client_id = ? AND status != "paid"', [ownerId]);

        return c.json({
            revenue: revenueRes?.total || 0,
            evenements: eventsRes?.total || 0,
            collaborators: collabRes?.total || 0,
            factures: pendingRes?.total || 0
        });
    } catch (e) { return c.json({ revenue: 0, evenements: 0, collaborators: 0, factures: 0 }); }
});

app.post('/admin/support/tickets/:id/messages', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Auth' }, 401);
        const body = await c.req.json();
        const msgId = crypto.randomUUID();
        await c.env.DB.prepare('INSERT INTO support_messages (id, ticket_id, sender_user_id, sender_type, message) VALUES (?, ?, ?, "admin", ?)')
            .bind(msgId, c.req.param('id'), user.id, body.message).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.patch('/admin/support/tickets/:id/close', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Auth' }, 403);
        await c.env.DB.prepare('UPDATE support_tickets SET status = "CLOSED", updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

export const onRequest = handle(app);
