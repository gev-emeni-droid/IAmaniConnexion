DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  name TEXT,
  street TEXT,
  zipCode TEXT,
  city TEXT,
  siret TEXT,
  vatNumber TEXT,
  phone TEXT,
  logo TEXT,
  primaryColor TEXT,
  rcs TEXT,
  ape TEXT,
  capital TEXT,
  headquarters TEXT
);

DROP TABLE IF EXISTS current_invoice;
CREATE TABLE current_invoice (
  id INTEGER PRIMARY KEY,
  invoiceNumber TEXT,
  date TEXT,
  covers INTEGER,
  client_companyName TEXT,
  client_address TEXT,
  description TEXT,
  amountHT10 REAL,
  amountHT20 REAL,
  full_data TEXT
);

DROP TABLE IF EXISTS invoices_history;
CREATE TABLE invoices_history (
  id INTEGER PRIMARY KEY,
  invoiceNumber TEXT,
  clientName TEXT,
  totalTTC REAL,
  date TEXT,
  full_data TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Only insert default settings if table is empty
INSERT OR IGNORE INTO settings (id, name, street, zipCode, city, siret, vatNumber, phone, logo, primaryColor, rcs, ape, capital, headquarters) 
VALUES (1, '', '', '', '', '', '', '', NULL, '#4f46e5', '', '', '', '');

-- Only insert default invoice if table is empty
INSERT OR IGNORE INTO current_invoice (id, invoiceNumber, date, covers, client_companyName, client_address, description, amountHT10, amountHT20)
VALUES (1, '', '', 1, '', '', '', 0, 0);

DROP TABLE IF EXISTS prestations;
CREATE TABLE prestations (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO prestations (label) VALUES 
('Prestation de restauration'),
('Service et consommation de restauration'),
('Repas professionnels'),
('Boissons et consommations');
