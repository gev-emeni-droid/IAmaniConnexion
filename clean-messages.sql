-- Marquer TOUS les messages admin comme lus
UPDATE support_messages SET is_read = 1 WHERE sender_type = 'admin';

-- Marquer TOUS les messages client comme lus
UPDATE support_messages SET is_read = 1 WHERE sender_type = 'client';

-- Fermer tous les anciens tickets
UPDATE support_tickets SET status = 'CLOSED' WHERE status != 'CLOSED';
