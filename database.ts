import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Interface pour supporter D1 en production et better-sqlite3 en dev
export interface DatabaseInstance {
    prepare(sql: string): {
        get(...params: any[]): any;
        all(...params: any[]): any[];
        run(...params: any[]): { lastInsertRowid: number | bigint; changes: number };
    };
    exec(sql: string): void;
}

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Migrations for existing tables (run before schema to ensure columns exist for indexes)
try {
    db.prepare('ALTER TABLE evenementiel ADD COLUMN calendar_id TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE employes ADD COLUMN tags TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE employes ADD COLUMN phone TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE employes ADD COLUMN address TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE evenementiel ADD COLUMN taken_by_id TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE evenementiel_config ADD COLUMN notify_recipient_employee_ids TEXT DEFAULT "[]"').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE admins ADD COLUMN username TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE clients ADD COLUMN username TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE clients ADD COLUMN company_name TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE clients ADD COLUMN logo_url TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE collaborators ADD COLUMN modules_access TEXT DEFAULT "[]"').run();
} catch (e) {}

// Migration : documents propres au client (hors privatisation)
try {
    db.exec(`CREATE TABLE IF NOT EXISTS client_documents (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        storage_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )`);
} catch (e) {}

try {
    db.exec('CREATE TABLE IF NOT EXISTS support_tickets (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, status TEXT DEFAULT "OPEN", created_by_user_id TEXT, created_by_type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE)');
} catch (e) {}

try {
    db.exec('CREATE TABLE IF NOT EXISTS support_messages (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, sender_user_id TEXT NOT NULL, sender_type TEXT NOT NULL, message TEXT, file_url TEXT, file_name TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE)');
} catch (e) {}

try {
    db.prepare('ALTER TABLE support_tickets ADD COLUMN status TEXT DEFAULT "OPEN"').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE support_messages ADD COLUMN file_url TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE support_messages ADD COLUMN file_name TEXT').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE support_messages ADD COLUMN is_read INTEGER DEFAULT 0').run();
} catch (e) {}

try {
    db.exec('CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, target_user_id TEXT NOT NULL, action TEXT NOT NULL, old_value TEXT, new_value TEXT, ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
} catch (e) {}

// Migration: align audit_logs with the new schema if old columns are still present
try {
    const auditCols = (db.prepare('PRAGMA table_info(audit_logs)').all() as any[]).map((c: any) => c.name);
    const needsAuditMigration = !auditCols.includes('target_user_id') || !auditCols.includes('old_value') || !auditCols.includes('new_value') || !auditCols.includes('ip_address');
    if (needsAuditMigration) {
        db.exec(`CREATE TABLE IF NOT EXISTS audit_logs_new (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            target_user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Best-effort migration from legacy audit_logs structure
        if (auditCols.includes('details')) {
            db.exec(`
                INSERT INTO audit_logs_new (id, user_id, target_user_id, action, old_value, new_value, ip_address, created_at)
                SELECT
                    id,
                    user_id,
                    COALESCE(user_id, 'unknown'),
                    UPPER(COALESCE(action, 'UPDATE_PROFILE')),
                    NULL,
                    details,
                    NULL,
                    COALESCE(created_at, CURRENT_TIMESTAMP)
                FROM audit_logs
            `);
        }

        db.exec('DROP TABLE audit_logs');
        db.exec('ALTER TABLE audit_logs_new RENAME TO audit_logs');
        console.log('Migration: audit_logs updated to new schema');
    }
} catch (e: any) {
    console.error('Migration error (audit_logs):', e);
}

try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username_unique ON admins(username) WHERE username IS NOT NULL');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_username_unique ON clients(username) WHERE username IS NOT NULL');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_collaborators_username_unique ON collaborators(username) WHERE username IS NOT NULL');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user ON audit_logs(target_user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_support_tickets_client_status ON support_tickets(client_id, status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created ON support_messages(ticket_id, created_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON support_messages(is_read, sender_type)');
} catch (e) {}

try {
    db.prepare('UPDATE clients SET company_name = name WHERE company_name IS NULL OR TRIM(company_name) = ""').run();
} catch (e) {}

// Migration: recreate collaborators table with nullable email + username column
try {
    const existingCols = (db.prepare('PRAGMA table_info(collaborators)').all() as any[]).map((c: any) => c.name);
    if (!existingCols.includes('username')) {
        db.exec(`CREATE TABLE IF NOT EXISTS collaborators_new (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            email TEXT UNIQUE,
            username TEXT UNIQUE,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT,
            modules_access TEXT DEFAULT '[]',
            is_temporary_password INTEGER DEFAULT 1,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        )`);
        db.exec(`INSERT INTO collaborators_new (id, client_id, email, username, password, name, role, modules_access, is_temporary_password, status, created_at)
            SELECT id, client_id, email, username, password, name, role, COALESCE(modules_access, '[]'), is_temporary_password, status, created_at FROM collaborators`);
        db.exec(`DROP TABLE collaborators`);
        db.exec(`ALTER TABLE collaborators_new RENAME TO collaborators`);
        console.log('Migration: collaborators updated (nullable email + username)');
    }
} catch (e: any) {
    console.error('Migration error (collaborators):', e);
}

try {
    db.prepare('UPDATE collaborators SET modules_access = "[]" WHERE modules_access IS NULL OR TRIM(modules_access) = ""').run();
} catch (e) {}

//
// Initialize database with schema
const schema = fs.readFileSync(path.join(process.cwd(), 'schema.sql'), 'utf8');
db.exec(schema);

// Seed Super Admin if not exists
const superAdminEmail = 'gev-emeni@outlook.fr';
const existingAdmin = db.prepare('SELECT * FROM admins WHERE email = ?').get(superAdminEmail);

if (!existingAdmin) {
    const id = crypto.randomUUID().substring(0, 8);
    // Mot de passe par défaut: Amani2024! (À changer immédiatement)
    const hashedPassword = bcrypt.hashSync('Amani2024!', 10);
        db.prepare('INSERT INTO admins (id, email, username, password, name) VALUES (?, ?, ?, ?, ?)')
            .run(id, superAdminEmail, 'gev-emeni', hashedPassword, 'Super Admin');
    console.log('Super Admin seeded with default password: Amani2024!');
}

try {
    db.prepare('UPDATE admins SET username = ? WHERE email = ? AND (username IS NULL OR TRIM(username) = "")').run('gev-emeni', superAdminEmail);
} catch (e) {}
export default db as unknown as DatabaseInstance;
