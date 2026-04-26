PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE client_documents (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    storage_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, is_temporary_password INTEGER DEFAULT 0);
CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    company_name TEXT,
    logo_url TEXT,
    account_manager_first_name TEXT DEFAULT '',
    account_manager_last_name TEXT DEFAULT '',
    account_manager_phone TEXT DEFAULT '',
    account_manager_email TEXT DEFAULT '',
    legal_form TEXT DEFAULT '',
    siret TEXT DEFAULT '',
    vat_number TEXT DEFAULT '',
    company_address TEXT DEFAULT '',
    company_postal_code TEXT DEFAULT '',
    company_city TEXT DEFAULT '',
    company_country TEXT DEFAULT 'France',
    company_employee_count INTEGER DEFAULT 0,
    default_tva_rate TEXT DEFAULT '20',
    default_tva_custom_rate REAL,
    tva_rates TEXT DEFAULT '[]',
    enable_cover_count INTEGER DEFAULT 0,
    password TEXT NOT NULL,
    is_temporary_password INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    last_login DATETIME,
    reset_token TEXT,
    reset_token_expires DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE collaborators (
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
);
CREATE TABLE client_modules (
    client_id TEXT NOT NULL,
    module_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    PRIMARY KEY (client_id, module_name),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE collaborator_permissions (
    collaborator_id TEXT NOT NULL,
    module_name TEXT NOT NULL,
    can_access INTEGER DEFAULT 0,
    PRIMARY KEY (collaborator_id, module_name),
    FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE
);
CREATE TABLE password_resets (
    email TEXT NOT NULL,
    token TEXT PRIMARY KEY,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE support_tickets (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
    created_by_user_id TEXT,
    created_by_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE support_messages (
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
CREATE TABLE planning (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE evenementiel_calendars (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'ARCHIVED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE(client_id, month, year)
);
CREATE TABLE evenementiel_spaces (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL, -- Hex color
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE evenementiel_staff_types (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE evenementiel (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    calendar_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('PRIVÉ', 'PROFESSIONNEL')),
    -- Champs communs
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    num_people INTEGER,
    documents TEXT, -- JSON string
    -- Champs PRIVÉ
    first_name TEXT,
    last_name TEXT,
    -- Champs PROFESSIONNEL
    company_name TEXT,
    organizer_name TEXT,
    taken_by_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (calendar_id) REFERENCES evenementiel_calendars(id) ON DELETE CASCADE,
    FOREIGN KEY (taken_by_id) REFERENCES employes(id) ON DELETE SET NULL
);
CREATE TABLE evenementiel_config (
    client_id TEXT PRIMARY KEY,
    track_taken_by INTEGER DEFAULT 0,
    allowed_taker_employee_ids TEXT DEFAULT '[]',
    notify_recipient_employee_ids TEXT DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE evenementiel_event_spaces (
    event_id TEXT NOT NULL,
    space_id TEXT NOT NULL,
    PRIMARY KEY (event_id, space_id),
    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,
    FOREIGN KEY (space_id) REFERENCES evenementiel_spaces(id) ON DELETE CASCADE
);
CREATE TABLE evenementiel_event_staff (
    event_id TEXT NOT NULL,
    staff_type_id TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (event_id, staff_type_id),
    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_type_id) REFERENCES evenementiel_staff_types(id) ON DELETE CASCADE
);
CREATE TABLE facture (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    due_date DATETIME,
    payload_json TEXT DEFAULT '{}',
    billing_snapshot TEXT DEFAULT '{}',
    total_ht REAL DEFAULT 0,
    total_tva REAL DEFAULT 0,
    total_ttc REAL DEFAULT 0,
    already_paid REAL DEFAULT 0,
    remaining_due REAL DEFAULT 0,
    crm_contact_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (crm_contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL
);
CREATE TABLE employes (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    position TEXT,
    salary REAL,
    hire_date DATE,
    tags TEXT, -- JSON array of tags/skills
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE crm_contacts (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('PRIVÉ', 'PROFESSIONNEL')),
    first_name TEXT,
    last_name TEXT,
    company_name TEXT,
    organizer_name TEXT,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT,
    postal_code TEXT,
    city TEXT,
    country TEXT DEFAULT 'France',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE(client_id, phone)
);
CREATE TABLE evenementiel_event_assignments (
    event_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    staff_type_id TEXT NOT NULL,
    PRIMARY KEY (event_id, employee_id),
    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employes(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_type_id) REFERENCES evenementiel_staff_types(id) ON DELETE CASCADE
);
CREATE TABLE event_documents (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    storage_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE event_notes (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    note_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE(event_id)
);
CREATE TABLE staff_category_mapping (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    staff_category_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_category_id) REFERENCES evenementiel_staff_types(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employes(id) ON DELETE CASCADE,
    UNIQUE(client_id, staff_category_id, employee_id)
);
CREATE TABLE job_posts (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE(client_id, title)
);
CREATE TABLE employee_documents (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    storage_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employes(id) ON DELETE CASCADE
);
CREATE TABLE billing_settings (
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
);
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_collaborators_client_id ON collaborators(client_id);
CREATE INDEX idx_client_modules_client_id ON client_modules(client_id);
CREATE INDEX idx_planning_client_id ON planning(client_id);
CREATE INDEX idx_evenementiel_client_id ON evenementiel(client_id);
CREATE INDEX idx_facture_client_id ON facture(client_id);
CREATE INDEX idx_employes_client_id ON employes(client_id);
CREATE INDEX idx_crm_contacts_client_id ON crm_contacts(client_id);
CREATE INDEX idx_evenementiel_calendar_id ON evenementiel(calendar_id);
CREATE INDEX idx_event_documents_client_id ON event_documents(client_id);
CREATE INDEX idx_event_documents_event_id ON event_documents(event_id);
CREATE INDEX idx_event_notes_client_id ON event_notes(client_id);
CREATE INDEX idx_event_notes_event_id ON event_notes(event_id);
CREATE INDEX idx_staff_mapping_client_id ON staff_category_mapping(client_id);
CREATE INDEX idx_staff_mapping_category_id ON staff_category_mapping(staff_category_id);
CREATE INDEX idx_staff_mapping_employee_id ON staff_category_mapping(employee_id);
CREATE INDEX idx_job_posts_client_id ON job_posts(client_id);
CREATE INDEX idx_billing_settings_client_id ON billing_settings(client_id);
CREATE INDEX idx_employee_documents_client_id ON employee_documents(client_id);
CREATE INDEX idx_employee_documents_employee_id ON employee_documents(employee_id);
CREATE UNIQUE INDEX idx_admins_username_unique ON admins(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX idx_clients_username_unique ON clients(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX idx_collaborators_username_unique ON collaborators(username) WHERE username IS NOT NULL;
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_target_user ON audit_logs(target_user_id);
CREATE INDEX idx_support_tickets_client_status ON support_tickets(client_id, status);
CREATE INDEX idx_support_messages_ticket_created ON support_messages(ticket_id, created_at);
CREATE INDEX idx_support_messages_unread ON support_messages(is_read, sender_type);
