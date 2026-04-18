-- 1. Calendriers événementiels
INSERT INTO evenementiel_calendars VALUES('4f2c527e','c7317f37',4,2026,'OPEN','2026-04-14 08:32:29');
INSERT INTO evenementiel_calendars VALUES('4eb93569','c7317f37',2,2026,'ARCHIVED','2026-04-14 11:49:35');
INSERT INTO evenementiel_calendars VALUES('51b6d207','c7317f37',5,2026,'OPEN','2026-04-14 19:57:40');
INSERT INTO evenementiel_calendars VALUES('b6eaefa4','32b862fe',4,2026,'OPEN','2026-04-14 20:52:58');

-- 2. Espaces événementiels
INSERT INTO evenementiel_spaces VALUES('9cff54f3','c7317f37','POLPO NORD','#a020f0','2026-04-14 11:42:19');
INSERT INTO evenementiel_spaces VALUES('da46ed59','c7317f37','Restaurant','#1f26ef','2026-04-14 13:59:19');

-- 3. Types de staff événementiel
INSERT INTO evenementiel_staff_types VALUES('500de5af','c7317f37','HÔtesses','2026-04-14 09:20:07');

-- 4. Employés
INSERT INTO employes VALUES('9703a0ee','c7317f37','NICOLAS','GUILLOTTE',NULL,'26424431',NULL,NULL,'["26424431"]','2026-04-14 13:00:40',NULL,NULL);
INSERT INTO employes VALUES('0192a490','c7317f37','MATTHEU','LEBIHAN',NULL,'26424431',NULL,NULL,'["26424431"]','2026-04-14 13:00:41',NULL,NULL);
INSERT INTO employes VALUES('441aee65','c7317f37','FRANCOIS','LOUISET',NULL,'26424431',NULL,NULL,'["26424431"]','2026-04-14 13:00:42',NULL,NULL);
-- ... (ajouter tous les autres INSERT INTO employes ...)

-- 5. Collaborateurs
INSERT INTO collaborators VALUES('53a10142','c7317f37','soniadouadi@outlook.fr','polpo.hotesse','$2b$10$k0qoMLvYXVI5DuMPkAQKbeZf.5fKEMBltGntyUVXBnf5pKO03Vvl6','Commercial & Hôtessse',NULL,0,'active','2026-04-14 11:32:46','["evenementiel","crm","facture"]');
INSERT INTO collaborators VALUES('5720b0a0','c7317f37',NULL,'polpo.rh','$2b$10$j3vHodU94lrPY63RwjIc2.n.hccD9anuD8kkD0TuTd3HCLnc8eNMy','Ressources Humaines','RH',0,'active','2026-04-15 13:29:50','["planning","employes"]');

-- 6. Modules clients
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

-- 7. Permissions collaborateurs
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

-- 8. CRM contacts
INSERT INTO crm_contacts VALUES('d2f270b0','c7317f37','PROFESSIONNEL','','','AG2R LA MONDIAL','',NULL,'__AUTO_NOPHONE__:company:ag2r la mondial','2026-04-14 15:53:31','2026-04-15 15:19:33',NULL,'92300','LEVALLOIS-PERRET','France');
-- ... (ajouter tous les autres INSERT INTO crm_contacts ...)

-- 9. Événementiel
INSERT INTO evenementiel VALUES('2e07b20e','c7317f37','4f2c527e','PROFESSIONNEL','','',NULL,'2026-04-09T19:00:00','2026-04-10T02:00:00',180,'[]','','','AG2R LA MONDIAL','','2026-04-14 15:44:15','b13aad76');
-- ... (ajouter tous les autres INSERT INTO evenementiel ...)

-- 10. Factures
INSERT INTO facture VALUES('1fb1981e-7bb1-434f-9fc2-669e2513b05a','c7317f37','BRAS-F37-202604-0001','Rekaia Emeni JELASSI',0.0,'paid','2026-04-17','2026-04-17 12:31:09','{"id":"1fb1981e-7bb1-434f-9fc2-669e2513b05a","invoiceNumber":"BRAS-F37-202604-0001","invoiceDate":"2026-04-17","clientName":"Rekaia Emeni JELASSI","clientAddress":"13 Allée de l''ile Marante\n302","clientCity":"Colombes","clientPostalCode":"92700","clientCountry":"France","crmContactId":null,"recipientEmail":"soniadaouadi@outlook.fr","coverCount":"","amountAlreadyPaid":0,"amountMode":"ttc","lines":[{"id":"1776429062081-edvlsu","label":"Prestation de restauration","quantity":1,"ttcByRate":{"10":0,"20":0}}],"totalHt":0,"totalTva":0,"totalTtcBrut":0,"netToPay":0,"status":"pending","billing_snapshot":{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 €","ape":"56.10A Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}},'{"client_id":"c7317f37","company_name":"Brasserie Polpo","logo_url":"/uploads/logos/logo-c7317f37-1776238100640-97ac1a52.png","address":"47 Quai Charles Pasqua","postal_code":"92300","city":"Levallois-Perret","country":"France","siret":"449 331 164 00037","tva":"FR24 449331164","phone":"0141343286","capital":"40 000 €","ape":"56.10A Restauration traditionnelle","siege_social":"","rcs_ville":"Nanterre","rcs_numero":"449 331 164","prestations_catalog":"[{\"id\":\"1\",\"label\":\"Prestation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":0},{\"id\":\"2\",\"label\":\"Service et consommation de restauration\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"3\",\"label\":\"Repas professionnels\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"4\",\"label\":\"Boissons et consommations\",\"unit_price_ttc\":0,\"tax_rate\":10},{\"id\":\"5\",\"label\":\"Prestation de restauration en semi-privatisation\",\"unit_price_ttc\":0,\"tax_rate\":10}]","updated_at":"2026-04-15 13:24:27","tva_rates":[10,20],"enable_cover_count":true,"can_edit_branding":false,"can_edit_tax_rate":false}',0.0,0.0,0.0,0.0,0.0,NULL,NULL,NULL);
-- ... (ajouter tous les autres INSERT INTO facture ...)
