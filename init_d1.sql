-- Script d'initialisation pour Cloudflare D1
-- Projet : IAmani SaaS

-- 1. Tables de base
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    password TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    password TEXT,
    is_temporary_password INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    company_name TEXT,
    logo_url TEXT,
    default_tva_rate TEXT DEFAULT '20',
    default_tva_custom_rate TEXT,
    tva_rates TEXT DEFAULT '[]',
    enable_cover_count INTEGER DEFAULT 0,
    account_manager_first_name TEXT,
    account_manager_last_name TEXT,
    account_manager_phone TEXT,
    account_manager_email TEXT,
    legal_form TEXT,
    siret TEXT,
    vat_number TEXT,
    company_address TEXT,
    company_postal_code TEXT,
    company_city TEXT,
    company_country TEXT DEFAULT 'France',
    company_employee_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS collaborators (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    email TEXT,
    username TEXT,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'staff',
    status TEXT DEFAULT 'active',
    modules_access TEXT DEFAULT '[]',
    is_temporary_password INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 2. Modules Business
CREATE TABLE IF NOT EXISTS facture (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    customer_name TEXT,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_ht REAL DEFAULT 0,
    total_tva REAL DEFAULT 0,
    total_ttc REAL DEFAULT 0,
    already_paid REAL DEFAULT 0,
    remaining_due REAL DEFAULT 0,
    crm_contact_id TEXT,
    last_sent_email TEXT,
    last_sent_at DATETIME,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS facture_history (
    id TEXT PRIMARY KEY,
    facture_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facture_id) REFERENCES facture(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crm_contacts (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    type TEXT DEFAULT 'CLIENT',
    first_name TEXT,
    last_name TEXT,
    company_name TEXT,
    organizer_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    postal_code TEXT,
    city TEXT,
    country TEXT DEFAULT 'France',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evenementiel (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    calendar_id TEXT,
    type TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    start_time DATETIME,
    end_time DATETIME,
    num_people INTEGER DEFAULT 0,
    documents TEXT DEFAULT '[]',
    first_name TEXT,
    last_name TEXT,
    company_name TEXT,
    organizer_name TEXT,
    taken_by_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evenementiel_calendars (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    month INTEGER,
    year INTEGER,
    status TEXT DEFAULT 'OPEN',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employes (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    position TEXT,
    salary REAL,
    hire_date DATETIME,
    tags TEXT DEFAULT '[]',
    phone TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 3. Configuration & Paramètres
CREATE TABLE IF NOT EXISTS client_modules (
    client_id TEXT NOT NULL,
    module_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    PRIMARY KEY (client_id, module_name),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS billing_settings (
    client_id TEXT PRIMARY KEY,
    company_name TEXT,
    address TEXT,
    postal_code TEXT,
    city TEXT,
    country TEXT,
    siret TEXT,
    tva TEXT,
    phone TEXT,
    capital TEXT,
    ape TEXT,
    siege_social TEXT,
    rcs_ville TEXT,
    rcs_numero TEXT,
    prestations_catalog TEXT DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crm_settings (
    client_id TEXT PRIMARY KEY,
    custom_fields TEXT DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evenementiel_config (
    client_id TEXT PRIMARY KEY,
    track_taken_by INTEGER DEFAULT 0,
    allowed_taker_employee_ids TEXT DEFAULT '[]',
    notify_recipient_employee_ids TEXT DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 4. Relations Événementiel
CREATE TABLE IF NOT EXISTS evenementiel_spaces (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evenementiel_event_spaces (
    event_id TEXT NOT NULL,
    space_id TEXT NOT NULL,
    PRIMARY KEY (event_id, space_id),
    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,
    FOREIGN KEY (space_id) REFERENCES evenementiel_spaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evenementiel_staff_types (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evenementiel_event_staff (
    event_id TEXT NOT NULL,
    staff_type_id TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (event_id, staff_type_id),
    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_type_id) REFERENCES evenementiel_staff_types(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evenementiel_event_assignments (
    event_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    staff_type_id TEXT NOT NULL,
    PRIMARY KEY (event_id, employee_id, staff_type_id),
    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employes(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_type_id) REFERENCES evenementiel_staff_types(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_notes (
    id TEXT PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    note_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE
);

-- 5. Support & Logs
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    created_by_user_id TEXT,
    created_by_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    sender_user_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    message TEXT,
    file_url TEXT,
    file_name TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_email_unique ON admins(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username_unique ON admins(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_unique ON clients(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_username_unique ON clients(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collaborators_client ON collaborators(client_id);
CREATE INDEX IF NOT EXISTS idx_facture_client ON facture(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_client ON crm_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_evenementiel_client ON evenementiel(client_id);
CREATE INDEX IF NOT EXISTS idx_employes_client ON employes(client_id);

-- 7. SEEDING (Super Admin par défaut)
-- Mot de passe : Amani2024!
INSERT OR IGNORE INTO admins (id, email, username, password, name) 
VALUES ('superadmin', 'gev-emeni@outlook.fr', 'gev-emeni', '$2b$10$hxlrBOWtqO0zQqGMIVIyCO459zL9wajVBBfLiz9.q3NT07Yb37s9i', 'Super Admin');
