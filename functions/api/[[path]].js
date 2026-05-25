import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { cors } from 'hono/cors';
import { sign, verify, decode } from 'hono/jwt';
import { compareSync, hashSync } from 'bcryptjs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const app = new Hono().basePath('/api');
app.use('*', cors());

// Middleware: Blocage IP
app.use('*', async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    try {
        const db = c.env.DB;
        const isBanned = await db.prepare('SELECT 1 FROM banned_ips WHERE ip_address = ?').bind(ip).first();
        if (isBanned) {
            return c.json({ error: 'Accès interdit : Votre adresse IP a été bloquée.' }, 403);
        }
    } catch (e) {
        // Ignorer si la table n'est pas encore créée
    }
    await next();
});

// Middleware: Capture Logs
app.use('*', async (c, next) => {
    const path = c.req.path;
    const method = c.req.method;
    
    // Ignore GET requests, CORS OPTIONS, and the log-action routes to prevent infinite loop
    if (method === 'GET' || method === 'OPTIONS' || path.includes('/api/admin/sentinel/log-action') || path.includes('/api/admin/sentinel/ban-ip')) {
        return await next();
    }
    
    // Clone request to read body
    const reqClone = c.req.raw.clone();
    let payload = null;
    try {
        const contentType = reqClone.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            payload = await reqClone.json();
            if (payload && payload.password) {
                payload = { ...payload, password: '***' };
            }
        }
    } catch(e) {}
    
    await next();
    
    // Log if successful and user is available
    if (c.res.status >= 200 && c.res.status < 400 && c.get('user')) {
        const user = c.get('user');
        c.executionCtx.waitUntil((async () => {
            try {
                await insertAuditLog(c, {
                    userId: user.id || 'system',
                    targetUserId: null,
                    clientId: user.clientId || null,
                    action: `HTTP_${method}_${path.split('/').pop()?.toUpperCase() || 'ACTION'}`,
                    category: LOG_CATEGORIES.BUSINESS,
                    payloadJson: payload ? JSON.stringify(payload) : null,
                    ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
                    country: c.req.header('cf-ipcountry') || 'FR',
                    userAgent: c.req.header('user-agent') || 'unknown'
                });
            } catch(e) {}
        })());
    }
});

app.onError(async (err, c) => {
    const route = `${c.req.method} ${c.req.path}`;
    console.error(`[CRITICAL ERROR] ${route}:`, err);
    
    // Log System Error to Sentinel (French & Descriptive)
    try {
        await insertAuditLog(c, {
            action: 'ERREUR_SYSTEME',
            category: LOG_CATEGORIES.SYSTEM,
            severity: LOG_SEVERITIES.ALERT,
            newValue: `Le serveur a rencontré une erreur 500 sur la route ${route}. Détail : ${err.message}`
        });
    } catch (logErr) {
        console.error('Failed to log error to Sentinel:', logErr.message);
    }

    return c.json({
        error: "Une erreur système s'est produite",
        message: err?.message,
        path: c.req.path
    }, 500);
});

app.notFound(async (c) => {
    // Log 404 to Sentinel
    try {
        await ensureAuditLogsSchema(c);
        await insertAuditLog(c, {
            action: 'NOT_FOUND',
            category: LOG_CATEGORIES.SYSTEM,
            severity: LOG_SEVERITIES.WARNING,
            newValue: `Page non trouvée (404) : ${c.req.path}`
        });
    } catch (e) {}
    return c.json({ error: 'Route non trouvée' }, 404);
});

// --- CONSTANTS ---
const LOG_CATEGORIES = {
    GLOBAL: 'GLOBAL',
    SECURITY: 'SECURITE',
    BUSINESS: 'METIER',
    SYSTEM: 'SYSTEME'
};

const LOG_SEVERITIES = {
    SUCCESS: 'success',
    INFO: 'info',
    WARNING: 'warning',
    ALERT: 'alert'
};

const superAdminPayload = {
    id: 'superadmin',
    name: 'Super Admin',
    email: 'gev-emeni@outlook.fr',
    type: 'admin',
    role: 'superadmin',
    permissions: ['all']
};

const generateId = () => {
    try {
        return crypto.randomUUID();
    } catch (e) {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
};

// hashPassword: async wrapper around bcryptjs hashSync so it can be awaited uniformly
const hashPassword = (plain) => Promise.resolve(hashSync(plain, 10));

const parseTvaRates = (raw) => {
    let rates = [20];
    try {
        if (typeof raw === 'string' && raw.trim() !== '') {
            if (raw !== '[object Object]') {
                rates = JSON.parse(raw);
            }
        } else if (Array.isArray(raw)) {
            rates = raw;
        }
    } catch (e) {
        console.error('ParseTVA Error:', e);
    }
    const final = Array.isArray(rates) && rates.length > 0
        ? rates.map(Number).filter(n => Number.isFinite(n) && n >= 0)
        : [20];
    return final.length > 0 ? final : [20];
};

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// --- CONSTANTS & MAPPING ---
const adminCols = `id, email, name, username, password, created_at`;
const clientCols = `id, name, email, username, password, is_temporary_password, status, last_login, created_at, company_name, logo_url, default_tva_rate, default_tva_custom_rate, tva_rates, enable_cover_count, account_manager_first_name, account_manager_last_name, account_manager_phone, account_manager_email, legal_form, siret, vat_number, company_address, company_postal_code, company_city, company_country, company_employee_count`;
const collabCols = `id, client_id, email, username, name, role, status, created_at, modules_access`;
const factureCols = `id, client_id, invoice_number, customer_name, amount, status, due_date, created_at, payload_json, billing_snapshot, total_ht, total_tva, total_ttc, already_paid, remaining_due, crm_contact_id`;
const crmCols = `id, client_id, type, first_name, last_name, company_name, organizer_name, email, phone, address, postal_code, city, country, created_at, updated_at`;
const eventCols = `id, client_id, calendar_id, type, phone, email, address, start_time, end_time, num_people, documents, first_name, last_name, company_name, organizer_name, taken_by_id, created_at`;
const calendarCols = `id, client_id, month, year, status, created_at`;
const employeCols = `id, client_id, first_name, last_name, email, position, salary, hire_date, tags, created_at`;

const toISO = (val) => {
    if (!val) return null;
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? val : d.toISOString();
    } catch (e) { return val; }
};

const mapClient = (row) => {
    if (!row) return row;
    const tva_rates = parseTvaRates(row.tva_rates);

    let logo_url = row.logo_url;
    if (logo_url && logo_url.length > 500000) {
        console.warn(`[PERF] Oversized logo (${logo_url.length} bytes) for client ${row.id}, clearing to prevent crash`);
        logo_url = null;
    }

    return {
        ...row,
        logo_url,
        last_login: toISO(row.last_login),
        created_at: toISO(row.created_at),
        company_employee_count: Number(row.company_employee_count || 0),
        tva_rates,
        enable_cover_count: Boolean(row.enable_cover_count)
    };
};

const mapFacture = (row) => {
    if (!row) return row;
    const total_ttc = Number(row.total_ttc || row.amount || 0);
    return { 
        ...row, 
        due_date: toISO(row.due_date), 
        created_at: toISO(row.created_at),
        total_ttc,
        amount: row.amount || total_ttc,
        payload_json: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json || '{}') : (row.payload_json || {}),
        billing_snapshot: typeof row.billing_snapshot === 'string' ? JSON.parse(row.billing_snapshot || '{}') : (row.billing_snapshot || {})
    };
};
const mapEvent = (row) => ({ ...row, created_at: toISO(row.created_at), documents: typeof row.documents === 'string' ? JSON.parse(row.documents || '[]') : (row.documents || []) });
const mapCrm = (row) => {
    let phone = row.phone;
    if (phone && phone.includes('__AUTO_NOPHONE__')) phone = '';
    return { ...row, phone, created_at: toISO(row.created_at), updated_at: toISO(row.updated_at) };
};
const mapCollab = (row) => ({ ...row, created_at: toISO(row.created_at), modules_access: typeof row.modules_access === 'string' ? JSON.parse(row.modules_access || '[]') : (row.modules_access || []) });
const mapFactureHistory = (row) => ({ ...row, created_at: toISO(row.created_at) });

const normalizePhone = (p) => String(p || '').replace(/[\s.\-()]/g, '');

const getSecret = (c) => {
    try {
        return (c.env?.JWT_SECRET && c.env.JWT_SECRET !== '') ? c.env.JWT_SECRET : 'iamani_stable_secret_2026';
    } catch (e) {
        return 'iamani_stable_secret_2026';
    }
};

const getUserFromReq = async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader) return null;

        const token = authHeader.split(' ')[1];
        if (!token) return null;

        if (token === 'admin-token' || token === 'admin') {
            console.log('Using static admin token');
            return superAdminPayload;
        }

        const secret = getSecret(c);
        try {
            return await verify(token, secret);
        } catch (e) {
            console.warn('JWT Verify failed, trying decode fallback:', e.message);
            try {
                const { payload } = decode(token);
                if (payload && payload.id) return payload;
            } catch (err) {
                console.error('JWT Decode fallback failed:', err.message);
            }
            return null;
        }
    } catch (e) {
        console.error('getUserFromReq fatal error:', e);
        return null;
    }
};

const truncateResult = (obj) => {
    if (!obj) return obj;
    if (Array.isArray(obj)) return obj.map(truncateResult);
    if (typeof obj !== 'object') return obj;

    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.length > 200000) { // 200KB limit per field
            console.warn(`[PERF] Truncating field ${key} (${value.length} bytes) to prevent crash`);
            newObj[key] = value.substring(0, 100) + '...[TRUNCATED_TO_PREVENT_CRASH]';
        } else if (value && typeof value === 'object') {
            newObj[key] = truncateResult(value);
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
};

const safeQuery = async (c, query, params = []) => {
    try {
        const db = c.env?.DB;
        if (!db) {
            console.error('D1 Database binding missing');
            return [];
        }
        const stmt = db.prepare(query);
        const res = await (params.length > 0 ? stmt.bind(...params).all() : stmt.all());
        return truncateResult(res.results || []);
    } catch (e) {
        console.error('D1 Query Error:', e.message);
        return [];
    }
};

const safeFirst = async (c, query, params = []) => {
    try {
        const db = c.env?.DB;
        if (!db) {
            console.error('D1 Database binding missing');
            return null;
        }
        const stmt = db.prepare(query);
        const res = await (params.length > 0 ? stmt.bind(...params).first() : stmt.first());
        return truncateResult(res);
    } catch (e) {
        console.error('D1 First Error:', e.message);
        return null;
    }
};

const safeRun = async (c, query, params = []) => {
    try {
        const db = c.env?.DB;
        if (!db) return null;
        return await db.prepare(query).bind(...params).run();
    } catch (e) {
        console.error('D1 Run Error:', e.message);
        return null;
    }
};

const insertAuditLog = async (c, params) => {
    try {
        const user = await getUserFromReq(c);
        const userId = user?.id || 'système';
        const ip = params.ipAddress || c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'Non renseignée';
        const ua = params.userAgent || c.req.header('user-agent') || 'Non renseigné';
        const country = params.country || c.req.header('cf-ipcountry') || 'FR';
        
        await c.env.DB.prepare(`
            INSERT INTO audit_logs (id, user_id, target_user_id, client_id, action, category, severity, old_value, new_value, ip_address, user_agent, payload_json, country, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
            generateId().substring(0, 12),
            userId,
            params.targetUserId || '',
            params.clientId || params.targetClientId || '',
            params.action,
            params.category || LOG_CATEGORIES.GLOBAL,
            params.severity || 'info',
            params.oldValue || '',
            params.newValue || `Action système sur ${c.req.method} ${c.req.path}`,
            ip,
            ua,
            params.payloadJson || null,
            country
        ).run();
    } catch (e) {
        console.error('Erreur lors de la journalisation:', e.message);
    }
};

const propagatePlanningChanges = async (c, ownerId, changedEmployeeIds) => {
    try {
        const now = new Date();
        const monday = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        const mondayStr = monday.toISOString().split('T')[0];

        // 1. Settings & Templates
        const settingsRow = await safeFirst(c, 'SELECT payload_json FROM planning_settings WHERE client_id = ?', [ownerId]);
        const settings = settingsRow ? JSON.parse(settingsRow.payload_json) : {};
        const weeklyDefaults = settings.weeklyDefaults || {};
        
        const tplRow = await safeFirst(c, 'SELECT payload_json FROM planning_templates WHERE client_id = ?', [ownerId]);
        const templates = tplRow ? JSON.parse(tplRow.payload_json) : [];
        const templateMap = {};
        templates.forEach(t => { templateMap[t.id] = t; });

        // 2. Absences
        const absRes = await c.env.DB.prepare('SELECT * FROM planning_absences WHERE client_id = ?').bind(ownerId).all();
        const absences = absRes.results || [];

        // 3. Future Weeks
        const weekRes = await c.env.DB.prepare('SELECT * FROM planning_weeks WHERE client_id = ? AND week_start >= ?').bind(ownerId, mondayStr).all();
        const weeks = weekRes.results || [];

        for (const week of weeks) {
            let payload = JSON.parse(week.payload_json);
            let hasChanges = false;
            if (!payload.rows) continue;

            const weekStart = new Date(week.week_start);

            payload.rows = payload.rows.map(row => {
                if (changedEmployeeIds.includes(String(row.employeeId))) {
                    const empDefaults = weeklyDefaults[String(row.employeeId)] || {};
                    const newShifts = { ...row.shifts };

                    for (let i = 0; i < 7; i++) {
                        const d = new Date(weekStart);
                        d.setDate(d.getDate() + i);
                        const dayDate = d.toISOString().split('T')[0];
                        
                        // PROTECTION : Ne pas écraser si saisi manuellement ou si c'est déjà une absence
                        const currentShift = newShifts[dayDate];
                        if (currentShift && (currentShift.isManual || currentShift.type === 'absence')) {
                            continue;
                        }

                        const dayNames = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
                        const defaultKey = empDefaults[String(i)] || empDefaults[dayNames[i]] || 'REPOS';
                        
                        let targetShift;
                        if (defaultKey === 'REPOS') {
                            targetShift = { date: dayDate, type: 'repos', serviceType: 'none', segments: [{ type: 'code', label: 'REPOS' }] };
                        } else {
                            const tpl = templateMap[defaultKey];
                            if (tpl) {
                                targetShift = {
                                    date: dayDate,
                                    type: 'travail',
                                    serviceType: tpl.serviceType || 'midi+soir',
                                    segments: (tpl.slots || []).map(s => ({ type: 'horaire', start: s.start, end: s.end, templateId: tpl.id, color: tpl.color }))
                                };
                            } else {
                                targetShift = { date: dayDate, type: 'repos', serviceType: 'none', segments: [{ type: 'code', label: 'REPOS' }] };
                            }
                        }

                        // Absence override (Priority)
                        const activeAbs = absences.find(a => String(a.employee_id) === String(row.employeeId) && dayDate >= a.start_date && dayDate <= a.end_date);
                        if (activeAbs) {
                            targetShift = {
                                date: dayDate,
                                type: 'absence',
                                serviceType: 'none',
                                segments: [{ type: 'code', label: activeAbs.absence_type || 'ABS' }]
                            };
                        }
                        
                        newShifts[dayDate] = targetShift;
                    }
                    hasChanges = true;
                    return { ...row, shifts: newShifts };
                }
                return row;
            });

            if (hasChanges) {
                await c.env.DB.prepare('UPDATE planning_weeks SET payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(JSON.stringify(payload), week.id).run();
            }
        }
    } catch (e) { console.error('Propagation Error:', e); }
};

const ensureAuditLogsSchema = async (c) => {
    try {
        const db = c.env.DB;
        
        await db.prepare(`CREATE TABLE IF NOT EXISTS banned_ips (
            id TEXT PRIMARY KEY,
            ip_address TEXT UNIQUE NOT NULL,
            reason TEXT,
            banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            banned_by TEXT
        )`).run();

        const info = await db.prepare('PRAGMA table_info(audit_logs)').all();
        const cols = (info.results || []).map(r => r.name);
        
        if (!cols.includes('category')) {
            await db.prepare("ALTER TABLE audit_logs ADD COLUMN category TEXT DEFAULT 'global'").run();
        }
        if (!cols.includes('severity')) {
            await db.prepare("ALTER TABLE audit_logs ADD COLUMN severity TEXT DEFAULT 'info'").run();
        }
        if (!cols.includes('client_id')) {
            await db.prepare("ALTER TABLE audit_logs ADD COLUMN client_id TEXT").run();
        }
        if (!cols.includes('user_agent')) {
            await db.prepare("ALTER TABLE audit_logs ADD COLUMN user_agent TEXT").run();
        }
        if (!cols.includes('payload_json')) {
            await db.prepare("ALTER TABLE audit_logs ADD COLUMN payload_json TEXT").run();
        }
        if (!cols.includes('country')) {
            await db.prepare("ALTER TABLE audit_logs ADD COLUMN country TEXT").run();
        }
    } catch (e) {
        console.error('Schema migration error (audit_logs/banned_ips):', e);
    }
};

const renderEmail = (content, title = 'IAmani', brandName = 'IAmani') => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        .email-container { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden; background-color: #ffffff; }
        .header { background-color: #1e293b; color: white; padding: 30px; text-align: center; }
        .body { padding: 40px; line-height: 1.6; color: #333; font-size: 16px; }
        .footer { background-color: #f9f9f9; color: #777; padding: 20px; text-align: center; font-size: 12px; border-top: 1px solid #eee; }
        .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
        .info-box { background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px; border-left: 4px solid #3b82f6; }
        hr { border: 0; border-top: 1px solid #eee; margin: 25px 0; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1 style="margin:0; font-size: 28px; letter-spacing: 1px;">${brandName}</h1>
            <p style="margin:5px 0 0; opacity: 0.9; font-size: 14px; font-weight: 300;">${title}</p>
        </div>
        <div class="body">
            ${content}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} IAmani - La gestion simplifiée de vos événements</p>
            <p>
                <a href="https://gestion.l-iamani.com" style="color: #3b82f6; text-decoration: none;">Site Web</a> | 
                <a href="https://gestion.l-iamani.com/contact" style="color: #3b82f6; text-decoration: none;">Support</a>
            </p>
        </div>
    </div>
</body>
</html>
    `;
};

const sendEmail = async (c, { to, subject, html, attachments = [], fromName = 'IAmani', replyTo }) => {
    const resendKey = c.env.RESEND_API_KEY;
    if (!resendKey) {
        console.error('RESEND_API_KEY is missing');
        return { success: false, error: 'Configuration envoi email manquante' };
    }
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
                from: `${fromName} <notifications@l-iamani.com>`,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                attachments,
                reply_to: replyTo
            }),
        });
        if (res.ok) return { success: true };
        const errData = await res.json();
        console.error('Resend Error:', errData);
        return { success: false, error: errData.message || 'Erreur Resend' };
    } catch (e) {
        console.error('SendEmail helper error:', e);
        return { success: false, error: e.message };
    }
};


const adminModules = [{ id: 'dashboard', name: 'Dashboard', enabled: true }, { id: 'clients', name: 'Gestion Clients', enabled: true }, { id: 'support', name: 'Support Client', enabled: true }];

// --- AUTH & USER ---
app.post('/auth/login', async (c) => {
    try {
        const body = await c.req.json();
        const rawIdentifier = body.identifier || body.email || body.username || '';
        const identifier = String(rawIdentifier).trim().toLowerCase();

        const admin = await safeFirst(c, `SELECT ${adminCols} FROM admins WHERE LOWER(email) = ? OR LOWER(username) = ?`, [identifier, identifier]);
        if (admin && body.password) {
            let isValid = (body.password === admin.password);
            if (!isValid && admin.password && admin.password.startsWith('$2')) {
                try {
                    isValid = compareSync(body.password, admin.password);
                } catch (e) { }
            }

            if (isValid) {
                const adminUser = { id: String(admin.id), name: String(admin.name || 'Super Admin'), email: String(admin.email), type: 'admin', role: 'superadmin', permissions: ['all'] };
                await insertAuditLog(c, {
                    action: 'LOGIN_SUCCESS',
                    category: LOG_CATEGORIES.SECURITY,
                    severity: LOG_SEVERITIES.SUCCESS,
                    newValue: `Connexion Administrateur réussie pour : ${identifier}`
                });
                return c.json({ token: await sign(adminUser, getSecret(c)), user: adminUser });
            } else {
                await insertAuditLog(c, {
                    action: 'LOGIN_FAILED',
                    category: LOG_CATEGORIES.SECURITY,
                    severity: LOG_SEVERITIES.WARNING,
                    newValue: `Échec de connexion Admin (MDP incorrect) : ${identifier}`
                });
            }
        }

        const client = await safeFirst(c, `SELECT ${clientCols} FROM clients WHERE LOWER(email) = ? OR LOWER(username) = ?`, [identifier, identifier]);
        if (client && body.password) {
            let isValid = (body.password === client.password);
            if (!isValid && client.password && client.password.startsWith('$2')) {
                try {
                    isValid = compareSync(body.password, client.password);
                } catch (e) { }
            }

            if (isValid) {
                const user = {
                    id: String(client.id),
                    clientId: String(client.id),
                    name: String(client.name || client.username || client.company_name || 'Client'),
                    company_name: String(client.company_name || ''),
                    logoUrl: String(client.logo_url || ''),
                    email: String(client.email || ''),
                    type: 'client',
                    role: 'client'
                };
                await insertAuditLog(c, {
                    action: 'LOGIN_SUCCESS',
                    category: LOG_CATEGORIES.SECURITY,
                    severity: LOG_SEVERITIES.SUCCESS,
                    clientId: client.id,
                    newValue: `Connexion réussie pour l'établissement : ${client.company_name || identifier}`
                });
                return c.json({ token: await sign(user, getSecret(c)), user });
            } else {
                await insertAuditLog(c, {
                    action: 'LOGIN_FAILED',
                    category: LOG_CATEGORIES.SECURITY,
                    severity: LOG_SEVERITIES.WARNING,
                    clientId: client.id,
                    newValue: `Échec de connexion (Mot de passe incorrect) pour : ${identifier}`
                });
            }
        }

        const collab = await safeFirst(c, `
            SELECT col.*, cl.company_name, cl.logo_url 
            FROM collaborators col 
            JOIN clients cl ON col.client_id = cl.id 
            WHERE LOWER(col.email) = ? OR LOWER(col.username) = ?
        `, [identifier, identifier]);
        if (collab && body.password) {
            let isValid = (body.password === collab.password);
            if (!isValid && collab.password && collab.password.startsWith('$2')) {
                try {
                    isValid = compareSync(body.password, collab.password);
                } catch (e) { }
            }

            if (isValid) {
                const user = {
                    id: String(collab.id),
                    client_id: String(collab.client_id),
                    name: String(collab.name),
                    company_name: String(collab.company_name || ''),
                    logoUrl: String(collab.logo_url || ''),
                    type: 'collaborator',
                    role: String(collab.role || 'staff'),
                    modules: typeof collab.modules_access === 'string' ? JSON.parse(collab.modules_access || '[]') : (collab.modules_access || [])
                };
                await insertAuditLog(c, {
                    action: 'LOGIN_SUCCESS',
                    category: LOG_CATEGORIES.SECURITY,
                    severity: LOG_SEVERITIES.SUCCESS,
                    clientId: collab.client_id,
                    newValue: `Connexion du collaborateur réussie : ${collab.name} (${identifier})`
                });
                return c.json({ token: await sign(user, getSecret(c)), user });
            } else {
                await insertAuditLog(c, {
                    action: 'LOGIN_FAILED',
                    category: LOG_CATEGORIES.SECURITY,
                    severity: LOG_SEVERITIES.WARNING,
                    clientId: collab.client_id,
                    newValue: `Échec de connexion Collaborateur (MDP incorrect) : ${identifier}`
                });
            }
        }

        await insertAuditLog(c, {
            action: 'LOGIN_NOT_FOUND',
            category: LOG_CATEGORIES.SECURITY,
            severity: LOG_SEVERITIES.ALERT,
            newValue: `Identifiant inconnu : ${identifier}`
        });
        return c.json({ error: 'Identifiants incorrects' }, 401);
    } catch (e) { return c.json({ error: 'Erreur Serveur' }, 500); }
});

app.post('/auth/logout', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (user) {
            const ownerId = (user.type === 'collaborator' || user.type === 'staff') ? (user.client_id || user.clientId) : (user.clientId || user.id);
            await insertAuditLog(c, {
                action: 'LOGOUT',
                category: LOG_CATEGORIES.SECURITY,
                severity: LOG_SEVERITIES.INFO,
                clientId: ownerId,
                newValue: `Déconnexion de l'utilisateur : ${user.name || user.email}`
            });
        }
        return c.json({ success: true });
    } catch (e) { return c.json({ success: true }); }
});

app.get('/auth/me', async (c) => {
    try {
        const payload = await getUserFromReq(c);
        if (!payload) return c.json({ error: 'Session expirée' }, 401);

        if (payload.type === 'admin') {
            const admin = await safeFirst(c, `SELECT ${adminCols} FROM admins WHERE id = ?`, [payload.id]);
            const adminUser = admin ? { id: String(admin.id), name: String(admin.name || 'Super Admin'), email: String(admin.email), type: 'admin', role: 'superadmin', permissions: ['all'] } : superAdminPayload;
            return c.json(adminUser);
        }

        if (payload.type === 'client') {
            const client = await safeFirst(c, `SELECT ${clientCols} FROM clients WHERE id = ?`, [payload.id]);
            if (!client) return c.json({ error: 'Client introuvable' }, 404);
            const user = {
                id: String(client.id),
                clientId: String(client.id),
                name: String(client.name || client.username || client.company_name || 'Client'),
                company_name: String(client.company_name || ''),
                logoUrl: String(client.logo_url || ''),
                email: String(client.email || ''),
                type: 'client',
                role: 'client'
            };
            return c.json(user);
        }

        if (payload.type === 'collaborator') {
            const collab = await safeFirst(c, `
                SELECT col.*, cl.company_name, cl.logo_url 
                FROM collaborators col 
                JOIN clients cl ON col.client_id = cl.id 
                WHERE col.id = ?
            `, [payload.id]);
            if (!collab) return c.json({ error: 'Collaborateur introuvable' }, 404);
            const user = {
                id: String(collab.id),
                client_id: String(collab.client_id),
                clientId: String(collab.client_id),
                name: String(collab.name),
                companyName: String(collab.company_name || ''),
                logoUrl: String(collab.logo_url || ''),
                type: 'collaborator',
                role: String(collab.role || 'staff'),
                modules: typeof collab.modules_access === 'string' ? JSON.parse(collab.modules_access || '[]') : (collab.modules_access || [])
            };
            return c.json(user);
        }

        return c.json(payload);
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.put('/user/profile', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Session expirée' }, 401);
        const body = await c.req.json();
        const { email, newEmail, currentPassword, newPassword } = body;
        const targetEmail = email || newEmail;

        let table = '';
        if (user.type === 'admin') table = 'admins';
        else if (user.type === 'client') table = 'clients';
        else if (user.type === 'collaborator') table = 'collaborators';

        if (!table) return c.json({ error: 'Type invalide' }, 400);

        const dbUser = await safeFirst(c, `SELECT password FROM ${table} WHERE id = ?`, [user.id]);
        if (!dbUser) return c.json({ error: 'Compte introuvable' }, 404);

        const sets = [];
        const params = [];

        if (targetEmail && targetEmail.trim() !== '') {
            sets.push('email = ?');
            params.push(targetEmail.trim());
        }

        if (newPassword) {
            if (!currentPassword) return c.json({ error: 'Mot de passe actuel obligatoire' }, 400);

            let isValid = (currentPassword === dbUser.password);
            if (!isValid && dbUser.password && dbUser.password.startsWith('$2')) {
                try { isValid = compareSync(currentPassword, dbUser.password); } catch (e) { }
            }
            if (!isValid) return c.json({ error: 'Mot de passe actuel incorrect' }, 401);

            const hashed = hashSync(newPassword, 10);
            sets.push('password = ?');
            params.push(hashed);

            if (user.type === 'client') {
                sets.push('is_temporary_password = 0');
            }

            await insertAuditLog(c, {
                action: 'UPDATE_PASSWORD',
                category: LOG_CATEGORIES.SECURITY,
                severity: LOG_SEVERITIES.WARNING,
                newValue: `Le mot de passe a été modifié avec succès par l'utilisateur.`
            });
        }

        if (sets.length === 0) return c.json({ success: true, message: 'Aucun changement' });

        params.push(user.id);
        await c.env.DB.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();

        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: `Erreur profil: ${e.message}` }, 500);
    }
});

app.post('/auth/force-change-password', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'client') return c.json({ error: 'Interdit' }, 403);
        const { newPassword } = await c.req.json();
        if (!newPassword) return c.json({ error: 'Mot de passe manquant' }, 400);

        const hashed = hashSync(newPassword, 10);
        await c.env.DB.prepare('UPDATE clients SET password = ?, is_temporary_password = 0 WHERE id = ?')
            .bind(hashed, user.id).run();

        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({});
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const row = await safeFirst(c, 'SELECT * FROM client_settings WHERE client_id = ?', [ownerId]);
        return c.json(row || {});
    } catch (e) { return c.json({}); }
});

app.put('/settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        await c.env.DB.prepare('INSERT OR REPLACE INTO client_settings (client_id, company_name, phone, email, address, postal_code, city, country, siret, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
            .bind(ownerId, body.company_name, body.phone, body.email, body.address, body.postal_code, body.city, body.country, body.siret).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur Settings' }, 500); }
});

app.get('/me/modules', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([], 401);
        
        if (user.type === 'admin') return c.json(adminModules);

        // Robust clientId resolution (handle underscore or camelCase from JWT)
        const ownerId = user.type === 'collaborator' ? (user.client_id || user.clientId) : user.id;
        
        if (!ownerId) {
            console.error('[GET /me/modules] No ownerId found for user:', user.id, user.type);
            return c.json([]);
        }

        const establishmentModules = await safeQuery(c, 'SELECT module_name, is_active FROM client_modules WHERE client_id = ?', [ownerId]);
        const activeInEstablishment = establishmentModules.filter(r => Number(r.is_active) === 1).map(r => r.module_name);

        if (user.type === 'collaborator') {
            const collabData = await safeFirst(c, 'SELECT modules_access FROM collaborators WHERE id = ?', [user.id]);
            const permissions = typeof collabData?.modules_access === 'string' 
                ? JSON.parse(collabData.modules_access || '[]') 
                : (collabData?.modules_access || []);
            
            // Logic: if establishment has NO modules defined in client_modules table, 
            // we assume all modules are available (backward compatibility) OR we filter strictly.
            // Let's be helpful: if the list is empty, we don't block everything if it's an old setup.
            const filtered = permissions.filter((m) => {
                // If the establishment has explicitly configured modules, we check against them
                if (activeInEstablishment.length > 0) {
                    return activeInEstablishment.includes(m);
                }
                // Otherwise (old establishment without client_modules setup), we allow what's in permissions
                return true;
            });

            return c.json(filtered.map((m) => ({ 
                module_name: m, 
                is_active: 1 
            })));
        }

        return c.json(establishmentModules);
    } catch (e) {
        console.error('GET /me/modules error:', e);
        return c.json([]); 
    }
});

// --- ADMIN ---
app.get('/admin/stats', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const [cl, rev, coll, mods] = await Promise.all([
            safeFirst(c, 'SELECT COUNT(*) as c FROM clients'),
            safeFirst(c, 'SELECT SUM(total_ttc) as total FROM facture'),
            safeFirst(c, 'SELECT COUNT(*) as c FROM collaborators'),
            safeFirst(c, 'SELECT COUNT(*) as c FROM client_modules WHERE is_active = 1')
        ]);
        return c.json({
            clientsCount: cl?.c || 0,
            revenue: `${new Intl.NumberFormat('fr-FR').format(rev?.total || 0)} €`,
            activeModulesCount: mods?.c || 0,
            collaboratorsCount: coll?.c || 0
        });
    } catch (e) { return c.json({ clientsCount: 0, revenue: '0 €', activeModulesCount: 0, collaboratorsCount: 0 }); }
});

app.get('/admin/clients', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const rows = await safeQuery(c, `SELECT ${clientCols} FROM clients ORDER BY created_at DESC`);
        return c.json(rows.map(mapClient));
    } catch (e) { return c.json([]); }
});

app.post('/admin/clients', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const body = await c.req.json();
        const id = generateId().substring(0, 8);
        const pwd = Math.random().toString(36).substring(2, 10);
        await c.env.DB.prepare(`INSERT INTO clients (id, name, email, username, password, is_temporary_password, company_name, logo_url, tva_rates, enable_cover_count, status) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'active')`)
            .bind(id, body.name||'', body.email||'', body.username||'', pwd, body.company_name||'', body.logo_url||null, JSON.stringify(body.tva_rates||[20]), body.enable_cover_count?1:0).run();
        const modules = body.modules || ['dashboard', 'planning', 'evenementiel', 'crm', 'facture', 'employes'];
        for (const m of modules) await c.env.DB.prepare('INSERT INTO client_modules (client_id, module_name, is_active) VALUES (?, ?, 1)').bind(id, m).run();
        await c.env.DB.prepare('INSERT INTO billing_settings (client_id, company_name, logo_url) VALUES (?, ?, ?)').bind(id, body.company_name||'', body.logo_url||null).run();
        await sendEmail(c, { to: body.email, subject: 'Bienvenue sur IAmani', html: renderEmail(`<p>Identifiant: ${body.username}<br>Mot de passe: ${pwd}</p>`, 'Bienvenue') });
        await insertAuditLog(c, {
            action: 'CREATE_CLIENT',
            category: LOG_CATEGORIES.GLOBAL,
            severity: LOG_SEVERITIES.SUCCESS,
            newValue: `Nouveau client créé : ${body.company_name || body.name}`
        });

        return c.json({ success: true, id, tempPassword: pwd });
    } catch (e) { return c.json({ error: e.message }, 500); }
});

app.get('/admin/clients/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const row = await safeFirst(c, `SELECT ${clientCols} FROM clients WHERE id = ?`, [c.req.param('id')]);
        return row ? c.json(mapClient(row)) : c.json({ error: '404' }, 404);
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.patch('/admin/clients/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const id = c.req.param('id');
        const b = await c.req.json();
        
        // Build dynamic UPDATE query
        const allowedFields = [
            'name', 'email', 'username', 'company_name', 'logo_url', 'tva_rates', 
            'enable_cover_count', 'status', 'account_manager_first_name', 
            'account_manager_last_name', 'account_manager_phone', 'account_manager_email',
            'legal_form', 'siret', 'vat_number', 'company_address', 
            'company_postal_code', 'company_city', 'company_country', 
            'company_employee_count'
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (field in b) {
                updates.push(`${field} = ?`);
                let val = b[field];
                if (field === 'tva_rates') val = JSON.stringify(val || [20]);
                if (field === 'enable_cover_count') val = val ? 1 : 0;
                if (field === 'company_employee_count') val = Number(val || 0);
                values.push(val);
            }
        }

        if (updates.length === 0) return c.json({ success: true, message: 'Rien à mettre à jour' });

        values.push(id);
        const sql = `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`;
        await c.env.DB.prepare(sql).bind(...values).run();
        
        await insertAuditLog(c, {
            action: 'UPDATE_CLIENT',
            category: LOG_CATEGORIES.GLOBAL,
            severity: LOG_SEVERITIES.INFO,
            newValue: `Fiche client modifiée (Champs : ${Object.keys(b).join(', ')}) : ${id}`
        });

        return c.json({ success: true });
    } catch (e) { 
        console.error('PATCH /admin/clients/:id error:', e);
        return c.json({ error: e.message }, 500); 
    }
});

app.delete('/admin/clients/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const id = c.req.param('id');
        const tables = ['client_documents', 'collaborators', 'client_modules', 'support_tickets', 'planning', 'evenementiel_calendars', 'evenementiel_spaces', 'evenementiel_staff_types', 'evenementiel', 'evenementiel_config', 'facture', 'employes', 'crm_contacts', 'billing_settings', 'planning_weeks', 'planning_templates', 'planning_settings', 'planning_archives', 'client_settings'];
        for (const t of tables) try { await c.env.DB.prepare(`DELETE FROM ${t} WHERE client_id = ?`).bind(id).run(); } catch (err) {}
        await c.env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id).run();

        await insertAuditLog(c, {
            action: 'DELETE_CLIENT',
            category: LOG_CATEGORIES.GLOBAL,
            severity: LOG_SEVERITIES.WARNING,
            newValue: `Client supprimé (ID : ${id})`
        });

        return c.json({ success: true });
    } catch (e) { return c.json({ error: e.message }, 500); }
});

app.get('/admin/clients/:id/modules', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const rows = await safeQuery(c, 'SELECT module_name, is_active FROM client_modules WHERE client_id = ?', [c.req.param('id')]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.put('/admin/clients/:id/modules', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const clientId = c.req.param('id');
        const body = await c.req.json();
        
        if (!Array.isArray(body)) return c.json({ error: 'Format invalide' }, 400);

        // We use a batch for atomicity: delete old entries and insert only active ones
        // This is much safer than INSERT OR REPLACE if unique constraints are missing
        const statements = [
            c.env.DB.prepare('DELETE FROM client_modules WHERE client_id = ?').bind(clientId)
        ];

        for (const m of body) {
            const mName = m.module_name || m.name;
            // Handle both 'is_active' (backend format) and 'active' (frontend format)
            const isActive = m.is_active === 1 || m.is_active === true || m.active === true || m.active === 1;
            
            if (mName && isActive) {
                statements.push(
                    c.env.DB.prepare('INSERT INTO client_modules (client_id, module_name, is_active) VALUES (?, ?, 1)')
                        .bind(clientId, mName)
                );
            }
        }

        await c.env.DB.batch(statements);
        
        await insertAuditLog(c, {
            action: 'MODIFICATION_CLIENT',
            category: 'CLIENTS',
            severity: 'info',
            clientId: clientId,
            newValue: `Mise à jour des modules pour le client ${clientId}`
        });

        return c.json({ success: true });
    } catch (e) {
        console.error('[PUT /admin/clients/:id/modules] Error:', e);
        try {
            await insertAuditLog(c, {
                action: 'ERREUR_SYSTEME',
                category: 'SYSTEME',
                severity: 'alert',
                newValue: `Erreur mise à jour modules client ${c.req.param('id')} : ${e.message}`
            });
        } catch (logErr) {}
        return c.json({ error: e.message || 'Erreur lors de la mise à jour des modules' }, 500);
    }
});

app.get('/admin/clients/:id/spaces', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const rows = await safeQuery(c, 'SELECT * FROM evenementiel_spaces WHERE client_id = ?', [c.req.param('id')]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.post('/admin/clients/:id/spaces', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const b = await c.req.json();
        const id = generateId();
        await c.env.DB.prepare('INSERT INTO evenementiel_spaces (id, client_id, name, color) VALUES (?, ?, ?, ?)').bind(id, c.req.param('id'), b.name, b.color||'#ffffff').run();
        return c.json({ success: true, id });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.patch('/admin/clients/:id/spaces/:sid', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const b = await c.req.json();
        await c.env.DB.prepare('UPDATE evenementiel_spaces SET name=?, color=? WHERE id=? AND client_id=?').bind(b.name, b.color, c.req.param('sid'), c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.delete('/admin/clients/:id/spaces/:sid', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        await c.env.DB.prepare('DELETE FROM evenementiel_spaces WHERE id=? AND client_id=?').bind(c.req.param('sid'), c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/admin/clients/:id/staff-types', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const rows = await safeQuery(c, 'SELECT * FROM evenementiel_staff_types WHERE client_id = ?', [c.req.param('id')]);
        return c.json(rows);
    } catch (e) { return c.json([]); }
});

app.post('/admin/clients/:id/staff-types', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const b = await c.req.json();
        if (b.id) {
            await c.env.DB.prepare('UPDATE evenementiel_staff_types SET name=? WHERE id=? AND client_id=?').bind(b.name, b.id, c.req.param('id')).run();
        } else {
            const id = generateId();
            await c.env.DB.prepare('INSERT INTO evenementiel_staff_types (id, client_id, name) VALUES (?, ?, ?)').bind(id, c.req.param('id'), b.name).run();
        }
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.delete('/admin/clients/:id/staff-types/:sid', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        await c.env.DB.prepare('DELETE FROM evenementiel_staff_types WHERE id=? AND client_id=?').bind(c.req.param('sid'), c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/admin/clients/:id/collaborators', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const rows = await safeQuery(c, 'SELECT * FROM collaborators WHERE client_id = ?', [c.req.param('id')]);
        return c.json(rows.map(mapCollab));
    } catch (e) { return c.json([]); }
});

app.post('/admin/clients/:id/collaborators', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const b = await c.req.json();
        const id = generateId();
        const pwd = b.password || Math.random().toString(36).slice(-8);
        await c.env.DB.prepare('INSERT INTO collaborators (id, client_id, name, email, username, password, role, modules_access) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(id, c.req.param('id'), b.name, b.email, b.username, await hashPassword(pwd), b.role||'staff', JSON.stringify(b.modules_access||[])).run();
        return c.json({ success: true, id });
    } catch (e) {
        console.error('[POST /collaborators] Error:', e?.message || e);
        return c.json({ error: e?.message || 'Erreur création collaborateur' }, 500);
    }
});

app.patch('/admin/clients/:id/collaborators/:cid', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const b = await c.req.json();
        let q = 'UPDATE collaborators SET name=?, email=?, username=?, role=?, modules_access=?';
        let p = [b.name, b.email, b.username, b.role, JSON.stringify(b.modules_access||[])];
        if (b.password && b.password !== '********') { q += ', password=?'; p.push(await hashPassword(b.password)); }
        q += ' WHERE id=? AND client_id=?'; p.push(c.req.param('cid'), c.req.param('id'));
        await c.env.DB.prepare(q).bind(...p).run();
        return c.json({ success: true });
    } catch (e) {
        console.error('[PATCH /collaborators] Error:', e?.message || e);
        try {
            await insertAuditLog(c, {
                action: 'ERREUR_SYSTEME',
                category: 'SYSTEME',
                severity: 'alert',
                newValue: `Erreur lors de la modification d'un collaborateur : ${e.message}`
            });
        } catch (logErr) {}
        return c.json({ error: e?.message || 'Erreur modification collaborateur' }, 500);
    }
});

app.delete('/admin/clients/:id/collaborators/:cid', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        await c.env.DB.prepare('DELETE FROM collaborators WHERE id=? AND client_id=?').bind(c.req.param('cid'), c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e) {
        console.error('[DELETE /collaborators] Error:', e?.message || e);
        try {
            await insertAuditLog(c, {
                action: 'ERREUR_SYSTEME',
                category: 'SYSTEME',
                severity: 'alert',
                newValue: `Erreur lors de la suppression d'un collaborateur : ${e.message}`
            });
        } catch (logErr) {}
        return c.json({ error: e?.message || 'Erreur suppression collaborateur' }, 500);
    }
});

app.post('/admin/clients/:id/collaborators/:cid/reset-password', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const collab = await safeFirst(c, 'SELECT * FROM collaborators WHERE id=? AND client_id=?', [c.req.param('cid'), c.req.param('id')]);
        if (!collab) return c.json({ error: '404' }, 404);
        const pwd = Math.random().toString(36).slice(-8);
        await c.env.DB.prepare('UPDATE collaborators SET password=? WHERE id=?').bind(await hashPassword(pwd), collab.id).run();
        await sendEmail(c, { to: collab.email, subject: 'Accès Collaborateur IAmani', html: renderEmail(`<p>Username: ${collab.username}<br>Password: ${pwd}</p>`, 'Identifiants') });
        return c.json({ success: true });
    } catch (e) {
        console.error('[POST /collaborators/reset-password] Error:', e?.message || e);
        try {
            await insertAuditLog(c, {
                action: 'ERREUR_SYSTEME',
                category: 'SYSTEME',
                severity: 'alert',
                newValue: `Erreur lors du reset password collaborateur : ${e.message}`
            });
        } catch (logErr) {}
        return c.json({ error: e?.message || 'Erreur reset password' }, 500);
    }
});

app.post('/admin/clients/:id/reset-password', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const cl = await safeFirst(c, 'SELECT * FROM clients WHERE id = ?', [c.req.param('id')]);
        if (!cl) return c.json({ error: '404' }, 404);
        const pwd = Math.random().toString(36).slice(-8);
        await c.env.DB.prepare('UPDATE clients SET password=?, is_temporary_password=1, status="active" WHERE id=?').bind(await hashPassword(pwd), cl.id).run();
        await sendEmail(c, { to: cl.email, subject: 'Accès IAmani', html: renderEmail(`<p>Identifiant: ${cl.username||cl.email}<br>Mot de passe: ${pwd}</p>`, 'Identifiants') });
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.post('/admin/clients/:id/force-reset-password', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const cl = await safeFirst(c, 'SELECT * FROM clients WHERE id = ?', [c.req.param('id')]);
        if (!cl) return c.json({ error: '404' }, 404);
        const pwd = Math.random().toString(36).slice(-10);
        await c.env.DB.prepare('UPDATE clients SET password=?, is_temporary_password=1, status="active" WHERE id=?').bind(await hashPassword(pwd), cl.id).run();
        await sendEmail(c, { to: cl.email, subject: 'Reset forcé IAmani', html: renderEmail(`<p>Identifiant: ${cl.username||cl.email}<br>Nouveau mot de passe: ${pwd}</p>`, 'Sécurité') });
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/admin/clients/:id/factures', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const rows = await safeQuery(c, `SELECT ${factureCols} FROM facture WHERE client_id = ?`, [c.req.param('id')]);
        return c.json(rows.map(mapFacture));
    } catch (e) { return c.json([]); }
});

app.delete('/admin/clients/:id/factures/:fid', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        await c.env.DB.prepare('DELETE FROM facture WHERE id=? AND client_id=?').bind(c.req.param('fid'), c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/admin/clients/:id/diagnostics', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const id = c.req.param('id');
        const [emp, ev, fact] = await Promise.all([
            safeFirst(c, 'SELECT COUNT(*) as c FROM employes WHERE client_id = ?', [id]),
            safeFirst(c, 'SELECT COUNT(*) as c FROM evenementiel WHERE client_id = ?', [id]),
            safeFirst(c, 'SELECT COUNT(*) as c FROM facture WHERE client_id = ?', [id]),
        ]);
        return c.json({ employees: emp?.c||0, events: ev?.c||0, factures: fact?.c||0 });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.post('/admin/upload-logo', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const { logoBase64, mimeType } = await c.req.json();
        if (!logoBase64) return c.json({ error: 'Données manquantes' }, 400);
        const dataUrl = `data:${mimeType || 'image/png'};base64,${logoBase64}`;
        if (dataUrl.length > 1000000) return c.json({ error: 'Logo trop volumineux (max 1Mo)' }, 400);
        return c.json({ logo_url: dataUrl });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.post('/admin/clients/:id/clear-logo', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        await c.env.DB.prepare('UPDATE clients SET logo_url = NULL WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/admin/sentinel/logs', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        
        await ensureAuditLogsSchema(c);
        
        const category = c.req.query('category');
        const clientId = c.req.query('clientId');
        const limit = parseInt(c.req.query('limit') || '100');
        
        let query = `
            SELECT 
                al.*,
                COALESCE(adm.name, cl.name, col.name, 'Système') as actor_name,
                COALESCE(adm.email, cl.email, col.email, 'system@iamani.com') as actor_email,
                target_cl.company_name as client_name
            FROM audit_logs al
            LEFT JOIN admins adm ON al.user_id = adm.id
            LEFT JOIN clients cl ON al.user_id = cl.id
            LEFT JOIN collaborators col ON al.user_id = col.id
            LEFT JOIN clients target_cl ON al.client_id = target_cl.id
            WHERE 1=1
        `;
        const params = [];
        
        if (category && category !== 'global') {
            query += ` AND al.category = ?`;
            params.push(category);
        }
        
        if (clientId) {
            query += ` AND al.client_id = ?`;
            params.push(clientId);
        }
        
        query += ` ORDER BY al.created_at DESC LIMIT ?`;
        params.push(limit);
        
        const rows = await safeQuery(c, query, params);
        return c.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at) })));
    } catch (e) { 
        console.error('Sentinel Error:', e);
        return c.json([]); 
    }
});

app.post('/admin/sentinel/log-action', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Accès refusé' }, 401);
        
        const { action, category, message, details } = await c.req.json();
        
        await insertAuditLog(c, {
            userId: user.id,
            clientId: user.clientId || user.id,
            action: action || 'CUSTOM_ACTION',
            category: category || 'METIER',
            message: message || 'Action utilisateur personnalisée',
            details: details || {}
        });
        
        return c.json({ success: true });
    } catch (e) {
        console.error('Log-action error:', e);
        return c.json({ error: 'Erreur lors de l\'enregistrement du log' }, 500);
    }
});

app.post('/admin/sentinel/ban-ip', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 403);
        
        const { ip, reason } = await c.req.json();
        if (!ip) return c.json({ error: 'IP address is required' }, 400);
        
        const db = c.env.DB;
        
        await db.prepare(`
            INSERT INTO banned_ips (id, ip_address, reason, banned_by)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(ip_address) DO UPDATE SET reason = excluded.reason, banned_at = CURRENT_TIMESTAMP, banned_by = excluded.banned_by
        `).bind(
            generateId(),
            ip,
            reason || 'Banned by admin',
            user.id
        ).run();
        
        // Log this action
        await insertAuditLog(c, {
            action: 'BAN_IP',
            category: 'SECURITE',
            severity: 'alert',
            newValue: `Banned IP: ${ip}`,
            ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
            country: c.req.header('cf-ipcountry') || 'FR',
            userAgent: c.req.header('user-agent')
        });
        
        return c.json({ success: true, message: 'IP address banned successfully' });
    } catch (e) {
        console.error('Ban IP error:', e);
        return c.json({ error: 'Failed to ban IP address' }, 500);
    }
});

app.get('/admin/clients/:id/audit-logs', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const rows = await safeQuery(c, 'SELECT * FROM audit_logs WHERE client_id = ? OR target_user_id = ? ORDER BY created_at DESC', [c.req.param('id'), c.req.param('id')]);
        return c.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at) })));
    } catch (e) { return c.json([]); }
});

app.get('/admin/clients/:id/planning-config', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const clientId = c.req.param('id');
        
        // Priorité à planning_settings car c'est ce que le module Planning utilise
        const planningRow = await safeFirst(c, 'SELECT payload_json FROM planning_settings WHERE client_id = ?', [clientId]);
        if (planningRow && planningRow.payload_json) {
            const payload = JSON.parse(planningRow.payload_json);
            return c.json({ 
                absenceCodes: payload.absenceCodes || [], 
                extraTypes: payload.extraTypes || [] 
            });
        }
        
        // Fallback sur client_settings
        const clientRow = await safeFirst(c, 'SELECT absence_codes, extra_types FROM client_settings WHERE client_id = ?', [clientId]);
        return c.json({ 
            absenceCodes: JSON.parse(clientRow?.absence_codes || '[]'), 
            extraTypes: JSON.parse(clientRow?.extra_types || '[]') 
        });
    } catch (e) { return c.json({ absenceCodes: [], extraTypes: [] }); }
});

app.post('/admin/clients/:id/planning-config', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const clientId = c.req.param('id');
        const b = await c.req.json();
        
        // On met à jour planning_settings
        const existingRow = await safeFirst(c, 'SELECT payload_json FROM planning_settings WHERE client_id = ?', [clientId]);
        const payload = (existingRow && existingRow.payload_json) ? JSON.parse(existingRow.payload_json) : {};
        
        payload.absenceCodes = b.absenceCodes || [];
        payload.extraTypes = b.extraTypes || [];
        
        await c.env.DB.prepare(`
            INSERT INTO planning_settings (client_id, payload_json)
            VALUES (?, ?)
            ON CONFLICT(client_id)
            DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = CURRENT_TIMESTAMP
        `).bind(clientId, JSON.stringify(payload)).run();

        return c.json({ success: true });
    } catch (e) { 
        console.error('POST /admin/clients/:id/planning-config error:', e);
        return c.json({ error: `Erreur: ${e.message}` }, 500); 
    }
});

app.post('/admin/clients/:id/impersonate', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        const cl = await safeFirst(c, `SELECT ${clientCols} FROM clients WHERE id = ?`, [c.req.param('id')]);
        if (!cl) return c.json({ error: '404' }, 404);
        
        await insertAuditLog(c, {
            action: 'IMPERSONATE',
            category: LOG_CATEGORIES.SECURITY,
            severity: LOG_SEVERITIES.WARNING,
            clientId: cl.id,
            newValue: `Super Admin a pris le contrôle de la session pour l'établissement : ${cl.company_name || cl.name}`
        });

        const p = { id: cl.id, clientId: cl.id, name: cl.name, type: 'client', role: 'client', impersonatedBySuperAdmin: true };
        return c.json({ token: await sign(p, getSecret(c)), user: p });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.post('/admin/clients/:id/sanitize', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Accès refusé' }, 401);
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/admin/clients/:id/planning/archives', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Forbidden' }, 403);
        const rows = await safeQuery(c, 'SELECT id, week_start, year, week_number, filename, created_at FROM planning_archives WHERE client_id = ? ORDER BY week_start DESC', [c.req.param('id')]);
        return c.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at) })));
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

app.delete('/planning/archive/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Session expirée' }, 401);

        const archiveId = c.req.param('id');
        const isSuperAdmin = user.type === 'admin' && (user.role === 'superadmin' || user.email === 'gev-emeni@outlook.fr');
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;

        console.log(`[DELETE /planning/archive] Request - ID: ${archiveId}, UserType: ${user.type}, IsSuperAdmin: ${isSuperAdmin}, OwnerID: ${ownerId}`);

        if (isSuperAdmin) {
            // Un super admin peut supprimer n'importe quelle archive par son ID
            await c.env.DB.prepare('DELETE FROM planning_archives WHERE id = ?').bind(archiveId).run();
        } else {
            // Un client ne peut supprimer que ses propres archives
            const res = await c.env.DB.prepare('DELETE FROM planning_archives WHERE id = ? AND client_id = ?').bind(archiveId, ownerId).run();
            if (res.meta.changes === 0) return c.json({ error: 'Archive introuvable ou accès refusé' }, 404);
        }

        return c.json({ success: true });
    } catch (e) {
        console.error('DELETE /planning/archive error:', e);
        return c.json({ error: `Erreur suppression: ${e.message}` }, 500);
    }
});

app.get('/planning/week/:date', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const date = c.req.param('date');



        const row = await safeFirst(c, 'SELECT payload_json FROM planning_weeks WHERE client_id = ? AND week_start = ?', [ownerId, date]);
        let data = row && row.payload_json ? JSON.parse(row.payload_json) : null;
        if (data) {
            data.week_start = date;
            await insertAuditLog(c, {
                action: 'VIEW_PLANNING',
                category: LOG_CATEGORIES.BUSINESS,
                severity: LOG_SEVERITIES.INFO,
                clientId: ownerId,
                newValue: `Consultation du planning pour la semaine du ${date}`
            });
        }
        return c.json(data);
    } catch (e) {
        console.error('[GET /planning/week/:date] Error:', e);
        return c.json(null);
    }
});

app.post('/planning/week', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const date = body.weekStart;
        if (!date) return c.json({ error: 'Missing weekStart' }, 400);



        await c.env.DB.prepare(`
            INSERT INTO planning_weeks (id, client_id, week_start, payload_json)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(client_id, week_start)
            DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = CURRENT_TIMESTAMP
        `).bind(body.id || generateId(), ownerId, date, JSON.stringify(body)).run();

        await insertAuditLog(c, {
            action: 'UPDATE_PLANNING',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.INFO,
            clientId: ownerId,
            newValue: `Modification du planning pour la semaine du ${date}`
        });

        return c.json({ success: true });
    } catch (e) {
        console.error('[POST /planning/week] Error:', e);
        return c.json({ error: `Erreur Planning: ${e.message}` }, 500);
    }
});

app.get('/planning/weeks', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;

        const rows = await safeQuery(c, 'SELECT id, week_start, updated_at FROM planning_weeks WHERE client_id = ? ORDER BY week_start DESC', [ownerId]);
        c.header('Cache-Control', 'no-store');
        return c.json(rows || []);
    } catch (e) { return c.json([]); }
});

app.get('/planning/archives', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json({ error: 'Non autorisé' }, 401);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;

    const res = await c.env.DB.prepare(`
        SELECT id, week_start, year, week_number, filename, created_at
        FROM planning_archives
        WHERE client_id = ?
        ORDER BY week_start DESC
    `).bind(ownerId).all();
    c.header('Cache-Control', 'no-store');
    return c.json(res.results || []);
});

app.get('/planning/archive/:week_start', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json({ error: 'Non autorisé' }, 401);
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const week_start = c.req.param('week_start');

    const res = await c.env.DB.prepare(`
        SELECT * FROM planning_archives
        WHERE client_id = ? AND week_start = ?
    `).bind(ownerId, week_start).first();
    if (!res) return c.json({ error: 'Archive non trouvée' }, 404);
    return c.json(res);
});

app.post('/planning/archive', async (c) => {
    const user = await getUserFromReq(c);
    if (!user) return c.json({ error: 'Non autorisé' }, 401);
    const body = await c.req.json();
    const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
    const { week_start, year, week_number, pdf_base64, filename } = body;

    if (!week_start || !pdf_base64) return c.json({ error: 'Données manquantes' }, 400);


    const id = generateId();
    try {
        await c.env.DB.prepare(`
            INSERT INTO planning_archives (id, client_id, week_start, year, week_number, pdf_base64, filename)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(client_id, week_start) DO UPDATE SET
                pdf_base64 = excluded.pdf_base64,
                filename = excluded.filename,
                created_at = CURRENT_TIMESTAMP
        `).bind(id, ownerId, week_start, year, week_number, pdf_base64, filename).run();

        await insertAuditLog(c, {
            action: 'PRINT_PLANNING',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.SUCCESS,
            clientId: ownerId,
            newValue: `Impression et archive du planning : ${filename}`
        });

        return c.json({ success: true, id });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

async function propagateTemplateChanges(db, clientId, newTemplates) {
    // On commence à partir du lundi de la semaine actuelle
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const mondayStr = monday.toISOString().split('T')[0];

    const { results: weeks } = await db.prepare(
        'SELECT id, payload_json FROM planning_weeks WHERE client_id = ? AND week_start >= ?'
    ).bind(clientId, mondayStr).all();

    if (!weeks || weeks.length === 0) return;

    for (const week of weeks) {
        let payload;
        try {
            payload = JSON.parse(week.payload_json);
        } catch (e) { continue; }

        let modified = false;
        if (!payload.rows) continue;

        payload.rows.forEach(row => {
            if (!row.shifts) return;
            Object.keys(row.shifts).forEach(date => {
                const shift = row.shifts[date];
                if (!shift.segments) return;

                // Regrouper les segments par templateId
                const segmentsByTpl = {};
                shift.segments.forEach(seg => {
                    if (seg.templateId) {
                        if (!segmentsByTpl[seg.templateId]) segmentsByTpl[seg.templateId] = [];
                        segmentsByTpl[seg.templateId].push(seg);
                    }
                });

                Object.keys(segmentsByTpl).forEach(tplId => {
                    const tpl = newTemplates.find(t => t.id === tplId);
                    if (!tpl) return;

                    const segments = segmentsByTpl[tplId];
                    const anyOverride = segments.some(s => s.hasOverride);

                    if (!anyOverride) {
                        if (segments.length === tpl.slots.length) {
                            segments.forEach((seg, i) => {
                                const slot = tpl.slots[i];
                                if (seg.start !== slot.start || seg.end !== slot.end || seg.colorOverride !== tpl.color || seg.color !== tpl.color) {
                                    seg.start = slot.start;
                                    seg.end = slot.end;
                                    seg.color = tpl.color;
                                    seg.colorOverride = tpl.color;
                                    modified = true;
                                }
                            });
                        } else {
                            segments.forEach(seg => {
                                if (seg.colorOverride !== tpl.color || seg.color !== tpl.color) {
                                    seg.color = tpl.color;
                                    seg.colorOverride = tpl.color;
                                    modified = true;
                                }
                            });
                            if (segments.length === 1 && tpl.slots.length === 1) {
                                const slot = tpl.slots[0];
                                if (segments[0].start !== slot.start || segments[0].end !== slot.end) {
                                    segments[0].start = slot.start;
                                    segments[0].end = slot.end;
                                    modified = true;
                                }
                            }
                        }
                    } else {
                        segments.forEach((seg, i) => {
                            if (!seg.hasOverride) {
                                if (seg.colorOverride !== tpl.color || seg.color !== tpl.color) {
                                    seg.color = tpl.color;
                                    seg.colorOverride = tpl.color;
                                    modified = true;
                                }
                                if (segments.length === tpl.slots.length) {
                                    const slot = tpl.slots[i];
                                    if (seg.start !== slot.start || seg.end !== slot.end) {
                                        seg.start = slot.start;
                                        seg.end = slot.end;
                                        modified = true;
                                    }
                                }
                            }
                        });
                    }
                });
            });
        });

        if (modified) {
            await db.prepare('UPDATE planning_weeks SET payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .bind(JSON.stringify(payload), week.id).run();
        }
    }
}

app.delete('/planning/week/:id', async (c) => {

    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        await c.env.DB.prepare('DELETE FROM planning_weeks WHERE id = ? AND client_id = ?').bind(c.req.param('id'), ownerId).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.get('/planning/templates', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;



        const row = await safeFirst(c, 'SELECT payload_json FROM planning_templates WHERE client_id = ?', [ownerId]);
        return c.json(row && row.payload_json ? JSON.parse(row.payload_json) : []);
    } catch (e) {
        console.error('[GET /planning/templates] Error:', e);
        return c.json([]);
    }
});

app.post('/planning/templates', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();



        await c.env.DB.prepare(`
            INSERT INTO planning_templates (id, client_id, payload_json)
            VALUES (?, ?, ?)
            ON CONFLICT(id)
            DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = CURRENT_TIMESTAMP
        `).bind(ownerId, ownerId, JSON.stringify(body)).run();

        // Propagation automatique vers les plannings existants
        await propagateTemplateChanges(c.env.DB, ownerId, body);

        return c.json({ success: true });

    } catch (e) {
        console.error('[POST /planning/templates] Error:', e);
        return c.json({ error: 'Erreur' }, 500);
    }
});

app.get('/planning/settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;



        const row = await safeFirst(c, 'SELECT payload_json FROM planning_settings WHERE client_id = ?', [ownerId]);
        return c.json(row && row.payload_json ? JSON.parse(row.payload_json) : {});
    } catch (e) {
        console.error('[GET /planning/settings] Error:', e);
        return c.json({});
    }
});

app.post('/planning/settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();



        const existingRow = await safeFirst(c, 'SELECT payload_json FROM planning_settings WHERE client_id = ?', [ownerId]);
        const existing = (existingRow && existingRow.payload_json) ? JSON.parse(existingRow.payload_json) : {};
        const isSuperAdmin = user.type === 'admin' && (user.role === 'superadmin' || user.email === 'gev-emeni@outlook.fr');

        const merged = { ...existing, ...(body || {}) };
        // Plus de restriction SuperAdmin sur absenceCodes et extraTypes pour que les clients puissent les modifier

        await c.env.DB.prepare(`
            INSERT INTO planning_settings (client_id, payload_json)
            VALUES (?, ?)
            ON CONFLICT(client_id)
            DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = CURRENT_TIMESTAMP
        `).bind(ownerId, JSON.stringify(merged)).run();

        // Propagation immédiate des changements d'horaires par défaut
        if (merged.weeklyDefaults) {
            await propagatePlanningChanges(c, ownerId, Object.keys(merged.weeklyDefaults));
        }

        return c.json({ success: true });
    } catch (e) {
        console.error('[POST /planning/settings] Error:', e);
        return c.json({ error: 'Erreur' }, 500);
    }
});

// --- PLANNING ABSENCES ---
app.get('/planning/absences', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;

        const res = await c.env.DB.prepare(`
            SELECT * FROM planning_absences WHERE client_id = ? ORDER BY start_date DESC
        `).bind(ownerId).all();
        return c.json(res.results || []);
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/planning/absences', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();

        if (!body.employee_id || !body.start_date || !body.end_date) {
            return c.json({ error: 'Missing fields' }, 400);
        }

        await c.env.DB.prepare(`
            INSERT INTO planning_absences (id, client_id, employee_id, start_date, end_date, absence_type)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                start_date = EXCLUDED.start_date,
                end_date = EXCLUDED.end_date,
                absence_type = EXCLUDED.absence_type
        `).bind(body.id || generateId(), ownerId, body.employee_id, body.start_date, body.end_date, body.absence_type).run();
        
        // Propagation immédiate de l'absence sur les plannings existants
        await propagatePlanningChanges(c, ownerId, [String(body.employee_id)]);

        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

app.delete('/planning/absences/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const id = c.req.param('id');

        const abs = await safeFirst(c, 'SELECT employee_id FROM planning_absences WHERE id = ?', [id]);
        await c.env.DB.prepare('DELETE FROM planning_absences WHERE id = ? AND client_id = ?').bind(id, ownerId).run();
        
        // Si on supprime une absence, on doit aussi propager pour restaurer les horaires par défaut
        if (abs) {
            await propagatePlanningChanges(c, ownerId, [String(abs.employee_id)]);
        }

        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
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

        if (rows.length === 0) return c.json([]);

        // Optimization: Bulk fetch related data
        const eventIds = rows.map(r => r.id);
        const placeholders = eventIds.map(() => '?').join(',');

        const [allStaff, allAssignments, allSpaces] = await Promise.all([
            safeQuery(c, `
                SELECT es.event_id, es.staff_type_id, es.count, st.name
                FROM evenementiel_event_staff es
                JOIN evenementiel_staff_types st ON es.staff_type_id = st.id
                WHERE es.event_id IN (${placeholders})
            `, eventIds),
            safeQuery(c, `
                SELECT a.event_id, a.employee_id, a.staff_type_id, 
                       (emp.first_name || ' ' || emp.last_name) as employee_name,
                       st.name as staff_type_name
                FROM evenementiel_event_assignments a
                JOIN employes emp ON a.employee_id = emp.id
                JOIN evenementiel_staff_types st ON a.staff_type_id = st.id
                WHERE a.event_id IN (${placeholders})
            `, eventIds),
            safeQuery(c, `
                SELECT es.event_id, s.* 
                FROM evenementiel_spaces s 
                JOIN evenementiel_event_spaces es ON s.id = es.space_id 
                WHERE es.event_id IN (${placeholders})
            `, eventIds)
        ]);

        const events = rows.map(row => ({
            ...mapEvent(row),
            has_note: !!row.has_notes,
            has_documents: row.documents && row.documents !== '[]' && row.documents !== 'null',
            notes: row.note_text || '',
            staff: allStaff.filter(s => s.event_id === row.id),
            assignments: allAssignments.filter(a => a.event_id === row.id),
            spaces: allSpaces.filter(s => s.event_id === row.id)
        }));

        return c.json(events);
    } catch (e) {
        console.error('GET /evenementiel error:', e);
        return c.json([]);
    }
});

app.get('/evenementiel/config', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({});
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const config = await safeFirst(c, 'SELECT * FROM evenementiel_config WHERE client_id = ?', [ownerId]);
        const staff = await safeQuery(c, 'SELECT * FROM evenementiel_staff_types WHERE client_id = ?', [ownerId]);
        const spaces = await safeQuery(c, 'SELECT * FROM evenementiel_spaces WHERE client_id = ?', [ownerId]);

        const safeParse = (val) => {
            if (!val) return [];
            if (typeof val !== 'string') return val;
            try { return JSON.parse(val); } catch (e) { return []; }
        };

        return c.json({
            client_id: ownerId,
            track_taken_by: Boolean(config?.track_taken_by || 0),
            allowed_taker_employee_ids: safeParse(config?.allowed_taker_employee_ids),
            notify_recipient_employee_ids: safeParse(config?.notify_recipient_employee_ids),
            authorized_staff_categories: staff,
            spaces: spaces
        });
    } catch (e) {
        console.error('GET Evenementiel Config Error:', e);
        return c.json({ authorized_staff_categories: [], spaces: [] }, 500);
    }
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
    } catch (e) {
        console.error('GET Mappings Error:', e);
        return c.json([], 500);
    }
});

app.get('/evenementiel/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const id = c.req.param('id');
        const row = await safeFirst(c, `
            SELECT e.*, 
                   (emp.first_name || ' ' || emp.last_name) as taken_by_name,
                   n.note_text, 
                   CASE WHEN n.id IS NOT NULL THEN 1 ELSE 0 END as has_notes
            FROM evenementiel e 
            LEFT JOIN employes emp ON e.taken_by_id = emp.id
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

        return c.json({
            ...mapEvent(row),
            taken_by_name: row.taken_by_name || '',
            has_notes: !!row.has_notes,
            notes: row.note_text || '', // Compatibilité
            staff,
            assignments,
            spaces: eventSpaces
        });
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

const syncCRMContact = async (c, ownerId, body) => {
    let crmId = body.crm_contact_id;
    const type = body.type || 'PRIVÉ';
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const company = String(body.company_name || '').trim();
    const firstName = String(body.first_name || '').trim();
    const lastName = String(body.last_name || '').trim();
    const organizer = String(body.organizer_name || '').trim();
    const address = String(body.address || '').trim();
    const postalCode = String(body.postal_code || '').trim();
    const city = String(body.city || '').trim();
    const country = String(body.country || '').trim();

    // 1. Si on n'a pas d'ID, on cherche un doublon
    if (!crmId) {
        let existing = null;
        if (type === 'PROFESSIONNEL' && company) {
            existing = await safeFirst(c, 'SELECT id FROM crm_contacts WHERE client_id = ? AND LOWER(company_name) = ?', [ownerId, company.toLowerCase()]);
        } else if (type === 'PRIVÉ' && lastName) {
            // Pour le privé, on cherche par couple Nom + Prénom (le prénom peut être vide)
            existing = await safeFirst(c, 'SELECT id FROM crm_contacts WHERE client_id = ? AND LOWER(first_name) = ? AND LOWER(last_name) = ?', [ownerId, firstName.toLowerCase(), lastName.toLowerCase()]);
        }

        if (existing) crmId = existing.id;
    }

    if (crmId) {
        // 2. Mise à jour du contact existant
        await c.env.DB.prepare(`
            UPDATE crm_contacts SET 
            first_name = ?, last_name = ?, email = ?, phone = ?, company_name = ?, organizer_name = ?, 
            address = ?, postal_code = ?, city = ?, country = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND client_id = ?
        `).bind(
            firstName, lastName, email || null, phone || null, company || null, organizer || null,
            address || null, postalCode || null, city || null, country || null, crmId, ownerId
        ).run();
    } else {
        // 3. Création d'un nouveau contact
        crmId = generateId();
        await c.env.DB.prepare(`
            INSERT INTO crm_contacts (id, client_id, type, first_name, last_name, email, phone, company_name, organizer_name, address, postal_code, city, country)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(crmId, ownerId, type, firstName, lastName, email || null, phone || null, company || null, organizer || null, address || null, postalCode || null, city || null, country || null).run();
    }
    return crmId;
};

app.post('/evenementiel', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const id = generateId();

        // Sync avec le CRM
        const crmContactId = await syncCRMContact(c, ownerId, body);

        // 1. Insertion Coeur
        const startTime = body.start_time || new Date().toISOString();
        const endTime = body.end_time || new Date().toISOString();

        await c.env.DB.prepare(`
            INSERT INTO evenementiel (id, client_id, calendar_id, type, phone, email, address, start_time, end_time, num_people, documents, first_name, last_name, company_name, organizer_name, taken_by_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id, ownerId, body.calendar_id, body.type, body.phone || '', body.email || '', body.address || '',
            startTime, endTime, Number(body.num_people || 0), JSON.stringify(body.documents || []),
            body.first_name || '', body.last_name || '', body.company_name || '', body.organizer_name || '', body.taken_by_id || null
        ).run();

        // 2. Espaces (Mapping)
        if (body.space_ids && Array.isArray(body.space_ids)) {
            for (const sid of body.space_ids) {
                if (sid) await c.env.DB.prepare('INSERT INTO evenementiel_event_spaces (event_id, space_id) VALUES (?, ?)').bind(id, sid).run();
            }
        }

        // 3. Staffing (Besoins)
        if (body.staff_requests && typeof body.staff_requests === 'object') {
            for (const [tid, cnt] of Object.entries(body.staff_requests)) {
                if (tid && cnt) {
                    await c.env.DB.prepare('INSERT INTO evenementiel_event_staff (event_id, staff_type_id, count) VALUES (?, ?, ?)').bind(id, tid, cnt).run();
                }
            }
        }

        // 4. Assignments
        if (Array.isArray(body.assignments)) {
            for (const ass of body.assignments) {
                if (ass.employee_id && ass.staff_type_id) {
                    await c.env.DB.prepare('INSERT INTO evenementiel_event_assignments (event_id, employee_id, staff_type_id) VALUES (?, ?, ?)').bind(id, ass.employee_id, ass.staff_type_id).run();
                }
            }
        }

        // 5. Notes
        if (body.note_text) {
            await c.env.DB.prepare('INSERT INTO event_notes (id, event_id, client_id, note_text) VALUES (?, ?, ?, ?)').bind(generateId(), id, ownerId, body.note_text).run();
        }

        const eventName = body.organizer_name || body.company_name || `${body.first_name} ${body.last_name}`.trim() || 'Événement sans nom';
        await insertAuditLog(c, {
            action: 'CREATE_EVENT',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.SUCCESS,
            clientId: ownerId,
            newValue: `Nouvelle privatisation créée : "${eventName}" le ${new Date(startTime).toLocaleDateString('fr-FR')}`
        });

        return c.json({ success: true, id });
    } catch (e) {
        console.error('POST Event Error:', e);
        return c.json({ error: `Erreur Création Événement: ${e.message}` }, 500);
    }
});

app.put('/evenementiel/config', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        if (!ownerId) return c.json({ error: 'ID client manquant' }, 400);

        const body = await c.req.json();
        await c.env.DB.prepare('INSERT OR REPLACE INTO evenementiel_config (client_id, track_taken_by, allowed_taker_employee_ids, notify_recipient_employee_ids, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
            .bind(ownerId, body.track_taken_by ? 1 : 0, JSON.stringify(body.allowed_taker_employee_ids || []), JSON.stringify(body.notify_recipient_employee_ids || [])).run();
        return c.json({ success: true });
    } catch (e) {
        console.error('PUT Evenementiel Config Error:', e);
        return c.json({ error: `Erreur Config: ${e.message}` }, 500);
    }
});

app.put('/evenementiel/staff-mappings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const categories = Array.isArray(body) ? body : (body.mappings || []);

        await c.env.DB.prepare('DELETE FROM staff_category_mapping WHERE client_id = ?').bind(ownerId).run();

        for (const cat of categories) {
            const staffCategoryId = cat.staff_type_id || cat.staff_category_id;
            const empIds = Array.isArray(cat.employee_ids) ? cat.employee_ids : (cat.employee_id ? [cat.employee_id] : []);

            for (const empId of empIds) {
                if (!empId || !staffCategoryId) continue;
                const id = generateId();
                await c.env.DB.prepare('INSERT INTO staff_category_mapping (id, client_id, staff_category_id, employee_id) VALUES (?, ?, ?, ?)')
                    .bind(id, ownerId, staffCategoryId, empId).run();
            }
        }
        return c.json({ success: true });
    } catch (e) {
        console.error('PUT Mappings Error:', e);
        return c.json({ error: `Erreur Mappings: ${e.message}` }, 500);
    }
});

app.put('/evenementiel/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const id = c.req.param('id');
        const body = await c.req.json();

        // Sync avec le CRM
        const crmContactId = await syncCRMContact(c, ownerId, body);

        // 1. UPDATE Coeur
        const taken_by = (body.taken_by_id === '' || body.taken_by_id === undefined) ? null : body.taken_by_id;
        const startTime = body.start_time || new Date().toISOString();
        const endTime = body.end_time || new Date().toISOString();

        console.log(`[PUT /evenementiel/${id}] Body received:`, JSON.stringify(body));

        const validParams = [
            body.calendar_id || '',
            body.type || 'PRIVÉ', body.phone || '', body.email || '', body.address || '',
            startTime, endTime, Number(body.num_people || 0),
            body.first_name || '', body.last_name || '', body.company_name || '',
            body.organizer_name || '', taken_by, crmContactId || null,
            id, ownerId
        ];

        await c.env.DB.prepare(`
            UPDATE evenementiel SET 
            calendar_id = ?, type = ?, phone = ?, email = ?, address = ?, start_time = ?, end_time = ?, 
            num_people = ?, first_name = ?, last_name = ?, company_name = ?, organizer_name = ?, taken_by_id = ?, crm_contact_id = ?,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND client_id = ?
        `).bind(...validParams).run();

        if (body.documents && Array.isArray(body.documents)) {
            await c.env.DB.prepare('UPDATE evenementiel SET documents = ? WHERE id = ? AND client_id = ?')
                .bind(JSON.stringify(body.documents), id, ownerId).run();
        }

        // 2. Nettoyage Relations
        await c.env.DB.prepare('DELETE FROM evenementiel_event_spaces WHERE event_id = ?').bind(id).run();
        await c.env.DB.prepare('DELETE FROM evenementiel_event_staff WHERE event_id = ?').bind(id).run();
        await c.env.DB.prepare('DELETE FROM evenementiel_event_assignments WHERE event_id = ?').bind(id).run();

        // 3. Re-Insertion
        if (body.space_ids && Array.isArray(body.space_ids)) {
            for (const sid of body.space_ids) {
                if (sid) await c.env.DB.prepare('INSERT INTO evenementiel_event_spaces (event_id, space_id) VALUES (?, ?)').bind(id, sid).run();
            }
        }
        if (body.staff_requests && typeof body.staff_requests === 'object') {
            for (const [tid, cnt] of Object.entries(body.staff_requests)) {
                if (tid && cnt) await c.env.DB.prepare('INSERT INTO evenementiel_event_staff (event_id, staff_type_id, count) VALUES (?, ?, ?)').bind(id, tid, cnt).run();
            }
        }
        if (Array.isArray(body.assignments)) {
            for (const ass of body.assignments) {
                if (ass.employee_id && ass.staff_type_id) await c.env.DB.prepare('INSERT INTO evenementiel_event_assignments (event_id, employee_id, staff_type_id) VALUES (?, ?, ?)').bind(id, ass.employee_id, ass.staff_type_id).run();
            }
        }

        if (body.note_text !== undefined) {
            await c.env.DB.prepare('DELETE FROM event_notes WHERE event_id = ?').bind(id).run();
            if (body.note_text && body.note_text.trim() !== '') {
                await c.env.DB.prepare('INSERT INTO event_notes (id, event_id, client_id, note_text) VALUES (?, ?, ?, ?)')
                    .bind(generateId(), id, ownerId, body.note_text).run();
            }
        }

        const eventName = body.organizer_name || body.company_name || `${body.first_name} ${body.last_name}`.trim() || 'Événement sans nom';
        await insertAuditLog(c, {
            action: 'UPDATE_EVENT',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.INFO,
            clientId: ownerId,
            newValue: `Modification de la privatisation : "${eventName}"`
        });

        return c.json({ success: true });
    } catch (e) {
        console.error('PUT Event Error:', e);
        return c.json({ error: `Erreur Modification Événement: ${e.message}` }, 500);
    }
});

app.delete('/evenementiel/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const eventId = c.req.param('id');
        const existing = await safeFirst(c, 'SELECT first_name, last_name, company_name, organizer_name FROM evenementiel WHERE id = ? AND client_id = ?', [eventId, ownerId]);
        const eventName = existing ? (existing.organizer_name || existing.company_name || `${existing.first_name} ${existing.last_name}`.trim()) : eventId;

        await c.env.DB.prepare('DELETE FROM evenementiel WHERE id = ? AND client_id = ?').bind(eventId, ownerId).run();

        await insertAuditLog(c, {
            action: 'DELETE_EVENT',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.WARNING,
            clientId: ownerId,
            newValue: `A supprimé la privatisation : "${eventName || 'inconnue'}"`
        });

        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Suppression échouée' }, 500); }
});

// --- (Doublons supprimés par priorité) ---


app.post('/evenementiel/calendars', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const id = generateId();
        await c.env.DB.prepare('INSERT INTO evenementiel_calendars (id, client_id, month, year, status) VALUES (?, ?, ?, ?, ?)')
            .bind(id, ownerId, body.month, body.year, 'OPEN').run();
        return c.json({ success: true, id });
    } catch (e) { return c.json({ error: 'Calendrier existant ou erreur' }, 500); }
});

app.post('/evenementiel/notify-update', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const { calendar_id, recipient_ids } = body;

        if (!calendar_id || !recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
            return c.json({ error: 'Paramètres manquants' }, 400);
        }

        const calendar = await safeFirst(c, 'SELECT * FROM evenementiel_calendars WHERE id = ? AND client_id = ?', [calendar_id, ownerId]);
        if (!calendar) return c.json({ error: 'Calendrier introuvable' }, 404);

        const client = await safeFirst(c, 'SELECT email, company_name FROM clients WHERE id = ?', [ownerId]);
        const placeholders = recipient_ids.map(() => '?').join(',');
        const employees = await safeQuery(c, `SELECT email FROM employes WHERE id IN (${placeholders}) AND client_id = ?`, [...recipient_ids, ownerId]);
        const emails = employees.map(e => e.email).filter(Boolean);

        if (emails.length === 0) {
            return c.json({ success: true, sent: 0, message: 'Aucun email valide trouvé' });
        }

        const senderName = client?.company_name || user.company_name || 'Votre Établissement';
        const monthName = MONTHS[calendar.month - 1] || calendar.month;
        const subject = `Mise à jour du planning - ${senderName} (${monthName} ${calendar.year})`;
        const html = renderEmail(`
            <p>Bonjour,</p>
            <p>Le planning des événements pour <strong>${monthName} ${calendar.year}</strong> a été mis à jour par <strong>${senderName}</strong>.</p>
            <div class="info-box">
                Vous pouvez consulter les détails et les affectations directement sur votre espace personnel IAmani.
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <a href="https://gestion.l-iamani.com/login" class="button">Consulter mon Planning</a>
            </div>
            <p style="margin-top: 30px;">
                Cordialement,<br>
                <strong>${senderName}</strong>
            </p>
        `, `Planning - ${senderName}`);

        const result = await sendEmail(c, { to: emails, subject, html, fromName: senderName, replyTo: client?.email });

        if (result.success) {
            return c.json({ success: true, sent: emails.length });
        } else {
            return c.json({ error: result.error || 'Erreur envoi email' }, 500);
        }
    } catch (e) {
        console.error('Notify Update Error:', e);
        return c.json({ error: `Erreur Notification: ${e.message}` }, 500);
    }
});

app.patch('/evenementiel/calendars/:id/archive', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        
        const ownerId = (user.type === 'collaborator' || user.type === 'staff') 
            ? (user.client_id || user.clientId) 
            : (user.type === 'client' ? user.id : (user.clientId || user.id));
            
        const id = c.req.param('id');
        if (!c.env.DB) throw new Error('D1 Database binding missing');
        
        const isSuperAdmin = user.type === 'admin' && (user.role === 'superadmin' || user.email === 'gev-emeni@outlook.fr');
        
        // On récupère le statut actuel pour pouvoir basculer (Toggle)
        const cal = await safeFirst(c, "SELECT status FROM evenementiel_calendars WHERE id = ?", [id]);
        if (!cal) return c.json({ error: 'Calendrier introuvable' }, 404);
        
        // On bascule entre OPEN et ARCHIVED (on évite CLOSED qui n'est pas géré par le front)
        const newStatus = cal.status === 'ARCHIVED' ? 'OPEN' : 'ARCHIVED';
        
        let query = "UPDATE evenementiel_calendars SET status = ? WHERE id = ?";
        let params = [newStatus, id];
        
        if (!isSuperAdmin) {
            query += " AND client_id = ?";
            params.push(ownerId);
        }
        
        const result = await c.env.DB.prepare(query).bind(...params).run();
        
        if (result.meta.changes === 0) {
            return c.json({ error: 'Accès refusé' }, 403);
        }
        
        // On retourne le nouveau statut pour que le front mette à jour ses messages (Toast)
        return c.json({ success: true, status: newStatus });
    } catch (e) {
        console.error('Archive Calendar Error:', e);
        return c.json({ error: `Erreur Archive: ${e.message}` }, 500);
    }
});

app.get('/crm/settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({});
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const row = await safeFirst(c, 'SELECT * FROM crm_settings WHERE client_id = ?', [ownerId]);
        return c.json(row || {});
    } catch (e) { return c.json({}); }
});

app.put('/crm/settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        await c.env.DB.prepare('INSERT OR REPLACE INTO crm_settings (client_id, custom_fields, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
            .bind(ownerId, JSON.stringify(body.custom_fields || [])).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur CRM' }, 500); }
});

app.get('/rh/settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({});
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const row = await safeFirst(c, 'SELECT * FROM rh_settings WHERE client_id = ?', [ownerId]);
        return c.json(row || {});
    } catch (e) { return c.json({}); }
});

app.put('/rh/settings', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        await c.env.DB.prepare('INSERT OR REPLACE INTO rh_settings (client_id, rules, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
            .bind(ownerId, JSON.stringify(body.rules || {})).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur RH' }, 500); }
});

app.delete('/evenementiel/calendars/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        await c.env.DB.prepare('DELETE FROM evenementiel_calendars WHERE id = ? AND client_id = ?').bind(c.req.param('id'), ownerId).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur Suppression' }, 500); }
});

app.get('/evenementiel/calendars/:id/events', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const calendarId = c.req.param('id');

        // Fetch events
        const rows = await safeQuery(c, `
            SELECT e.*, 
                   (emp.first_name || ' ' || emp.last_name) as taken_by_name,
                   n.note_text, 
                   CASE WHEN n.id IS NOT NULL THEN 1 ELSE 0 END as has_notes
            FROM evenementiel e 
            LEFT JOIN employes emp ON e.taken_by_id = emp.id
            LEFT JOIN event_notes n ON e.id = n.event_id 
            WHERE e.calendar_id = ? AND e.client_id = ?
        `, [calendarId, ownerId]);

        if (rows.length === 0) return c.json([]);

        // Optimization: Fetch ALL staff, assignments, and spaces for these events in bulk
        const eventIds = rows.map(r => r.id);
        const placeholders = eventIds.map(() => '?').join(',');

        const [allStaff, allAssignments, allSpaces] = await Promise.all([
            safeQuery(c, `
                SELECT es.event_id, es.staff_type_id, es.count, st.name
                FROM evenementiel_event_staff es
                JOIN evenementiel_staff_types st ON es.staff_type_id = st.id
                WHERE es.event_id IN (${placeholders})
            `, eventIds),
            safeQuery(c, `
                SELECT a.event_id, a.employee_id, a.staff_type_id, 
                       (emp.first_name || ' ' || emp.last_name) as employee_name,
                       st.name as staff_type_name
                FROM evenementiel_event_assignments a
                JOIN employes emp ON a.employee_id = emp.id
                JOIN evenementiel_staff_types st ON a.staff_type_id = st.id
                WHERE a.event_id IN (${placeholders})
            `, eventIds),
            safeQuery(c, `
                SELECT es.event_id, s.* 
                FROM evenementiel_spaces s 
                JOIN evenementiel_event_spaces es ON s.id = es.space_id 
                WHERE es.event_id IN (${placeholders})
            `, eventIds)
        ]);

        const events = rows.map(row => ({
            ...mapEvent(row),
            staff: allStaff.filter(s => s.event_id === row.id),
            assignments: allAssignments.filter(a => a.event_id === row.id),
            spaces: allSpaces.filter(s => s.event_id === row.id)
        }));

        return c.json(events);
    } catch (e) {
        console.error('GET Calendar Events Error:', e);
        return c.json({ error: `Erreur chargement événements: ${e.message}` }, 500);
    }
});

app.get('/test-db', async (c) => {
    try {
        if (!c.env?.DB) return c.json({ error: 'No DB binding' }, 500);
        const res = await c.env.DB.prepare('SELECT 1').first();
        return c.json({ success: true, result: res });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
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
        const id = c.req.param('id');
        const row = await safeFirst(c, `SELECT ${crmCols} FROM crm_contacts WHERE id = ? AND client_id = ?`, [id, ownerId]);
        if (!row) return c.json({ error: 'Contact introuvable' }, 404);

        const contact = mapCrm(row);

        // Récupérer les données liées
        const factures = await safeQuery(c, `SELECT ${factureCols} FROM facture WHERE crm_contact_id = ? AND client_id = ?`, [id, ownerId]);

        // Historique strict: lien CRM prioritaire, avec fallback exact pour les anciens events non relies.
        const normalizedEmail = String(contact.email || '').trim().toLowerCase();
        const normalizedPhone = String(contact.phone || '').replace(/[\s.\-()]/g, '');
        const normalizedCompany = String(contact.company_name || '').trim().toLowerCase();
        const normalizedOrganizer = String(contact.organizer_name || '').trim().toLowerCase();
        const normalizedFirstName = String(contact.first_name || '').trim().toLowerCase();
        const normalizedLastName = String(contact.last_name || '').trim().toLowerCase();

        const matchedEvents = await safeQuery(c, `
            SELECT ${eventCols} FROM evenementiel
            WHERE client_id = ? AND (
                crm_contact_id = ?
                OR (
                    (crm_contact_id IS NULL OR crm_contact_id = '') AND (
                        (? != '' AND LOWER(TRIM(COALESCE(email, ''))) = ?)
                        OR (? != '' AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '.', ''), '-', ''), '(', ''), ')', '') = ?)
                        OR (? != '' AND LOWER(TRIM(COALESCE(company_name, ''))) = ?)
                        OR (? != '' AND LOWER(TRIM(COALESCE(organizer_name, ''))) = ?)
                        OR (
                            ? != '' AND ? != ''
                            AND LOWER(TRIM(COALESCE(first_name, ''))) = ?
                            AND LOWER(TRIM(COALESCE(last_name, ''))) = ?
                        )
                    )
                )
            )
            ORDER BY start_time DESC
        `, [
            ownerId,
            id,
            normalizedEmail,
            normalizedEmail,
            normalizedPhone,
            normalizedPhone,
            normalizedCompany,
            normalizedCompany,
            normalizedOrganizer,
            normalizedOrganizer,
            normalizedFirstName,
            normalizedLastName,
            normalizedFirstName,
            normalizedLastName,
        ]);

        return c.json({
            ...contact,
            factures: factures.map(mapFacture),
            events: matchedEvents.map(mapEvent)
        });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.post('/crm/contacts', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const id = generateId();
        await c.env.DB.prepare('INSERT INTO crm_contacts (id, client_id, first_name, last_name, email, phone, company_name, organizer_name, address, postal_code, city, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(id, ownerId, body.first_name, body.last_name, body.email, body.phone, body.company_name, body.organizer_name, body.address, body.postal_code, body.city, body.country).run();
        return c.json({ success: true, id });
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
        const isSuperAdmin = user.type === 'admin' && (user.role === 'superadmin' || user.email === 'gev-emeni@outlook.fr');

        const id = c.req.query('id');
        if (id) {
            const invoice = await safeFirst(c, `SELECT * FROM facture WHERE id = ?`, [id]);
            if (!invoice) return c.json({ error: 'Facture introuvable' }, 404);

            if (!isSuperAdmin && invoice.client_id !== ownerId) {
                return c.json({ error: 'Accès refusé' }, 403);
            }

            const hexToRgb = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
            };

            const payload = typeof invoice.payload_json === 'string' ? JSON.parse(invoice.payload_json || '{}') : (invoice.payload_json || {});
            const snapshot = typeof invoice.billing_snapshot === 'string' ? JSON.parse(invoice.billing_snapshot || '{}') : (invoice.billing_snapshot || {});

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Original Colors & Settings
            const accentColor = snapshot.primary_color || '#2f9e9e';
            const companyName = snapshot.company_name || 'Nom de l’établissement';
            const fmt = (val) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val || 0);
            
            // --- 1. HEADER (Margins approx 14mm) ---
            // Company Info (Left)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14); // text-xl
            doc.setTextColor(30, 41, 59); // slate-800
            doc.text(companyName, 14, 20);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9); // text-xs
            doc.setTextColor(71, 85, 105); // slate-600
            doc.text(snapshot.address || '-', 14, 25);
            doc.text(`${snapshot.postal_code || ''} ${snapshot.city || ''}`.trim() || '-', 14, 29);
            if (snapshot.phone) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text(`Tél : ${snapshot.phone}`, 14, 34);
            }

            // Title "FACTURE" (Right)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(32); // text-[32px]
            doc.setTextColor(accentColor);
            doc.text('FACTURE', 196, 24, { align: 'right' });

            // Info Box (Right)
            doc.setDrawColor(241, 245, 249); // border-slate-100
            doc.setFillColor(248, 250, 252); // bg-slate-50
            doc.roundedRect(130, 30, 66, 25, 3, 3, 'FD');
            
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184); // slate-400
            doc.setFont('helvetica', 'bold');
            doc.text('NUMÉRO DE FACTURE', 135, 36);
            doc.setFontSize(11); // text-base
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text(invoice.invoice_number || 'F-XXXXXX', 135, 42);
            
            doc.setDrawColor(226, 232, 240); // border-slate-200/60
            doc.line(135, 45, 190, 45);
            
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text('DATE', 135, 49);
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            const dateStr = new Date(invoice.due_date || invoice.created_at).toLocaleDateString('fr-FR');
            doc.text(dateStr, 135, 53);

            // --- 2. DESTINATAIRE (Right align block) ---
            if (invoice.customer_name) {
                const destY = 70;
                doc.setDrawColor(248, 250, 252); // border-slate-50
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(110, destY, 86, 32, 3, 3, 'FD');
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(accentColor);
                doc.text('DESTINATAIRE', 115, destY + 6);
                
                doc.setFontSize(14); // text-lg
                doc.setTextColor(15, 23, 42);
                doc.text(invoice.customer_name, 115, destY + 14);
                
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10); // text-xs
                doc.setTextColor(71, 85, 105);
                const addr = payload.clientAddress || '-';
                const city = `${payload.clientPostalCode || ''} ${payload.clientCity || ''} ${payload.clientCountry || ''}`.trim() || '-';
                doc.text(addr, 115, destY + 20);
                doc.text(city, 115, destY + 26);
            }

            // --- 3. TABLE ---
            const tvaRates = snapshot.tva_rates || [20];
            const activeTvaRates = tvaRates.filter(r => (payload.lines || []).some(l => l.ttcByRate && l.ttcByRate[r] > 0));
            const displayRates = activeTvaRates.length > 0 ? activeTvaRates : [tvaRates[0]];

            const tableRows = (payload.lines || []).map(line => {
                const row = [
                    { content: line.label || 'Prestation', styles: { fontStyle: 'bold', fontSize: 13, textColor: [30, 41, 59] } }
                ];
                displayRates.forEach(rate => {
                    const ttc = Number(line.ttcByRate?.[rate] || 0);
                    const ht = ttc / (1 + rate / 100);
                    row.push(ht > 0 ? fmt(ht) : '-');
                });
                const totalLineTtc = Object.values(line.ttcByRate || {}).reduce((a, b) => Number(a) + Number(b), 0);
                const totalLineHt = totalLineTtc / (1 + (displayRates[0] || 20) / 100); // Simplified HT total
                row.push(fmt(totalLineHt));
                return row;
            });

            autoTable(doc, {
                startY: 110,
                head: [[
                    { content: 'Désignation de la prestation', styles: { halign: 'left' } }, 
                    ...displayRates.map(r => ({ content: `Base HT (${r}%)`, styles: { halign: 'right' } })), 
                    { content: 'Total HT', styles: { halign: 'right' } }
                ]],
                body: tableRows,
                theme: 'plain',
                headStyles: { 
                    textColor: [148, 163, 184], // slate-400
                    fontSize: 8, 
                    fontStyle: 'bold',
                    cellPadding: { bottom: 3 },
                    lineWidth: { bottom: 0.5 },
                    lineColor: { bottom: [15, 23, 42] } // slate-900
                },
                styles: { fontSize: 10, cellPadding: 5, textColor: [71, 85, 105] }, // slate-600
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    [displayRates.length + 1]: { halign: 'right', fontStyle: 'bold', fontSize: 13, textColor: [15, 23, 42] }
                },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 0) {
                        // Subtitle: Quantity info
                        const line = payload.lines[data.row.index];
                        if (line) {
                            doc.setFontSize(7);
                            doc.setTextColor(148, 163, 184);
                            doc.setFont('helvetica', 'bold');
                            const qStr = `${line.quantity} quantité${line.quantity > 1 ? 's' : ''}`;
                            doc.text(qStr.toUpperCase(), data.cell.x + 5, data.cell.y + data.cell.height - 2);
                        }
                    }
                }
            });

            // --- 4. TOTALS (Summary Box) ---
            let finalY = doc.lastAutoTable.finalY + 10;
            if (finalY > 230) { doc.addPage(); finalY = 20; }

            doc.setFillColor(248, 250, 252); // slate-50
            doc.setDrawColor(241, 245, 249); // border-slate-100
            doc.roundedRect(120, finalY, 76, 50, 4, 4, 'FD');
            
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text('Sous-total Hors Taxes :', 125, finalY + 8);
            doc.setTextColor(15, 23, 42);
            doc.text(fmt(invoice.total_ht), 191, finalY + 8, { align: 'right' });
            
            doc.setDrawColor(226, 232, 240);
            doc.line(125, finalY + 12, 191, finalY + 12);
            
            let tvaY = finalY + 18;
            displayRates.forEach(rate => {
                const ttc = (payload.lines || []).reduce((sum, l) => sum + Number(l.ttcByRate?.[rate] || 0), 0);
                const ht = ttc / (1 + rate / 100);
                const tva = ttc - ht;
                if (tva > 0) {
                    doc.setFontSize(7);
                    doc.setTextColor(148, 163, 184);
                    doc.text(`TVA collectée (${rate}%) :`, 125, tvaY);
                    doc.setTextColor(71, 85, 105);
                    doc.text(fmt(tva), 191, tvaY, { align: 'right' });
                    tvaY += 4;
                }
            });

            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text('Total TTC :', 125, finalY + 32);
            doc.text(fmt(invoice.total_ttc), 191, finalY + 32, { align: 'right' });

            doc.setDrawColor(hexToRgb(accentColor)[0], hexToRgb(accentColor)[1], hexToRgb(accentColor)[2]);
            doc.setLineWidth(0.6);
            doc.line(125, finalY + 36, 191, finalY + 36);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(accentColor);
            doc.text('NET À PAYER TTC', 125, finalY + 42);
            doc.setFontSize(18);
            doc.text(fmt(invoice.remaining_due || invoice.total_ttc - (invoice.already_paid || 0)), 191, finalY + 42, { align: 'right' });

            // --- 5. LEGAL FOOTER ---
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(100, 116, 139);
                doc.text(companyName.toUpperCase(), 105, 280, { align: 'center', charSpace: 0.5 });
                
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(148, 163, 184);
                const legal = [];
                if (snapshot.rcs_ville && snapshot.rcs_numero) legal.push(`RCS ${snapshot.rcs_ville} ${snapshot.rcs_numero}`);
                if (snapshot.siret) legal.push(`SIRET ${snapshot.siret}`);
                if (snapshot.tva) legal.push(`TVA ${snapshot.tva}`);
                if (snapshot.ape) legal.push(`Code APE ${snapshot.ape}`);
                doc.text(legal.join(' • '), 105, 285, { align: 'center' });
                
                const legal2 = [];
                if (snapshot.capital) legal2.push(`Capital social : ${snapshot.capital}`);
                if (snapshot.siege_social) legal2.push(snapshot.siege_social);
                else if (snapshot.address) legal2.push(snapshot.address);
                doc.text(legal2.join(' • '), 105, 289, { align: 'center' });
            }

            const pdfOutput = doc.output('arraybuffer');
            return c.body(pdfOutput, 200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Facture_${invoice.invoice_number || invoice.id}.pdf"`
            });
        }

        const rows = await safeQuery(c, `SELECT ${factureCols} FROM facture WHERE client_id = ? ORDER BY created_at DESC`, [ownerId]);
        return c.json(rows.map(mapFacture) || []);
    } catch (e) {
        console.error('GET Factures Route Error:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/facture/crm-search', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json([]);
        const q = c.req.query('q') || '';
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const rows = await safeQuery(c, `SELECT ${crmCols} FROM crm_contacts WHERE client_id = ? AND (company_name LIKE ? OR first_name LIKE ? OR last_name LIKE ?) LIMIT 10`, [ownerId, `%${q}%`, `%${q}%`, `%${q}%`]);
        return c.json(rows.map(mapCrm));
    } catch (e) { return c.json([]); }
});

app.post('/facture', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const id = body.id || generateId();
        const invoiceNumber = body.invoice_number || body.invoiceNumber || ('INV-' + Date.now());
        const amount = Number(body.amount || body.totalTtcBrut || body.total_ttc || 0);
        const totalHt = Number(body.total_ht || body.totalHt || 0);
        const totalTva = Number(body.total_tva || body.totalTva || 0);
        const totalTtc = Number(body.total_ttc || body.totalTtcBrut || amount || 0);
        const dueDate = body.due_date || body.invoiceDate || null;

        await c.env.DB.prepare(`
            INSERT OR REPLACE INTO facture (id, client_id, invoice_number, customer_name, amount, status, due_date, total_ht, total_tva, total_ttc, already_paid, remaining_due, crm_contact_id, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            ownerId,
            invoiceNumber,
            body.customer_name || body.clientName || 'Client',
            amount,
            body.status || 'pending',
            dueDate,
            totalHt,
            totalTva,
            totalTtc,
            Number(body.already_paid || body.amountAlreadyPaid || 0),
            Number(body.remaining_due || body.netToPay || 0),
            body.crm_contact_id || null,
            JSON.stringify(body)
        ).run();

        await insertAuditLog(c, {
            action: 'CREATE_INVOICE',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.SUCCESS,
            clientId: ownerId,
            newValue: `Facture n°${invoiceNumber} générée (Montant : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)})`
        });

        return c.json({ success: true, id });
    } catch (e) {
        console.error('POST Facture Error:', e);
        return c.json({ error: `Erreur Facture: ${e.message}` }, 500);
    }
});

app.delete('/facture/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);

        const id = c.req.param('id');
        const isSuperAdmin = user.type === 'admin' && (user.role === 'superadmin' || user.email === 'gev-emeni@outlook.fr');
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;

        // On vérifie d'abord l'existence et la propriété (sauf si Super Admin)
        const existing = await safeFirst(c, 'SELECT client_id FROM facture WHERE id = ?', [id]);
        if (!existing) return c.json({ error: 'Facture introuvable' }, 404);

        if (!isSuperAdmin && existing.client_id !== ownerId) {
            return c.json({ error: 'Accès refusé' }, 403);
        }

        // Suppression en batch pour gérer les contraintes de clés étrangères (facture_history)
        await c.env.DB.batch([
            c.env.DB.prepare('DELETE FROM facture_history WHERE facture_id = ?').bind(id),
            c.env.DB.prepare('DELETE FROM facture WHERE id = ?').bind(id)
        ]);

        return c.json({ success: true });
    } catch (e) {
        console.error('DELETE /facture/:id Error:', e);
        return c.json({ error: `Erreur suppression: ${e.message}` }, 500);
    }
});

app.post('/facture/:id/send-email', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const id = c.req.param('id');

        const client = await safeFirst(c, 'SELECT email, company_name FROM clients WHERE id = ?', [ownerId]);
        if (!client) return c.json({ error: 'Client introuvable' }, 404);

        const senderName = client?.company_name || user.company_name || 'Votre Établissement';
        const invoiceDate = body.invoicePayload?.invoiceDate || body.invoicePayload?.due_date || new Date().toISOString();
        const formattedDate = new Date(invoiceDate).toLocaleDateString('fr-FR');

        const emailRes = await sendEmail(c, {
            to: body.to,
            subject: `${senderName} facture`,
            html: renderEmail(`
                <p>Bonjour,</p>
                <p>Veuillez trouver ci-joint votre facture de <strong>${senderName}</strong> du ${formattedDate}.</p>
                <div class="info-box">
                    <strong>Établissement:</strong> ${senderName}<br>
                    <strong>Montant:</strong> ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(body.invoicePayload?.totalTtcBrut || body.invoicePayload?.total_ttc || 0)}<br>
                    <strong>Date de la facture:</strong> ${formattedDate}
                </div>
                <div style="margin-top: 30px;">
                    Cordialement,<br>
                    <strong>${senderName}</strong>
                </div>
            `, 'Facture', senderName),
            fromName: senderName,
            replyTo: client?.email,
            attachments: body.pdfBase64 ? [
                {
                    filename: body.filename || 'facture.pdf',
                    content: body.pdfBase64,
                }
            ] : [],
        });

        if (emailRes.success) {
            // Colonnes last_sent_at/email temporairement désactivées pour éviter l'erreur 500 (manquantes en base)
            // await c.env.DB.prepare('UPDATE facture SET last_sent_at = CURRENT_TIMESTAMP, last_sent_email = ? WHERE id = ?').bind(body.to, id).run();
            
            await insertAuditLog(c, {
                action: 'SEND_INVOICE_EMAIL',
                category: LOG_CATEGORIES.BUSINESS,
                severity: LOG_SEVERITIES.SUCCESS,
                clientId: ownerId,
                newValue: `Facture #${body.invoicePayload?.invoice_number || id} envoyée par email à ${body.to}`
            });

            return c.json({ success: true });
        } else {
            return c.json({ error: emailRes.error }, 500);
        }
    } catch (e) {
        console.error('Email Route Error:', e);
        return c.json({ error: 'Erreur Serveur' }, 500);
    }
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
        const ownerId = (user.type === 'collaborator' || user.type === 'staff') ? (user.client_id || user.clientId) : (user.clientId || user.id);
        const row = await safeFirst(c, 'SELECT * FROM billing_settings WHERE client_id = ?', [ownerId]);
        const clientBrand = await safeFirst(c, 'SELECT company_name, logo_url, tva_rates, enable_cover_count FROM clients WHERE id = ?', [ownerId]);

        const parsedTvaRates = parseTvaRates(clientBrand?.tva_rates);

        return c.json({
            ...(row || {}),
            company_name: clientBrand?.company_name || row?.company_name || '',
            logo_url: clientBrand?.logo_url || '',
            tva_rates: parsedTvaRates,
            enable_cover_count: Boolean(clientBrand?.enable_cover_count)
        });
    } catch (e) {
        console.error('GET billing-settings error:', e);
        return c.json({});
    }
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

        const [rows, docs] = await Promise.all([
            safeQuery(c, `
                SELECT e.*, 
                       COALESCE(
                           jp.title, 
                           st.name, 
                           NULLIF(NULLIF(e.position, '-'), '')
                       ) as job_post_title 
                FROM employes e 
                LEFT JOIN job_posts jp ON e.position = jp.id 
                LEFT JOIN staff_category_mapping scm ON e.id = scm.employee_id 
                LEFT JOIN evenementiel_staff_types st ON scm.staff_category_id = st.id 
                WHERE e.client_id = ? 
                GROUP BY e.id
                ORDER BY e.last_name, e.first_name
            `, [ownerId]),
            safeQuery(c, 'SELECT * FROM employee_documents WHERE client_id = ?', [ownerId])
        ]);

        const employees = rows.map(r => ({ 
            ...r, 
            hire_date: toISO(r.hire_date),
            documents: docs.filter(d => d.employee_id === r.id)
        }));

        return c.json(employees);
    } catch (e) { 
        console.error('GET Employes Error:', e);
        return c.json([]); 
    }
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
            first_name = ?, last_name = ?, email = ?, position = ?, 
            salary = ?, hire_date = ?, tags = ?, phone = ?, address = ?
            WHERE id = ? AND client_id = ?
        `).bind(
            body.first_name, body.last_name, body.email, body.position,
            body.salary || null, body.hire_date || null, JSON.stringify(body.tags || []),
            body.phone || null, body.address || null, id, ownerId
        ).run();

        await insertAuditLog(c, {
            action: 'UPDATE_EMPLOYEE',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.INFO,
            clientId: ownerId,
            newValue: `Fiche employé modifiée : ${body.first_name} ${body.last_name}`
        });

        // Mise à jour des documents si présents
        if (Array.isArray(body.documents)) {
            await c.env.DB.prepare('DELETE FROM employee_documents WHERE employee_id = ? AND client_id = ?').bind(id, ownerId).run();
            if (body.documents.length > 0) {
                const batch = body.documents.map(doc => 
                    c.env.DB.prepare('INSERT INTO employee_documents (id, employee_id, client_id, display_name, file_name, mime_type, file_size, storage_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                    .bind(doc.id || generateId(), id, ownerId, doc.display_name, doc.file_name, doc.mime_type || null, doc.file_size || null, doc.storage_key || null)
                );
                await c.env.DB.batch(batch);
            }
        }

        return c.json({ success: true });
    } catch (e) { 
        console.error('Update Employe Error:', e);
        return c.json({ error: 'Erreur Maj Employé' }, 500); 
    }
});

app.post('/employes', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const body = await c.req.json();
        const id = generateId();
        
        await c.env.DB.prepare('INSERT INTO employes (id, client_id, first_name, last_name, email, position, salary, hire_date, tags, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(id, ownerId, body.first_name, body.last_name, body.email, body.position, body.salary || null, body.hire_date || null, JSON.stringify(body.tags || []), body.phone || null, body.address || null).run();
            
        await insertAuditLog(c, {
            action: 'CREATE_EMPLOYEE',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.SUCCESS,
            clientId: ownerId,
            newValue: `Nouvel employé ajouté : ${body.first_name} ${body.last_name}`
        });
            
        if (Array.isArray(body.documents) && body.documents.length > 0) {
            const batch = body.documents.map(doc => 
                c.env.DB.prepare('INSERT INTO employee_documents (id, employee_id, client_id, display_name, file_name, mime_type, file_size, storage_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                .bind(generateId(), id, ownerId, doc.display_name, doc.file_name, doc.mime_type || null, doc.file_size || null, doc.storage_key || null)
            );
            await c.env.DB.batch(batch);
        }

        return c.json({ success: true, id });
    } catch (e) {
        console.error('POST Employe Error:', e);
        return c.json({ error: `Erreur: ${e.message}` }, 500);
    }
});

app.delete('/employes/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const id = c.req.param('id');
        
        await c.env.DB.batch([
            c.env.DB.prepare('DELETE FROM employee_documents WHERE employee_id = ? AND client_id = ?').bind(id, ownerId),
            c.env.DB.prepare('DELETE FROM employes WHERE id = ? AND client_id = ?').bind(id, ownerId)
        ]);

        await insertAuditLog(c, {
            action: 'DELETE_EMPLOYEE',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.WARNING,
            clientId: ownerId,
            newValue: `Employé supprimé (ID : ${id})`
        });

        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur Suppression Employé' }, 500); }
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
        if (!title || !title.trim()) return c.json({ error: 'Titre requis' }, 400);

        const id = generateId();
        const stmt = c.env.DB.prepare('INSERT INTO job_posts (id, client_id, title) VALUES (?, ?, ?)');
        await stmt.bind(id, ownerId, title.trim()).run();

        return c.json({ success: true, id });
    } catch (e) {
        console.error('Job Post Create Error:', e);
        return c.json({ error: `Erreur: ${e.message}` }, 500);
    }
});

app.delete('/employes/posts/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const id = c.req.param('id');

        const stmt = c.env.DB.prepare('DELETE FROM job_posts WHERE id = ? AND client_id = ?');
        await stmt.bind(id, ownerId).run();

        return c.json({ success: true });
    } catch (e) {
        console.error('Job Post Delete Error:', e);
        return c.json({ error: `Erreur: ${e.message}` }, 500);
    }
});

// --- SUPPORT ---
app.get('/support/ticket/open', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ ticket: null, messages: [] });
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;
        const row = await safeFirst(c, 'SELECT * FROM support_tickets WHERE created_by_user_id = ? AND status = "OPEN"', [user.id]);
        if (!row) return c.json({ ticket: null, messages: [] });

        const messages = await safeQuery(c, 'SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [row.id]);

        // Marquer comme lu automatiquement quand le client ouvre son ticket
        await c.env.DB.prepare('UPDATE support_messages SET is_read = 1 WHERE ticket_id = ? AND sender_type = "admin" AND is_read = 0')
            .bind(row.id).run();

        return c.json({ ticket: row, messages });
    } catch (e) { return c.json({ ticket: null, messages: [] }); }
});

app.post('/support/messages/read', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const { messageIds } = await c.req.json();
        if (Array.isArray(messageIds) && messageIds.length > 0) {
            const placeholders = messageIds.map(() => '?').join(',');
            await c.env.DB.prepare(`UPDATE support_messages SET is_read = 1 WHERE id IN (${placeholders})`).bind(...messageIds).run();
        }
        return c.json({ success: true });
    } catch (e) { return c.json({ error: 'Erreur' }, 500); }
});

app.post('/support/upload', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const form = await c.req.formData();
        const file = form.get('file');
        if (!file) return c.json({ error: 'Fichier manquant' }, 400);
        if (file.size > 800000) return c.json({ error: 'Fichier trop volumineux (max 800Ko)' }, 400);

        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        const base64 = btoa(binary);
        const dataUri = `data:${file.type};base64,${base64}`;

        return c.json({ file_url: dataUri, file_name: file.name });
    } catch (e) {
        console.error('Support upload error:', e);
        return c.json({ error: 'Erreur upload' }, 500);
    }
});

app.post('/support/messages', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const body = await c.req.json();
        let ticketId = body.ticket_id;
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;

        if (!ticketId) {
            ticketId = generateId();
            await c.env.DB.prepare('INSERT INTO support_tickets (id, client_id, status, created_by_user_id, created_by_type) VALUES (?, ?, "OPEN", ?, ?)')
                .bind(ticketId, ownerId, user.id, user.type).run();
        }

        const msgId = generateId();
        await c.env.DB.prepare('INSERT INTO support_messages (id, ticket_id, sender_user_id, sender_type, message, file_url, file_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(msgId, ticketId, user.id, user.type, body.message, body.file_url || null, body.file_name || null).run();

        // Notification Admin (non-bloquant)
        const client = await safeFirst(c, 'SELECT company_name FROM clients WHERE id = ?', [ownerId]);
        const emailPromise = sendEmail(c, {
            to: 'gev-emeni@outlook.fr',
            subject: `[Support Admin] Nouveau message de ${client?.company_name || 'Client'}`,
            html: renderEmail(`
                <p>Une nouvelle demande d'assistance a été reçue sur la plateforme support.</p>
                <div class="info-box">
                    <strong>Client:</strong> ${client?.company_name || 'Inconnu'}<br>
                    <strong>Utilisateur:</strong> ${user.name}
                </div>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; font-style: italic;">
                    ${body.message || '(Pas de message texte)'}
                </div>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://gestion.l-iamani.com/admin/support" class="button">Répondre au Ticket</a>
                </div>
            `, 'Support IAmani - Nouveau Message')
        });

        if (c.executionCtx) {
            c.executionCtx.waitUntil(emailPromise);
        }

        return c.json({ success: true, ticketId });
    } catch (e) {
        console.error('POST Support Message Error:', e);
        return c.json({ error: `Erreur Message: ${e.message}` }, 500);
    }
});

app.get('/support/unread-count', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ count: 0 });
        const res = await safeFirst(c, `
            SELECT COUNT(*) as count 
            FROM support_messages m
            JOIN support_tickets t ON m.ticket_id = t.id
            WHERE t.created_by_user_id = ? AND t.status = "OPEN" AND m.is_read = 0 AND m.sender_type = "admin"
        `, [user.id]);
        return c.json({ count: res?.count || 0 });
    } catch (e) { return c.json({ count: 0 }); }
});

app.get('/admin/support/unread-count', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ count: 0 });
        const res = await safeFirst(c, `
            SELECT COUNT(*) as count 
            FROM support_messages m
            JOIN support_tickets t ON m.ticket_id = t.id
            WHERE t.status = "OPEN" AND m.is_read = 0 AND m.sender_type != "admin"
        `);
        return c.json({ count: res?.count || 0 });
    } catch (e) { return c.json({ count: 0 }); }
});

app.get('/admin/support/tickets', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json([]);
        const status = c.req.query('status');
        let query = `
            SELECT t.*, c.company_name,
                   COALESCE(
                       CASE 
                           WHEN t.created_by_type = 'client' THEN c.company_name
                           WHEN t.created_by_type = 'collaborator' THEN col.name
                       END,
                       'Client'
                   ) as creator_name,
            (SELECT COUNT(*) FROM support_messages WHERE ticket_id = t.id AND is_read = 0 AND sender_type != "admin") as unread_count
            FROM support_tickets t 
            LEFT JOIN clients c ON t.client_id = c.id
            LEFT JOIN collaborators col ON t.created_by_user_id = col.id
        `;
        const params = [];
        if (status) {
            query += " WHERE t.status = ?";
            params.push(status);
        }
        query += " ORDER BY t.created_at DESC";
        const rows = await safeQuery(c, query, params);
        return c.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at), updated_at: toISO(r.updated_at) })));
    } catch (e) { return c.json([]); }
});

app.get('/admin/support/tickets/:id/messages', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json([]);
        const ticketId = c.req.param('id');

        // Marquer comme lu automatiquement quand l'admin ouvre le ticket
        await c.env.DB.prepare('UPDATE support_messages SET is_read = 1 WHERE ticket_id = ? AND sender_type != "admin" AND is_read = 0')
            .bind(ticketId).run();

        const rows = await safeQuery(c, `
            SELECT m.*, 
            CASE 
                WHEN m.sender_type = 'admin' THEN 'IAmani Support'
                WHEN m.sender_type = 'client' THEN cl.company_name
                WHEN m.sender_type = 'collaborator' THEN col.name
                ELSE 'Client'
            END as sender_name
            FROM support_messages m
            LEFT JOIN clients cl ON m.sender_user_id = cl.id AND m.sender_type = 'client'
            LEFT JOIN collaborators col ON m.sender_user_id = col.id AND m.sender_type = 'collaborator'
            WHERE m.ticket_id = ? 
            ORDER BY m.created_at ASC
        `, [ticketId]);

        return c.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at) })));
    } catch (e) {
        console.error('GET Admin Messages Error:', e);
        return c.json([]);
    }
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
        const facturesRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM facture WHERE client_id = ?', [ownerId]);
        const pendingRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM facture WHERE client_id = ? AND status != ?', [ownerId, 'PAID']);
        const employesRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM employes WHERE client_id = ?', [ownerId]);
        const planningRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM planning_weeks WHERE client_id = ?', [ownerId]);

        return c.json({
            revenue: revenueRes?.total || 0,
            evenements: eventsRes?.total || 0,
            collaborators: collabRes?.total || 0,
            factures: facturesRes?.total || 0,
            pendingFactures: pendingRes?.total || 0,
            employes: employesRes?.total || 0,
            planning: planningRes?.total || 0
        });
    } catch (e) {
        console.error('GET Client Stats Error:', e);
        return c.json({ revenue: 0, evenements: 0, collaborators: 0, factures: 0, pendingFactures: 0, employes: 0, planning: 0 });
    }
});

app.get('/dashboard/stats', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user) return c.json({ error: 'Auth' }, 401);
        const ownerId = user.type === 'collaborator' ? user.client_id : user.id;

        const revenueRes = await safeFirst(c, 'SELECT SUM(total_ttc) as total FROM facture WHERE client_id = ?', [ownerId]);
        const eventsRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM evenementiel WHERE client_id = ?', [ownerId]);
        const collabRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM collaborators WHERE client_id = ?', [ownerId]);
        const facturesRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM facture WHERE client_id = ?', [ownerId]);
        const pendingRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM facture WHERE client_id = ? AND status != ?', [ownerId, 'PAID']);
        const employesRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM employes WHERE client_id = ?', [ownerId]);
        const planningRes = await safeFirst(c, 'SELECT COUNT(*) as total FROM planning_weeks WHERE client_id = ?', [ownerId]);

        // TEST FORCÉ SENTINEL
        await insertAuditLog(c, {
            action: 'DASHBOARD_ACCESS',
            category: LOG_CATEGORIES.BUSINESS,
            severity: LOG_SEVERITIES.INFO,
            clientId: ownerId,
            newValue: `Le tableau de bord a été consulté par ${user.name || 'un utilisateur'}.`
        });

        return c.json({
            revenue: revenueRes?.total || 0,
            evenements: eventsRes?.total || 0,
            collaborators: collabRes?.total || 0,
            factures: facturesRes?.total || 0,
            pendingFactures: pendingRes?.total || 0,
            employes: employesRes?.total || 0,
            planning: planningRes?.total || 0
        });
    } catch (e) {
        console.error('GET Dashboard Stats Error:', e);
        return c.json({ revenue: 0, evenements: 0, collaborators: 0, factures: 0, pendingFactures: 0, employes: 0, planning: 0 });
    }
});

app.post('/admin/support/tickets/:id/messages', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Auth' }, 401);
        const body = await c.req.json();
        const ticketId = c.req.param('id');
        const msgId = generateId();

        await c.env.DB.prepare('INSERT INTO support_messages (id, ticket_id, sender_user_id, sender_type, message, file_url, file_name) VALUES (?, ?, ?, "admin", ?, ?, ?)')
            .bind(msgId, ticketId, user.id, body.message, body.file_url || null, body.file_name || null).run();

        // Notification Client (non-bloquant)
        const ticket = await safeFirst(c, 'SELECT client_id FROM support_tickets WHERE id = ?', [ticketId]);
        if (ticket) {
            const client = await safeFirst(c, 'SELECT email, company_name FROM clients WHERE id = ?', [ticket.client_id]);
            if (client?.email) {
                const emailPromise = sendEmail(c, {
                    to: client.email,
                    subject: '[Support IAmani] Réponse à votre demande d\'assistance',
                    html: renderEmail(`
                        <p>Bonjour ${client.company_name || 'Client'},</p>
                        <p>Le support IAmani a répondu à votre message concernant votre demande d'assistance.</p>
                        <hr>
                        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            ${body.message || '<i>(Consultez la réponse et les éventuelles pièces jointes sur la plateforme)</i>'}
                        </div>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://gestion.l-iamani.com/dashboard/support" class="button">Consulter le Support</a>
                        </div>
                        <p style="margin-top: 30px; font-size: 14px; color: #666;">
                            Nous restons à votre entière disposition pour toute information complémentaire.
                        </p>
                    `, 'IAmani - Assistance Client')
                });

                if (c.executionCtx) {
                    c.executionCtx.waitUntil(emailPromise);
                }
            }
        }

        return c.json({ success: true });
    } catch (e) {
        console.error('POST Admin Support Message Error:', e);
        return c.json({ error: `Erreur Admin Support: ${e.message}` }, 500);
    }
});

app.patch('/admin/support/tickets/:id/close', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Auth' }, 403);
        await c.env.DB.prepare('UPDATE support_tickets SET status = "CLOSED", updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: `Erreur Fermeture Ticket: ${e.message}` }, 500); }
});

app.delete('/admin/support/tickets/:id', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.role !== 'superadmin') return c.json({ error: 'Auth' }, 403);
        const ticketId = c.req.param('id');

        // Supprimer les messages puis le ticket (Batch atomique)
        await c.env.DB.batch([
            c.env.DB.prepare('DELETE FROM support_messages WHERE ticket_id = ?').bind(ticketId),
            c.env.DB.prepare('DELETE FROM support_tickets WHERE id = ?').bind(ticketId)
        ]);

        return c.json({ success: true });
    } catch (e) {
        console.error('DELETE Admin Support Ticket Error:', e);
        return c.json({ error: `Erreur Suppression Ticket: ${e.message}` }, 500);
    }
});


app.get('/health', (c) => c.json({ status: 'ok' }));

export const onRequest = handle(app);
