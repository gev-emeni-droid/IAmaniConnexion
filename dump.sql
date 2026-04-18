
PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

CREATE TABLE admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT
);
INSERT INTO admins VALUES('c58f0ec9','gev-emeni@outlook.fr','$2b$10$vJOPYRl5DcyrF/G4Ph9SGeEZ54YSKo0V/sOCcTpV0Rw.1eZ.q9gHi','Super Admin','2026-04-14 07:42:08',NULL);

CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_temporary_password INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    last_login DATETIME,
    reset_token TEXT,
    reset_token_expires DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT, company_name TEXT, logo_url TEXT, default_tva_rate TEXT DEFAULT '20', default_tva_custom_rate REAL, tva_rates TEXT DEFAULT '[]', enable_cover_count INTEGER DEFAULT 0, account_manager_first_name TEXT DEFAULT '', account_manager_last_name TEXT DEFAULT '', account_manager_phone TEXT DEFAULT '', account_manager_email TEXT DEFAULT '', legal_form TEXT DEFAULT '', siret TEXT DEFAULT '', vat_number TEXT DEFAULT '', company_address TEXT DEFAULT '', company_postal_code TEXT DEFAULT '', company_city TEXT DEFAULT '', company_country TEXT DEFAULT 'France', company_employee_count INTEGER DEFAULT 0
);
INSERT INTO clients VALUES('c7317f37','Brasserie Polpo','heslotemeni@outlook.com','$2b$10$7Eyq2UOlenRQHbhqo70C2.n5JFW0Nbs4fXYqSB0S/CkIyd9sgeMk2',0,'active','2026-04-18 08:39:19','85d40878-d511-436d-9db7-72a383795c2d','2026-04-15T13:27:46.480Z','2026-04-14 08:31:09','polpo.direction','Brasserie Polpo','/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png','20',NULL,'[10,20]',1,'François','Louiset','','','','449 331 164 00037','FR24 449331164','47 Quai Charles Pasqua','92300','Levallois-Perret','France',0);
INSERT INTO clients VALUES('32b862fe','L''IAmani','arsheslot@gmail.Com','$2b$10$SipMZAeO2Jsv0wLqp3rvF.PxbLnuTCVzBkhKoZZO0itFhRrxgzlDe',0,'active','2026-04-16 07:42:11','427558e7-0bfd-4d62-9b76-7dbc24f7399d','2026-04-15T13:21:04.848Z','2026-04-14 11:44:45','iamani','L''IAmani','/uploads/logos/logo-32b862fe-1776253636328-3e03b3a1.png','20',NULL,'[20]',0,'','','','','','','','','','','France',0);

-- DÉPLACEMENT : Création de la table collaborators AVANT toute référence
CREATE TABLE IF NOT EXISTS "collaborators" (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    is_temporary_password INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    modules_access TEXT DEFAULT "[]",
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
INSERT INTO collaborators VALUES('53a10142','c7317f37','soniadouadi@outlook.fr','polpo.hotesse','$2b$10$k0qoMLvYXVI5DuMPkAQKbeZf.5fKEMBltGntyUVXBnf5pKO03Vvl6','Commercial & Hôtessse',NULL,0,'active','2026-04-14 11:32:46','["evenementiel","crm","facture"]');
INSERT INTO collaborators VALUES('5720b0a0','c7317f37',NULL,'polpo.rh','$2b$10$j3vHodU94lrPY63RwjIc2.n.hccD9anuD8kkD0TuTd3HCLnc8eNMy','Ressources Humaines','RH',0,'active','2026-04-15 13:29:50','["planning","employes"]');

CREATE TABLE client_modules (

    client_id TEXT NOT NULL,

    module_name TEXT NOT NULL,

    is_active INTEGER DEFAULT 0,

    PRIMARY KEY (client_id, module_name),

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE

);

INSERT INTO client_modules VALUES('c7317f37','planning',1);

INSERT INTO client_modules VALUES('c7317f37','evenementiel',1);

INSERT INTO client_modules VALUES('c7317f37','facture',1);

INSERT INTO client_modules VALUES('c7317f37','employes',1);

INSERT INTO client_modules VALUES('c7317f37','crm',1);

INSERT INTO client_modules VALUES('32b862fe','planning',1);

INSERT INTO client_modules VALUES('32b862fe','evenementiel',1);

INSERT INTO client_modules VALUES('32b862fe','facture',1);

INSERT INTO client_modules VALUES('32b862fe','employes',1);

INSERT INTO client_modules VALUES('32b862fe','crm',1);

CREATE TABLE collaborator_permissions (

    collaborator_id TEXT NOT NULL,

    module_name TEXT NOT NULL,

    can_access INTEGER DEFAULT 0,

    PRIMARY KEY (collaborator_id, module_name),

    FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE

);

INSERT INTO collaborator_permissions VALUES('53a10142','planning',0);

INSERT INTO collaborator_permissions VALUES('53a10142','evenementiel',1);

INSERT INTO collaborator_permissions VALUES('53a10142','facture',1);

INSERT INTO collaborator_permissions VALUES('53a10142','employes',0);

INSERT INTO collaborator_permissions VALUES('53a10142','crm',1);

INSERT INTO collaborator_permissions VALUES('5720b0a0','planning',1);

INSERT INTO collaborator_permissions VALUES('5720b0a0','evenementiel',0);

INSERT INTO collaborator_permissions VALUES('5720b0a0','facture',0);

INSERT INTO collaborator_permissions VALUES('5720b0a0','employes',1);

INSERT INTO collaborator_permissions VALUES('5720b0a0','crm',0);

CREATE TABLE password_resets (

    email TEXT NOT NULL,

    token TEXT PRIMARY KEY,

    expires_at DATETIME NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

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

INSERT INTO evenementiel_calendars VALUES('4f2c527e','c7317f37',4,2026,'OPEN','2026-04-14 08:32:29');

INSERT INTO evenementiel_calendars VALUES('4eb93569','c7317f37',2,2026,'ARCHIVED','2026-04-14 11:49:35');

INSERT INTO evenementiel_calendars VALUES('51b6d207','c7317f37',5,2026,'OPEN','2026-04-14 19:57:40');

INSERT INTO evenementiel_calendars VALUES('b6eaefa4','32b862fe',4,2026,'OPEN','2026-04-14 20:52:58');

CREATE TABLE evenementiel_spaces (

    id TEXT PRIMARY KEY,

    client_id TEXT NOT NULL,

    name TEXT NOT NULL,

    color TEXT NOT NULL, -- Hex color

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE

);

INSERT INTO evenementiel_spaces VALUES('9cff54f3','c7317f37','POLPO NORD','#a020f0','2026-04-14 11:42:19');

INSERT INTO evenementiel_spaces VALUES('da46ed59','c7317f37','Restaurant','#1f26ef','2026-04-14 13:59:19');

CREATE TABLE evenementiel_staff_types (

    id TEXT PRIMARY KEY,

    client_id TEXT NOT NULL,

    name TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE

);

INSERT INTO evenementiel_staff_types VALUES('500de5af','c7317f37','H├┤tesses','2026-04-14 09:20:07');

CREATE TABLE evenementiel (

    id TEXT PRIMARY KEY,

    client_id TEXT NOT NULL,

    calendar_id TEXT NOT NULL,

    type TEXT NOT NULL CHECK(type IN ('PRIV├뿯½', 'PROFESSIONNEL')),

    -- Champs communs

    phone TEXT NOT NULL,

    email TEXT,

    address TEXT,

    start_time DATETIME NOT NULL,

    end_time DATETIME NOT NULL,

    num_people INTEGER,

    documents TEXT, -- JSON string

    -- Champs PRIV├뿯½

    first_name TEXT,

    last_name TEXT,

    -- Champs PROFESSIONNEL

    company_name TEXT,

    organizer_name TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, taken_by_id TEXT,

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,

    FOREIGN KEY (calendar_id) REFERENCES evenementiel_calendars(id) ON DELETE CASCADE

);

INSERT INTO evenementiel VALUES('2e07b20e','c7317f37','4f2c527e','PROFESSIONNEL','','',NULL,'2026-04-09T19:00:00','2026-04-10T02:00:00',180,'[]','','','AG2R LA MONDIAL','','2026-04-14 15:44:15','b13aad76');

INSERT INTO evenementiel VALUES('8cc62467','c7317f37','4f2c527e','PROFESSIONNEL','','',NULL,'2026-04-14T09:00:00','2026-04-14T17:00:00',150,'[]','','','ERES GROUP','','2026-04-14 16:58:01','5b07ba0e');

INSERT INTO evenementiel VALUES('38ae920d','c7317f37','4f2c527e','PROFESSIONNEL','','',NULL,'2026-04-14T17:00:00','2026-04-15T02:00:00',150,'[]','','','ERES GROUP','','2026-04-14 17:00:43','5b07ba0e');

INSERT INTO evenementiel VALUES('f6cf1fd2','c7317f37','4f2c527e','PROFESSIONNEL','','',NULL,'2026-04-16T19:00:00','2026-04-17T02:00:00',130,'[]','','','ESPACE TEMPS','','2026-04-14 17:02:34','5b07ba0e');

INSERT INTO evenementiel VALUES('abaea39e','c7317f37','4f2c527e','PRIV├뿯½','','',NULL,'2026-04-18T11:30:00','2026-04-18T16:30:00',140,'[]','Madame','ACHACH','','','2026-04-14 17:13:38','b13aad76');

INSERT INTO evenementiel VALUES('eb60de42','c7317f37','4f2c527e','PRIV├뿯½','','',NULL,'2026-04-18T19:00:00','2026-04-19T04:00:00',120,'[]','MADAME','TEULIERES','','','2026-04-14 19:11:30','b13aad76');

INSERT INTO evenementiel VALUES('c5b1dc69','c7317f37','51b6d207','PRIV├뿯½','','',NULL,'2026-05-07T19:00:00','2026-05-08T02:00:00',140,'[]','MADAME','TRAN','','','2026-04-15 13:47:36','b13aad76');

INSERT INTO evenementiel VALUES('56f2e2cf','c7317f37','51b6d207','PROFESSIONNEL','','',NULL,'2026-05-08T19:00:00','2026-05-09T02:00:00',400,'[]','','','THEA PHARMA','','2026-04-15 13:49:24','b13aad76');

INSERT INTO evenementiel VALUES('979b3e07','c7317f37','51b6d207','PROFESSIONNEL','','',NULL,'2026-05-21T12:00:00','2026-05-21T16:00:00',300,'[]','','','BANG BANG EVENT','','2026-04-15 13:52:14','b13aad76');

CREATE TABLE evenementiel_event_spaces (

    event_id TEXT NOT NULL,

    space_id TEXT NOT NULL,

    PRIMARY KEY (event_id, space_id),

    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,

    FOREIGN KEY (space_id) REFERENCES evenementiel_spaces(id) ON DELETE CASCADE

);

INSERT INTO evenementiel_event_spaces VALUES('8cc62467','da46ed59');

INSERT INTO evenementiel_event_spaces VALUES('38ae920d','da46ed59');

INSERT INTO evenementiel_event_spaces VALUES('abaea39e','da46ed59');

INSERT INTO evenementiel_event_spaces VALUES('eb60de42','da46ed59');

INSERT INTO evenementiel_event_spaces VALUES('f6cf1fd2','da46ed59');

INSERT INTO evenementiel_event_spaces VALUES('c5b1dc69','da46ed59');

INSERT INTO evenementiel_event_spaces VALUES('56f2e2cf','da46ed59');

INSERT INTO evenementiel_event_spaces VALUES('979b3e07','da46ed59');

INSERT INTO evenementiel_event_spaces VALUES('2e07b20e','da46ed59');

CREATE TABLE evenementiel_event_staff (

    event_id TEXT NOT NULL,

    staff_type_id TEXT NOT NULL,

    count INTEGER NOT NULL,

    PRIMARY KEY (event_id, staff_type_id),

    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,

    FOREIGN KEY (staff_type_id) REFERENCES evenementiel_staff_types(id) ON DELETE CASCADE

);

INSERT INTO evenementiel_event_staff VALUES('8cc62467','500de5af',2);

INSERT INTO evenementiel_event_staff VALUES('38ae920d','500de5af',2);

INSERT INTO evenementiel_event_staff VALUES('abaea39e','500de5af',1);

INSERT INTO evenementiel_event_staff VALUES('eb60de42','500de5af',1);

INSERT INTO evenementiel_event_staff VALUES('56f2e2cf','500de5af',4);

INSERT INTO evenementiel_event_staff VALUES('979b3e07','500de5af',4);

INSERT INTO evenementiel_event_staff VALUES('2e07b20e','500de5af',2);

CREATE TABLE facture (

    id TEXT PRIMARY KEY,

    client_id TEXT NOT NULL,

    invoice_number TEXT NOT NULL,

    customer_name TEXT NOT NULL,

    amount REAL NOT NULL,

    status TEXT DEFAULT 'pending',

    due_date DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, payload_json TEXT DEFAULT '{}', billing_snapshot TEXT DEFAULT '{}', total_ht REAL DEFAULT 0, total_tva REAL DEFAULT 0, total_ttc REAL DEFAULT 0, already_paid REAL DEFAULT 0, remaining_due REAL DEFAULT 0, crm_contact_id TEXT, last_sent_email TEXT, last_sent_at DATETIME,

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE

);

INSERT INTO facture VALUES('1fb1981e-7bb1-434f-9fc2-669e2513b05a','c7317f37','BRAS-F37-202604-0001','Rekaia Emeni JELASSI',0.0,'paid','2026-04-17','2026-04-17 12:31:09','{"id":"1fb1981e-7bb1-434f-9fc2-669e2513b05a","invoiceNumber":"BRAS-F37-202604-0001","invoiceDate":"2026-04-17","clientName":"Rekaia Emeni JELASSI","clientAddress":"13 All├뿯½e de l''ile Marante\n302","clientCity":"Colombes","clientPostalCode":"92700","clientCountry":"France","crmContactId":null,"recipientEmail":"soniadaouadi@outlook.fr","coverCount":"","amountAlreadyPaid":0,"amountMode":"ttc","lines":[{"id":"1776429062081-edvlsu","label":"Prestation de restauration","quantity":1,"ttcByRate":{"10":0,"20":0}}],"totalHt":0,"totalTva":0,"totalTtcBrut":0,"netToPay":0,"status":"pending","billing_snapshot":{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}}','{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}',0.0,0.0,0.0,0.0,0.0,NULL,NULL,NULL);

INSERT INTO facture VALUES('1bd449d4-2d45-4625-afaf-e180e8ee012f','c7317f37','BRAS-F37-202604-0002','Brasserie Polpo',0.0,'paid','2026-03-31','2026-04-17 13:12:26','{"id":"1bd449d4-2d45-4625-afaf-e180e8ee012f","invoiceNumber":"BRAS-F37-202604-0002","invoiceDate":"2026-03-31","clientName":"Brasserie Polpo","clientAddress":"47 Quai Charles Pasqua","clientCity":"Levallois-Perret","clientPostalCode":"92300","clientCountry":"France","crmContactId":null,"recipientEmail":"gev-emeni@outlook.fr","coverCount":"","amountAlreadyPaid":0,"amountMode":"ttc","lines":[{"id":"1776431525290-j8uo5h","label":"Prestation de restauration","quantity":1,"ttcByRate":{"10":0,"20":0}}],"totalHt":0,"totalTva":0,"totalTtcBrut":0,"netToPay":0,"status":"pending","billing_snapshot":{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}}','{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}',0.0,0.0,0.0,0.0,0.0,NULL,NULL,NULL);

INSERT INTO facture VALUES('7d0f43f0-db94-4fed-bf22-f263c0e1ad43','c7317f37','BRAS-202604-0001','Rekaia JELASSI',0.0,'paid','2026-04-17','2026-04-17 13:28:10','{"id":"7d0f43f0-db94-4fed-bf22-f263c0e1ad43","invoiceNumber":"BRAS-202604-0001","invoiceDate":"2026-04-17","clientName":"Rekaia JELASSI","clientAddress":"13 All├뿯½e de l''ile Marante","clientCity":"Colombes","clientPostalCode":"92700","clientCountry":"France","crmContactId":null,"recipientEmail":"gev-emeni@outlook.fr","coverCount":"","amountAlreadyPaid":0,"amountMode":"ttc","lines":[{"id":"1776432479191-gt54zb","label":"Prestation de restauration","quantity":1,"ttcByRate":{"10":0,"20":0}}],"totalHt":0,"totalTva":0,"totalTtcBrut":0,"netToPay":0,"status":"pending","billing_snapshot":{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}}','{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}',0.0,0.0,0.0,0.0,0.0,NULL,NULL,NULL);

INSERT INTO facture VALUES('c22bc459-9f83-469c-a0bf-530fb6bb54fa','c7317f37','BRAS-202604-0002','Rekaia JELASSI',0.0,'paid','2026-04-17','2026-04-17 13:35:21','{"id":"c22bc459-9f83-469c-a0bf-530fb6bb54fa","invoiceNumber":"BRAS-202604-0002","invoiceDate":"2026-04-17","clientName":"Rekaia JELASSI","clientAddress":"13 All├뿯½e de l''ile Marante","clientCity":"Colombes","clientPostalCode":"92700","clientCountry":"France","crmContactId":null,"recipientEmail":"gev-emeni@outlook.fr","coverCount":"","amountAlreadyPaid":0,"amountMode":"ttc","lines":[{"id":"1776432909988-vv5src","label":"Prestation de restauration","quantity":1,"ttcByRate":{"10":0,"20":0}}],"totalHt":0,"totalTva":0,"totalTtcBrut":0,"netToPay":0,"status":"pending","billing_snapshot":{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}}','{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}',0.0,0.0,0.0,0.0,0.0,NULL,NULL,NULL);

INSERT INTO facture VALUES('987dadb5-dd5f-4ee5-949c-f87f5325b926','c7317f37','BRAS-202604-0003','Brasserie Polpo',0.0,'paid','2026-04-15','2026-04-17 13:35:42','{"id":"987dadb5-dd5f-4ee5-949c-f87f5325b926","invoiceNumber":"BRAS-202604-0003","invoiceDate":"2026-04-15","clientName":"Brasserie Polpo","clientAddress":"47 Quai Charles Pasqua","clientCity":"Levallois-Perret","clientPostalCode":"92300","clientCountry":"France","crmContactId":null,"recipientEmail":"soniadaouadi@outlook.fr","coverCount":"","amountAlreadyPaid":0,"amountMode":"ttc","lines":[{"id":"1776432926390-fsljqx","label":"Prestation de restauration","quantity":1,"ttcByRate":{"10":0,"20":0}}],"totalHt":0,"totalTva":0,"totalTtcBrut":0,"netToPay":0,"status":"pending","billing_snapshot":{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}}','{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}',0.0,0.0,0.0,0.0,0.0,NULL,NULL,NULL);

INSERT INTO facture VALUES('b415da83-4772-4d72-a5b0-bd92e3f94770','c7317f37','BRAS-202604-0004','Rekaia Emeni JELASSI',0.0,'paid','2026-04-17','2026-04-17 13:39:26','{"id":"b415da83-4772-4d72-a5b0-bd92e3f94770","invoiceNumber":"BRAS-202604-0004","invoiceDate":"2026-04-17","clientName":"Rekaia Emeni JELASSI","clientAddress":"13 All├뿯½e de l''ile Marante\n302","clientCity":"Colombes","clientPostalCode":"92700","clientCountry":"France","crmContactId":null,"recipientEmail":"soniadaouadi@outlook.fr","coverCount":"","amountAlreadyPaid":0,"amountMode":"ttc","lines":[{"id":"1776433149744-cyrl42","label":"Prestation de restauration","quantity":1,"ttcByRate":{"10":0,"20":0}}],"totalHt":0,"totalTva":0,"totalTtcBrut":0,"netToPay":0,"status":"pending","billing_snapshot":{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}}','{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}',0.0,0.0,0.0,0.0,0.0,NULL,NULL,NULL);

INSERT INTO facture VALUES('07ac0393-aa9f-44ce-a6e1-7bf806d1f930','c7317f37','BRAS-202604-0005','Brasserie Polpo test 2',0.0,'paid','2026-04-17','2026-04-17 13:48:35','{"id":"07ac0393-aa9f-44ce-a6e1-7bf806d1f930","invoiceNumber":"BRAS-202604-0005","invoiceDate":"2026-04-17","clientName":"Brasserie Polpo test 2","clientAddress":"47 Quai Charles Pasqua","clientCity":"Levallois-Perret","clientPostalCode":"92300","clientCountry":"France","crmContactId":null,"recipientEmail":"gev-emeni@outlook.fr","coverCount":"","amountAlreadyPaid":0,"amountMode":"ttc","lines":[{"id":"1776433640087-2vjqst","label":"Prestation de restauration","quantity":1,"ttcByRate":{"10":0,"20":0}}],"totalHt":0,"totalTva":0,"totalTtcBrut":0,"netToPay":0,"status":"pending","billing_snapshot":{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}}','{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 뿯½뿯½뿯½","ape":"56.10A 뿯½뿯½뿯½ Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}',0.0,0.0,0.0,0.0,0.0,NULL,NULL,NULL);

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

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, phone TEXT, address TEXT,

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE

);

INSERT INTO employes VALUES('9703a0ee','c7317f37','NICOLAS','GUILLOTTE',NULL,'26424431',NULL,NULL,'["26424431"]','2026-04-14 13:00:40',NULL,NULL);

INSERT INTO employes VALUES('0192a490','c7317f37','MATTHEU','LEBIHAN',NULL,'26424431',NULL,NULL,'["26424431"]','2026-04-14 13:00:41',NULL,NULL);

INSERT INTO employes VALUES('441aee65','c7317f37','FRANCOIS','LOUISET',NULL,'26424431',NULL,NULL,'["26424431"]','2026-04-14 13:00:42',NULL,NULL);

INSERT INTO employes VALUES('03aa37ce','c7317f37','LUCAS','MANGANE',NULL,'26424431',NULL,NULL,'["26424431"]','2026-04-14 13:00:42',NULL,NULL);

INSERT INTO employes VALUES('5b478c01','c7317f37','REGIS','MINGUI',NULL,'26424431',NULL,NULL,'["26424431"]','2026-04-14 13:00:42',NULL,NULL);

INSERT INTO employes VALUES('b13aad76','c7317f37','Juliette','GLOUX','soniadaouadi@outlook.fr','5da696b8',NULL,NULL,'["5da696b8"]','2026-04-14 13:00:43',NULL,NULL);

INSERT INTO employes VALUES('c58e68ad','c7317f37','Julienne','MBOCK HANG',NULL,'5da696b8',NULL,NULL,'["5da696b8"]','2026-04-14 13:00:43',NULL,NULL);

INSERT INTO employes VALUES('5b07ba0e','c7317f37','Jade','RENAUDAT',NULL,'5da696b8',NULL,NULL,'["5da696b8"]','2026-04-14 13:00:44',NULL,NULL);

INSERT INTO employes VALUES('8f891371','c7317f37','MOHAMED','MOUILED LAMINE',NULL,'e3eddca3',NULL,NULL,'["e3eddca3"]','2026-04-14 13:00:45',NULL,NULL);

INSERT INTO employes VALUES('73342f74','c7317f37','EMON','BARUA',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:45',NULL,NULL);

INSERT INTO employes VALUES('83118688','c7317f37','SAGAR','BARUA',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:45',NULL,NULL);

INSERT INTO employes VALUES('b4f6a9e9','c7317f37','SHUVA','BARUA',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:46',NULL,NULL);

INSERT INTO employes VALUES('fb8a9a69','c7317f37','MAMADOU','FALL',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:46',NULL,NULL);

INSERT INTO employes VALUES('34d44a9f','c7317f37','NASSIM','HARRAT',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:46',NULL,NULL);

INSERT INTO employes VALUES('fb0948a6','c7317f37','IBRAHIMA','KONATE',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:47',NULL,NULL);

INSERT INTO employes VALUES('560e1569','c7317f37','SHELIHANE','KROTNI',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:47',NULL,NULL);

INSERT INTO employes VALUES('51cca7b8','c7317f37','GAEL','LE PICARD',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:47',NULL,NULL);

INSERT INTO employes VALUES('0318f1b2','c7317f37','MODY','MAGASSA',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:48',NULL,NULL);

INSERT INTO employes VALUES('35db61b2','c7317f37','ABRAHAM','NDRI',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:48',NULL,NULL);

INSERT INTO employes VALUES('5e7a90f2','c7317f37','JOHN-MARC','NOCHE',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:48',NULL,NULL);

INSERT INTO employes VALUES('519ad272','c7317f37','MAGALI','PENIN',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:49',NULL,NULL);

INSERT INTO employes VALUES('b6bd51f8','c7317f37','SAMANTHA','POLLET',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:49',NULL,NULL);

INSERT INTO employes VALUES('0ada12f5','c7317f37','HASIM','TAJUDDIN',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:49',NULL,NULL);

INSERT INTO employes VALUES('9c5a7af2','c7317f37','JULIA','TANCHON LEGRAND',NULL,'72a799fb',NULL,NULL,'["72a799fb"]','2026-04-14 13:00:50',NULL,NULL);

INSERT INTO employes VALUES('6d8fb0be','c7317f37','BADAN','BARUA',NULL,'9233f8c2',NULL,NULL,'["9233f8c2"]','2026-04-14 13:00:51',NULL,NULL);

INSERT INTO employes VALUES('4e6dce6d','c7317f37','BIJOY','BARUA',NULL,'9233f8c2',NULL,NULL,'["9233f8c2"]','2026-04-14 13:00:51',NULL,NULL);

INSERT INTO employes VALUES('e993b908','c7317f37','EMON','BARUA',NULL,'9233f8c2',NULL,NULL,'["9233f8c2"]','2026-04-14 13:00:51',NULL,NULL);

INSERT INTO employes VALUES('efb23595','c7317f37','KONOK','BARUA',NULL,'9233f8c2',NULL,NULL,'["9233f8c2"]','2026-04-14 13:00:52',NULL,NULL);

INSERT INTO employes VALUES('f71f6919','c7317f37','RITU','BARUA',NULL,'9233f8c2',NULL,NULL,'["9233f8c2"]','2026-04-14 13:00:52',NULL,NULL);

INSERT INTO employes VALUES('1691868a','c7317f37','SAJU','BARUA',NULL,'9233f8c2',NULL,NULL,'["9233f8c2"]','2026-04-14 13:00:53',NULL,NULL);

INSERT INTO employes VALUES('3f010867','c7317f37','DAOUDA','KANTE',NULL,'9233f8c2',NULL,NULL,'["9233f8c2"]','2026-04-14 13:00:53',NULL,NULL);

INSERT INTO employes VALUES('2cdc0463','c7317f37','DIABE','SACKO',NULL,'9233f8c2',NULL,NULL,'["9233f8c2"]','2026-04-14 13:00:53',NULL,NULL);

INSERT INTO employes VALUES('4eb77932','c7317f37','ANDREA','BRAULT',NULL,'bef75760',NULL,NULL,'["bef75760"]','2026-04-14 13:00:54',NULL,NULL);

INSERT INTO employes VALUES('3f778e71','c7317f37','RAPHAELLE','CAILLE',NULL,'bef75760',NULL,NULL,'["bef75760"]','2026-04-14 13:00:54',NULL,NULL);

INSERT INTO employes VALUES('62835df3','c7317f37','SARAH','DRIDI',NULL,'bef75760',NULL,NULL,'["bef75760"]','2026-04-14 13:00:55',NULL,NULL);

INSERT INTO employes VALUES('d92e5173','c7317f37','Emeni','HESLOT',NULL,'bef75760',NULL,NULL,'["bef75760"]','2026-04-14 13:00:55',NULL,NULL);

INSERT INTO employes VALUES('d358855d','c7317f37','SASHA','LEPIENNE',NULL,'bef75760',NULL,NULL,'["bef75760"]','2026-04-14 13:00:56',NULL,NULL);

INSERT INTO employes VALUES('cffc9907','c7317f37','JEWEL','BARUA',NULL,'ed393f6d',NULL,NULL,'["ed393f6d"]','2026-04-14 13:00:56',NULL,NULL);

INSERT INTO employes VALUES('dda0a36e','c7317f37','SNIGDHA','BARUA',NULL,'ed393f6d',NULL,NULL,'["ed393f6d"]','2026-04-14 13:00:57',NULL,NULL);

INSERT INTO employes VALUES('42df59ae','c7317f37','SWAJAN','BARUA',NULL,'ed393f6d',NULL,NULL,'["ed393f6d"]','2026-04-14 13:00:57',NULL,NULL);

INSERT INTO employes VALUES('37c0fed4','c7317f37','SRI POLAS','DAS',NULL,'ed393f6d',NULL,NULL,'["ed393f6d"]','2026-04-14 13:00:58',NULL,NULL);

INSERT INTO employes VALUES('adc7299c','c7317f37','HRIDAY','BARUA',NULL,'b8f038d9',NULL,NULL,'["b8f038d9"]','2026-04-14 13:00:58',NULL,NULL);

INSERT INTO employes VALUES('a460903f','c7317f37','IHNATENKO','IHOR',NULL,'b8f038d9',NULL,NULL,'["b8f038d9"]','2026-04-14 13:00:59',NULL,NULL);

INSERT INTO employes VALUES('404ce868','c7317f37','RANDY','SAADA',NULL,'71054bf3',NULL,NULL,'["71054bf3"]','2026-04-14 13:01:00',NULL,NULL);

CREATE TABLE crm_contacts (

    id TEXT PRIMARY KEY,

    client_id TEXT NOT NULL,

    type TEXT NOT NULL CHECK(type IN ('PRIV├뿯½', 'PROFESSIONNEL')),

    first_name TEXT,

    last_name TEXT,

    company_name TEXT,

    organizer_name TEXT,

    email TEXT,

    phone TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, address TEXT DEFAULT '', postal_code TEXT DEFAULT '', city TEXT DEFAULT '', country TEXT DEFAULT 'France',

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,

    UNIQUE(client_id, phone)

);

INSERT INTO crm_contacts VALUES('d2f270b0','c7317f37','PROFESSIONNEL','','','AG2R LA MONDIAL','',NULL,'__AUTO_NOPHONE__:company:ag2r la mondial','2026-04-14 15:53:31','2026-04-15 15:19:33',NULL,'92300','LEVALLOIS-PERRET','France');

INSERT INTO crm_contacts VALUES('35c6047e','c7317f37','PROFESSIONNEL','','','ERES GROUP','',NULL,'__AUTO_NOPHONE__:company:eres group','2026-04-14 16:58:02','2026-04-14 17:00:44','','','','France');

INSERT INTO crm_contacts VALUES('5491748b','c7317f37','PROFESSIONNEL','','','ESPACE TEMPS','',NULL,'__AUTO_NOPHONE__:company:espace temps','2026-04-14 17:02:35','2026-04-14 19:58:27','','','','France');

INSERT INTO crm_contacts VALUES('22fc49af','c7317f37','PRIV├뿯½','Madame','ACHACH','','',NULL,'__AUTO_NOPHONE__:name:madame:achach','2026-04-14 19:08:43','2026-04-14 19:08:43','','','','France');

INSERT INTO crm_contacts VALUES('c2776869','c7317f37','PRIV├뿯½','MADAME','TEULIERES','','',NULL,'__AUTO_NOPHONE__:name:madame:teulieres','2026-04-14 19:11:30','2026-04-14 19:13:14','','','','France');

INSERT INTO crm_contacts VALUES('fe7def49','c7317f37','PRIV├뿯½','MADAME','TRAN','','',NULL,'__AUTO_NOPHONE__:name:madame:tran','2026-04-15 13:47:37','2026-04-15 13:47:37',NULL,'','','France');

INSERT INTO crm_contacts VALUES('bec44b4d','c7317f37','PROFESSIONNEL','','','THEA PHARMA','',NULL,'__AUTO_NOPHONE__:company:thea pharma','2026-04-15 13:49:25','2026-04-15 13:49:25',NULL,'','','France');

INSERT INTO crm_contacts VALUES('857f6df7','c7317f37','PROFESSIONNEL','','','BANG BANG EVENT','',NULL,'__AUTO_NOPHONE__:company:bang bang event','2026-04-15 13:52:15','2026-04-15 13:52:15',NULL,'','','France');

CREATE TABLE evenementiel_event_assignments (

    event_id TEXT NOT NULL,

    employee_id TEXT NOT NULL,

    staff_type_id TEXT NOT NULL,

    PRIMARY KEY (event_id, employee_id),

    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE CASCADE,

    FOREIGN KEY (employee_id) REFERENCES employes(id) ON DELETE CASCADE,

    FOREIGN KEY (staff_type_id) REFERENCES evenementiel_staff_types(id) ON DELETE CASCADE

);

INSERT INTO evenementiel_event_assignments VALUES('8cc62467','560e1569','500de5af');

INSERT INTO evenementiel_event_assignments VALUES('38ae920d','4eb77932','500de5af');

INSERT INTO evenementiel_event_assignments VALUES('abaea39e','4eb77932','500de5af');

INSERT INTO evenementiel_event_assignments VALUES('eb60de42','4eb77932','500de5af');

INSERT INTO evenementiel_event_assignments VALUES('56f2e2cf','4eb77932','500de5af');

INSERT INTO evenementiel_event_assignments VALUES('56f2e2cf','560e1569','500de5af');

INSERT INTO evenementiel_event_assignments VALUES('979b3e07','560e1569','500de5af');

INSERT INTO evenementiel_event_assignments VALUES('979b3e07','4eb77932','500de5af');

INSERT INTO evenementiel_event_assignments VALUES('2e07b20e','4eb77932','500de5af');

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

INSERT INTO event_notes VALUES('26cad262','f6cf1fd2','c7317f37','PAS D''HOTESSE','2026-04-14 17:02:35','2026-04-14 19:58:27');

INSERT INTO event_notes VALUES('16694abe','c5b1dc69','c7317f37','PAS D''H├뿯½TESSES','2026-04-15 13:47:37','2026-04-15 13:47:37');

INSERT INTO event_notes VALUES('dbce0337','2e07b20e','c7317f37','tu m''a fais un chargement de donn├뿯½e via mon compte admin dans gestion clients, pour ajouter les employ├뿯½s de mes client, ou je vais lui donner un excel ou pdf et il vas recuperer obligatoirement nom prenom poste, et pas obligatoire, mail, numero de telephone,; je veux que tu me fasse exactement la meme chose, avec un tableau excel ou pdf pour "evenementiel" je vais devoir donner une liste avec "date du calendrier" (donc mois + ann├뿯½e)"Nom de l''entreprise ou Nom prenom" "Particulier" ou "professionnelle", "date" "heure debut" "heure fin" "nombre d''hotesse booker" et "nom des staff booker" "nombre d''extras" "prenom du prise par" "nombre de personne" "date de la privat" et "espace", esce que tu as compris l''id├뿯½e? en gros il vas devoir analyser le document et  saisir les donn├뿯½e des privat, trouver les staff correspondant et les booker etc  (donc normalement automatiquement ├뿯½a creer egalement les ficher CMR client vu que ce sont de nouveau client qui privatisent a ajouter dans enevementiel) et du coup ├뿯½a vient ajouter les privat a "eve,nementiel du client concerner grace a l''exporte excel ou pdf. Dis moi si tu as bien compris avant de faire quoi que ce soit dessus','2026-04-15 15:19:33','2026-04-15 15:19:33');

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

INSERT INTO staff_category_mapping VALUES('758d691b','c7317f37','500de5af','4eb77932','2026-04-14 13:43:41');

INSERT INTO staff_category_mapping VALUES('91e7877b','c7317f37','500de5af','3f778e71','2026-04-14 13:43:42');

INSERT INTO staff_category_mapping VALUES('75bb275a','c7317f37','500de5af','560e1569','2026-04-14 13:43:42');

INSERT INTO staff_category_mapping VALUES('fab6f0eb','c7317f37','500de5af','d358855d','2026-04-14 13:43:42');

CREATE TABLE job_posts (

    id TEXT PRIMARY KEY,

    client_id TEXT NOT NULL,

    title TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,

    UNIQUE(client_id, title)

);

INSERT INTO job_posts VALUES('26424431','c7317f37','ENCADREMENT','2026-04-14 13:00:39');

INSERT INTO job_posts VALUES('5da696b8','c7317f37','COMMERCIALE + ADMIN','2026-04-14 13:00:43');

INSERT INTO job_posts VALUES('e3eddca3','c7317f37','ASSISTANT MANAGER','2026-04-14 13:00:44');

INSERT INTO job_posts VALUES('72a799fb','c7317f37','CHEF DE RANG','2026-04-14 13:00:45');

INSERT INTO job_posts VALUES('9233f8c2','c7317f37','RUNNER','2026-04-14 13:00:50');

INSERT INTO job_posts VALUES('bef75760','c7317f37','ACCUEIL','2026-04-14 13:00:54');

INSERT INTO job_posts VALUES('ed393f6d','c7317f37','BARMAN','2026-04-14 13:00:56');

INSERT INTO job_posts VALUES('b8f038d9','c7317f37','PLAGE / RUNNER','2026-04-14 13:00:58');

INSERT INTO job_posts VALUES('71054bf3','c7317f37','APPRENTI','2026-04-14 13:00:59');

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

CREATE TABLE evenementiel_config (

    client_id TEXT PRIMARY KEY,

    track_taken_by INTEGER DEFAULT 0,

    allowed_taker_employee_ids TEXT DEFAULT '[]',

    notify_recipient_employee_ids TEXT DEFAULT '[]',

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE

);

INSERT INTO evenementiel_config VALUES('c7317f37',1,'["5b07ba0e","b13aad76"]','["b13aad76"]','2026-04-14 13:43:42');

CREATE TABLE IF NOT EXISTS "collaborators" (

            id TEXT PRIMARY KEY,

            client_id TEXT NOT NULL,

            email TEXT UNIQUE,

            username TEXT UNIQUE,

            password TEXT NOT NULL,

            name TEXT NOT NULL,

            role TEXT,

            is_temporary_password INTEGER DEFAULT 1,

            status TEXT DEFAULT 'active',

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, modules_access TEXT DEFAULT "[]",

            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE

        );

INSERT INTO collaborators VALUES('53a10142','c7317f37','soniadouadi@outlook.fr','polpo.hotesse','$2b$10$k0qoMLvYXVI5DuMPkAQKbeZf.5fKEMBltGntyUVXBnf5pKO03Vvl6','Commercial & H├┤tesse',NULL,0,'active','2026-04-14 11:32:46','["evenementiel","crm","facture"]');

INSERT INTO collaborators VALUES('5720b0a0','c7317f37',NULL,'polpo.rh','$2b$10$j3vHodU94lrPY63RwjIc2.n.hccD9anuD8kkD0TuTd3HCLnc8eNMy','Ressources Humaines','RH',0,'active','2026-04-15 13:29:50','["planning","employes"]');

CREATE TABLE IF NOT EXISTS "audit_logs" (

            id TEXT PRIMARY KEY,

            user_id TEXT NOT NULL,

            target_user_id TEXT NOT NULL,

            action TEXT NOT NULL,

            old_value TEXT,

            new_value TEXT,

            ip_address TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        );

INSERT INTO audit_logs VALUES('1d670247-aee','c58f0ec9','c7317f37','UPDATE_LOGO_URL',NULL,'/uploads/logos/logo-c7317f37-1776162348430-1a2a6c89.png','unknown','2026-04-14 10:25:48');

INSERT INTO audit_logs VALUES('a3cc1e84-60f','c58f0ec9','c7317f37','UPDATE_LOGO_URL','/uploads/logos/logo-c7317f37-1776162348430-1a2a6c89.png','/uploads/logos/logo-c7317f37-1776162361287-c22b6b6d.png','unknown','2026-04-14 10:26:02');

INSERT INTO audit_logs VALUES('d5b02063-852','c58f0ec9','c7317f37','UPDATE_EMAIL','soniadaouadi@outlook.fr','heslotemeni@outlook.com','unknown','2026-04-14 14:10:58');

INSERT INTO audit_logs VALUES('fc16a0ff-4b5','c58f0ec9','c7317f37','UPDATE_COMPANY_NAME','Sonia','Brasserie Polpo','unknown','2026-04-15 07:26:58');

INSERT INTO audit_logs VALUES('42079d92-5ba','c58f0ec9','c7317f37','UPDATE_LOGO_URL','/uploads/logos/logo-c7317f37-1776162361287-c22b6b6d.png','/uploads/logos/logo-c7317f37-1776238077600-553ce8b0.png','unknown','2026-04-15 07:27:57');

INSERT INTO audit_logs VALUES('18dbf665-9a6','c58f0ec9','c7317f37','UPDATE_LOGO_URL','/uploads/logos/logo-c7317f37-1776238077600-553ce8b0.png','/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png','unknown','2026-04-15 07:28:20');

INSERT INTO audit_logs VALUES('eca39795-3f0','c58f0ec9','32b862fe','UPDATE_IDENTIFIER','axel','iamani','unknown','2026-04-15 11:47:17');

INSERT INTO audit_logs VALUES('20215b3c-fa1','c58f0ec9','32b862fe','UPDATE_COMPANY_NAME','ARS','L''IAmani','unknown','2026-04-15 11:47:17');

INSERT INTO audit_logs VALUES('236c6821-ae1','c58f0ec9','32b862fe','UPDATE_LOGO_URL','/uploads/logos/logo-axel-1776167085729-8c74a314.png','/uploads/logos/logo-32b862fe-1776253636328-3e03b3a1.png','unknown','2026-04-15 11:47:18');

INSERT INTO audit_logs VALUES('611f2906-da6','c58f0ec9','c7317f37','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:02:58');

INSERT INTO audit_logs VALUES('3082c1b0-725','c58f0ec9','c7317f37','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:08:45');

INSERT INTO audit_logs VALUES('5a87223c-5f9','c58f0ec9','c7317f37','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:11:00');

INSERT INTO audit_logs VALUES('ca20d1a6-494','c58f0ec9','c7317f37','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:12:32');

INSERT INTO audit_logs VALUES('b8477a08-612','c58f0ec9','32b862fe','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:19:12');

INSERT INTO audit_logs VALUES('d603b048-18b','c58f0ec9','32b862fe','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:19:43');

INSERT INTO audit_logs VALUES('5360cfb5-f03','c58f0ec9','32b862fe','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:20:16');

INSERT INTO audit_logs VALUES('7150b81e-e84','c58f0ec9','32b862fe','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:21:05');

INSERT INTO audit_logs VALUES('0b3be5c2-95d','c58f0ec9','c7317f37','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:22:34');

INSERT INTO audit_logs VALUES('c790aaeb-fce','c58f0ec9','53a10142','UPDATE_PASSWORD','[PROTECTED]','[RESET_COLLABORATOR_BY_ADMIN]','unknown','2026-04-15 12:27:00');

INSERT INTO audit_logs VALUES('beb0b23f-5dc','c58f0ec9','c7317f37','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_LINK_SENT]','unknown','2026-04-15 12:27:46');

INSERT INTO audit_logs VALUES('be612e3e-c1e','c58f0ec9','53a10142','UPDATE_PASSWORD','[PROTECTED]','[FORCE_RESET_COLLABORATOR_BY_ADMIN]','unknown','2026-04-15 13:03:25');

INSERT INTO audit_logs VALUES('c8a0d356-6ef','c58f0ec9','c7317f37','UPDATE_IDENTIFIER','soniad','polpo.direction','unknown','2026-04-15 13:08:33');

INSERT INTO audit_logs VALUES('c9d0935e-26a','c7317f37','c7317f37','UPDATE_PASSWORD','[PROTECTED]','[UPDATED]','unknown','2026-04-15 13:21:18');

INSERT INTO audit_logs VALUES('06d3431c-dae','c58f0ec9','c58f0ec9','UPDATE_PASSWORD','[PROTECTED]','[UPDATED]','unknown','2026-04-15 13:27:13');

INSERT INTO audit_logs VALUES('1d09bea4-a13','c58f0ec9','c58f0ec9','UPDATE_PASSWORD','[PROTECTED]','[UPDATED]','unknown','2026-04-15 13:27:45');

CREATE TABLE support_tickets (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, status TEXT DEFAULT "OPEN", created_by_user_id TEXT, created_by_type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE);

INSERT INTO support_tickets VALUES('5aecde07-b','c7317f37','CLOSED','c7317f37','client','2026-04-14 10:57:49','2026-04-14 10:59:47');

INSERT INTO support_tickets VALUES('164ab2ac-f','c7317f37','CLOSED','c7317f37','client','2026-04-14 11:37:26','2026-04-14 11:38:13');

INSERT INTO support_tickets VALUES('36201118-f','c7317f37','OPEN','c7317f37','client','2026-04-14 20:41:44','2026-04-16 11:13:13');

CREATE TABLE support_messages (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, sender_user_id TEXT NOT NULL, sender_type TEXT NOT NULL, message TEXT, file_url TEXT, file_name TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE);

INSERT INTO support_messages VALUES('7e0dab58-d4f','5aecde07-b','c7317f37','client','Test',NULL,NULL,1,'2026-04-14 10:57:49');

INSERT INTO support_messages VALUES('3e90b38e-7b5','5aecde07-b','c58f0ec9','admin','Je vous ├뿯½coute',NULL,NULL,1,'2026-04-14 10:58:07');

INSERT INTO support_messages VALUES('2bded4e1-d7d','164ab2ac-f','c7317f37','client','Bonjour',NULL,NULL,1,'2026-04-14 11:37:27');

INSERT INTO support_messages VALUES('ad24d114-5b0','164ab2ac-f','c58f0ec9','admin','Rerpondre',NULL,NULL,1,'2026-04-14 11:37:46');

INSERT INTO support_messages VALUES('d3c45fb6-ffb','36201118-f','c7317f37','client','tEST',NULL,NULL,1,'2026-04-14 20:41:45');

INSERT INTO support_messages VALUES('f2c7409c-d87','36201118-f','c58f0ec9','admin','Que puis-faire pour vous?',NULL,NULL,1,'2026-04-16 00:47:16');

INSERT INTO support_messages VALUES('cb707928-c04','36201118-f','c58f0ec9','admin','├뿯½tes-vous l├뿯½?',NULL,NULL,1,'2026-04-16 01:57:56');

INSERT INTO support_messages VALUES('e095c13c-f27','36201118-f','c7317f37','client','Bonjour j''aimerais ajouter une fonctionnalit├뿯½ au site si possible',NULL,NULL,1,'2026-04-16 02:03:25');

INSERT INTO support_messages VALUES('8297a35c-074','36201118-f','c58f0ec9','admin','Oui',NULL,NULL,0,'2026-04-16 07:50:22');

INSERT INTO support_messages VALUES('a9d8324d-fe8','36201118-f','c58f0ec9','admin','?',NULL,NULL,0,'2026-04-16 07:53:01');

INSERT INTO support_messages VALUES('2706e2d0-0e5','36201118-f','c58f0ec9','admin','j''attend',NULL,NULL,0,'2026-04-16 07:58:49');

INSERT INTO support_messages VALUES('095be6a8-2d4','36201118-f','c58f0ec9','admin','Oui',NULL,NULL,0,'2026-04-16 10:47:39');

INSERT INTO support_messages VALUES('96bc4064-4aa','36201118-f','c58f0ec9','admin','Oui',NULL,NULL,0,'2026-04-16 10:52:48');

INSERT INTO support_messages VALUES('bc171856-f2f','36201118-f','c58f0ec9','admin','Merveilleux',NULL,NULL,0,'2026-04-16 11:13:12');

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

INSERT INTO billing_settings VALUES('c7317f37','','','47 Quai Charles Pasqua','92300','Levallois-Perret','France','449 331 164 00037','FR24 449331164','0141343286','40 000 뿯½뿯½뿯½','56.10A 뿯½뿯½뿯½ Restauration traditionnelle','','Nanterre','449 331 164','[{"id":"1","label":"Prestation de restauration","unit_price_ttc":0,"tax_rate":0},{"id":"2","label":"Service et consommation de restauration","unit_price_ttc":0,"tax_rate":10},{"id":"3","label":"Repas professionnels","unit_price_ttc":0,"tax_rate":10},{"id":"4","label":"Boissons et consommations","unit_price_ttc":0,"tax_rate":10},{"id":"5","label":"Prestation de restauration en semi-privatisation","unit_price_ttc":0,"tax_rate":10}]','2026-04-15 13:24:27');

CREATE TABLE crm_contact_documents (

    id TEXT PRIMARY KEY,

    client_id TEXT NOT NULL,

    contact_id TEXT NOT NULL,

    event_id TEXT,

    display_name TEXT NOT NULL,

    file_name TEXT NOT NULL,

    mime_type TEXT,

    file_size INTEGER,

    storage_key TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,

    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,

    FOREIGN KEY (event_id) REFERENCES evenementiel(id) ON DELETE SET NULL

);

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

CREATE TABLE facture_history (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        facture_id TEXT NOT NULL,

        client_id TEXT NOT NULL,

        action TEXT NOT NULL, -- 'email', 'print', 'download'

        email TEXT,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, pdf_filename TEXT,

        UNIQUE(facture_id, client_id, action, email)

    );

INSERT INTO facture_history VALUES(1,'96a958b0-2c46-469b-b672-de0d9dcae3c8','c7317f37','email','gev-emeni@outlook.fr','2026-04-17 13:12:26','BRAS-F37-202604-0002.pdf');

INSERT INTO facture_history VALUES(2,'5bdcee93-86f5-40f3-a4e1-c15ad80e262d','c7317f37','email','soniadaouadi@outlook.fr','2026-04-17 13:20:41','CLNT-202604-0001.pdf');

INSERT INTO facture_history VALUES(3,'03cdec85-efb6-49e7-ad59-07ec22a10341','c7317f37','email','gev-emeni@outlook.fr','2026-04-17 13:24:15','CLNT-202604-0001.pdf');

INSERT INTO facture_history VALUES(4,'f66e2c3a-6499-46c0-81f5-63965f8681b2','c7317f37','email','gev-emeni@outlook.fr','2026-04-17 13:28:10','BRAS-202604-0001.pdf');

INSERT INTO facture_history VALUES(5,'b73d3aee-7d4c-4bac-97df-c873ae25b7e4','c7317f37','email','gev-emeni@outlook.fr','2026-04-17 13:35:20','BRAS-202604-0002.pdf');

INSERT INTO facture_history VALUES(6,'caff68b8-d678-4bd6-b1f4-92462a19824a','c7317f37','email','soniadaouadi@outlook.fr','2026-04-17 13:35:42','BRAS-202604-0003.pdf');

INSERT INTO facture_history VALUES(7,'8c6e83e8-c7c0-48ec-be9b-029c3b362e9f','c7317f37','email','soniadaouadi@outlook.fr','2026-04-17 13:39:26','BRAS-202604-0004.pdf');

INSERT INTO facture_history VALUES(8,'9b2e2864-3ea8-4959-acb7-32300c4e5db4','c7317f37','email','gev-emeni@outlook.fr','2026-04-17 13:48:34','BRAS-202604-0005.pdf');

PRAGMA writable_schema=ON;

CREATE TABLE IF NOT EXISTS sqlite_sequence(name,seq);

DELETE FROM sqlite_sequence;

INSERT INTO sqlite_sequence VALUES('facture_history',8);

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

CREATE INDEX idx_employee_documents_client_id ON employee_documents(client_id);

CREATE INDEX idx_employee_documents_employee_id ON employee_documents(employee_id);

CREATE INDEX idx_collaborators_client_id ON collaborators(client_id);

CREATE UNIQUE INDEX idx_admins_username_unique ON admins(username) WHERE username IS NOT NULL;

CREATE UNIQUE INDEX idx_clients_username_unique ON clients(username) WHERE username IS NOT NULL;

CREATE UNIQUE INDEX idx_collaborators_username_unique ON collaborators(username) WHERE username IS NOT NULL;

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

CREATE INDEX idx_audit_logs_target_user ON audit_logs(target_user_id);

CREATE INDEX idx_support_tickets_client_status ON support_tickets(client_id, status);

CREATE INDEX idx_support_messages_ticket_created ON support_messages(ticket_id, created_at);

CREATE INDEX idx_support_messages_unread ON support_messages(is_read, sender_type);

CREATE INDEX idx_billing_settings_client_id ON billing_settings(client_id);

CREATE INDEX idx_crm_contact_documents_contact ON crm_contact_documents(contact_id, created_at DESC);

PRAGMA writable_schema=OFF;

COMMIT;

