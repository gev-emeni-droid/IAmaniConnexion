-- Script de migration pour IAmani - CRM Contacts
-- Objectif : Supprimer la contrainte UNIQUE(client_id, phone) et rendre 'phone' nullable

-- 1. Désactiver temporairement les contraintes de clés étrangères (si possible)
PRAGMA foreign_keys = OFF;

-- 2. Renommer la table actuelle
ALTER TABLE crm_contacts RENAME TO crm_contacts_old;

-- 3. Créer la nouvelle table avec le schéma assoupli
CREATE TABLE crm_contacts (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('PRIVÉ', 'PROFESSIONNEL')),
    first_name TEXT,
    last_name TEXT,
    company_name TEXT,
    organizer_name TEXT,
    email TEXT,
    phone TEXT, -- Maintenant nullable
    address TEXT,
    postal_code TEXT,
    city TEXT,
    country TEXT DEFAULT 'France',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 4. Transférer les données
INSERT INTO crm_contacts (
    id, client_id, type, first_name, last_name, company_name, organizer_name, 
    email, phone, address, postal_code, city, country, created_at, updated_at
)
SELECT 
    id, client_id, type, first_name, last_name, company_name, organizer_name, 
    email, phone, address, postal_code, city, country, created_at, updated_at
FROM crm_contacts_old;

-- 5. Créer l'index de performance
CREATE INDEX IF NOT EXISTS idx_crm_contacts_client_phone ON crm_contacts(client_id, phone);

-- 6. Supprimer l'ancienne table
DROP TABLE crm_contacts_old;

-- 7. Réactiver les clés étrangères
PRAGMA foreign_keys = ON;

-- Validation
SELECT COUNT(*) as nb_contacts FROM crm_contacts;
