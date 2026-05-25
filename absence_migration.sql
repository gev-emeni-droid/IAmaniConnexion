ALTER TABLE employes ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS employes_username_idx ON employes(username);

ALTER TABLE employes ADD COLUMN password_hash TEXT;
ALTER TABLE employes ADD COLUMN is_active INTEGER DEFAULT 0;
ALTER TABLE employes ADD COLUMN allowed_absence_types TEXT;

CREATE TABLE IF NOT EXISTS absence_requests (
    id TEXT PRIMARY KEY,
    employe_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    type TEXT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    days_count REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
