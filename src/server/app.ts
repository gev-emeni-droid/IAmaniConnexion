
// ...existing code...


import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify, sign } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { serveStatic } from '@hono/node-server/serve-static';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import localDb from '../../database.ts';

// Création de la table d'historique des actions sur les factures
const ensureFactureHistoryTable = async (db: any) => {
    await db.prepare(`CREATE TABLE IF NOT EXISTS facture_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facture_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        action TEXT NOT NULL, -- 'email', 'print', 'download'
        email TEXT,
        pdf_filename TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(facture_id, client_id, action, email, pdf_filename)
    )`).run();
    // Ajout colonne pdf_filename si migration
    const cols = await db.prepare('PRAGMA table_info(facture_history)').all();
    if (!cols.some((c:any) => c.name === 'pdf_filename')) {
        await db.prepare('ALTER TABLE facture_history ADD COLUMN pdf_filename TEXT').run();
    }
};

// Load local overrides first, then fallback to .env.
loadEnv({ path: '.env.local' });
loadEnv();

// Type pour D1Database si les types Cloudflare ne sont pas chargés
interface D1Database {
    prepare(sql: string): any;
}

type Bindings = {
    DB: D1Database;
    JWT_SECRET: string;
    RESEND_API_KEY: string;
};

const app = new Hono<{
    Bindings: Bindings;
    Variables: {
        user: any;
    }
}>();

app.onError((err, c) => {
    console.error(`[CRITICAL APP ERROR] ${err.message}`, err.stack);
    return c.json({ error: 'Internal Server Error: ' + err.message }, 500);
});

const DEFAULT_JWT_SECRET = 'super-secret-key';
const SUPER_ADMIN_EMAIL = 'gev-emeni@outlook.fr';
const CRM_AUTO_PHONE_PREFIX = '__AUTO_NOPHONE__:';
const uploadsRoot = path.join(process.cwd(), 'uploads');
const logosRoot = path.join(uploadsRoot, 'logos');
const supportRoot = path.join(uploadsRoot, 'support');

// Ensure upload folders exist on boot.
if (!fs.existsSync(logosRoot)) {
    fs.mkdirSync(logosRoot, { recursive: true });
}
if (!fs.existsSync(supportRoot)) {
    fs.mkdirSync(supportRoot, { recursive: true });
}

app.use('/api/*', cors());
app.use('/uploads/*', serveStatic({
    root: './uploads',
    rewriteRequestPath: (p: string) => p.replace(/^\/uploads/, '')
} as any));

app.use('*', async (c, next) => {
    console.log(`[Hono Request] ${c.req.method} ${c.req.path}`);
    await next();
    console.log(`[Hono Response] ${c.req.method} ${c.req.path} -> ${c.res.status}`);
});

// Helper to get DB (D1 or Local)
const getDb = (c: any) => {
    if (c.env?.DB) {
        // Wrapper for D1 to match better-sqlite3 interface for simplicity in this refactor
        // In a real production app, we'd use a more robust abstraction or Drizzle ORM
        return {
            prepare: (sql: string) => ({
                get: async (...params: any[]) => (await c.env.DB.prepare(sql).bind(...params).first()),
                all: async (...params: any[]) => (await c.env.DB.prepare(sql).bind(...params).all()).results,
                run: async (...params: any[]) => (await c.env.DB.prepare(sql).bind(...params).run()),
            })
        };
    }
    return localDb;
};

// Initialisation de la table d'historique au démarrage
ensureFactureHistoryTable(localDb).catch(console.error);
const resolveClientId = (user: any, bodyClientId?: string) => {
    if (user.type === 'admin') {
        return bodyClientId || null;
    }
    return user.clientId;
};

const getRequestIp = (c: any) => {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) return String(forwarded).split(',')[0].trim();
    return c.req.header('x-real-ip') || 'unknown';
};

const ensureClientFiscalColumns = async (db: any) => {
    const cols = await db.prepare('PRAGMA table_info(clients)').all() as any[];
    const names = new Set((cols || []).map((c: any) => String(c.name || '')));
    if (!names.has('default_tva_rate')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN default_tva_rate TEXT DEFAULT '20'").run();
    }
    if (!names.has('default_tva_custom_rate')) {
        await db.prepare('ALTER TABLE clients ADD COLUMN default_tva_custom_rate REAL').run();
    }
    if (!names.has('tva_rates')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN tva_rates TEXT DEFAULT '[]'").run();
    }
    if (!names.has('enable_cover_count')) {
        await db.prepare('ALTER TABLE clients ADD COLUMN enable_cover_count INTEGER DEFAULT 0').run();
    }
    if (!names.has('account_manager_first_name')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN account_manager_first_name TEXT DEFAULT ''").run();
    }
    if (!names.has('account_manager_last_name')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN account_manager_last_name TEXT DEFAULT ''").run();
    }
    if (!names.has('account_manager_phone')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN account_manager_phone TEXT DEFAULT ''").run();
    }
    if (!names.has('account_manager_email')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN account_manager_email TEXT DEFAULT ''").run();
    }
    if (!names.has('legal_form')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN legal_form TEXT DEFAULT ''").run();
    }
    if (!names.has('siret')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN siret TEXT DEFAULT ''").run();
    }
    if (!names.has('vat_number')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN vat_number TEXT DEFAULT ''").run();
    }
    if (!names.has('company_address')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN company_address TEXT DEFAULT ''").run();
    }
    if (!names.has('company_postal_code')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN company_postal_code TEXT DEFAULT ''").run();
    }
    if (!names.has('company_city')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN company_city TEXT DEFAULT ''").run();
    }
    if (!names.has('company_country')) {
        await db.prepare("ALTER TABLE clients ADD COLUMN company_country TEXT DEFAULT 'France'").run();
    }
    if (!names.has('company_employee_count')) {
        await db.prepare('ALTER TABLE clients ADD COLUMN company_employee_count INTEGER DEFAULT 0').run();
    }
};

const ensureBillingSettingsTable = async (db: any) => {
    await db.prepare(`CREATE TABLE IF NOT EXISTS billing_settings (
        client_id TEXT PRIMARY KEY,
        company_name TEXT DEFAULT '',
        logo_url TEXT DEFAULT '',
        address TEXT DEFAULT '',
        postal_code TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT 'France',
        siret TEXT DEFAULT '',
        tva TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        capital TEXT DEFAULT '',
        ape TEXT DEFAULT '',
        siege_social TEXT DEFAULT '',
        rcs_ville TEXT DEFAULT '',
        rcs_numero TEXT DEFAULT '',
        prestations_catalog TEXT DEFAULT '[]',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )`).run();
};

const ensureFactureColumns = async (db: any) => {
    await db.prepare(`CREATE TABLE IF NOT EXISTS facture (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        due_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    const cols = await db.prepare('PRAGMA table_info(facture)').all() as any[];
    const names = new Set((cols || []).map((c: any) => String(c.name || '')));
    if (!names.has('payload_json')) {
        await db.prepare("ALTER TABLE facture ADD COLUMN payload_json TEXT DEFAULT '{}' ").run();
    }
    if (!names.has('billing_snapshot')) {
        await db.prepare("ALTER TABLE facture ADD COLUMN billing_snapshot TEXT DEFAULT '{}' ").run();
    }
    if (!names.has('total_ht')) {
        await db.prepare('ALTER TABLE facture ADD COLUMN total_ht REAL DEFAULT 0').run();
    }
    if (!names.has('total_tva')) {
        await db.prepare('ALTER TABLE facture ADD COLUMN total_tva REAL DEFAULT 0').run();
    }
    if (!names.has('total_ttc')) {
        await db.prepare('ALTER TABLE facture ADD COLUMN total_ttc REAL DEFAULT 0').run();
    }
    if (!names.has('already_paid')) {
        await db.prepare('ALTER TABLE facture ADD COLUMN already_paid REAL DEFAULT 0').run();
    }
    if (!names.has('remaining_due')) {
        await db.prepare('ALTER TABLE facture ADD COLUMN remaining_due REAL DEFAULT 0').run();
    }
    if (!names.has('crm_contact_id')) {
        await db.prepare('ALTER TABLE facture ADD COLUMN crm_contact_id TEXT').run();
    }
};

const ensureCrmContactColumns = async (db: any) => {
    const cols = await db.prepare('PRAGMA table_info(crm_contacts)').all() as any[];
    const names = new Set((cols || []).map((c: any) => String(c.name || '')));
    if (!names.has('address')) {
        await db.prepare("ALTER TABLE crm_contacts ADD COLUMN address TEXT DEFAULT ''").run();
    }
    if (!names.has('postal_code')) {
        await db.prepare("ALTER TABLE crm_contacts ADD COLUMN postal_code TEXT DEFAULT ''").run();
    }
    if (!names.has('city')) {
        await db.prepare("ALTER TABLE crm_contacts ADD COLUMN city TEXT DEFAULT ''").run();
    }
    if (!names.has('country')) {
        await db.prepare("ALTER TABLE crm_contacts ADD COLUMN country TEXT DEFAULT 'France'").run();
    }
};

const isAutoPhone = (phone: any) => String(phone || '').startsWith(CRM_AUTO_PHONE_PREFIX);

const toPublicPhone = (phone: any) => {
    const value = String(phone || '').trim();
    return isAutoPhone(value) ? '' : value;
};

const buildCRMPhoneStorageValue = (params: {
    phone?: any;
    email?: any;
    type?: any;
    companyName?: any;
    firstName?: any;
    lastName?: any;
}) => {
    const normalizedPhone = String(params.phone || '').trim();
    if (normalizedPhone) return normalizedPhone;

    const normalizedEmail = String(params.email || '').trim().toLowerCase();
    const normalizedType = String(params.type || '').toUpperCase();
    const normalizedCompany = String(params.companyName || '').trim().toLowerCase();
    const normalizedFirst = String(params.firstName || '').trim().toLowerCase();
    const normalizedLast = String(params.lastName || '').trim().toLowerCase();

    if (normalizedEmail) return `${CRM_AUTO_PHONE_PREFIX}email:${normalizedEmail}`;
    if (normalizedType === 'PROFESSIONNEL' && normalizedCompany) {
        return `${CRM_AUTO_PHONE_PREFIX}company:${normalizedCompany}`;
    }
    if (normalizedFirst || normalizedLast) {
        return `${CRM_AUTO_PHONE_PREFIX}name:${normalizedFirst}:${normalizedLast}`;
    }
    return `${CRM_AUTO_PHONE_PREFIX}${crypto.randomUUID().substring(0, 8)}`;
};

type ImportEmployeeRow = {
    last_name: string;
    first_name: string;
    position: string;
    email?: string;
    phone?: string;
};

const extractRowsFromExcel = (arrayBuffer: ArrayBuffer) => {
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length === 0) {
        throw new Error('Le fichier Excel est vide.');
    }

    const firstRow = rows[0];
    const keys = Object.keys(firstRow);
    const findCol = (...candidates: string[]) =>
        keys.find((k) => candidates.some((c) => k.trim().toLowerCase() === c.toLowerCase())) ?? null;

    const colNom = findCol('nom', 'last_name', 'lastname', 'name');
    const colPrenom = findCol('prénom', 'prenom', 'first_name', 'firstname');
    const colPoste = findCol('poste', 'position', 'titre', 'title', 'role');
    const colEmail = findCol('email', 'e-mail', 'mail', 'courriel');
    const colPhone = findCol('téléphone', 'telephone', 'tel', 'phone');

    const missing: string[] = [];
    if (!colNom) missing.push('Nom');
    if (!colPrenom) missing.push('Prénom');
    if (!colPoste) missing.push('Poste');
    if (missing.length > 0) {
        throw new Error(`Colonnes manquantes dans le fichier : ${missing.join(', ')}.`);
    }

    const parsedRows: ImportEmployeeRow[] = rows.map((row: any) => ({
        last_name: String(row[colNom!] || '').trim(),
        first_name: String(row[colPrenom!] || '').trim(),
        position: String(row[colPoste!] || '').trim(),
        email: colEmail ? String(row[colEmail] || '').trim() : '',
        phone: colPhone ? String(row[colPhone] || '').trim() : ''
    }));

    return {
        sourceType: 'excel' as const,
        totalRows: rows.length,
        parsedRows
    };
};

const extractRowsFromPdf = async (arrayBuffer: ArrayBuffer) => {
    const parser = new PDFParse({ data: Buffer.from(arrayBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = String(parsed?.text || '');
    if (!text.trim()) {
        throw new Error('Le PDF ne contient pas de texte exploitable.');
    }

    const lines = text
        .split(/\r?\n/)
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    const parsedRows: ImportEmployeeRow[] = [];
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes('nom') && lower.includes('prénom')) continue;
        if (lower.includes('poste') && lower.includes('téléphone')) continue;

        let cols: string[] = [];
        if (/[;|\t]/.test(line)) {
            cols = line.split(/[;|\t]/).map((c) => c.trim()).filter(Boolean);
        } else if (/\s{2,}/.test(line)) {
            cols = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
        }

        if (cols.length >= 3) {
            parsedRows.push({
                last_name: String(cols[0] || '').trim(),
                first_name: String(cols[1] || '').trim(),
                position: String(cols[2] || '').trim(),
                phone: String(cols[3] || '').trim()
            });
            continue;
        }

        const simpleMatch = line.match(/^([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,})\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,})\s+-\s+([^\-]{2,})(?:\s+-\s+(\+?[\d .\-]{7,}))?$/);
        if (simpleMatch) {
            parsedRows.push({
                last_name: simpleMatch[1].trim(),
                first_name: simpleMatch[2].trim(),
                position: simpleMatch[3].trim(),
                phone: (simpleMatch[4] || '').trim()
            });
        }
    }

    if (parsedRows.length === 0) {
        throw new Error('Aucune ligne RH détectée dans le PDF. Format attendu: Nom, Prénom, Poste, Tel.');
    }

    return {
        sourceType: 'pdf' as const,
        totalRows: parsedRows.length,
        parsedRows
    };
};

const analyzeImportRows = async (db: any, clientId: string, rows: ImportEmployeeRow[]) => {
    const existingPosts: { id: string; title: string }[] = await db.prepare('SELECT id, title FROM job_posts WHERE client_id = ?').all(clientId) as any[];
    const existingTitles = new Set(existingPosts.map((p: any) => String(p.title).trim().toLowerCase()));

    const newPostTitles = new Set<string>();
    const validRows: ImportEmployeeRow[] = [];
    const errors: string[] = [];

    rows.forEach((row, i) => {
        const lastName = String(row.last_name || '').trim();
        const firstName = String(row.first_name || '').trim();
        const position = String(row.position || '').trim();
        const email = String(row.email || '').trim();
        const phone = String(row.phone || '').trim();

        if (!lastName || !firstName || !position) {
            errors.push(`Ligne ${i + 1} : Nom, Prénom ou Poste manquant.`);
            return;
        }
        const posKey = position.toLowerCase();
        if (!existingTitles.has(posKey)) newPostTitles.add(position);
        validRows.push({ last_name: lastName, first_name: firstName, position, email, phone });
    });

    return {
        validRows,
        newPosts: Array.from(newPostTitles),
        existingPosts: existingPosts.map((p: any) => p.title),
        errors: errors.slice(0, 20)
    };
};

const executeImportRows = async (db: any, clientId: string, rows: ImportEmployeeRow[]) => {
    const existingPosts: { id: string; title: string }[] = await db.prepare('SELECT id, title FROM job_posts WHERE client_id = ?').all(clientId) as any[];
    const postMap = new Map<string, string>(existingPosts.map((p: any) => [String(p.title).trim().toLowerCase(), p.id]));

    let postsCreated = 0;
    let employeesCreated = 0;
    let duplicatesSkipped = 0;
    const errorsList: string[] = [];
    const seenInFile = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lastName = String(row.last_name || '').trim();
        const firstName = String(row.first_name || '').trim();
        const positionTitle = String(row.position || '').trim();
        const email = String(row.email || '').trim();
        const phone = String(row.phone || '').trim();

        if (!lastName || !firstName || !positionTitle) {
            errorsList.push(`Ligne ${i + 1} : Nom, Prénom ou Poste manquant — ignoré.`);
            continue;
        }

        const posKey = positionTitle.toLowerCase();
        if (!postMap.has(posKey)) {
            const postId = crypto.randomUUID().substring(0, 8);
            try {
                await db.prepare('INSERT INTO job_posts (id, client_id, title) VALUES (?, ?, ?)').run(postId, clientId, positionTitle);
                postMap.set(posKey, postId);
                postsCreated++;
            } catch {
                const existing = await db.prepare('SELECT id FROM job_posts WHERE client_id = ? AND LOWER(title) = ?').get(clientId, posKey) as any;
                if (existing) postMap.set(posKey, existing.id);
            }
        }

        const postId = postMap.get(posKey);
        if (!postId) {
            errorsList.push(`Ligne ${i + 1} : Impossible de résoudre le poste "${positionTitle}".`);
            continue;
        }

        const nameKey = `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${postId}`;
        const emailKey = email.trim().toLowerCase();
        const phoneKey = phone.replace(/[^\d+]/g, '');
        const dedupeKey = `${nameKey}|${emailKey}|${phoneKey}`;

        // Doublon dans le même fichier importé
        if (seenInFile.has(dedupeKey)) {
            duplicatesSkipped++;
            continue;
        }
        seenInFile.add(dedupeKey);

        // Doublon déjà en base pour ce client
        const candidates = await db.prepare(`
            SELECT id, email, phone
            FROM employes
            WHERE client_id = ?
              AND LOWER(TRIM(first_name)) = ?
              AND LOWER(TRIM(last_name)) = ?
              AND position = ?
        `).all(clientId, firstName.trim().toLowerCase(), lastName.trim().toLowerCase(), postId) as any[];

        const isDuplicateInDb = (candidates || []).some((cand: any) => {
            const candEmail = String(cand?.email || '').trim().toLowerCase();
            const candPhone = String(cand?.phone || '').replace(/[^\d+]/g, '');

            if (emailKey && candEmail && emailKey === candEmail) return true;
            if (phoneKey && candPhone && phoneKey === candPhone) return true;
            if (!emailKey && !phoneKey) return true; // même nom+prénom+poste sans contact => doublon
            return false;
        });

        if (isDuplicateInDb) {
            duplicatesSkipped++;
            continue;
        }

        const empId = crypto.randomUUID().substring(0, 8);
        try {
            await db.prepare(`
                INSERT INTO employes (id, client_id, first_name, last_name, email, position, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(empId, clientId, firstName, lastName, email || null, postId, JSON.stringify([postId]));

            if (phone) {
                await db.prepare('UPDATE employes SET phone = ? WHERE id = ?').run(phone, empId);
            }
            employeesCreated++;
        } catch (e: any) {
            errorsList.push(`Ligne ${i + 1} (${firstName} ${lastName}) : ${e.message}`);
        }
    }

    return {
        postsCreated,
        employeesCreated,
        duplicatesSkipped,
        errors: errorsList.slice(0, 20)
    };
};

const insertAuditLog = async (
    db: any,
    params: {
        userId: string;
        targetUserId: string;
        action: string;
        oldValue?: string | null;
        newValue?: string | null;
        ipAddress?: string | null;
    }
) => {
    await db.prepare(`
        INSERT INTO audit_logs (id, user_id, target_user_id, action, old_value, new_value, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        crypto.randomUUID().substring(0, 12),
        params.userId,
        params.targetUserId,
        params.action,
        params.oldValue ?? null,
        params.newValue ?? null,
        params.ipAddress ?? null
    );
};

const archivePastCalendars = async (db: any, clientId: string) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    await db.prepare(`
        UPDATE evenementiel_calendars
        SET status = 'ARCHIVED'
        WHERE client_id = ?
        AND status = 'OPEN'
        AND (year < ? OR (year = ? AND month < ?))
    `).run(clientId, currentYear, currentYear, currentMonth);
};

const getSupportClientContext = async (db: any, user: any) => {
    if (user.type === 'client') {
        const client = await db.prepare('SELECT id, name, company_name, email FROM clients WHERE id = ?').get(user.id) as any;
        return { clientId: user.id, clientName: client?.name || user.name || 'Client', companyName: client?.company_name || client?.name || 'Client', clientEmail: client?.email || null };
    }
    if (user.type === 'collaborator') {
        const collab = await db.prepare('SELECT name, client_id FROM collaborators WHERE id = ?').get(user.id) as any;
        if (!collab?.client_id) return null;
        const client = await db.prepare('SELECT id, name, company_name, email FROM clients WHERE id = ?').get(collab.client_id) as any;
        return { clientId: collab.client_id, clientName: collab?.name || user.name || 'Collaborateur', companyName: client?.company_name || client?.name || 'Client', clientEmail: client?.email || null };
    }
    return null;
};

const sendSupportNotification = async (c: any, opts: { to: string; senderName: string; companyName: string; hasAttachment: boolean; ticketId?: string; clientId?: string; }) => {
    const resendKey = c.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (!resendKey || !opts.to) return;
    const resend = new Resend(resendKey);
    // Génère le lien vers le dashboard du client concerné
    const baseUrl = process.env.FRONTEND_URL || 'https://app.l-iamani.com';
    const dashboardUrl = opts.clientId ? `${baseUrl}/dashboard/${opts.clientId}/support` : `${baseUrl}/support`;
    await resend.emails.send({
        from: "L'IAmani <notification@l-iamani.com>",
        to: opts.to,
        subject: `Réponse du support L'IAmani - ${opts.companyName}`,
        html: `
            <div style="font-family: sans-serif; padding: 24px; color: #111; font-size: 16px;">
                <p>Bonjour,</p>
                <p><b>${opts.companyName}</b></p>
                <p>Vous venez de recevoir une réponse du support L'IAmani.<br>
                Cliquez sur le lien suivant pour la visualiser&nbsp;:</p>
                <p style="margin: 18px 0;"><a href="${dashboardUrl}" style="background:#2f9e9e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Voir la réponse</a></p>
                <p>Cordialement,<br>L'équipe L'IAmani</p>
            </div>
        `
    });
};

// --- Middlewares ---

const authMiddleware = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);
    
    const token = authHeader.split(' ')[1];
    try {
        const secret = c.env?.JWT_SECRET || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
        const payload = await verify(token, secret, 'HS256');
        c.set('user', payload);
        await next();
    } catch (e) {
        return c.json({ error: 'Invalid token' }, 401);
    }
};

const adminOnly = async (c: any, next: any) => {
    const user = c.get('user');
    if (user.type !== 'admin') return c.json({ error: 'Forbidden' }, 403);
    await next();
};

const superAdminOnly = async (c: any, next: any) => {
    const user = c.get('user');
    if (user.type !== 'admin' || user.email !== SUPER_ADMIN_EMAIL) {
        return c.json({ error: 'Super Admin access required' }, 403);
    }
    await next();
};

const moduleAccessMiddleware = async (c: any, next: any) => {
    const user = c.get('user');
    const db = getDb(c);
    const path = c.req.path;
    const moduleName = path.split('/')[2];
    const acceptedModules = [moduleName];

    if (moduleName === 'employes' && c.req.method === 'GET') {
        acceptedModules.push('evenementiel');
    }
    
    console.log(`[DEBUG] Accessing module: ${moduleName} for path: ${path}, user type: ${user?.type}`);
    
    if (user.type === 'admin') {
        await next();
        return;
    }

    const modulePlaceholders = acceptedModules.map(() => '?').join(', ');
    const clientModules = await db.prepare(`SELECT module_name, is_active FROM client_modules WHERE client_id = ? AND module_name IN (${modulePlaceholders})`)
        .all(user.clientId, ...acceptedModules) as any[];
    const hasActiveModule = (clientModules || []).some((row: any) => Number(row?.is_active || 0) === 1);
    
    if (!hasActiveModule) {
        return c.json({ error: 'Module not active for this client' }, 403);
    }
    
    if (user.type === 'collaborator') {
        const collab = await db.prepare('SELECT modules_access FROM collaborators WHERE id = ?').get(user.id) as any;
        let allowedModules: string[] = [];
        try {
            const parsed = JSON.parse(collab?.modules_access || '[]');
            allowedModules = Array.isArray(parsed) ? parsed.map((m: any) => String(m)) : [];
        } catch {
            allowedModules = [];
        }

        if (allowedModules.length === 0) {
            const rows = await db.prepare('SELECT module_name FROM collaborator_permissions WHERE collaborator_id = ? AND can_access = 1').all(user.id) as any[];
            allowedModules = (rows || []).map((r: any) => String(r.module_name));
        }

        const hasAllowedModule = acceptedModules.some((name) => allowedModules.includes(name));
        if (!hasAllowedModule) {
            return c.json({ error: 'Access denied to this module' }, 403);
        }
    }
    
    await next();
};

// --- Auth Routes ---

app.get('/api/health', (c) => {
    console.log('Health check requested');
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/admin/upload-logo', authMiddleware, adminOnly, async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body.logo as File | undefined;
        const clientIdRaw = body.client_id;
        const clientId = Array.isArray(clientIdRaw) ? String(clientIdRaw[0] || 'client') : String(clientIdRaw || 'client');

        if (!file || typeof (file as any).arrayBuffer !== 'function') {
            return c.json({ error: 'Fichier logo manquant.' }, 400);
        }

        const originalName = String((file as any).name || 'logo');
        const mimeType = String((file as any).type || '').toLowerCase();
        const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
        if (!allowedMime.includes(mimeType)) {
            return c.json({ error: 'Format non supporte. Utilisez .jpg, .png ou .svg.' }, 400);
        }

        const extFromName = path.extname(originalName).toLowerCase();
        const ext = extFromName || (mimeType === 'image/png' ? '.png' : (mimeType.includes('svg') ? '.svg' : '.jpg'));
        const safeClientId = clientId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'client';
        const filename = `logo-${safeClientId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
        const absolutePath = path.join(logosRoot, filename);

        const data = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(absolutePath, data);

        const logoUrl = `/uploads/logos/${filename}`;
        return c.json({ success: true, logo_url: logoUrl });
    } catch (e: any) {
        console.error('Error uploading logo:', e);
        return c.json({ error: e.message || 'Erreur upload logo' }, 400);
    }
});

app.post('/api/support/upload', authMiddleware, async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body.file as File | undefined;
        const user = c.get('user');
        if (!file || typeof (file as any).arrayBuffer !== 'function') {
            return c.json({ error: 'Fichier manquant.' }, 400);
        }

        const originalName = String((file as any).name || 'attachment');
        const extFromName = path.extname(originalName).toLowerCase();
        const ext = extFromName || '.bin';
        const safeUser = String(user?.id || 'user').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'user';
        const filename = `support-${safeUser}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
        const absolutePath = path.join(supportRoot, filename);

        const data = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(absolutePath, data);

        return c.json({ success: true, file_url: `/uploads/support/${filename}`, file_name: originalName });
    } catch (e: any) {
        console.error('Error uploading support file:', e);
        return c.json({ error: e.message || 'Erreur upload support' }, 400);
    }
});

const loginHandler = async (c: any) => {
    try {
        const { identifier, email: emailCompat, password } = await c.req.json();
        // Accept both 'identifier' (new) and 'email' (legacy compat)
        const login = (identifier || emailCompat || '').trim();
        const loginLower = login.toLowerCase();
        const db = getDb(c);

        if (!login) return c.json({ error: 'Identifiant requis' }, 400);

        console.log(`Login attempt for: ${login}`);

        // Admin by email OR username
        let user = await db.prepare('SELECT * FROM admins WHERE LOWER(email) = ? OR LOWER(username) = ?').get(loginLower, loginLower) as any;
        let type: 'admin' | 'client' | 'collaborator' = 'admin';

        // Client by email OR username
        if (!user) {
            user = await db.prepare('SELECT * FROM clients WHERE LOWER(email) = ? OR LOWER(username) = ?').get(loginLower, loginLower) as any;
            type = 'client';
        }

        // Collaborator by email OR username
        if (!user) {
            user = await db.prepare('SELECT * FROM collaborators WHERE LOWER(email) = ? OR LOWER(username) = ?').get(loginLower, loginLower) as any;
            type = 'collaborator';
        }

        if (!user) {
            console.log(`User not found: ${login}`);
            return c.json({ error: 'Utilisateur non trouvé' }, 404);
        }

        // Check status for clients and collaborators
        if (type !== 'admin' && user.status === 'blocked') {
            return c.json({ error: 'Votre compte a été suspendu, contactez l\'administrateur' }, 403);
        }

        const valid = bcrypt.compareSync(password, user.password);
        if (!valid) {
            console.log(`Invalid password for: ${login}`);
            return c.json({ error: 'Mot de passe incorrect' }, 401);
        }

        // Update last login
        if (type === 'client') {
            try {
                await db.prepare('UPDATE clients SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
            } catch (updateErr) {
                console.error('Failed to update last_login:', updateErr);
            }
        }

        let companyName: string | null = null;
        let logoUrl: string | null = null;
        if (type === 'client') {
            companyName = user.company_name || user.name || null;
            logoUrl = user.logo_url || null;
        } else if (type === 'collaborator') {
            const brand = await db.prepare('SELECT company_name, name, logo_url FROM clients WHERE id = ?').get(user.client_id) as any;
            companyName = brand?.company_name || brand?.name || null;
            logoUrl = brand?.logo_url || null;
        }

        const secret = c.env?.JWT_SECRET || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
        const mustChange = user.is_temporary_password === 1;
        const payload = {
            id: user.id,
            email: user.email,
            type,
            clientId: type === 'admin' ? null : (type === 'client' ? user.id : user.client_id),
            isTemporary: mustChange,
            mustChangePassword: mustChange,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
        };

        const token = await sign(payload, secret, 'HS256');

        console.log(`Login successful for: ${login} (${type})`);
        return c.json({
            token,
            user: {
                id: user.id,
                email: user.email || null,
                username: user.username || null,
                modules_access: type === 'collaborator' ? (() => {
                    try {
                        const parsed = JSON.parse(user.modules_access || '[]');
                        return Array.isArray(parsed) ? parsed.map((m: any) => String(m)) : [];
                    } catch {
                        return [];
                    }
                })() : undefined,
                companyName,
                logoUrl,
                type,
                name: user.name || user.username || user.email,
                isTemporary: mustChange,
                mustChangePassword: mustChange
            }
        });
    } catch (e: any) {
        console.error('Login error:', e);
        return c.json({ error: 'Erreur interne du serveur: ' + e.message }, 500);
    }
};

app.post('/api/login', loginHandler);
app.post('/api/auth/login', loginHandler);

// Force-change-password: update password + issue a fresh JWT without the mustChangePassword flag
app.post('/api/auth/force-change-password', authMiddleware, async (c) => {
    try {
        const { newPassword } = await c.req.json();
        if (!newPassword || String(newPassword).length < 8) {
            return c.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400);
        }
        const user = c.get('user');
        const db = getDb(c);
        const hashed = bcrypt.hashSync(String(newPassword), 10);

        if (user.type === 'client') {
            await db.prepare('UPDATE clients SET password = ?, is_temporary_password = 0 WHERE id = ?').run(hashed, user.id);
        } else if (user.type === 'collaborator') {
            await db.prepare('UPDATE collaborators SET password = ?, is_temporary_password = 0 WHERE id = ?').run(hashed, user.id);
        } else {
            await db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashed, user.id);
        }

        // Fetch fresh data to build new token
        let freshUser: any;
        let companyName: string | null = null;
        let logoUrl: string | null = null;
        if (user.type === 'client') {
            freshUser = await db.prepare('SELECT id, name, email, username, company_name, logo_url, status FROM clients WHERE id = ?').get(user.id) as any;
            companyName = freshUser?.company_name || freshUser?.name || null;
            logoUrl = freshUser?.logo_url || null;
        } else if (user.type === 'collaborator') {
            freshUser = await db.prepare(`
                SELECT c.id, c.name, c.email, c.username, c.status, c.modules_access, cl.company_name, cl.name AS client_name, cl.logo_url
                FROM collaborators c
                LEFT JOIN clients cl ON cl.id = c.client_id
                WHERE c.id = ?
            `).get(user.id) as any;
            companyName = freshUser?.company_name || freshUser?.client_name || null;
            logoUrl = freshUser?.logo_url || null;
        } else {
            freshUser = await db.prepare('SELECT id, name, email, username FROM admins WHERE id = ?').get(user.id) as any;
        }

        const secret = c.env?.JWT_SECRET || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
        const newPayload = {
            id: user.id,
            email: user.email,
            type: user.type,
            clientId: user.clientId,
            isTemporary: false,
            mustChangePassword: false,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
        };
        const newToken = await sign(newPayload, secret, 'HS256');

        let modulesAccess: string[] | undefined;
        if (user.type === 'collaborator' && freshUser?.modules_access) {
            try {
                const parsed = JSON.parse(freshUser.modules_access);
                modulesAccess = Array.isArray(parsed) ? parsed.map((m: any) => String(m)) : [];
            } catch { modulesAccess = []; }
        }

        return c.json({
            token: newToken,
            user: {
                id: user.id,
                email: freshUser?.email || null,
                username: freshUser?.username || null,
                type: user.type,
                name: freshUser?.name || freshUser?.username || freshUser?.email,
                companyName,
                logoUrl,
                modules_access: modulesAccess,
                isTemporary: false,
                mustChangePassword: false
            }
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

const meHandler = async (c: any) => {
    const user = c.get('user');
    console.log(`[DEBUG] /api/me request for: ${user.email}, type: ${user.type}, id: ${user.id}`);
    const db = getDb(c);
    let userData;
    try {
        if (user.type === 'client') {
            userData = await db.prepare('SELECT id, name, email, username, company_name, logo_url, status FROM clients WHERE id = ?').get(user.id) as any;
            if (userData) {
                userData.companyName = userData.company_name || userData.name || null;
                userData.logoUrl = userData.logo_url || null;
            }
        } else if (user.type === 'collaborator') {
            userData = await db.prepare(`
                SELECT c.id, c.name, c.email, c.username, c.status, c.modules_access, cl.company_name, cl.name AS client_name, cl.logo_url
                FROM collaborators c
                LEFT JOIN clients cl ON cl.id = c.client_id
                WHERE c.id = ?
            `).get(user.id) as any;
            if (userData) {
                userData.companyName = userData.company_name || userData.client_name || null;
                userData.logoUrl = userData.logo_url || null;
                try {
                    const parsed = JSON.parse(userData.modules_access || '[]');
                    userData.modules_access = Array.isArray(parsed) ? parsed.map((m: any) => String(m)) : [];
                } catch {
                    userData.modules_access = [];
                }
            }
        } else {
            userData = await db.prepare('SELECT id, name, email, username FROM admins WHERE id = ?').get(user.id);
            if (userData) {
                (userData as any).companyName = null;
                (userData as any).logoUrl = null;
            }
        }

        if (userData) {
            (userData as any).type = user.type;
            (userData as any).clientId = user.type === 'admin'
                ? null
                : ((user as any).clientId ?? (userData as any).id ?? null);
            (userData as any).impersonatedBySuperAdmin = Boolean((user as any).impersonatedBySuperAdmin);
            (userData as any).originalAdminEmail = (user as any).originalAdminEmail || null;
            console.log(`[DEBUG] Found user data: ${JSON.stringify(userData)}`);
        } else {
            console.warn(`[DEBUG] No user data found for id: ${user.id} in table for type: ${user.type}`);
        }

        return c.json(userData);
    } catch (err: any) {
        console.error(`[DEBUG] Error in /api/me: ${err.message}`);
        return c.json({ error: err.message }, 500);
    }
};

app.get('/api/me', authMiddleware, meHandler);
app.get('/api/auth/me', authMiddleware, meHandler);

app.get('/api/me/modules', authMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    
    if (user.type === 'admin') {
        // Admin has access to all modules conceptually, but doesn't use them
        return c.json([]);
    }
    
    if (user.type === 'collaborator') {
        const collab = await db.prepare('SELECT modules_access FROM collaborators WHERE id = ?').get(user.id) as any;
        let collaboratorModules: string[] = [];
        try {
            const parsed = JSON.parse(collab?.modules_access || '[]');
            collaboratorModules = Array.isArray(parsed) ? parsed.map((m: any) => String(m)) : [];
        } catch {
            collaboratorModules = [];
        }

        const clientModules = await db.prepare('SELECT module_name, is_active FROM client_modules WHERE client_id = ?').all(user.clientId) as any[];
        const activeClientModules = new Set((clientModules || []).filter((m: any) => Number(m.is_active) === 1).map((m: any) => String(m.module_name)));

        const normalized = Array.from(new Set(collaboratorModules)).filter((m) => activeClientModules.has(m));
        return c.json(normalized.map((module_name) => ({ module_name, is_active: 1 })));
    }

    const modules = await db.prepare('SELECT module_name, is_active FROM client_modules WHERE client_id = ?').all(user.clientId);
    return c.json(modules);
});

app.post('/api/change-password', authMiddleware, async (c) => {
    const { newPassword } = await c.req.json();
    const user = c.get('user');
    const db = getDb(c);
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    if (user.type === 'client') {
        await db.prepare('UPDATE clients SET password = ?, is_temporary_password = 0 WHERE id = ?').run(hashedPassword, user.id);
    } else if (user.type === 'collaborator') {
        await db.prepare('UPDATE collaborators SET password = ?, is_temporary_password = 0 WHERE id = ?').run(hashedPassword, user.id);
    } else {
        await db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashedPassword, user.id);
    }
    
    return c.json({ success: true });
});

app.put('/api/user/profile', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const { currentPassword, newEmail, newPassword } = await c.req.json();
        const requestIp = getRequestIp(c);

        const table = user.type === 'admin' ? 'admins' : (user.type === 'client' ? 'clients' : 'collaborators');
        const dbUser = user.type === 'collaborator'
            ? await db.prepare('SELECT id, client_id, email, password FROM collaborators WHERE id = ?').get(user.id) as any
            : await db.prepare(`SELECT id, email, password FROM ${table} WHERE id = ?`).get(user.id) as any;
        if (!dbUser) {
            return c.json({ error: 'Utilisateur introuvable.' }, 404);
        }

        const updates: string[] = [];
        const params: any[] = [];
        const shouldChangeEmail = newEmail !== undefined && String(newEmail).trim() !== String(dbUser.email || '').trim();
        const shouldChangePassword = !!newPassword;

        if (!shouldChangeEmail && !shouldChangePassword) {
            return c.json({ error: 'Aucune modification fournie.' }, 400);
        }

        if (shouldChangePassword) {
            if (!currentPassword) {
                return c.json({ error: 'Le mot de passe actuel est requis pour changer le mot de passe.' }, 400);
            }
            const passwordOk = bcrypt.compareSync(String(currentPassword), dbUser.password);
            if (!passwordOk) {
                return c.json({ error: 'Mot de passe actuel incorrect.' }, 401);
            }
        }

        if (shouldChangeEmail) {
            const normalizedEmail = String(newEmail || '').trim() || null;
            if (user.type !== 'collaborator' && !normalizedEmail) {
                return c.json({ error: 'Email obligatoire pour ce type de compte.' }, 400);
            }
            if (normalizedEmail) {
                const sameTableConflict = await db.prepare(`
                    SELECT id FROM admins WHERE LOWER(email) = LOWER(?) AND id <> ?
                    UNION SELECT id FROM clients WHERE LOWER(email) = LOWER(?) AND id <> ?
                    UNION SELECT id FROM collaborators WHERE LOWER(email) = LOWER(?) AND id <> ?
                `).get(normalizedEmail, user.id, normalizedEmail, user.id, normalizedEmail, user.id) as any;
                if (sameTableConflict) {
                    return c.json({ error: 'Cet email est déjà utilisé.' }, 400);
                }
            }
            updates.push('email = ?');
            params.push(normalizedEmail);
        }

        if (shouldChangePassword) {
            if (String(newPassword).length < 8) {
                return c.json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }, 400);
            }
            const hashed = bcrypt.hashSync(String(newPassword), 10);
            updates.push('password = ?');
            params.push(hashed);
            if (table !== 'admins') {
                updates.push('is_temporary_password = 0');
            }
        }

        params.push(user.id);
        await db.prepare(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        if (shouldChangeEmail) {
            await insertAuditLog(db, {
                userId: user.id,
                targetUserId: user.id,
                action: 'UPDATE_EMAIL',
                oldValue: dbUser.email || null,
                newValue: String(newEmail || '').trim() || null,
                ipAddress: requestIp
            });
        }

        if (shouldChangePassword) {
            await insertAuditLog(db, {
                userId: user.id,
                targetUserId: user.id,
                action: 'UPDATE_PASSWORD',
                oldValue: '[PROTECTED]',
                newValue: '[UPDATED]',
                ipAddress: requestIp
            });
        }

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Error updating user profile:', e);
        return c.json({ error: e.message }, 400);
    }
});

// --- Admin Routes ---

app.get('/api/admin/clients', authMiddleware, superAdminOnly, async (c) => {
    const db = getDb(c);
    await ensureClientFiscalColumns(db);
    await ensureBillingSettingsTable(db);
    const clients = await db.prepare(`
        SELECT
            c.id,
            c.name,
            c.email,
            c.username,
            COALESCE(NULLIF(c.company_name, ''), NULLIF(bs.company_name, ''), c.name) as company_name,
            c.logo_url,
            c.default_tva_rate,
            c.default_tva_custom_rate,
            c.tva_rates,
            c.enable_cover_count,
            c.status,
            c.last_login,
            c.created_at,
            c.account_manager_first_name,
            c.account_manager_last_name,
            COALESCE(NULLIF(c.account_manager_phone, ''), '') as account_manager_phone,
            COALESCE(NULLIF(c.account_manager_email, ''), '') as account_manager_email,
            COALESCE(NULLIF(bs.phone, ''), '') as company_phone,
            COALESCE(NULLIF(c.email, ''), '') as company_email,
            c.legal_form,
            COALESCE(NULLIF(c.siret, ''), NULLIF(bs.siret, ''), '') as siret,
            COALESCE(NULLIF(c.vat_number, ''), NULLIF(bs.tva, ''), '') as vat_number,
            COALESCE(NULLIF(c.company_address, ''), NULLIF(bs.address, ''), NULLIF(bs.siege_social, ''), '') as company_address,
            COALESCE(NULLIF(c.company_postal_code, ''), NULLIF(bs.postal_code, ''), '') as company_postal_code,
            COALESCE(NULLIF(c.company_city, ''), NULLIF(bs.city, ''), '') as company_city,
            COALESCE(NULLIF(c.company_country, ''), NULLIF(bs.country, ''), 'France') as company_country,
            c.company_employee_count,
            bs.capital,
            bs.ape,
            bs.rcs_ville,
            bs.rcs_numero,
            (SELECT COUNT(*) FROM employes e WHERE e.client_id = c.id) as employees_count,
            (SELECT COUNT(*) FROM collaborators co WHERE co.client_id = c.id) as collaborators_count,
            (SELECT COUNT(*) FROM evenementiel_calendars cal WHERE cal.client_id = c.id) as calendars_count,
            (SELECT COUNT(*) FROM evenementiel_spaces sp WHERE sp.client_id = c.id) as spaces_count
        FROM clients c
        LEFT JOIN billing_settings bs ON bs.client_id = c.id
        ORDER BY c.created_at DESC
    `).all();
    return c.json(clients);
});

app.post('/api/admin/clients', authMiddleware, superAdminOnly, async (c) => {
    try {
        const { name, email, username, company_name, logo_url, tva_rates, enable_cover_count, modules: selectedModules } = await c.req.json();
        const db = getDb(c);
        await ensureClientFiscalColumns(db);
        const cleanUsername = String(username || '').trim().toLowerCase();
        const cleanCompanyName = String(company_name || name || '').trim();
        const cleanLogoUrl = String(logo_url || '').trim() || null;
        const cleanCoverCount = enable_cover_count ? 1 : 0;
        const rawRates = Array.isArray(tva_rates) ? tva_rates : [];
        const cleanRates = [...new Set(rawRates.map(Number).filter((n: number) => Number.isFinite(n) && n >= 0))];
        const cleanRatesJson = JSON.stringify(cleanRates.length > 0 ? cleanRates : [20]);

        if (!cleanUsername) {
            return c.json({ error: 'Le pseudo de connexion est obligatoire.' }, 400);
        }
        
        console.log(`Creating client: ${name} (${email})`);
        
        // Check if email already exists
        const existing = await db.prepare('SELECT id FROM clients WHERE email = ?').get(email);
        if (existing) {
            console.log(`Client creation failed: Email ${email} already exists`);
            return c.json({ error: 'Un client avec cet email existe déjà' }, 400);
        }

        const usernameInUse = await db.prepare(`
            SELECT id FROM clients WHERE username = ?
            UNION SELECT id FROM collaborators WHERE username = ?
            UNION SELECT id FROM admins WHERE username = ?
        `).get(cleanUsername, cleanUsername, cleanUsername);
        if (usernameInUse) {
            return c.json({ error: `Le pseudo "${cleanUsername}" est déjà utilisé.` }, 400);
        }

        const usernameEmailClash = await db.prepare(`
            SELECT id FROM admins WHERE email = ?
            UNION SELECT id FROM collaborators WHERE email = ?
            UNION SELECT id FROM clients WHERE email = ?
        `).get(cleanUsername, cleanUsername, cleanUsername);
        if (usernameEmailClash) {
            return c.json({ error: `Le pseudo "${cleanUsername}" est déjà utilisé comme adresse email.` }, 400);
        }
        
        const id = crypto.randomBytes(4).toString('hex');
        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = bcrypt.hashSync(tempPassword, 10);
        
        console.log(`Generated ID: ${id}, Temp Password: ${tempPassword}`);
        
        try {
            await db.prepare('INSERT INTO clients (id, name, email, username, company_name, logo_url, tva_rates, enable_cover_count, password, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .run(id, name, email, cleanUsername, cleanCompanyName || name, cleanLogoUrl, cleanRatesJson, cleanCoverCount, hashedPassword, 'active');
        } catch (dbErr: any) {
            console.error('Database error during client insert:', dbErr);
            throw new Error(`Erreur base de données: ${dbErr.message}`);
        }
        
        // Modules provisioning
        try {
            const allModules = ['planning', 'evenementiel', 'facture', 'employes', 'crm'];
            for (const m of allModules) {
                const isActive = selectedModules && selectedModules.includes(m) ? 1 : 0;
                await db.prepare('INSERT INTO client_modules (client_id, module_name, is_active) VALUES (?, ?, ?)').run(id, m, isActive);
            }
        } catch (modErr: any) {
            console.error('Database error during modules insert:', modErr);
            // We might want to rollback here in a real app, but for now we'll just log
        }

        console.log('Client and modules inserted successfully');

        // Send Email via Resend
        const resendKey = c.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (resendKey) {
            console.log('Attempting to send welcome email...');
            const resend = new Resend(resendKey);
            try {
                await resend.emails.send({
                    from: "L'IAmani <notification@l-iamani.com>",
                    to: email,
                    subject: "Votre compte client L'IAmani",
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #000;">Bienvenue chez L'IAmani</h2>
                            <p>Bonjour ${name},</p>
                            <p>Votre compte client a été créé avec succès. Voici vos identifiants temporaires :</p>
                            <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>Email :</strong> ${email}</p>
                                <p style="margin: 5px 0;"><strong>Mot de passe :</strong> ${tempPassword}</p>
                            </div>
                            <p>Vous devrez changer ce mot de passe lors de votre première connexion.</p>
                            <p>L'équipe L'IAmani</p>
                        </div>
                    `
                });
                console.log('Welcome email sent successfully');
            } catch (emailErr) {
                console.error('Failed to send client email:', emailErr);
            }
        } else {
            console.log('No RESEND_API_KEY found, skipping email');
        }
        
        return c.json({ id, tempPassword, username: cleanUsername });
    } catch (e: any) {
        console.error('Client creation error:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.patch('/api/admin/clients/:id', authMiddleware, superAdminOnly, async (c) => {
    const id = c.req.param('id');
    const actor = c.get('user');
    const {
        name,
        email,
        username,
        company_name,
        logo_url,
        status,
        tva_rates,
        enable_cover_count,
        account_manager_first_name,
        account_manager_last_name,
        account_manager_phone,
        account_manager_email,
        legal_form,
        siret,
        vat_number,
        company_address,
        company_postal_code,
        company_city,
        company_country,
        company_employee_count,
    } = await c.req.json();
    const db = getDb(c);
    await ensureClientFiscalColumns(db);
    const requestIp = getRequestIp(c);
    
    try {
        const current = await db.prepare('SELECT id, email, username, company_name, logo_url, tva_rates, enable_cover_count, account_manager_first_name, account_manager_last_name, account_manager_phone, account_manager_email, legal_form, siret, vat_number, company_address, company_postal_code, company_city, company_country, company_employee_count FROM clients WHERE id = ?').get(id) as any;
        if (!current) return c.json({ error: 'Client not found' }, 404);

        const updates: string[] = [];
        const params: any[] = [];

        if (username !== undefined) {
            const normalized = String(username || '').trim().toLowerCase() || null;
            if (normalized) {
                const existingUsername = await db.prepare(`
                    SELECT id FROM clients WHERE username = ? AND id <> ?
                    UNION SELECT id FROM collaborators WHERE username = ?
                    UNION SELECT id FROM admins WHERE username = ?
                `).get(normalized, id, normalized, normalized);
                if (existingUsername) {
                    return c.json({ error: `Le pseudo "${normalized}" est déjà utilisé.` }, 400);
                }
            }
            updates.push('username = ?');
            params.push(normalized);
        }

        if (name) { updates.push('name = ?'); params.push(name); }
        if (email) { updates.push('email = ?'); params.push(email); }
        if (company_name !== undefined) { updates.push('company_name = ?'); params.push(company_name || null); }
        if (logo_url !== undefined) { updates.push('logo_url = ?'); params.push(logo_url || null); }
        if (tva_rates !== undefined) {
            const rawRates = Array.isArray(tva_rates) ? tva_rates : [];
            const cleanRates = [...new Set(rawRates.map(Number).filter((n: number) => Number.isFinite(n) && n >= 0))];
            updates.push('tva_rates = ?');
            params.push(JSON.stringify(cleanRates));
        }
        if (enable_cover_count !== undefined) {
            updates.push('enable_cover_count = ?');
            params.push(enable_cover_count ? 1 : 0);
        }
        if (account_manager_first_name !== undefined) { updates.push('account_manager_first_name = ?'); params.push(String(account_manager_first_name || '').trim()); }
        if (account_manager_last_name !== undefined) { updates.push('account_manager_last_name = ?'); params.push(String(account_manager_last_name || '').trim()); }
        if (account_manager_phone !== undefined) { updates.push('account_manager_phone = ?'); params.push(String(account_manager_phone || '').trim()); }
        if (account_manager_email !== undefined) { updates.push('account_manager_email = ?'); params.push(String(account_manager_email || '').trim()); }
        if (legal_form !== undefined) { updates.push('legal_form = ?'); params.push(String(legal_form || '').trim()); }
        if (siret !== undefined) { updates.push('siret = ?'); params.push(String(siret || '').trim()); }
        if (vat_number !== undefined) { updates.push('vat_number = ?'); params.push(String(vat_number || '').trim()); }
        if (company_address !== undefined) { updates.push('company_address = ?'); params.push(String(company_address || '').trim()); }
        if (company_postal_code !== undefined) { updates.push('company_postal_code = ?'); params.push(String(company_postal_code || '').trim()); }
        if (company_city !== undefined) { updates.push('company_city = ?'); params.push(String(company_city || '').trim()); }
        if (company_country !== undefined) { updates.push('company_country = ?'); params.push(String(company_country || '').trim()); }
        if (company_employee_count !== undefined) { updates.push('company_employee_count = ?'); params.push(Math.max(0, Number(company_employee_count || 0))); }
        if (status) { updates.push('status = ?'); params.push(status); }
        
        if (updates.length > 0) {
            params.push(id);
            await db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            if (email !== undefined && String(email || '') !== String(current.email || '')) {
                await insertAuditLog(db, {
                    userId: actor.id,
                    targetUserId: id,
                    action: 'UPDATE_EMAIL',
                    oldValue: current.email || null,
                    newValue: String(email || '') || null,
                    ipAddress: requestIp
                });
            }

            if (username !== undefined && String(username || '').trim().toLowerCase() !== String(current.username || '').trim().toLowerCase()) {
                await insertAuditLog(db, {
                    userId: actor.id,
                    targetUserId: id,
                    action: 'UPDATE_IDENTIFIER',
                    oldValue: current.username || null,
                    newValue: String(username || '').trim().toLowerCase() || null,
                    ipAddress: requestIp
                });
            }

            if (company_name !== undefined && String(company_name || '') !== String(current.company_name || '')) {
                await insertAuditLog(db, {
                    userId: actor.id,
                    targetUserId: id,
                    action: 'UPDATE_COMPANY_NAME',
                    oldValue: current.company_name || null,
                    newValue: String(company_name || '') || null,
                    ipAddress: requestIp
                });
            }

            if (logo_url !== undefined && String(logo_url || '') !== String(current.logo_url || '')) {
                await insertAuditLog(db, {
                    userId: actor.id,
                    targetUserId: id,
                    action: 'UPDATE_LOGO_URL',
                    oldValue: current.logo_url || null,
                    newValue: String(logo_url || '') || null,
                    ipAddress: requestIp
                });
            }
        }
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

app.delete('/api/admin/clients/:id', authMiddleware, superAdminOnly, async (c) => {
    const id = c.req.param('id');
    const db = getDb(c);
    // Cascade delete is handled by foreign keys in schema
    await db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    return c.json({ success: true });
});

app.get('/api/admin/clients/:id/factures', authMiddleware, superAdminOnly, async (c) => {
    try {
        const clientId = c.req.param('id');
        const db = getDb(c);
        await ensureFactureColumns(db);
        const items = await db.prepare('SELECT * FROM facture WHERE client_id = ? ORDER BY datetime(created_at) DESC').all(clientId);
        return c.json(items);
    } catch (e: any) {
        console.error('Error fetching admin client factures:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.delete('/api/admin/clients/:clientId/factures/:factureId', authMiddleware, superAdminOnly, async (c) => {
    try {
        const clientId = c.req.param('clientId');
        const factureId = c.req.param('factureId');
        const db = getDb(c);
        await ensureFactureColumns(db);

        const existing = await db.prepare('SELECT id FROM facture WHERE id = ? AND client_id = ?').get(factureId, clientId) as any;
        if (!existing) {
            return c.json({ error: 'Facture introuvable' }, 404);
        }

        await db.prepare('DELETE FROM facture WHERE id = ? AND client_id = ?').run(factureId, clientId);
        return c.json({ success: true });
    } catch (e: any) {
        console.error('Error deleting admin client facture:', e);
        return c.json({ error: e.message }, 500);
    }
});

// ── Import Excel Employés & Postes (SuperAdmin only) ──────────────────────────
// ANALYSE seule (preview) : POST /api/admin/import-excel/:clientId/preview
app.post('/api/admin/import-excel/:clientId/preview', authMiddleware, superAdminOnly, async (c) => {
    try {
        const clientId = c.req.param('clientId');
        const db = getDb(c);
        const client = await db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId) as any;
        if (!client) return c.json({ error: 'Client introuvable.' }, 404);

        const formData = await c.req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return c.json({ error: 'Aucun fichier fourni.' }, 400);

        const arrayBuffer = await file.arrayBuffer();
        const fileName = String(file.name || '').toLowerCase();
        const fileType = String(file.type || '').toLowerCase();
        const isPdf = fileType.includes('pdf') || fileName.endsWith('.pdf');

        const extracted = isPdf
            ? await extractRowsFromPdf(arrayBuffer)
            : extractRowsFromExcel(arrayBuffer);

        const analysis = await analyzeImportRows(db, clientId, extracted.parsedRows);

        return c.json({
            source_type: extracted.sourceType,
            total_rows: extracted.totalRows,
            valid_employees: analysis.validRows.length,
            new_posts: analysis.newPosts,
            existing_posts: analysis.existingPosts,
            errors: analysis.errors,
            detected_employees: analysis.validRows.slice(0, 50)
        });
    } catch (e: any) {
        return c.json({ error: `Erreur d'analyse : ${e.message}` }, 500);
    }
});

// IMPORT final : POST /api/admin/import-excel/:clientId/execute
app.post('/api/admin/import-excel/:clientId/execute', authMiddleware, superAdminOnly, async (c) => {
    try {
        const clientId = c.req.param('clientId');
        const db = getDb(c);
        const client = await db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId) as any;
        if (!client) return c.json({ error: 'Client introuvable.' }, 404);

        const formData = await c.req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return c.json({ error: 'Aucun fichier fourni.' }, 400);

        const arrayBuffer = await file.arrayBuffer();
        const fileName = String(file.name || '').toLowerCase();
        const fileType = String(file.type || '').toLowerCase();
        const isPdf = fileType.includes('pdf') || fileName.endsWith('.pdf');

        const extracted = isPdf
            ? await extractRowsFromPdf(arrayBuffer)
            : extractRowsFromExcel(arrayBuffer);

        const analysis = await analyzeImportRows(db, clientId, extracted.parsedRows);
        const execution = await executeImportRows(db, clientId, analysis.validRows);

        return c.json({
            success: true,
            source_type: extracted.sourceType,
            posts_created: execution.postsCreated,
            employees_created: execution.employeesCreated,
            duplicates_skipped: execution.duplicatesSkipped,
            errors: execution.errors
        });
    } catch (e: any) {
        return c.json({ error: `Erreur d'importation : ${e.message}` }, 500);
    }
});

app.post('/api/admin/clients/:id/reset-password', authMiddleware, superAdminOnly, async (c) => {
    const id = c.req.param('id');
    const actor = c.get('user');
    const db = getDb(c);
    const requestIp = getRequestIp(c);
    const client = await db.prepare('SELECT name, email FROM clients WHERE id = ?').get(id) as any;
    if (!client) return c.json({ error: 'Client not found' }, 404);

    const tempPassword = crypto.randomUUID().substring(0, 8);
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);
    await db.prepare('UPDATE clients SET password = ?, is_temporary_password = 1 WHERE id = ?').run(hashedPassword, id);

    await insertAuditLog(db, {
        userId: actor.id,
        targetUserId: id,
        action: 'UPDATE_PASSWORD',
        oldValue: '[PROTECTED]',
        newValue: '[RESET_BY_ADMIN]',
        ipAddress: requestIp
    });

    const resendKey = c.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (resendKey) {
        const resend = new Resend(resendKey);
        await resend.emails.send({
            from: "L'IAmani <notification@l-iamani.com>",
            to: client.email,
            subject: "Réinitialisation de votre mot de passe L'IAmani",
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #000;">Réinitialisation de mot de passe</h2>
                    <p>Bonjour ${client.name},</p>
                    <p>Votre mot de passe a été réinitialisé par l'administrateur. Voici vos nouveaux identifiants temporaires :</p>
                    <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Email :</strong> ${client.email}</p>
                        <p style="margin: 5px 0;"><strong>Nouveau mot de passe :</strong> ${tempPassword}</p>
                    </div>
                    <p>Vous devrez changer ce mot de passe lors de votre prochaine connexion.</p>
                    <p>L'équipe L'IAmani</p>
                </div>
            `
        });
    }

    return c.json({ success: true, tempPassword });
});

app.post('/api/admin/clients/:id/force-reset', authMiddleware, superAdminOnly, async (c) => {
    const id = c.req.param('id');
    const actor = c.get('user');
    const db = getDb(c);
    const requestIp = getRequestIp(c);
    const client = await db.prepare('SELECT name, email FROM clients WHERE id = ?').get(id) as any;
    if (!client) return c.json({ error: 'Client not found' }, 404);

    const resetToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 3600000).toISOString(); // 1h
    await db.prepare('UPDATE clients SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(resetToken, expires, id);

    await insertAuditLog(db, {
        userId: actor.id,
        targetUserId: id,
        action: 'UPDATE_PASSWORD',
        oldValue: '[PROTECTED]',
        newValue: '[FORCE_RESET_LINK_SENT]',
        ipAddress: requestIp
    });

    const resendKey = c.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (resendKey) {
        const resend = new Resend(resendKey);
        const resetLink = `${c.req.url.split('/api')[0]}/reset-password?token=${resetToken}`;
        await resend.emails.send({
            from: "L'IAmani <notification@l-iamani.com>",
            to: client.email,
            subject: "Réinitialisation obligatoire de votre mot de passe L'IAmani",
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #000;">Réinitialisation obligatoire du mot de passe</h2>
                    <p>Bonjour ${client.name},</p>
                    <p>Une réinitialisation de votre mot de passe a été forcée par l'administrateur.</p>
                    <p>Cliquez sur le lien ci-dessous pour définir votre nouveau mot de passe :</p>
                    <div style="margin: 30px 0;">
                        <a href="${resetLink}" style="background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Réinitialiser mon mot de passe</a>
                    </div>
                    <p>Ce lien est valable pendant 1 heure.</p>
                    <p>L'équipe L'IAmani</p>
                </div>
            `
        });
    }

    return c.json({ success: true });
});

app.post('/api/admin/clients/:id/impersonate', authMiddleware, superAdminOnly, async (c) => {
    const id = c.req.param('id');
    const actor = c.get('user');
    const db = getDb(c);
    const client = await db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
    if (!client) return c.json({ error: 'Client not found' }, 404);

    const secret = c.env?.JWT_SECRET || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
    const payload = {
        id: client.id,
        email: client.email,
        type: 'client',
        clientId: client.id,
        isTemporary: false,
        impersonatedBySuperAdmin: true,
        originalAdminEmail: actor?.email || null,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 // 1h for impersonation
    };

    const token = await sign(payload, secret, 'HS256');
    return c.json({
        token,
        user: {
            id: client.id,
            email: client.email,
            type: 'client',
            name: client.name,
            clientId: client.id,
            impersonatedBySuperAdmin: true,
            originalAdminEmail: actor?.email || null,
        }
    });
});

app.get('/api/admin/clients/:id/modules', authMiddleware, adminOnly, async (c) => {
    const clientId = c.req.param('id');
    const db = getDb(c);
    const modules = await db.prepare('SELECT module_name, is_active FROM client_modules WHERE client_id = ?').all(clientId);
    return c.json(modules);
});

app.post('/api/admin/clients/:id/modules', authMiddleware, adminOnly, async (c) => {
    const clientId = c.req.param('id');
    const { modules } = await c.req.json();
    const db = getDb(c);
    
    for (const m of modules) {
        await db.prepare('UPDATE client_modules SET is_active = ? WHERE client_id = ? AND module_name = ?')
          .run(m.active ? 1 : 0, clientId, m.name);
    }
    
    return c.json({ success: true });
});

app.get('/api/admin/stats', authMiddleware, superAdminOnly, async (c) => {
    const db = getDb(c);
    const clients = await db.prepare('SELECT COUNT(*) as count FROM clients').get() as any;
    const modules = await db.prepare('SELECT COUNT(*) as count FROM client_modules WHERE is_active = 1').get() as any;
    const collaborators = await db.prepare('SELECT COUNT(*) as count FROM collaborators').get() as any;
    
    return c.json({
        clientsCount: clients.count,
        activeModulesCount: modules.count,
        collaboratorsCount: collaborators.count,
        revenue: '12,450 €' // Dummy revenue for now
    });
});

app.get('/api/admin/clients/:id/collaborators', authMiddleware, adminOnly, async (c) => {
    const clientId = c.req.param('id');
    const db = getDb(c);
    const collaborators = await db.prepare('SELECT id, name, email, username, role, modules_access, created_at FROM collaborators WHERE client_id = ?').all(clientId);
    return c.json(collaborators);
});

app.get('/api/admin/clients/:id/audit-logs', authMiddleware, superAdminOnly, async (c) => {
    try {
        const clientId = c.req.param('id');
        const db = getDb(c);

        const logs = await db.prepare(`
            SELECT
                al.*,
                COALESCE(a1.name, c1.name, cb1.name, 'Systeme') AS actor_name,
                COALESCE(a2.name, c2.name, cb2.name, 'Inconnu') AS target_name
            FROM audit_logs al
            LEFT JOIN admins a1 ON a1.id = al.user_id
            LEFT JOIN clients c1 ON c1.id = al.user_id
            LEFT JOIN collaborators cb1 ON cb1.id = al.user_id
            LEFT JOIN admins a2 ON a2.id = al.target_user_id
            LEFT JOIN clients c2 ON c2.id = al.target_user_id
            LEFT JOIN collaborators cb2 ON cb2.id = al.target_user_id
            WHERE
                al.user_id = ?
                OR al.target_user_id = ?
                OR al.user_id IN (SELECT id FROM collaborators WHERE client_id = ?)
                OR al.target_user_id IN (SELECT id FROM collaborators WHERE client_id = ?)
            ORDER BY al.created_at DESC
        `).all(clientId, clientId, clientId, clientId);

        return c.json(logs || []);
    } catch (e: any) {
        console.error('Error fetching client audit logs:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.post('/api/admin/clients/:id/collaborators', authMiddleware, adminOnly, async (c) => {
    const clientId = c.req.param('id');
    const { name, email, username, role, modules_access, password } = await c.req.json();
    const db = getDb(c);

    // Validate required fields
    if (!name?.trim()) return c.json({ error: 'Le nom est obligatoire.' }, 400);
    if (!username?.trim()) return c.json({ error: 'Le pseudo de connexion est obligatoire.' }, 400);
    if (!password?.trim() || String(password).length < 8) return c.json({ error: 'Le mot de passe est obligatoire et doit faire au minimum 8 caractères.' }, 400);

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email?.trim() || null;

    // Check username uniqueness across all account types
    const usernameInUse = await db.prepare(`
        SELECT id FROM collaborators WHERE username = ?
        UNION SELECT id FROM clients WHERE username = ?
        UNION SELECT id FROM admins WHERE username = ?
    `).get(cleanUsername, cleanUsername, cleanUsername) as any;
    if (usernameInUse) return c.json({ error: `Le pseudo "${cleanUsername}" est déjà utilisé.` }, 400);

    // Username must not clash with any existing email
    const usernameEmailClash = await db.prepare(`
        SELECT id FROM admins WHERE email = ?
        UNION SELECT id FROM collaborators WHERE email = ?
        UNION SELECT id FROM clients WHERE email = ?
    `).get(cleanUsername, cleanUsername, cleanUsername) as any;
    if (usernameEmailClash) return c.json({ error: `Le pseudo "${cleanUsername}" est déjà utilisé comme adresse email.` }, 400);

    // Email uniqueness if provided
    if (cleanEmail) {
        const emailInUse = await db.prepare('SELECT id FROM collaborators WHERE email = ?').get(cleanEmail) as any;
        if (emailInUse) return c.json({ error: 'Cette adresse email est déjà utilisée.' }, 400);
    }

    const id = crypto.randomUUID().substring(0, 8);
    const hashedPassword = bcrypt.hashSync(String(password).trim(), 10);
    
    const allowedModules = ['planning', 'evenementiel', 'crm', 'facture', 'employes'];
    const selectedModules = Array.isArray(modules_access)
        ? modules_access.map((m: any) => String(m)).filter((m: string) => allowedModules.includes(m))
        : [];

    try {
        await db.prepare('INSERT INTO collaborators (id, client_id, name, email, username, password, role, modules_access, is_temporary_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, clientId, name.trim(), cleanEmail, cleanUsername, hashedPassword, role?.trim() || null, JSON.stringify(selectedModules), 1);
        
        // Keep collaborator_permissions in sync for existing middleware/legacy behavior.
        const modules = ['planning', 'evenementiel', 'facture', 'employes', 'crm'];
        for (const m of modules) {
            await db.prepare('INSERT INTO collaborator_permissions (collaborator_id, module_name, can_access) VALUES (?, ?, ?)').run(id, m, selectedModules.includes(m) ? 1 : 0);
        }
        
        return c.json({ id, username: cleanUsername, success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

app.patch('/api/admin/clients/:clientId/collaborators/:id', authMiddleware, adminOnly, async (c) => {
    try {
        const clientId = c.req.param('clientId');
        const collaboratorId = c.req.param('id');
        const db = getDb(c);
        const { name, email, username, role, modules_access } = await c.req.json();

        const existing = await db.prepare('SELECT id, email, username FROM collaborators WHERE id = ? AND client_id = ?').get(collaboratorId, clientId) as any;
        if (!existing) return c.json({ error: 'Collaborateur introuvable.' }, 404);

        const cleanName = String(name || '').trim();
        const cleanUsername = String(username || '').trim().toLowerCase();
        const cleanEmail = String(email || '').trim() || null;
        const cleanRole = String(role || '').trim() || null;

        if (!cleanName) return c.json({ error: 'Le nom est obligatoire.' }, 400);
        if (!cleanUsername) return c.json({ error: 'Le pseudo de connexion est obligatoire.' }, 400);

        const usernameInUse = await db.prepare(`
            SELECT id FROM collaborators WHERE username = ? AND id <> ?
            UNION SELECT id FROM clients WHERE username = ?
            UNION SELECT id FROM admins WHERE username = ?
        `).get(cleanUsername, collaboratorId, cleanUsername, cleanUsername) as any;
        if (usernameInUse) return c.json({ error: `Le pseudo "${cleanUsername}" est déjà utilisé.` }, 400);

        const usernameEmailClash = await db.prepare(`
            SELECT id FROM admins WHERE email = ?
            UNION SELECT id FROM clients WHERE email = ?
            UNION SELECT id FROM collaborators WHERE email = ? AND id <> ?
        `).get(cleanUsername, cleanUsername, cleanUsername, collaboratorId) as any;
        if (usernameEmailClash) return c.json({ error: `Le pseudo "${cleanUsername}" est déjà utilisé comme adresse email.` }, 400);

        if (cleanEmail) {
            const emailInUse = await db.prepare('SELECT id FROM collaborators WHERE email = ? AND id <> ?').get(cleanEmail, collaboratorId) as any;
            if (emailInUse) return c.json({ error: 'Cette adresse email est déjà utilisée.' }, 400);
        }

        const allowedModules = ['planning', 'evenementiel', 'crm', 'facture', 'employes'];
        const selectedModules = Array.isArray(modules_access)
            ? modules_access.map((m: any) => String(m)).filter((m: string) => allowedModules.includes(m))
            : [];

        await db.prepare('UPDATE collaborators SET name = ?, email = ?, username = ?, role = ?, modules_access = ? WHERE id = ? AND client_id = ?')
            .run(cleanName, cleanEmail, cleanUsername, cleanRole, JSON.stringify(selectedModules), collaboratorId, clientId);

        for (const moduleName of allowedModules) {
            await db.prepare(`
                INSERT INTO collaborator_permissions (collaborator_id, module_name, can_access)
                VALUES (?, ?, ?)
                ON CONFLICT(collaborator_id, module_name)
                DO UPDATE SET can_access = excluded.can_access
            `).run(collaboratorId, moduleName, selectedModules.includes(moduleName) ? 1 : 0);
        }

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

app.delete('/api/admin/clients/:clientId/collaborators/:id', authMiddleware, adminOnly, async (c) => {
    try {
        const clientId = c.req.param('clientId');
        const collaboratorId = c.req.param('id');
        const db = getDb(c);

        const collaborator = await db.prepare('SELECT id FROM collaborators WHERE id = ? AND client_id = ?').get(collaboratorId, clientId) as any;
        if (!collaborator) return c.json({ error: 'Collaborateur introuvable.' }, 404);

        // Remove both entities to fully free login identifiers.
        await db.prepare('DELETE FROM collaborators WHERE id = ? AND client_id = ?').run(collaboratorId, clientId);
        const usersTable = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get() as any;
        if (usersTable) {
            await db.prepare('DELETE FROM users WHERE id = ?').run(collaboratorId);
        }

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: String(e?.message || 'Erreur suppression collaborateur') }, 400);
    }
});

app.post('/api/admin/clients/:clientId/collaborators/:id/reset-password', authMiddleware, superAdminOnly, async (c) => {
    try {
        const clientId = c.req.param('clientId');
        const collaboratorId = c.req.param('id');
        const actor = c.get('user');
        const db = getDb(c);
        const requestIp = getRequestIp(c);

        const collaborator = await db.prepare('SELECT id, name, email, username FROM collaborators WHERE id = ? AND client_id = ?').get(collaboratorId, clientId) as any;
        if (!collaborator) return c.json({ error: 'Collaborateur introuvable.' }, 404);
        if (!String(collaborator.email || '').trim()) return c.json({ error: 'Aucune adresse email renseignée pour ce collaborateur.' }, 400);

        const tempPassword = crypto.randomUUID().substring(0, 8);
        const hashedPassword = bcrypt.hashSync(tempPassword, 10);
        await db.prepare('UPDATE collaborators SET password = ?, is_temporary_password = 1 WHERE id = ? AND client_id = ?').run(hashedPassword, collaboratorId, clientId);

        await insertAuditLog(db, {
            userId: actor.id,
            targetUserId: collaboratorId,
            action: 'UPDATE_PASSWORD',
            oldValue: '[PROTECTED]',
            newValue: '[RESET_COLLABORATOR_BY_ADMIN]',
            ipAddress: requestIp
        });

        const resendKey = c.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (resendKey) {
            const resend = new Resend(resendKey);
            await resend.emails.send({
                from: "L'IAmani <notification@l-iamani.com>",
                to: collaborator.email,
                subject: "Vos nouveaux accès collaborateur L'IAmani",
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #000;">Vos nouveaux accès collaborateur</h2>
                        <p>Bonjour ${collaborator.name},</p>
                        <p>Le super administrateur vous a renvoyé vos identifiants d'accès.</p>
                        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Email :</strong> ${collaborator.email}</p>
                            <p style="margin: 5px 0;"><strong>Pseudo :</strong> ${collaborator.username || '-'}</p>
                            <p style="margin: 5px 0;"><strong>Mot de passe temporaire :</strong> ${tempPassword}</p>
                        </div>
                        <p>Vous devrez changer ce mot de passe lors de votre prochaine connexion.</p>
                        <p>L'équipe L'IAmani</p>
                    </div>
                `
            });
        }

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Collaborator reset password error:', e);
        return c.json({ error: e.message || 'Erreur lors de la réinitialisation du collaborateur' }, 500);
    }
});

app.post('/api/admin/clients/:clientId/collaborators/:id/force-reset', authMiddleware, superAdminOnly, async (c) => {
    try {
        const clientId = c.req.param('clientId');
        const collaboratorId = c.req.param('id');
        const actor = c.get('user');
        const db = getDb(c);
        const requestIp = getRequestIp(c);

        const collaborator = await db.prepare('SELECT id, name, email, username FROM collaborators WHERE id = ? AND client_id = ?').get(collaboratorId, clientId) as any;
        if (!collaborator) return c.json({ error: 'Collaborateur introuvable.' }, 404);
        if (!String(collaborator.email || '').trim()) return c.json({ error: 'Aucune adresse email renseignée pour ce collaborateur.' }, 400);

        const tempPassword = crypto.randomUUID().substring(0, 8);
        const hashedPassword = bcrypt.hashSync(tempPassword, 10);
        await db.prepare('UPDATE collaborators SET password = ?, is_temporary_password = 1 WHERE id = ? AND client_id = ?').run(hashedPassword, collaboratorId, clientId);

        await insertAuditLog(db, {
            userId: actor.id,
            targetUserId: collaboratorId,
            action: 'UPDATE_PASSWORD',
            oldValue: '[PROTECTED]',
            newValue: '[FORCE_RESET_COLLABORATOR_BY_ADMIN]',
            ipAddress: requestIp
        });

        const resendKey = c.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (resendKey) {
            const resend = new Resend(resendKey);
            await resend.emails.send({
                from: "L'IAmani <notification@l-iamani.com>",
                to: collaborator.email,
                subject: "Réinitialisation obligatoire de votre mot de passe L'IAmani",
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #000;">Réinitialisation obligatoire du mot de passe</h2>
                        <p>Bonjour ${collaborator.name},</p>
                        <p>Votre mot de passe a été réinitialisé par le super administrateur.</p>
                        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Email :</strong> ${collaborator.email}</p>
                            <p style="margin: 5px 0;"><strong>Pseudo :</strong> ${collaborator.username || '-'}</p>
                            <p style="margin: 5px 0;"><strong>Nouveau mot de passe temporaire :</strong> ${tempPassword}</p>
                        </div>
                        <p>Vous devrez définir un mot de passe personnel à votre prochaine connexion.</p>
                        <p>L'équipe L'IAmani</p>
                    </div>
                `
            });
        }

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Collaborator force reset error:', e);
        return c.json({ error: e.message || 'Erreur lors du reset forcé du collaborateur' }, 500);
    }
});

// --- Support Routes ---

app.get('/api/support/ticket/open', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        if (user.type === 'admin') return c.json({ error: 'Forbidden' }, 403);

        const ctx = await getSupportClientContext(db, user);
        if (!ctx?.clientId) return c.json({ ticket: null, messages: [] });

        const ticket = await db.prepare("SELECT * FROM support_tickets WHERE client_id = ? AND status = 'OPEN' ORDER BY updated_at DESC LIMIT 1").get(ctx.clientId) as any;
        if (!ticket) return c.json({ ticket: null, messages: [] });

        const messages = await db.prepare('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC').all(ticket.id);
        await db.prepare("UPDATE support_messages SET is_read = 1 WHERE ticket_id = ? AND sender_type = 'admin' AND is_read = 0").run(ticket.id);
        return c.json({ ticket, messages });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/api/support/messages', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        if (user.type === 'admin') return c.json({ error: 'Forbidden' }, 403);

        const { message, file_url, file_name } = await c.req.json();
        const hasText = !!String(message || '').trim();
        const hasFile = !!String(file_url || '').trim();
        if (!hasText && !hasFile) return c.json({ error: 'Message vide.' }, 400);

        const ctx = await getSupportClientContext(db, user);
        if (!ctx?.clientId) return c.json({ error: 'Contexte client manquant.' }, 400);

        let ticket = await db.prepare("SELECT * FROM support_tickets WHERE client_id = ? AND status = 'OPEN' ORDER BY updated_at DESC LIMIT 1").get(ctx.clientId) as any;
        if (!ticket) {
            const ticketId = crypto.randomUUID().substring(0, 10);
            await db.prepare("INSERT INTO support_tickets (id, client_id, status, created_by_user_id, created_by_type) VALUES (?, ?, 'OPEN', ?, ?)")
                .run(ticketId, ctx.clientId, user.id, user.type);
            ticket = await db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId) as any;
        }

        const messageId = crypto.randomUUID().substring(0, 12);
        await db.prepare(`
            INSERT INTO support_messages (id, ticket_id, sender_user_id, sender_type, message, file_url, file_name, is_read)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        `).run(messageId, ticket.id, user.id, user.type, hasText ? String(message).trim() : null, hasFile ? String(file_url).trim() : null, file_name || null);

        await db.prepare('UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ticket.id);

        // Notify super admin
        await sendSupportNotification(c, {
            to: SUPER_ADMIN_EMAIL,
            senderName: ctx.clientName,
            companyName: ctx.companyName,
            hasAttachment: hasFile
        });

        return c.json({ success: true, ticket_id: ticket.id });
    } catch (e: any) {
        console.error('Error sending support message (client):', e);
        return c.json({ error: e.message }, 400);
    }
});

app.get('/api/admin/support/unread-count', authMiddleware, adminOnly, async (c) => {
    try {
        const db = getDb(c);
        const row = await db.prepare(`
            SELECT COUNT(*) as count
            FROM support_messages m
            JOIN support_tickets t ON t.id = m.ticket_id
            WHERE t.status = 'OPEN' AND m.is_read = 0 AND m.sender_type <> 'admin'
        `).get() as any;
        return c.json({ count: Number(row?.count || 0) });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/admin/support/tickets', authMiddleware, adminOnly, async (c) => {
    try {
        const db = getDb(c);
        const status = String(c.req.query('status') || 'OPEN').toUpperCase();
        const tickets = await db.prepare(`
            SELECT
                t.*,
                c.name as client_name,
                c.company_name as company_name,
                c.email as client_email,
                COALESCE(SUM(CASE WHEN m.is_read = 0 AND m.sender_type <> 'admin' THEN 1 ELSE 0 END), 0) as unread_count,
                MAX(m.created_at) as last_message_at
            FROM support_tickets t
            JOIN clients c ON c.id = t.client_id
            LEFT JOIN support_messages m ON m.ticket_id = t.id
            WHERE t.status = ?
            GROUP BY t.id
            ORDER BY COALESCE(last_message_at, t.updated_at) DESC
        `).all(status);
        return c.json(tickets || []);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/admin/support/tickets/:id/messages', authMiddleware, adminOnly, async (c) => {
    try {
        const db = getDb(c);
        const ticketId = c.req.param('id');
        const ticket = await db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId) as any;
        if (!ticket) return c.json({ error: 'Ticket introuvable' }, 404);

        const messages = await db.prepare('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId);
        await db.prepare("UPDATE support_messages SET is_read = 1 WHERE ticket_id = ? AND sender_type <> 'admin'").run(ticketId);
        return c.json({ ticket, messages });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/api/admin/support/tickets/:id/messages', authMiddleware, adminOnly, async (c) => {
    try {
        const db = getDb(c);
        const user = c.get('user');
        const ticketId = c.req.param('id');
        const { message, file_url, file_name } = await c.req.json();
        const hasText = !!String(message || '').trim();
        const hasFile = !!String(file_url || '').trim();
        if (!hasText && !hasFile) return c.json({ error: 'Message vide.' }, 400);

        const ticket = await db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId) as any;
        if (!ticket) return c.json({ error: 'Ticket introuvable' }, 404);
        if (ticket.status !== 'OPEN') return c.json({ error: 'Ticket clos.' }, 400);

        const messageId = crypto.randomUUID().substring(0, 12);
        await db.prepare(`
            INSERT INTO support_messages (id, ticket_id, sender_user_id, sender_type, message, file_url, file_name, is_read)
            VALUES (?, ?, ?, 'admin', ?, ?, ?, 0)
        `).run(messageId, ticketId, user.id, hasText ? String(message).trim() : null, hasFile ? String(file_url).trim() : null, file_name || null);

        await db.prepare('UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ticketId);

        const client = await db.prepare('SELECT name, company_name, email FROM clients WHERE id = ?').get(ticket.client_id) as any;
        if (client?.email) {
            await sendSupportNotification(c, {
                to: client.email,
                senderName: user.name || user.email || 'Admin',
                companyName: client.company_name || client.name || 'Client',
                hasAttachment: hasFile,
                clientId: ticket.client_id
            });
        }

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Error sending support message (admin):', e);
        return c.json({ error: e.message }, 400);
    }
});

app.patch('/api/admin/support/tickets/:id/close', authMiddleware, adminOnly, async (c) => {
    try {
        const db = getDb(c);
        const ticketId = c.req.param('id');
        const ticket = await db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId) as any;
        if (!ticket) return c.json({ error: 'Ticket introuvable' }, 404);
        await db.prepare("UPDATE support_tickets SET status = 'CLOSED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(ticketId);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/support/unread-count', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        if (user.type === 'admin') return c.json({ count: 0 });
        const db = getDb(c);
        const ctx = await getSupportClientContext(db, user);
        if (!ctx?.clientId) return c.json({ count: 0 });

        const row = await db.prepare(`
            SELECT COUNT(*) as count
            FROM support_messages m
            JOIN support_tickets t ON t.id = m.ticket_id
            WHERE t.client_id = ?
              AND t.status = 'OPEN'
              AND m.sender_type = 'admin'
              AND m.is_read = 0
        `).get(ctx.clientId) as any;

        return c.json({ count: Number(row?.count || 0) });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// --- Dashboard Stats (client) ---

app.get('/api/dashboard/stats', authMiddleware, async (c) => {
    const user = c.get('user');
    if (user.type === 'admin') return c.json({ error: 'Forbidden' }, 403);
    const db = getDb(c);
    const clientId = user.clientId;

    const [empRow, evtRow, factRow, planRow, recentEmployees, recentEvents, recentFactures, recentPlanning] = await Promise.all([
        db.prepare('SELECT COUNT(*) as count FROM employes WHERE client_id = ?').get(clientId) as any,
        db.prepare('SELECT COUNT(*) as count FROM evenementiel WHERE client_id = ?').get(clientId) as any,
        db.prepare('SELECT COUNT(*) as count FROM facture WHERE client_id = ?').get(clientId) as any,
        db.prepare('SELECT COUNT(*) as count FROM planning WHERE client_id = ?').get(clientId) as any,
        db.prepare(`
            SELECT id, first_name, last_name, position, created_at
            FROM employes
            WHERE client_id = ?
            ORDER BY datetime(created_at) DESC
            LIMIT 3
        `).all(clientId) as any[],
        db.prepare(`
            SELECT id, type, first_name, last_name, company_name, organizer_name, start_time, created_at
            FROM evenementiel
            WHERE client_id = ?
            ORDER BY datetime(created_at) DESC
            LIMIT 3
        `).all(clientId) as any[],
        db.prepare(`
            SELECT id, invoice_number, customer_name, total_ttc, amount, created_at
            FROM facture
            WHERE client_id = ?
            ORDER BY datetime(created_at) DESC
            LIMIT 3
        `).all(clientId) as any[],
        db.prepare(`
            SELECT id, title, start_date, created_at
            FROM planning
            WHERE client_id = ?
            ORDER BY datetime(created_at) DESC
            LIMIT 3
        `).all(clientId) as any[],
    ]);

    const recentActivity = [
        ...(recentEmployees || []).map((item: any) => ({
            id: `employee-${item.id}`,
            type: 'employe',
            title: 'Employé ajouté',
            subject: [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Employé',
            detail: item.position || 'Nouveau profil',
            value: null,
            created_at: item.created_at,
        })),
        ...(recentEvents || []).map((item: any) => ({
            id: `event-${item.id}`,
            type: 'evenement',
            title: 'Événement créé',
            subject: item.type === 'PROFESSIONNEL'
                ? (item.company_name || item.organizer_name || 'Événement professionnel')
                : [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Événement privé',
            detail: item.start_time || null,
            value: null,
            created_at: item.created_at,
        })),
        ...(recentFactures || []).map((item: any) => ({
            id: `facture-${item.id}`,
            type: 'facture',
            title: 'Facture générée',
            subject: item.invoice_number || 'Facture',
            detail: item.customer_name || null,
            value: Number(item.total_ttc ?? item.amount ?? 0),
            created_at: item.created_at,
        })),
        ...(recentPlanning || []).map((item: any) => ({
            id: `planning-${item.id}`,
            type: 'planning',
            title: 'Planning ajouté',
            subject: item.title || 'Nouvelle entrée planning',
            detail: item.start_date || null,
            value: null,
            created_at: item.created_at,
        })),
    ]
        .filter((item) => item.created_at)
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
        .slice(0, 5);

    return c.json({
        employes: empRow?.count ?? 0,
        evenements: evtRow?.count ?? 0,
        factures: factRow?.count ?? 0,
        planning: planRow?.count ?? 0,
        recentActivity,
    });
});

// --- Module Routes ---

app.get('/api/planning', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    const items = await db.prepare('SELECT * FROM planning WHERE client_id = ?').all(user.clientId);
    return c.json(items);
});

// --- Evenementiel Calendars ---

app.get('/api/evenementiel/config', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const clientId = user.type === 'admin' ? c.req.query('client_id') : user.clientId;

        if (!clientId) {
            return c.json({ error: 'Client context is required' }, 400);
        }

        const spacesRaw = await db.prepare('SELECT * FROM evenementiel_spaces WHERE client_id = ? ORDER BY name ASC').all(clientId);
        const spaces = (spacesRaw || []).map((s: any) => ({ ...s, color_hex: s.color }));

        const authorizedStaffCategories = await db.prepare('SELECT * FROM evenementiel_staff_types WHERE client_id = ? ORDER BY name ASC').all(clientId);

        const rawConfig = await db.prepare('SELECT track_taken_by, allowed_taker_employee_ids, notify_recipient_employee_ids FROM evenementiel_config WHERE client_id = ?').get(clientId) as any;
        const trackTakenBy = Number(rawConfig?.track_taken_by || 0) === 1;
        let allowedTakerEmployeeIds: string[] = [];
        let notifyRecipientEmployeeIds: string[] = [];
        try {
            const parsed = JSON.parse(rawConfig?.allowed_taker_employee_ids || '[]');
            allowedTakerEmployeeIds = Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
        } catch {
            allowedTakerEmployeeIds = [];
        }
        try {
            const parsedNotify = JSON.parse(rawConfig?.notify_recipient_employee_ids || '[]');
            notifyRecipientEmployeeIds = Array.isArray(parsedNotify) ? parsedNotify.map((id: any) => String(id)) : [];
        } catch {
            notifyRecipientEmployeeIds = [];
        }

        const allowedTakenByEmployees = allowedTakerEmployeeIds.length > 0
            ? await db.prepare(`
                SELECT id, first_name, last_name, email
                FROM employes
                WHERE client_id = ? AND id IN (${allowedTakerEmployeeIds.map(() => '?').join(',')})
            `).all(clientId, ...allowedTakerEmployeeIds) as any[]
            : [] as any[];

        // Filtered: only return IDs that still exist in DB (removes stale refs)
        const validAllowedIds = allowedTakenByEmployees.map((e: any) => String(e.id));

        const notifyRecipients = notifyRecipientEmployeeIds.length > 0
            ? await db.prepare(`
                SELECT id, first_name, last_name, email
                FROM employes
                WHERE client_id = ? AND id IN (${notifyRecipientEmployeeIds.map(() => '?').join(',')}) AND email IS NOT NULL AND TRIM(email) <> ''
            `).all(clientId, ...notifyRecipientEmployeeIds) as any[]
            : [] as any[];

        const validNotifyIds = notifyRecipients.map((e: any) => String(e.id));

        return c.json({
            spaces,
            authorized_staff_categories: authorizedStaffCategories,
            track_taken_by: trackTakenBy,
            allowed_taker_employee_ids: validAllowedIds,
            allowed_taken_by_employees: allowedTakenByEmployees,
            notify_recipient_employee_ids: validNotifyIds,
            notify_recipients: notifyRecipients
        });
    } catch (e: any) {
        console.error('Error fetching evenementiel config:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.put('/api/evenementiel/config', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const body = await c.req.json();
        const clientId = resolveClientId(user, body?.client_id);
        if (!clientId) {
            return c.json({ error: 'Client context is required' }, 400);
        }

        const trackTakenBy = body?.track_taken_by ? 1 : 0;
        const rawAllowedIds = Array.isArray(body?.allowed_taker_employee_ids) ? body.allowed_taker_employee_ids : [];
        const allowedIds = Array.from(new Set(rawAllowedIds.map((id: any) => String(id))));
        const rawNotifyIds = Array.isArray(body?.notify_recipient_employee_ids) ? body.notify_recipient_employee_ids : [];
        const notifyIds = Array.from(new Set(rawNotifyIds.map((id: any) => String(id))));

        // Silently filter out IDs that no longer exist in the DB (stale refs are ignored)
        const cleanAllowedIds: string[] = allowedIds.length > 0
            ? ((await db.prepare(`
                SELECT id FROM employes
                WHERE client_id = ? AND id IN (${allowedIds.map(() => '?').join(',')})
            `).all(clientId, ...allowedIds) as any[]).map((row: any) => String(row.id)))
            : [];

        const cleanNotifyIds: string[] = notifyIds.length > 0
            ? ((await db.prepare(`
                SELECT id FROM employes
                WHERE client_id = ? AND id IN (${notifyIds.map(() => '?').join(',')}) AND email IS NOT NULL AND TRIM(email) <> ''
            `).all(clientId, ...notifyIds) as any[]).map((row: any) => String(row.id)))
            : [];

        await db.prepare(`
            INSERT INTO evenementiel_config (client_id, track_taken_by, allowed_taker_employee_ids, notify_recipient_employee_ids, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(client_id)
            DO UPDATE SET
                track_taken_by = excluded.track_taken_by,
                allowed_taker_employee_ids = excluded.allowed_taker_employee_ids,
                notify_recipient_employee_ids = excluded.notify_recipient_employee_ids,
                updated_at = CURRENT_TIMESTAMP
        `).run(clientId, trackTakenBy, JSON.stringify(cleanAllowedIds), JSON.stringify(cleanNotifyIds));

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Error saving evenementiel config:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.post('/api/evenementiel/notify-update', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const clientId = user.clientId;
        if (!clientId) {
            return c.json({ error: 'Client context is required' }, 400);
        }

        const { calendar_id, recipient_ids } = await c.req.json();
        if (!calendar_id) {
            return c.json({ error: 'calendar_id is required' }, 400);
        }
        if (!Array.isArray(recipient_ids) || recipient_ids.length === 0) {
            return c.json({ error: 'Aucun destinataire sélectionné' }, 400);
        }

        const calendar = await db.prepare('SELECT month, year FROM evenementiel_calendars WHERE id = ? AND client_id = ?').get(calendar_id, clientId) as any;
        if (!calendar) {
            return c.json({ error: 'Calendrier introuvable' }, 404);
        }

        const cfg = await db.prepare('SELECT notify_recipient_employee_ids FROM evenementiel_config WHERE client_id = ?').get(clientId) as any;
        let allowedIds: string[] = [];
        try {
            const parsed = JSON.parse(cfg?.notify_recipient_employee_ids || '[]');
            allowedIds = Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
        } catch {
            allowedIds = [];
        }

        const selectedIds = Array.from(new Set(recipient_ids.map((id: any) => String(id))));
        for (const id of selectedIds) {
            if (!allowedIds.includes(id)) {
                return c.json({ error: 'Un destinataire sélectionné n\'est pas autorisé.' }, 400);
            }
        }

        const recipients = await db.prepare(`
            SELECT id, first_name, last_name, email
            FROM employes
            WHERE client_id = ? AND id IN (${selectedIds.map(() => '?').join(',')}) AND email IS NOT NULL AND TRIM(email) <> ''
        `).all(clientId, ...selectedIds) as any[];

        if (recipients.length === 0) {
            return c.json({ error: 'Aucun destinataire email valide.' }, 400);
        }

        const client = await db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId) as any;
        const clientName = client?.name || 'Client';
        const monthName = [
            'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
            'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'
        ][Math.max(0, Number(calendar.month || 1) - 1)] || String(calendar.month || '');
        const platformLink = `${c.req.url.split('/api')[0]}/evenementiel`;

        const resendKey = c.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (!resendKey) {
            return c.json({ error: 'RESEND_API_KEY manquante sur le serveur.' }, 500);
        }

        const resend = new Resend(resendKey);
        for (const recipient of recipients) {
            const firstName = recipient.first_name || 'collaborateur';
            await resend.emails.send({
                from: "L'IAmani <notification@l-iamani.com>",
                to: recipient.email,
                subject: `📅 Mise à jour du calendrier - ${clientName}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #111;">
                        <h2 style="margin:0 0 12px;">Calendrier mis à jour</h2>
                        <p>Bonjour ${firstName},</p>
                        <p>Le calendrier des événements pour <strong>${monthName} ${calendar.year}</strong> a été mis à jour.</p>
                        <p>Vous pouvez le consulter ici : <a href="${platformLink}">${platformLink}</a></p>
                    </div>
                `
            });
        }

        return c.json({ success: true, sent: recipients.length });
    } catch (e: any) {
        console.error('Error sending calendrier update notifications:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.get('/api/evenementiel/spaces', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const clientId = user.clientId;
        if (!clientId) {
            return c.json({ error: 'Client context is required' }, 400);
        }
        const rawItems = await db.prepare('SELECT * FROM evenementiel_spaces WHERE client_id = ? ORDER BY name ASC').all(clientId);
        const items = (rawItems || []).map((s: any) => ({ ...s, color_hex: s.color }));
        return c.json(items);
    } catch (e: any) {
        console.error('Error fetching spaces:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/admin/clients/:id/spaces', authMiddleware, superAdminOnly, async (c) => {
    const clientId = c.req.param('id');
    const db = getDb(c);
    const items = await db.prepare('SELECT id, client_id, name, color AS color_hex, color FROM evenementiel_spaces WHERE client_id = ? ORDER BY name ASC').all(clientId);
    return c.json(items);
});

app.post('/api/admin/clients/:id/spaces', authMiddleware, superAdminOnly, async (c) => {
    const clientId = c.req.param('id');
    const db = getDb(c);
    const { name, color } = await c.req.json();
    const id = crypto.randomUUID().substring(0, 8);

    try {
        await db.prepare('INSERT INTO evenementiel_spaces (id, client_id, name, color) VALUES (?, ?, ?, ?)').run(id, clientId, name, color);
        return c.json({ id });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

app.delete('/api/admin/clients/:clientId/spaces/:spaceId', authMiddleware, superAdminOnly, async (c) => {
    const { clientId, spaceId } = c.req.param();
    const db = getDb(c);
    await db.prepare('DELETE FROM evenementiel_spaces WHERE id = ? AND client_id = ?').run(spaceId, clientId);
    return c.json({ success: true });
});

app.patch('/api/admin/clients/:clientId/spaces/:spaceId', authMiddleware, superAdminOnly, async (c) => {
    const { clientId, spaceId } = c.req.param();
    const db = getDb(c);
    const body = await c.req.json();

    const name = String(body?.name || '').trim();
    const color = String(body?.color || '').trim();

    if (!name) {
        return c.json({ error: 'Le nom de l\'espace est obligatoire.' }, 400);
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return c.json({ error: 'Le code couleur doit etre un hex valide (#RRGGBB).' }, 400);
    }

    const existing = await db.prepare('SELECT id FROM evenementiel_spaces WHERE id = ? AND client_id = ?').get(spaceId, clientId) as any;
    if (!existing) {
        return c.json({ error: 'Espace introuvable.' }, 404);
    }

    await db.prepare('UPDATE evenementiel_spaces SET name = ?, color = ? WHERE id = ? AND client_id = ?').run(name, color, spaceId, clientId);
    return c.json({ success: true });
});

app.get('/api/admin/clients/:id/staff-types', authMiddleware, superAdminOnly, async (c) => {
    const clientId = c.req.param('id');
    const db = getDb(c);
    const items = await db.prepare('SELECT * FROM evenementiel_staff_types WHERE client_id = ? ORDER BY name ASC').all(clientId);
    return c.json(items);
});

app.post('/api/admin/clients/:id/staff-types', authMiddleware, superAdminOnly, async (c) => {
    const clientId = c.req.param('id');
    const db = getDb(c);
    const { id, name } = await c.req.json();

    if (!String(name || '').trim()) {
        return c.json({ error: 'Le nom de catégorie est obligatoire.' }, 400);
    }

    const cleanName = String(name).trim();

    try {
        if (id) {
            await db.prepare('UPDATE evenementiel_staff_types SET name = ? WHERE id = ? AND client_id = ?').run(cleanName, id, clientId);
            return c.json({ id, updated: true });
        }

        const newId = crypto.randomUUID().substring(0, 8);
        await db.prepare('INSERT INTO evenementiel_staff_types (id, client_id, name) VALUES (?, ?, ?)').run(newId, clientId, cleanName);
        return c.json({ id: newId, created: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

app.delete('/api/admin/clients/:clientId/staff-types/:staffId', authMiddleware, superAdminOnly, async (c) => {
    const { clientId, staffId } = c.req.param();
    const db = getDb(c);
    await db.prepare('DELETE FROM evenementiel_staff_types WHERE id = ? AND client_id = ?').run(staffId, clientId);
    return c.json({ success: true });
});

app.get('/api/evenementiel/staff-types', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const clientId = user.clientId;
        if (!clientId) {
            return c.json({ error: 'Client context is required' }, 400);
        }
        const items = await db.prepare('SELECT * FROM evenementiel_staff_types WHERE client_id = ? ORDER BY name ASC').all(clientId);
        return c.json(items);
    } catch (e: any) {
        console.error('Error fetching staff types:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/evenementiel/staff-mappings', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const clientId = user.clientId;

        if (!clientId) {
            return c.json({ error: 'Client context is required' }, 400);
        }

        const rows = await db.prepare(`
            SELECT
                m.id,
                m.staff_category_id,
                m.employee_id,
                st.name AS staff_category_name,
                e.first_name,
                e.last_name,
                e.email
            FROM staff_category_mapping m
            JOIN evenementiel_staff_types st ON st.id = m.staff_category_id AND st.client_id = m.client_id
            JOIN employes e ON e.id = m.employee_id AND e.client_id = m.client_id
            WHERE m.client_id = ?
            ORDER BY st.name ASC, e.last_name ASC, e.first_name ASC
        `).all(clientId);

        return c.json(rows);
    } catch (e: any) {
        console.error('Error fetching staff mappings:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.put('/api/evenementiel/staff-mappings', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    const clientId = user.clientId;

    if (!clientId) {
        return c.json({ error: 'Client context is required' }, 400);
    }

    try {
        const body = await c.req.json();
        const mappings = Array.isArray(body?.mappings) ? body.mappings : [];

        const validCategoryIds = new Set(
            (await db.prepare('SELECT id FROM evenementiel_staff_types WHERE client_id = ?').all(clientId) as any[]).map((row: any) => row.id)
        );
        const validEmployeeIds = new Set(
            (await db.prepare('SELECT id FROM employes WHERE client_id = ?').all(clientId) as any[]).map((row: any) => row.id)
        );

        const nextPairs: Array<{ staff_category_id: string; employee_id: string }> = [];
        for (const entry of mappings) {
            const staffCategoryId = entry?.staff_category_id;
            const employeeIds = Array.isArray(entry?.employee_ids) ? entry.employee_ids : [];

            if (!staffCategoryId || !validCategoryIds.has(staffCategoryId)) {
                return c.json({ error: 'Invalid staff category mapping payload' }, 400);
            }

            const dedupedEmployeeIds: string[] = Array.from(new Set(employeeIds.map((id: any) => String(id))));
            for (const employeeId of dedupedEmployeeIds) {
                if (!validEmployeeIds.has(employeeId)) {
                    return c.json({ error: 'Invalid employee mapping payload' }, 400);
                }
                nextPairs.push({ staff_category_id: staffCategoryId, employee_id: employeeId });
            }
        }

        await db.prepare('DELETE FROM staff_category_mapping WHERE client_id = ?').run(clientId);

        for (const pair of nextPairs) {
            await db.prepare(`
                INSERT INTO staff_category_mapping (id, client_id, staff_category_id, employee_id)
                VALUES (?, ?, ?, ?)
            `).run(crypto.randomUUID().substring(0, 8), clientId, pair.staff_category_id, pair.employee_id);
        }

        return c.json({ success: true, count: nextPairs.length });
    } catch (e: any) {
        console.error('Error saving staff mappings:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.post('/api/evenementiel/staff-types', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    if (user.type !== 'admin') {
        return c.json({ error: 'Only SuperAdmin can manage staff categories' }, 403);
    }
    const db = getDb(c);
    const body = await c.req.json();
    const { name } = body;
    const clientId = user.type === 'admin' ? (body.client_id || user.clientId) : user.clientId;
    const id = crypto.randomUUID().substring(0, 8);

    try {
        await db.prepare('INSERT INTO evenementiel_staff_types (id, client_id, name) VALUES (?, ?, ?)').run(id, clientId, name);
        return c.json({ id });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

app.delete('/api/evenementiel/staff-types/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    if (user.type !== 'admin') {
        return c.json({ error: 'Only SuperAdmin can manage staff categories' }, 403);
    }
    const db = getDb(c);
    const id = c.req.param('id');
    await db.prepare('DELETE FROM evenementiel_staff_types WHERE id = ?').run(id);
    return c.json({ success: true });
});

app.get('/api/evenementiel/calendars', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);

        if (user.type !== 'admin') {
            await archivePastCalendars(db, user.clientId);
        }

        const query = user.type === 'admin' 
            ? 'SELECT * FROM evenementiel_calendars ORDER BY year ASC, month ASC' 
            : 'SELECT * FROM evenementiel_calendars WHERE client_id = ? ORDER BY year ASC, month ASC';
        const params = user.type === 'admin' ? [] : [user.clientId];
        const items = await db.prepare(query).all(...params);
        return c.json(items);
    } catch (e: any) {
        console.error('Error fetching calendars:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.post('/api/evenementiel/calendars', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    const body = await c.req.json();
    const { month, year } = body;
    const clientId = resolveClientId(user, body.client_id);
    const id = crypto.randomUUID().substring(0, 8);

    if (!clientId) {
        return c.json({ error: 'client_id is required for admin actions' }, 400);
    }

    try {
        await archivePastCalendars(db, clientId);
        await db.prepare('INSERT INTO evenementiel_calendars (id, client_id, month, year) VALUES (?, ?, ?, ?)').run(id, clientId, month, year);
        return c.json({ id });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

app.get('/api/evenementiel/calendars/:id/events', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const calendarId = c.req.param('id');
        
        const query = user.type === 'admin'
            ? 'SELECT e.*, (SELECT COUNT(*) FROM evenementiel_event_assignments WHERE event_id = e.id) as assigned_count FROM evenementiel e WHERE e.calendar_id = ? ORDER BY e.start_time ASC'
            : 'SELECT e.*, (SELECT COUNT(*) FROM evenementiel_event_assignments WHERE event_id = e.id) as assigned_count FROM evenementiel e WHERE e.calendar_id = ? AND e.client_id = ? ORDER BY e.start_time ASC';
        const params = user.type === 'admin' ? [calendarId] : [calendarId, user.clientId];
        
        const events = await db.prepare(query).all(...params);
        
        // Fetch spaces and staff for each event
        const enrichedEvents = await Promise.all(events.map(async (event: any) => {
            const spaces = await db.prepare(`
                SELECT s.* FROM evenementiel_spaces s
                JOIN evenementiel_event_spaces es ON s.id = es.space_id
                WHERE es.event_id = ?
            `).all(event.id);
            
            const staff = await db.prepare(`
                SELECT st.name, est.count, st.id as staff_type_id FROM evenementiel_staff_types st
                JOIN evenementiel_event_staff est ON st.id = est.staff_type_id
                WHERE est.event_id = ?
            `).all(event.id);

            const assignments = await db.prepare(`
                SELECT a.employee_id, e.first_name || ' ' || e.last_name as employee_name, st.name as staff_type_name, st.id as staff_type_id
                FROM evenementiel_event_assignments a
                JOIN employes e ON a.employee_id = e.id
                JOIN evenementiel_staff_types st ON a.staff_type_id = st.id
                WHERE a.event_id = ?
            `).all(event.id);

            const documents = await db.prepare(`
                SELECT id, file_name, mime_type, file_size, storage_key, created_at
                FROM event_documents
                WHERE event_id = ? AND client_id = ?
                ORDER BY created_at DESC
            `).all(event.id, event.client_id);

            const note = await db.prepare(`
                SELECT id, note_text, updated_at
                FROM event_notes
                WHERE event_id = ? AND client_id = ?
                LIMIT 1
            `).get(event.id, event.client_id) as any;

            const takenBy = event.taken_by_id
                ? await db.prepare('SELECT id, first_name, last_name FROM employes WHERE id = ? AND client_id = ?').get(event.taken_by_id, event.client_id) as any
                : null;
            
            return {
                ...event,
                spaces,
                staff,
                assignments,
                documents,
                note_text: note?.note_text || '',
                has_note: !!note?.note_text,
                has_documents: documents.length > 0,
                taken_by_name: takenBy ? `${takenBy.first_name || ''} ${takenBy.last_name || ''}`.trim() : null
            };
        }));

        return c.json(enrichedEvents);
    } catch (e: any) {
        console.error('Error fetching calendar events:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/evenementiel', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        // Super admin sees everything, others only their client data
        const query = user.type === 'admin' 
            ? 'SELECT * FROM evenementiel ORDER BY start_time DESC' 
            : 'SELECT * FROM evenementiel WHERE client_id = ? ORDER BY start_time DESC';
        const params = user.type === 'admin' ? [] : [user.clientId];
        const items = await db.prepare(query).all(...params);

        const enrichedEvents = await Promise.all(items.map(async (event: any) => {
            const spaces = await db.prepare(`
                SELECT s.name, s.color FROM evenementiel_spaces s
                JOIN evenementiel_event_spaces es ON s.id = es.space_id
                WHERE es.event_id = ?
            `).all(event.id);
            
            const staff = await db.prepare(`
                SELECT st.name, est.count, st.id as staff_type_id FROM evenementiel_staff_types st
                JOIN evenementiel_event_staff est ON st.id = est.staff_type_id
                WHERE est.event_id = ?
            `).all(event.id);

            const assignments = await db.prepare(`
                SELECT a.employee_id, e.first_name || ' ' || e.last_name as employee_name, st.name as staff_type_name, st.id as staff_type_id
                FROM evenementiel_event_assignments a
                JOIN employes e ON a.employee_id = e.id
                JOIN evenementiel_staff_types st ON a.staff_type_id = st.id
                WHERE a.event_id = ?
            `).all(event.id);

            const documents = await db.prepare(`
                SELECT id, file_name, mime_type, file_size, storage_key, created_at
                FROM event_documents
                WHERE event_id = ? AND client_id = ?
                ORDER BY created_at DESC
            `).all(event.id, event.client_id);

            const note = await db.prepare(`
                SELECT id, note_text, updated_at
                FROM event_notes
                WHERE event_id = ? AND client_id = ?
                LIMIT 1
            `).get(event.id, event.client_id) as any;

            const takenBy = event.taken_by_id
                ? await db.prepare('SELECT id, first_name, last_name FROM employes WHERE id = ? AND client_id = ?').get(event.taken_by_id, event.client_id) as any
                : null;
            
            return {
                ...event,
                spaces,
                staff,
                assignments,
                documents,
                note_text: note?.note_text || '',
                has_note: !!note?.note_text,
                has_documents: documents.length > 0,
                taken_by_name: takenBy ? `${takenBy.first_name || ''} ${takenBy.last_name || ''}`.trim() : null
            };
        }));

        return c.json(enrichedEvents);
    } catch (e: any) {
        console.error('Error fetching evenementiel:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.post('/api/evenementiel', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    const body = await c.req.json();
    const id = crypto.randomUUID().substring(0, 8);
    
    const { 
        calendar_id, type, phone, email, address, start_time, end_time, num_people,
        staff_requests, assignments, documents, note_text, first_name, last_name, company_name, organizer_name,
        space_ids, taken_by_id
    } = body;

    if (!calendar_id) return c.json({ error: 'Calendar ID is required' }, 400);
    if (!start_time || !end_time) return c.json({ error: 'Heure de début et de fin obligatoires.' }, 400);
    if (type === 'PROFESSIONNEL' && !String(company_name || '').trim()) {
        return c.json({ error: 'Le nom de l\'entreprise est obligatoire pour une privatisation professionnelle.' }, 400);
    }

    const normalizedSpaceIds = Array.isArray(space_ids)
        ? Array.from(new Set(space_ids.map((id: any) => String(id || '').trim()).filter(Boolean)))
        : [];

    const clientId = resolveClientId(user, body.client_id);
    if (!clientId) return c.json({ error: 'client_id is required for admin actions' }, 400);

    try {
        await archivePastCalendars(db, clientId);

        // Check if calendar is OPEN
        const calendar = await db.prepare('SELECT status FROM evenementiel_calendars WHERE id = ? AND client_id = ?').get(calendar_id, clientId);
        if (!calendar) return c.json({ error: 'Calendar not found' }, 404);
        if (calendar.status === 'ARCHIVED') return c.json({ error: 'Cannot add events to an archived calendar' }, 403);

        const availableSpacesRow = await db.prepare('SELECT COUNT(*) as count FROM evenementiel_spaces WHERE client_id = ?').get(clientId) as any;
        const hasConfiguredSpaces = Number(availableSpacesRow?.count || 0) > 0;

        if (hasConfiguredSpaces && normalizedSpaceIds.length === 0) {
            return c.json({ error: 'Veuillez sélectionner un espace pour cette privatisation.' }, 400);
        }

        // Ensure selected spaces belong to this tenant
        for (const spaceId of normalizedSpaceIds) {
            const space = await db.prepare('SELECT id FROM evenementiel_spaces WHERE id = ? AND client_id = ?').get(spaceId, clientId);
            if (!space) {
                return c.json({ error: 'Invalid space selected for this client' }, 400);
            }
        }

        let validTakenById: string | null = null;
        if (taken_by_id) {
            const cfg = await db.prepare('SELECT track_taken_by, allowed_taker_employee_ids FROM evenementiel_config WHERE client_id = ?').get(clientId) as any;
            const trackingEnabled = Number(cfg?.track_taken_by || 0) === 1;
            if (!trackingEnabled) {
                return c.json({ error: 'Le suivi pris par est désactivé pour ce client.' }, 400);
            }
            let allowedIds: string[] = [];
            try {
                const parsed = JSON.parse(cfg?.allowed_taker_employee_ids || '[]');
                allowedIds = Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
            } catch {
                allowedIds = [];
            }
            const normalizedTakenBy = String(taken_by_id);
            if (!allowedIds.includes(normalizedTakenBy)) {
                return c.json({ error: 'Le preneur sélectionné n\'est pas autorisé.' }, 400);
            }
            const employee = await db.prepare('SELECT id FROM employes WHERE id = ? AND client_id = ?').get(normalizedTakenBy, clientId);
            if (!employee) {
                return c.json({ error: 'Le preneur sélectionné est invalide.' }, 400);
            }
            validTakenById = normalizedTakenBy;
        }

        // 1. Insert Event
        await db.prepare(`
            INSERT INTO evenementiel (
                id, client_id, calendar_id, type, phone, email, address, start_time, end_time, 
                num_people, documents, first_name, last_name, 
                company_name, organizer_name, taken_by_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, clientId, calendar_id, type, phone, email, address, start_time, end_time, 
            num_people, JSON.stringify([]), 
            first_name, last_name, company_name, organizer_name, validTakenById
        );

        // 2. Insert spaces
        for (const spaceId of normalizedSpaceIds) {
            await db.prepare('INSERT INTO evenementiel_event_spaces (event_id, space_id) VALUES (?, ?)').run(id, spaceId);
        }

        // 3. Insert staff requests (staff_requests is an object: { staff_type_id: count })
        if (staff_requests && typeof staff_requests === 'object') {
            for (const [staffTypeId, count] of Object.entries(staff_requests)) {
                if (Number(count) > 0) {
                    await db.prepare('INSERT INTO evenementiel_event_staff (event_id, staff_type_id, count) VALUES (?, ?, ?)').run(id, staffTypeId, count);
                }
            }
        }

        // 4. Insert assignments (internal booking)
        if (assignments && Array.isArray(assignments)) {
            for (const ass of assignments) {
                await db.prepare('INSERT INTO evenementiel_event_assignments (event_id, employee_id, staff_type_id) VALUES (?, ?, ?)').run(id, ass.employee_id, ass.staff_type_id);
            }
        }

        // 5. Save note (single note per event)
        if (typeof note_text === 'string' && note_text.trim()) {
            await db.prepare('INSERT INTO event_notes (id, event_id, client_id, note_text) VALUES (?, ?, ?, ?)')
                .run(crypto.randomUUID().substring(0, 8), id, clientId, note_text.trim());
        }

        // 6. Save document metadata
        if (documents && Array.isArray(documents)) {
            for (const doc of documents) {
                const fileName = doc?.file_name || doc?.name;
                if (!fileName) continue;
                await db.prepare(`
                    INSERT INTO event_documents (id, event_id, client_id, file_name, mime_type, file_size, storage_key)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    crypto.randomUUID().substring(0, 8),
                    id,
                    clientId,
                    fileName,
                    doc?.mime_type || doc?.type || null,
                    typeof doc?.file_size === 'number' ? doc.file_size : (typeof doc?.size === 'number' ? doc.size : null),
                    doc?.storage_key || doc?.url || null
                );
            }
        }

        // 7. CRM Logic: Automatic Contact Management
        await ensureCrmContactColumns(db);
        const normalizedPhone = String(phone || '').trim();
        const normalizedEmail = String(email || '').trim();
        const normalizedCompanyName = String(company_name || '').trim();
        const normalizedFirstName = String(first_name || '').trim();
        const normalizedLastName = String(last_name || '').trim();
        const phoneForStorage = buildCRMPhoneStorageValue({
            phone: normalizedPhone,
            email: normalizedEmail,
            type,
            companyName: normalizedCompanyName,
            firstName: first_name,
            lastName: last_name
        });
        let existingContact: any = null;

        if (normalizedPhone) {
            existingContact = await db.prepare('SELECT id FROM crm_contacts WHERE client_id = ? AND phone = ?').get(clientId, normalizedPhone);
        } else if (normalizedEmail) {
            existingContact = await db.prepare('SELECT id FROM crm_contacts WHERE client_id = ? AND LOWER(email) = LOWER(?)').get(clientId, normalizedEmail);
        } else if (type === 'PROFESSIONNEL' && normalizedCompanyName) {
            existingContact = await db.prepare('SELECT id FROM crm_contacts WHERE client_id = ? AND type = ? AND LOWER(company_name) = LOWER(?)').get(clientId, type, normalizedCompanyName);
        } else if (type === 'PRIVÉ' && normalizedLastName) {
            existingContact = await db.prepare(`
                SELECT id FROM crm_contacts
                WHERE client_id = ?
                  AND type = 'PRIVÉ'
                  AND LOWER(COALESCE(last_name, '')) = LOWER(?)
                  AND (? = '' OR LOWER(COALESCE(first_name, '')) = LOWER(?))
                LIMIT 1
            `).get(clientId, normalizedLastName, normalizedFirstName, normalizedFirstName) as any;
        }

        if (existingContact) {
            await db.prepare(`
                UPDATE crm_contacts 
                SET type = ?, first_name = ?, last_name = ?, company_name = ?, organizer_name = ?, email = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(type, first_name, last_name, company_name, organizer_name, normalizedEmail || null, phoneForStorage, address || null, existingContact.id);
        } else if (
            normalizedPhone
            || normalizedEmail
            || (type === 'PROFESSIONNEL' && normalizedCompanyName)
            || (type === 'PRIVÉ' && normalizedLastName)
        ) {
            const contactId = crypto.randomUUID().substring(0, 8);
            await db.prepare(`
                INSERT INTO crm_contacts (id, client_id, type, first_name, last_name, company_name, organizer_name, email, phone, address, country)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(contactId, clientId, type, first_name, last_name, company_name, organizer_name, normalizedEmail || null, phoneForStorage, address || null, 'France');
        }

        return c.json({ id });
    } catch (e: any) {
        console.error('Event creation error:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.put('/api/evenementiel/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    const eventId = c.req.param('id');
    const body = await c.req.json();
    const {
        calendar_id, type, phone, email, address, start_time, end_time, num_people,
        staff_requests, assignments, documents, note_text, first_name, last_name, company_name, organizer_name,
        space_ids, taken_by_id
    } = body;

    const clientId = resolveClientId(user, body.client_id);
    if (!clientId) return c.json({ error: 'client_id is required for admin actions' }, 400);
    if (!calendar_id) return c.json({ error: 'Calendar ID is required' }, 400);
    if (!start_time || !end_time) return c.json({ error: 'Heure de début et de fin obligatoires.' }, 400);
    if (type === 'PROFESSIONNEL' && !String(company_name || '').trim()) {
        return c.json({ error: 'Le nom de l\'entreprise est obligatoire pour une privatisation professionnelle.' }, 400);
    }

    const normalizedSpaceIds = Array.isArray(space_ids)
        ? Array.from(new Set(space_ids.map((id: any) => String(id || '').trim()).filter(Boolean)))
        : [];

    try {
        await archivePastCalendars(db, clientId);

        const existingEvent = user.type === 'admin'
            ? await db.prepare('SELECT id, client_id FROM evenementiel WHERE id = ?').get(eventId)
            : await db.prepare('SELECT id, client_id FROM evenementiel WHERE id = ? AND client_id = ?').get(eventId, clientId);

        if (!existingEvent) {
            return c.json({ error: 'Event not found' }, 404);
        }

        const calendar = await db.prepare('SELECT status FROM evenementiel_calendars WHERE id = ? AND client_id = ?').get(calendar_id, clientId);
        if (!calendar) return c.json({ error: 'Calendar not found' }, 404);
        if (calendar.status === 'ARCHIVED') return c.json({ error: 'Cannot edit an event in an archived calendar' }, 403);

        const availableSpacesRow = await db.prepare('SELECT COUNT(*) as count FROM evenementiel_spaces WHERE client_id = ?').get(clientId) as any;
        const hasConfiguredSpaces = Number(availableSpacesRow?.count || 0) > 0;

        if (hasConfiguredSpaces && normalizedSpaceIds.length === 0) {
            return c.json({ error: 'Veuillez sélectionner un espace pour cette privatisation.' }, 400);
        }

        for (const spaceId of normalizedSpaceIds) {
            const space = await db.prepare('SELECT id FROM evenementiel_spaces WHERE id = ? AND client_id = ?').get(spaceId, clientId);
            if (!space) {
                return c.json({ error: 'Invalid space selected for this client' }, 400);
            }
        }

        let validTakenById: string | null = null;
        if (taken_by_id) {
            const cfg = await db.prepare('SELECT track_taken_by, allowed_taker_employee_ids FROM evenementiel_config WHERE client_id = ?').get(clientId) as any;
            const trackingEnabled = Number(cfg?.track_taken_by || 0) === 1;
            if (!trackingEnabled) {
                return c.json({ error: 'Le suivi pris par est désactivé pour ce client.' }, 400);
            }
            let allowedIds: string[] = [];
            try {
                const parsed = JSON.parse(cfg?.allowed_taker_employee_ids || '[]');
                allowedIds = Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
            } catch {
                allowedIds = [];
            }
            const normalizedTakenBy = String(taken_by_id);
            if (!allowedIds.includes(normalizedTakenBy)) {
                return c.json({ error: 'Le preneur sélectionné n\'est pas autorisé.' }, 400);
            }
            const employee = await db.prepare('SELECT id FROM employes WHERE id = ? AND client_id = ?').get(normalizedTakenBy, clientId);
            if (!employee) {
                return c.json({ error: 'Le preneur sélectionné est invalide.' }, 400);
            }
            validTakenById = normalizedTakenBy;
        }

        await db.prepare(`
            UPDATE evenementiel
            SET calendar_id = ?, type = ?, phone = ?, email = ?, address = ?, start_time = ?, end_time = ?,
                num_people = ?, first_name = ?, last_name = ?, company_name = ?, organizer_name = ?, taken_by_id = ?
            WHERE id = ? AND client_id = ?
        `).run(
            calendar_id, type, phone, email, address, start_time, end_time,
            num_people, first_name, last_name, company_name, organizer_name, validTakenById,
            eventId, clientId
        );

        await db.prepare('DELETE FROM evenementiel_event_spaces WHERE event_id = ?').run(eventId);
        for (const spaceId of normalizedSpaceIds) {
            await db.prepare('INSERT INTO evenementiel_event_spaces (event_id, space_id) VALUES (?, ?)').run(eventId, spaceId);
        }

        await db.prepare('DELETE FROM evenementiel_event_staff WHERE event_id = ?').run(eventId);
        if (staff_requests && typeof staff_requests === 'object') {
            for (const [staffTypeId, count] of Object.entries(staff_requests)) {
                if (Number(count) > 0) {
                    await db.prepare('INSERT INTO evenementiel_event_staff (event_id, staff_type_id, count) VALUES (?, ?, ?)').run(eventId, staffTypeId, count);
                }
            }
        }

        await db.prepare('DELETE FROM evenementiel_event_assignments WHERE event_id = ?').run(eventId);
        if (assignments && Array.isArray(assignments)) {
            for (const ass of assignments) {
                await db.prepare('INSERT INTO evenementiel_event_assignments (event_id, employee_id, staff_type_id) VALUES (?, ?, ?)').run(eventId, ass.employee_id, ass.staff_type_id);
            }
        }

        await db.prepare('DELETE FROM event_documents WHERE event_id = ? AND client_id = ?').run(eventId, clientId);
        if (documents && Array.isArray(documents)) {
            for (const doc of documents) {
                const fileName = doc?.file_name || doc?.name;
                if (!fileName) continue;
                await db.prepare(`
                    INSERT INTO event_documents (id, event_id, client_id, file_name, mime_type, file_size, storage_key)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    crypto.randomUUID().substring(0, 8),
                    eventId,
                    clientId,
                    fileName,
                    doc?.mime_type || doc?.type || null,
                    typeof doc?.file_size === 'number' ? doc.file_size : (typeof doc?.size === 'number' ? doc.size : null),
                    doc?.storage_key || doc?.url || null
                );
            }
        }

        if (typeof note_text === 'string' && note_text.trim()) {
            const existingNote = await db.prepare('SELECT id FROM event_notes WHERE event_id = ? AND client_id = ?').get(eventId, clientId) as any;
            if (existingNote) {
                await db.prepare('UPDATE event_notes SET note_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                    .run(note_text.trim(), existingNote.id);
            } else {
                await db.prepare('INSERT INTO event_notes (id, event_id, client_id, note_text) VALUES (?, ?, ?, ?)')
                    .run(crypto.randomUUID().substring(0, 8), eventId, clientId, note_text.trim());
            }
        } else {
            await db.prepare('DELETE FROM event_notes WHERE event_id = ? AND client_id = ?').run(eventId, clientId);
        }

        await ensureCrmContactColumns(db);
        const normalizedPhone = String(phone || '').trim();
        const normalizedEmail = String(email || '').trim();
        const normalizedCompanyName = String(company_name || '').trim();
        const normalizedFirstName = String(first_name || '').trim();
        const normalizedLastName = String(last_name || '').trim();
        const phoneForStorage = buildCRMPhoneStorageValue({
            phone: normalizedPhone,
            email: normalizedEmail,
            type,
            companyName: normalizedCompanyName,
            firstName: first_name,
            lastName: last_name
        });
        let existingContact: any = null;

        if (normalizedPhone) {
            existingContact = await db.prepare('SELECT id FROM crm_contacts WHERE client_id = ? AND phone = ?').get(clientId, normalizedPhone) as any;
        } else if (normalizedEmail) {
            existingContact = await db.prepare('SELECT id FROM crm_contacts WHERE client_id = ? AND LOWER(email) = LOWER(?)').get(clientId, normalizedEmail) as any;
        } else if (type === 'PROFESSIONNEL' && normalizedCompanyName) {
            existingContact = await db.prepare('SELECT id FROM crm_contacts WHERE client_id = ? AND type = ? AND LOWER(company_name) = LOWER(?)').get(clientId, type, normalizedCompanyName) as any;
        } else if (type === 'PRIVÉ' && normalizedLastName) {
            existingContact = await db.prepare(`
                SELECT id FROM crm_contacts
                WHERE client_id = ?
                  AND type = 'PRIVÉ'
                  AND LOWER(COALESCE(last_name, '')) = LOWER(?)
                  AND (? = '' OR LOWER(COALESCE(first_name, '')) = LOWER(?))
                LIMIT 1
            `).get(clientId, normalizedLastName, normalizedFirstName, normalizedFirstName) as any;
        }

        if (existingContact) {
            await db.prepare(`
                UPDATE crm_contacts
                SET type = ?, first_name = ?, last_name = ?, company_name = ?, organizer_name = ?, email = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(type, first_name, last_name, company_name, organizer_name, normalizedEmail || null, phoneForStorage, address || null, existingContact.id);
        } else if (
            normalizedPhone
            || normalizedEmail
            || (type === 'PROFESSIONNEL' && normalizedCompanyName)
            || (type === 'PRIVÉ' && normalizedLastName)
        ) {
            const contactId = crypto.randomUUID().substring(0, 8);
            await db.prepare(`
                INSERT INTO crm_contacts (id, client_id, type, first_name, last_name, company_name, organizer_name, email, phone, address, country)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(contactId, clientId, type, first_name, last_name, company_name, organizer_name, normalizedEmail || null, phoneForStorage, address || null, 'France');
        }

        return c.json({ id: eventId, success: true });
    } catch (e: any) {
        console.error('Event update error:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.delete('/api/evenementiel/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    const id = c.req.param('id');

    const event = user.type === 'admin'
        ? await db.prepare('SELECT id, calendar_id FROM evenementiel WHERE id = ?').get(id) as any
        : await db.prepare('SELECT id, calendar_id FROM evenementiel WHERE id = ? AND client_id = ?').get(id, user.clientId) as any;
    if (!event) return c.json({ error: 'Événement introuvable.' }, 404);

    const calendar = await db.prepare('SELECT status FROM evenementiel_calendars WHERE id = ?').get(event.calendar_id) as any;
    if (calendar?.status === 'ARCHIVED') {
        return c.json({ error: 'Impossible de supprimer un événement d\'un calendrier archivé.' }, 403);
    }

    if (user.type === 'admin') {
        await db.prepare('DELETE FROM evenementiel WHERE id = ?').run(id);
    } else {
        await db.prepare('DELETE FROM evenementiel WHERE id = ? AND client_id = ?').run(id, user.clientId);
    }
    return c.json({ success: true });
});

app.patch('/api/evenementiel/calendars/:id/archive', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    const id = c.req.param('id');
    const clientId = user.type === 'admin' ? c.req.query('client_id') : user.clientId;

    const calendar = await db.prepare('SELECT * FROM evenementiel_calendars WHERE id = ? AND client_id = ?').get(id, clientId) as any;
    if (!calendar) return c.json({ error: 'Calendrier introuvable.' }, 404);

    const newStatus = calendar.status === 'ARCHIVED' ? 'OPEN' : 'ARCHIVED';
    await db.prepare('UPDATE evenementiel_calendars SET status = ? WHERE id = ?').run(newStatus, id);
    return c.json({ id, status: newStatus });
});

app.delete('/api/evenementiel/calendars/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    const id = c.req.param('id');
    const clientId = user.type === 'admin' ? c.req.query('client_id') : user.clientId;

    const calendar = await db.prepare('SELECT * FROM evenementiel_calendars WHERE id = ? AND client_id = ?').get(id, clientId) as any;
    if (!calendar) return c.json({ error: 'Calendrier introuvable.' }, 404);

    const evts = await db.prepare('SELECT id FROM evenementiel WHERE calendar_id = ?').all(id) as any[];
    for (const evt of evts) {
        await db.prepare('DELETE FROM evenementiel_event_spaces WHERE event_id = ?').run(evt.id);
        await db.prepare('DELETE FROM evenementiel_event_staff WHERE event_id = ?').run(evt.id);
        await db.prepare('DELETE FROM evenementiel_event_assignments WHERE event_id = ?').run(evt.id);
        await db.prepare('DELETE FROM event_documents WHERE event_id = ?').run(evt.id);
        await db.prepare('DELETE FROM event_notes WHERE event_id = ?').run(evt.id);
    }
    await db.prepare('DELETE FROM evenementiel WHERE calendar_id = ?').run(id);
    await db.prepare('DELETE FROM evenementiel_calendars WHERE id = ?').run(id);
    return c.json({ success: true });
});

app.get('/api/crm/contacts', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        await ensureCrmContactColumns(db);
        const items = await db.prepare('SELECT * FROM crm_contacts WHERE client_id = ? ORDER BY updated_at DESC').all(user.clientId);
        return c.json((items || []).map((it: any) => ({ ...it, phone: toPublicPhone(it.phone) })));
    } catch (e: any) {
        console.error('Error fetching CRM contacts:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/crm/contacts/search', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        await ensureCrmContactColumns(db);
        const query = String(c.req.query('q') || '').trim();

        if (query.length < 2) {
            return c.json([]);
        }

        const pattern = `%${query}%`;
        const items = await db.prepare(`
            SELECT id, type, first_name, last_name, company_name, organizer_name, phone, email, address, postal_code, city, country, updated_at
            FROM crm_contacts
            WHERE client_id = ?
              AND (
                LOWER(COALESCE(company_name, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(first_name, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(last_name, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(email, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(address, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(city, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(postal_code, '')) LIKE LOWER(?)
                OR COALESCE(phone, '') LIKE ?
              )
            ORDER BY updated_at DESC
            LIMIT 8
        `).all(user.clientId, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);

        return c.json((items || []).map((it: any) => ({ ...it, phone: toPublicPhone(it.phone) })));
    } catch (e: any) {
        console.error('Error searching CRM contacts:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/crm/contacts/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        await ensureCrmContactColumns(db);
        const id = c.req.param('id');
        
        const contact = await db.prepare('SELECT * FROM crm_contacts WHERE id = ? AND client_id = ?').get(id, user.clientId) as any;
        if (!contact) return c.json({ error: 'Contact not found' }, 404);
                const contactType = String(contact.type || '');
        const normalizedPhone = toPublicPhone(contact.phone);
        const normalizedEmail = String(contact.email || '').trim();
                const normalizedCompanyName = String(contact.company_name || '').trim();
                const normalizedOrganizerName = String(contact.organizer_name || '').trim();
                const normalizedFirstName = String(contact.first_name || '').trim();
                const normalizedLastName = String(contact.last_name || '').trim();
        
        // Get history
        const history = await db.prepare(`
            SELECT e.*, GROUP_CONCAT(s.name) as spaces
            FROM evenementiel e
            LEFT JOIN evenementiel_event_spaces es ON e.id = es.event_id
            LEFT JOIN evenementiel_spaces s ON es.space_id = s.id
            WHERE e.client_id = ?
              AND (
                                (? = 'PROFESSIONNEL' AND ? <> '' AND LOWER(COALESCE(e.company_name, '')) = LOWER(?))
                                OR (? = 'PROFESSIONNEL' AND ? <> '' AND LOWER(COALESCE(e.organizer_name, '')) = LOWER(?))
                                OR (
                                        ? = 'PRIVÉ'
                                        AND ? <> ''
                                        AND LOWER(COALESCE(e.last_name, '')) = LOWER(?)
                                        AND (? = '' OR LOWER(COALESCE(e.first_name, '')) = LOWER(?))
                                )
                        OR
                (? <> '' AND e.phone = ?)
                OR (? <> '' AND LOWER(COALESCE(e.email, '')) = LOWER(?))
              )
            GROUP BY e.id
            ORDER BY e.start_time DESC
                `).all(
                        user.clientId,
                        contactType, normalizedCompanyName, normalizedCompanyName,
                        contactType, normalizedOrganizerName, normalizedOrganizerName,
                        contactType, normalizedLastName, normalizedLastName, normalizedFirstName, normalizedFirstName,
                        normalizedPhone, normalizedPhone,
                        normalizedEmail, normalizedEmail
                );

        const factures = await db.prepare(`
            SELECT id, invoice_number, customer_name, total_ttc, amount, due_date, status, created_at
            FROM facture
            WHERE client_id = ? AND crm_contact_id = ?
            ORDER BY datetime(created_at) DESC
        `).all(user.clientId, id);
        
        // Documents liés aux privatisations de ce contact
        const eventIds = (history || []).map((evt: any) => evt.id);
        let eventDocuments: any[] = [];
        if (eventIds.length > 0) {
            const placeholders = eventIds.map(() => '?').join(',');
            eventDocuments = await db.prepare(`
                SELECT id, event_id, file_name, mime_type, file_size, storage_key, created_at
                FROM event_documents
                WHERE client_id = ? AND event_id IN (${placeholders})
                ORDER BY created_at DESC
            `).all(user.clientId, ...eventIds);
        }

        // Documents propres au client (hors privatisation)
        const clientDocuments = await db.prepare(`
            SELECT id, file_name, mime_type, file_size, storage_key, created_at
            FROM client_documents
            WHERE client_id = ?
            ORDER BY created_at DESC
        `).all(user.clientId);

        return c.json({
            ...contact,
            phone: toPublicPhone(contact.phone),
            history,
            factures,
            eventDocuments,
            clientDocuments
        });
    } catch (e: any) {
        console.error('Error fetching CRM contact detail:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.put('/api/crm/contacts/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const id = c.req.param('id');
        const body = await c.req.json();

        await ensureCrmContactColumns(db);
        const existing = await db.prepare('SELECT id FROM crm_contacts WHERE id = ? AND client_id = ?').get(id, user.clientId) as any;
        if (!existing) return c.json({ error: 'Contact not found' }, 404);

        const normalizedType = body?.type === 'PRIVÉ' ? 'PRIVÉ' : 'PROFESSIONNEL';
        const firstName = String(body?.first_name || '').trim();
        const lastName = String(body?.last_name || '').trim();
        const companyName = String(body?.company_name || '').trim();
        const organizerName = String(body?.organizer_name || '').trim();
        const email = String(body?.email || '').trim();
        const phone = String(body?.phone || '').trim();
        const address = String(body?.address || '').trim();
        const postalCode = String(body?.postal_code || '').trim();
        const city = String(body?.city || '').trim();
        const country = String(body?.country || 'France').trim() || 'France';
        const phoneForStorage = buildCRMPhoneStorageValue({
            phone,
            email,
            type: normalizedType,
            companyName,
            firstName,
            lastName
        });

        if (normalizedType === 'PRIVÉ' && !lastName) {
            return c.json({ error: 'Le nom est requis pour un contact privé.' }, 400);
        }

        if (normalizedType === 'PROFESSIONNEL' && !companyName) {
            return c.json({ error: 'Le nom d\'entreprise est requis pour un contact professionnel.' }, 400);
        }

        await db.prepare(`
            UPDATE crm_contacts
            SET type = ?,
                first_name = ?,
                last_name = ?,
                company_name = ?,
                organizer_name = ?,
                email = ?,
                phone = ?,
                address = ?,
                postal_code = ?,
                city = ?,
                country = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND client_id = ?
        `).run(
            normalizedType,
            firstName || null,
            lastName || null,
            companyName || null,
            organizerName || null,
            email || null,
            phoneForStorage,
            address || null,
            postalCode || null,
            city || null,
            country,
            id,
            user.clientId
        );

        const updated = await db.prepare('SELECT * FROM crm_contacts WHERE id = ? AND client_id = ?').get(id, user.clientId) as any;
        return c.json({ ...updated, phone: toPublicPhone(updated?.phone) });
    } catch (e: any) {
        console.error('Error updating CRM contact:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.delete('/api/crm/contacts/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const id = c.req.param('id');

        const contact = await db.prepare('SELECT id FROM crm_contacts WHERE id = ? AND client_id = ?').get(id, user.clientId) as any;
        if (!contact) return c.json({ error: 'Contact not found' }, 404);

        await db.prepare('DELETE FROM crm_contacts WHERE id = ? AND client_id = ?').run(id, user.clientId);
        return c.json({ success: true });
    } catch (e: any) {
        console.error('Error deleting CRM contact:', e);
        return c.json({ error: e.message }, 500);
    }
});

const buildInvoiceClientPrefix = (companyName?: string, clientId?: string) => {
    const normalizedName = String(companyName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
    const namePart = normalizedName.slice(0, 4) || 'CLNT';
    const normalizedId = String(clientId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const idPart = normalizedId.slice(-3);
    return idPart ? `${namePart}-${idPart}` : namePart;
};

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const formatFactureEmailDate = (value: any) => {
    const raw = String(value || '').trim();
    if (!raw) return new Date().toLocaleDateString('fr-FR');
    const normalized = raw.includes('T') ? raw : `${raw}T00:00:00`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('fr-FR');
};

const sanitizePdfText = (value: any) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');

const escapePdfText = (value: any) => sanitizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .slice(0, 140);

const buildFacturePdfBuffer = (params: { invoice: any; payload: any; settings: any; }) => {
    const invoice = params.invoice || {};
    const payload = params.payload || {};
    const settings = params.settings || {};
    const lines = Array.isArray(payload.lines) ? payload.lines : [];

    const totalHt = Number(payload.totalHt ?? invoice.total_ht ?? 0);
    const totalTva = Number(payload.totalTva ?? invoice.total_tva ?? 0);
    const totalTtc = Number(payload.totalTtcBrut ?? payload.totalTtc ?? invoice.total_ttc ?? 0);

    const contentLines = [
        String(settings.company_name || 'Votre etablissement'),
        String(settings.address || ''),
        [settings.postal_code, settings.city, settings.country].filter(Boolean).join(' '),
        '',
        `FACTURE ${invoice.invoice_number || payload.invoiceNumber || ''}`,
        `Date: ${formatFactureEmailDate(payload.invoiceDate || invoice.due_date)}`,
        `Client: ${payload.clientName || invoice.customer_name || 'Client'}`,
        `Adresse: ${[payload.clientAddress, payload.clientPostalCode, payload.clientCity, payload.clientCountry].filter(Boolean).join(' ')}`,
        '',
        'Prestations:'
    ];

    if (lines.length > 0) {
        lines.forEach((line: any, index: number) => {
            const totalLineTtc = line?.ttcByRate
                ? Object.values(line.ttcByRate as Record<string, number>).reduce((sum: number, value: any) => sum + Number(value || 0), 0)
                : 0;
            contentLines.push(`${index + 1}. ${String(line?.label || 'Prestation')} x${Math.max(1, Number(line?.quantity || 1))} - ${totalLineTtc.toFixed(2)} EUR TTC`);
        });
    } else {
        contentLines.push('Aucune ligne detaillee.');
    }

    contentLines.push('');
    contentLines.push(`Total HT: ${totalHt.toFixed(2)} EUR`);
    contentLines.push(`TVA: ${totalTva.toFixed(2)} EUR`);
    contentLines.push(`Total TTC: ${totalTtc.toFixed(2)} EUR`);

    let y = 795;
    let stream = '';
    for (const line of contentLines.slice(0, 46)) {
        stream += `BT /F1 11 Tf 40 ${y} Td (${escapePdfText(line)}) Tj ET\n`;
        y -= 16;
        if (y < 40) break;
    }

    const objects = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
        `4 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}endstream\nendobj\n`,
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) {
        offsets.push(Buffer.byteLength(pdf, 'utf8'));
        pdf += object;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i++) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
};

app.get('/api/facture/crm-search', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        await ensureCrmContactColumns(db);
        const query = String(c.req.query('q') || '').trim();

        if (query.length < 2) {
            return c.json([]);
        }

        const pattern = `%${query}%`;
        const items = await db.prepare(`
            SELECT id, type, first_name, last_name, company_name, organizer_name, phone, email, address, postal_code, city, country, updated_at
            FROM crm_contacts
            WHERE client_id = ?
              AND (
                LOWER(COALESCE(company_name, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(first_name, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(last_name, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(email, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(address, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(city, '')) LIKE LOWER(?)
                OR LOWER(COALESCE(postal_code, '')) LIKE LOWER(?)
                OR COALESCE(phone, '') LIKE ?
              )
            ORDER BY updated_at DESC
            LIMIT 8
        `).all(user.clientId, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);

        return c.json((items || []).map((it: any) => ({ ...it, phone: toPublicPhone(it.phone) })));
    } catch (e: any) {
        console.error('Error searching CRM contacts from facture:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/facture', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        await ensureFactureColumns(db);
        const items = await db.prepare('SELECT * FROM facture WHERE client_id = ? ORDER BY datetime(created_at) DESC').all(user.clientId);
        return c.json(items);
    } catch (e: any) {
        console.error('Error fetching factures:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.post('/api/facture', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        await ensureFactureColumns(db);
        const body = await c.req.json();
        const id = String(body.id || crypto.randomUUID());
        const clientProfile = await db.prepare('SELECT company_name FROM clients WHERE id = ?').get(user.clientId) as any;
        const clientPrefix = buildInvoiceClientPrefix(clientProfile?.company_name || user?.companyName || '', user.clientId);
        const invoiceNumber = String(body.invoiceNumber || `${clientPrefix}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`);
        const customerName = String(body.clientName || body.customer_name || 'Client');
        const crmContactIdRaw = String(body.crmContactId || body.crm_contact_id || '').trim();
        const totalHt = Number(body.totalHt || 0);
        const totalTva = Number(body.totalTva || 0);
        const totalTtc = Number(body.totalTtcBrut || body.totalTtc || 0);
        const alreadyPaid = Number(body.alreadyPaidValue || body.already_paid || 0);
        const remainingDue = Number(body.netToPay || body.remaining_due || 0);
        const status = remainingDue <= 0 ? 'paid' : String(body.status || 'pending');
        const dueDate = body.invoiceDate || null;
        const linkedContact = crmContactIdRaw
            ? await db.prepare('SELECT id FROM crm_contacts WHERE id = ? AND client_id = ?').get(crmContactIdRaw, user.clientId) as any
            : null;
        const crmContactId = linkedContact?.id ? String(linkedContact.id) : null;
        const payloadJson = JSON.stringify({ ...(body || {}), crmContactId });
        const billingSnapshot = JSON.stringify(body.billing_snapshot || {});

        await db.prepare(`INSERT INTO facture (
            id, client_id, invoice_number, customer_name, amount, status, due_date,
            payload_json, billing_snapshot, total_ht, total_tva, total_ttc, already_paid, remaining_due, crm_contact_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            invoice_number = excluded.invoice_number,
            customer_name = excluded.customer_name,
            amount = excluded.amount,
            status = excluded.status,
            due_date = excluded.due_date,
            payload_json = excluded.payload_json,
            billing_snapshot = excluded.billing_snapshot,
            total_ht = excluded.total_ht,
            total_tva = excluded.total_tva,
            total_ttc = excluded.total_ttc,
            already_paid = excluded.already_paid,
            remaining_due = excluded.remaining_due,
            crm_contact_id = excluded.crm_contact_id`).run(
            id, user.clientId, invoiceNumber, customerName, totalTtc, status, dueDate,
            payloadJson, billingSnapshot, totalHt, totalTva, totalTtc, alreadyPaid, remainingDue, crmContactId
        );

        const saved = await db.prepare('SELECT * FROM facture WHERE id = ?').get(id);
        return c.json(saved);
    } catch (e: any) {
        console.error('Error saving facture:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.post('/api/facture/:id/send-email', authMiddleware, moduleAccessMiddleware, async (c) => {
        console.log('[DEBUG] Handler /api/facture/:id/send-email appelé pour', c.req.param('id'));
    try {
        const user = c.get('user');
        const db = getDb(c);
        await ensureFactureColumns(db);
        await ensureCrmContactColumns(db);

        const id = String(c.req.param('id') || '').trim();
        const body = await c.req.json().catch(() => ({} as any));
        const invoice = await db.prepare('SELECT * FROM facture WHERE id = ? AND client_id = ?').get(id, user.clientId);
        // Accepte le payload soit dans invoicePayload, soit à la racine du body
        let requestPayload = {};
        if (body?.invoicePayload && typeof body.invoicePayload === 'object') {
            requestPayload = body.invoicePayload;
        } else {
            // Si le body contient au moins un champ clé de facture OU les champs d'email minimal, on le prend comme payload
            const keys = Object.keys(body || {});
            if (
                keys.includes('clientName') ||
                keys.includes('customer_name') ||
                keys.includes('invoiceNumber') ||
                keys.includes('totalTtcBrut') ||
                keys.includes('totalTtc') ||
                (keys.includes('to') && keys.includes('pdfBase64'))
            ) {
                requestPayload = body;
            }
        }
        let payload, settings, virtualInvoice;
        const reqPayload: any = requestPayload; // typage any pour accès dynamique
        if (invoice) {
            payload = (() => {
                try {
                    return typeof invoice.payload_json === 'string' ? JSON.parse(invoice.payload_json || '{}') : (invoice.payload_json || {});
                } catch {
                    return {};
                }
            })();
            settings = (() => {
                try {
                    return typeof invoice.billing_snapshot === 'string' ? JSON.parse(invoice.billing_snapshot || '{}') : (invoice.billing_snapshot || {});
                } catch {
                    return {};
                }
            })();
            virtualInvoice = invoice;
        } else if (Object.keys(reqPayload).length) {
            payload = reqPayload;
            settings = reqPayload.billing_snapshot || {};
            virtualInvoice = {
                id,
                invoice_number: reqPayload.invoiceNumber || id,
                customer_name: reqPayload.clientName || reqPayload.customer_name || 'Client',
                amount: Number(reqPayload.totalTtcBrut || reqPayload.totalTtc || 0),
                due_date: reqPayload.invoiceDate || null,
                status: String(reqPayload.status || 'pending'),
                crm_contact_id: reqPayload.crmContactId || reqPayload.crm_contact_id || null,
                payload_json: JSON.stringify(reqPayload || {}),
                billing_snapshot: JSON.stringify(reqPayload.billing_snapshot || {}),
            };
        } else {
            console.warn('[FACTURE EMAIL] Blocage: Facture introuvable et payload vide', { id, userId: user.clientId, body });
            return c.json({ error: 'Facture introuvable et payload vide' }, 404);
        }

        let recipientEmail = String(body?.to || payload?.recipientEmail || '').trim();
        if (!recipientEmail && virtualInvoice.crm_contact_id) {
            const linkedContact = await db.prepare('SELECT email FROM crm_contacts WHERE id = ? AND client_id = ?').get(virtualInvoice.crm_contact_id, user.clientId) as any;
            recipientEmail = String(linkedContact?.email || '').trim();
        }

        if (!recipientEmail) {
            console.warn('[FACTURE EMAIL] Blocage: Adresse email du destinataire manquante', { id, userId: user.clientId, body, payload });
            return c.json({ error: 'Adresse email du destinataire manquante.' }, 400);
        }

        if (!isValidEmailAddress(recipientEmail)) {
            console.warn('[FACTURE EMAIL] Blocage: Adresse email invalide', { recipientEmail });
            return c.json({ error: 'Adresse email invalide.' }, 400);
        }

        const resendKey = c.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (!resendKey) {
            console.warn('[FACTURE EMAIL] Blocage: RESEND_API_KEY manquante sur le serveur');
            return c.json({ error: 'RESEND_API_KEY manquante sur le serveur.' }, 500);
        }

        // Répondre immédiatement au frontend
        console.log('[FACTURE EMAIL] Tous les prérequis sont OK, envoi du mail en tâche de fond...');
        c.json({ success: true });

        // Envoi du mail en tâche de fond
        setImmediate(async () => {
            try {
                const nextPayload = { ...payload, ...requestPayload, recipientEmail };
                if (invoice) {
                    await db.prepare('UPDATE facture SET payload_json = ? WHERE id = ? AND client_id = ?').run(JSON.stringify(nextPayload), id, user.clientId);
                }

                // Récupération intelligente du nom d'établissement
                let establishmentName = String(settings.company_name || '').trim();
                if (!establishmentName && user && user.clientId) {
                    // Aller chercher dans la table clients si non présent dans settings
                    const clientRow = await db.prepare('SELECT company_name, name FROM clients WHERE id = ?').get(user.clientId) as any;
                    establishmentName = String(clientRow?.company_name || clientRow?.name || 'Votre établissement').trim();
                }
                if (!establishmentName) establishmentName = 'Votre établissement';
                // Correction de l'expression régulière pour supprimer les caractères interdits
                const senderLabel = establishmentName.replace(/[<>"\n]/g, '').trim() || 'Votre établissement';
                const displayDate = formatFactureEmailDate(nextPayload.invoiceDate || virtualInvoice.due_date);
                const providedPdfBase64 = String(body?.pdfBase64 || '').trim();
                const pdfBuffer = providedPdfBase64
                    ? Buffer.from(providedPdfBase64, 'base64')
                    : buildFacturePdfBuffer({ invoice: virtualInvoice, payload: nextPayload, settings });
                const safeFilename = String(body?.filename || `${String(virtualInvoice.invoice_number || nextPayload.invoiceNumber || 'facture').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`)
                    .replace(/[^a-zA-Z0-9._-]/g, '_');
                const resend = new Resend(resendKey);

                const emailResult = await resend.emails.send({
                    from: `${senderLabel} <notification@l-iamani.com>`,
                    to: recipientEmail,
                    subject: `[${establishmentName}] Votre facture du "${displayDate}"`,
                    text: `Bonjour,\n\nVous trouverez ci-joint votre facture du ${displayDate}, bonne réception.\n\nCordialement,\n${establishmentName}`,
                    html: `<p>Bonjour,</p><p>Vous trouverez ci-joint votre facture du ${displayDate}, bonne réception.</p><p>Cordialement,<br/>${establishmentName}</p>`,
                    attachments: [
                        {
                            filename: safeFilename,
                            content: pdfBuffer,
                        }
                    ]
                });
                console.log('[FACTURE EMAIL] Résultat envoi Resend:', JSON.stringify(emailResult));
                // Enregistrement dans l'historique d'envoi si succès
                if (emailResult && typeof emailResult === 'object' && 'id' in emailResult && emailResult.id) {
                    try {
                        await ensureFactureHistoryTable(db);
                        await db.prepare(`INSERT INTO facture_history (facture_id, client_id, action, email, pdf_filename) VALUES (?, ?, 'email', ?, ?)`)
                            .run(id, user.clientId, recipientEmail, safeFilename);
                        console.log('[FACTURE EMAIL] Historique d\'envoi enregistré pour la facture', id, 'PDF:', safeFilename);
                    } catch (histErr) {
                        console.error('[FACTURE EMAIL] Erreur lors de l\'enregistrement de l\'historique:', histErr);
                    }
                } else {
                    console.error('[FACTURE EMAIL] Echec d\'envoi ou pas d\'ID de message retourné:', emailResult);
                }
            } catch (err) {
                console.error('Erreur lors de l’envoi du mail de facture (async) :', err);
            }
        });
    } catch (e: any) {
        console.error('Error sending facture email:', e);
        return c.json({ error: e.message || 'Erreur lors de l’envoi de la facture' }, 500);
    }
});

app.delete('/api/facture/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        await ensureFactureColumns(db);

        const hasSuperAdminAccess = (
            (user?.type === 'admin' && user?.email === SUPER_ADMIN_EMAIL) ||
            (user?.type === 'client' && user?.impersonatedBySuperAdmin === true && user?.originalAdminEmail === SUPER_ADMIN_EMAIL)
        );

        if (!hasSuperAdminAccess) {
            return c.json({ error: 'Super Admin access required' }, 403);
        }

        const id = c.req.param('id');
        const clientId = String(user?.clientId || user?.id || '');
        const existing = await db.prepare('SELECT id FROM facture WHERE id = ? AND client_id = ?').get(id, clientId) as any;

        if (!existing) {
            return c.json({ error: 'Facture introuvable' }, 404);
        }

        await db.prepare('DELETE FROM facture WHERE id = ? AND client_id = ?').run(id, clientId);
        return c.json({ success: true });
    } catch (e: any) {
        console.error('Error deleting facture:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/facture/billing-settings', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    await ensureClientFiscalColumns(db);
    await ensureBillingSettingsTable(db);
    const row = await db.prepare('SELECT * FROM billing_settings WHERE client_id = ?').get(user.clientId) as any;
    const clientBrand = await db.prepare('SELECT company_name, logo_url, default_tva_rate, default_tva_custom_rate, tva_rates, enable_cover_count FROM clients WHERE id = ?').get(user.clientId) as any;
    const parsedTvaRates = (() => {
        try {
            const arr = JSON.parse(clientBrand?.tva_rates || '[]');
            if (Array.isArray(arr) && arr.length > 0) return arr.map(Number).filter((n: number) => Number.isFinite(n) && n >= 0);
        } catch {}
        // fallback vers l'ancien taux unique
        const legacy = clientBrand?.default_tva_rate === 'custom'
            ? (clientBrand?.default_tva_custom_rate ?? 20)
            : Number(clientBrand?.default_tva_rate ?? 20);
        return [Number.isFinite(legacy) ? legacy : 20];
    })();
    return c.json({
        ...(row || {}),
        company_name: clientBrand?.company_name || '',
        logo_url: clientBrand?.logo_url || '',
        tva_rates: parsedTvaRates,
        enable_cover_count: Boolean(clientBrand?.enable_cover_count),
        can_edit_branding: user.type === 'admin',
        can_edit_tax_rate: user.type === 'admin',
    });
});

app.put('/api/facture/billing-settings', authMiddleware, moduleAccessMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c);
    await ensureClientFiscalColumns(db);
    await ensureBillingSettingsTable(db);
    const body = await c.req.json();
    const fields = ['address','postal_code','city','country','siret','tva','phone','capital','ape','siege_social','rcs_ville','rcs_numero','prestations_catalog'];
    db.prepare(`INSERT INTO billing_settings (client_id, ${fields.join(', ')}, updated_at)
        VALUES (?, ${fields.map(() => '?').join(', ')}, CURRENT_TIMESTAMP)
        ON CONFLICT(client_id) DO UPDATE SET
        ${fields.map(f => `${f} = excluded.${f}`).join(', ')},
        updated_at = CURRENT_TIMESTAMP`
    ).run(user.clientId, ...fields.map(f => body[f] ?? (f === 'country' ? 'France' : (f === 'prestations_catalog' ? '[]' : ''))));

    await db.prepare(`UPDATE clients SET
        company_address = ?,
        company_postal_code = ?,
        company_city = ?,
        company_country = ?,
        siret = ?,
        vat_number = ?
        WHERE id = ?
    `).run(
        String(body.address || '').trim(),
        String(body.postal_code || '').trim(),
        String(body.city || '').trim(),
        String(body.country || 'France').trim() || 'France',
        String(body.siret || '').trim(),
        String(body.tva || '').trim(),
        user.clientId
    );

    return c.json({ success: true });
});

app.get('/api/employes', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const items = await db.prepare(`
            SELECT e.*, COALESCE(jp.title, st.name) as job_post_title
            FROM employes e
            LEFT JOIN job_posts jp ON jp.client_id = e.client_id AND jp.id = e.position
            LEFT JOIN evenementiel_staff_types st ON st.client_id = e.client_id AND st.id = e.position
            WHERE e.client_id = ?
            ORDER BY e.created_at DESC
        `).all(user.clientId);

        const enriched = await Promise.all(items.map(async (employee: any) => {
            const documents = await db.prepare(`
                SELECT id, display_name, file_name, mime_type, file_size, storage_key, created_at
                FROM employee_documents
                WHERE employee_id = ? AND client_id = ?
                ORDER BY created_at DESC
            `).all(employee.id, user.clientId);
            return { ...employee, documents };
        }));

        return c.json(enriched);
    } catch (e: any) {
        console.error('Error fetching employes:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/api/employes/posts', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const posts = await db.prepare('SELECT * FROM job_posts WHERE client_id = ? ORDER BY title ASC').all(user.clientId);
        return c.json(posts);
    } catch (e: any) {
        console.error('Error fetching job posts:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.post('/api/employes/posts', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const { title } = await c.req.json();

        if (!title || !String(title).trim()) {
            return c.json({ error: 'Le titre du poste est obligatoire' }, 400);
        }

        const id = crypto.randomUUID().substring(0, 8);
        await db.prepare('INSERT INTO job_posts (id, client_id, title) VALUES (?, ?, ?)')
            .run(id, user.clientId, String(title).trim());

        return c.json({ id });
    } catch (e: any) {
        console.error('Error creating job post:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.delete('/api/employes/posts/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const id = c.req.param('id');

        const inUse = await db.prepare('SELECT COUNT(*) as count FROM employes WHERE client_id = ? AND position = ?')
            .get(user.clientId, id) as any;
        if (Number(inUse?.count || 0) > 0) {
            return c.json({ error: 'Impossible de supprimer: ce poste est utilisé par des employés.' }, 400);
        }

        await db.prepare('DELETE FROM job_posts WHERE id = ? AND client_id = ?').run(id, user.clientId);
        return c.json({ success: true });
    } catch (e: any) {
        console.error('Error deleting job post:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.post('/api/employes', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const body = await c.req.json();
        const {
            first_name,
            last_name,
            position,
            email,
            phone,
            address,
            documents
        } = body;

        if (!first_name || !last_name || !position) {
            return c.json({ error: 'Nom, prénom et poste sont obligatoires.' }, 400);
        }

        const jobPost = await db.prepare('SELECT id FROM job_posts WHERE id = ? AND client_id = ?').get(position, user.clientId);
        const authorizedStaffCategory = await db.prepare('SELECT id FROM evenementiel_staff_types WHERE id = ? AND client_id = ?').get(position, user.clientId);
        if (!jobPost && !authorizedStaffCategory) {
            return c.json({ error: 'Le poste sélectionné est invalide.' }, 400);
        }

        const id = crypto.randomUUID().substring(0, 8);
        await db.prepare(`
            INSERT INTO employes (id, client_id, first_name, last_name, email, position, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            user.clientId,
            String(first_name).trim(),
            String(last_name).trim(),
            email ? String(email).trim() : null,
            position,
            JSON.stringify([
                String(position)
            ])
        );

        await db.prepare('UPDATE employes SET phone = ?, address = ? WHERE id = ? AND client_id = ?')
            .run(phone ? String(phone).trim() : null, address ? String(address).trim() : null, id, user.clientId);

        if (Array.isArray(documents)) {
            for (const doc of documents) {
                const displayName = String(doc?.display_name || '').trim();
                const fileName = String(doc?.file_name || doc?.name || '').trim();
                if (!displayName || !fileName) continue;
                await db.prepare(`
                    INSERT INTO employee_documents (id, client_id, employee_id, display_name, file_name, mime_type, file_size, storage_key)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    crypto.randomUUID().substring(0, 8),
                    user.clientId,
                    id,
                    displayName,
                    fileName,
                    doc?.mime_type || doc?.type || null,
                    typeof doc?.file_size === 'number' ? doc.file_size : (typeof doc?.size === 'number' ? doc.size : null),
                    doc?.storage_key || doc?.url || null
                );
            }
        }

        return c.json({ id, success: true });
    } catch (e: any) {
        console.error('Error creating employee:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.put('/api/employes/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const employeeId = c.req.param('id');
        const body = await c.req.json();
        const {
            first_name,
            last_name,
            position,
            email,
            phone,
            address,
            documents
        } = body;

        const existing = await db.prepare('SELECT id FROM employes WHERE id = ? AND client_id = ?').get(employeeId, user.clientId);
        if (!existing) {
            return c.json({ error: 'Employé introuvable.' }, 404);
        }

        if (!first_name || !last_name || !position) {
            return c.json({ error: 'Nom, prénom et poste sont obligatoires.' }, 400);
        }

        const jobPost = await db.prepare('SELECT id FROM job_posts WHERE id = ? AND client_id = ?').get(position, user.clientId);
        const authorizedStaffCategory = await db.prepare('SELECT id FROM evenementiel_staff_types WHERE id = ? AND client_id = ?').get(position, user.clientId);
        if (!jobPost && !authorizedStaffCategory) {
            return c.json({ error: 'Le poste sélectionné est invalide.' }, 400);
        }

        await db.prepare(`
            UPDATE employes
            SET first_name = ?, last_name = ?, email = ?, position = ?, phone = ?, address = ?, tags = ?
            WHERE id = ? AND client_id = ?
        `).run(
            String(first_name).trim(),
            String(last_name).trim(),
            email ? String(email).trim() : null,
            position,
            phone ? String(phone).trim() : null,
            address ? String(address).trim() : null,
            JSON.stringify([String(position)]),
            employeeId,
            user.clientId
        );

        await db.prepare('DELETE FROM employee_documents WHERE employee_id = ? AND client_id = ?').run(employeeId, user.clientId);
        if (Array.isArray(documents)) {
            for (const doc of documents) {
                const displayName = String(doc?.display_name || '').trim();
                const fileName = String(doc?.file_name || doc?.name || '').trim();
                if (!displayName || !fileName) continue;
                await db.prepare(`
                    INSERT INTO employee_documents (id, client_id, employee_id, display_name, file_name, mime_type, file_size, storage_key)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    crypto.randomUUID().substring(0, 8),
                    user.clientId,
                    employeeId,
                    displayName,
                    fileName,
                    doc?.mime_type || doc?.type || null,
                    typeof doc?.file_size === 'number' ? doc.file_size : (typeof doc?.size === 'number' ? doc.size : null),
                    doc?.storage_key || doc?.url || null
                );
            }
        }

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Error updating employee:', e);
        return c.json({ error: e.message }, 400);
    }
});

app.delete('/api/employes/:id', authMiddleware, moduleAccessMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c);
        const employeeId = c.req.param('id');
        await db.prepare('DELETE FROM employes WHERE id = ? AND client_id = ?').run(employeeId, user.clientId);
        return c.json({ success: true });
    } catch (e: any) {
        console.error('Error deleting employee:', e);
        return c.json({ error: e.message }, 400);
    }
});


// --- Envoi de facture par email et enregistrement de l'envoi ---
app.post('/api/factures/:id/send', authMiddleware, async (c) => {
    const db = getDb(c);
    await ensureFactureColumns(db);
    const user = c.get('user');
    const factureId = c.req.param('id');
    const { email } = await c.req.json(); // email d'envoi (obligatoire)
    if (!email || !String(email).includes('@')) {
        return c.json({ error: 'Adresse email invalide.' }, 400);
    }
    // Récupérer la facture
    const facture = await db.prepare('SELECT * FROM facture WHERE id = ?').get(factureId);
    if (!facture) {
        console.error('[API] Facture non trouvée pour envoi email', { factureId });
        return c.json({ error: 'Facture introuvable.' }, 404);
    }
    // Vérifier que l'utilisateur a le droit d'envoyer cette facture
    if (user.type !== 'admin' && user.type !== 'client' && user.type !== 'collaborator') {
        return c.json({ error: 'Accès refusé.' }, 403);
    }
    // Générer le lien PDF (supposé stocké dans facture.pdf_url ou à générer)
    const pdfUrl = facture.pdf_url || (facture.payload_json && JSON.parse(facture.payload_json).pdf_url);
    if (!pdfUrl) {
        return c.json({ error: 'PDF non disponible pour cette facture.' }, 400);
    }
    // Envoi email via Resend
    const resendKey = c.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (!resendKey) {
        return c.json({ error: 'Service email non configuré.' }, 500);
    }
    const resend = new Resend(resendKey);
    try {
        await resend.emails.send({
            from: "L'IAmani <notification@l-iamani.com>",
            to: email,
            subject: `Votre facture L'IAmani n°${facture.invoice_number}`,
            html: `
                <div style=\"font-family: sans-serif; padding: 20px; color: #333;\">
                    <h2 style=\"color: #000;\">Votre facture</h2>
                    <p>Bonjour,</p>
                    <p>Veuillez trouver votre facture n°${facture.invoice_number} en pièce jointe ou via le lien ci-dessous :</p>
                    <p><a href=\"${pdfUrl}\" target=\"_blank\">Télécharger la facture (PDF)</a></p>
                    <p>Cordialement,<br>L'équipe L'IAmani</p>
                </div>
            `
        });
        // Mettre à jour l'historique d'envoi
        await db.prepare('UPDATE facture SET last_sent_email = ?, last_sent_at = CURRENT_TIMESTAMP WHERE id = ?').run(email, factureId);
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: "Erreur lors de l'envoi de l'email." });
    }
});



// Compatible ES module/tsx/Windows : démarrage du serveur si exécuté directement
if (
    (typeof process !== 'undefined' && process.argv &&
        (process.argv[1]?.endsWith('app.ts') || process.argv[1]?.endsWith('app.js')))
) {
    import('@hono/node-server').then(({ serve }) => {
        serve({ fetch: app.fetch, port: 3000 });
        console.log('Hono server listening on http://localhost:3000');
    });
}

export default app;
