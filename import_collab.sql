-- INSERTS collaborators (11 colonnes)
INSERT INTO collaborators VALUES('53a10142','c7317f37','soniadouadi@outlook.fr','polpo.hotesse','$2b$10$k0qoMLvYXVI5DuMPkAQKbeZf.5fKEMBltGntyUVXBnf5pKO03Vvl6','Commercial & Hôtessse',NULL,'["evenementiel","crm","facture"]',0,'active','2026-04-14 11:32:46');
INSERT INTO collaborators VALUES('5720b0a0','c7317f37',NULL,'polpo.rh','$2b$10$j3vHodU94lrPY63RwjIc2.n.hccD9anuD8kkD0TuTd3HCLnc8eNMy','Ressources Humaines','RH','["planning","employes"]',0,'active','2026-04-15 13:29:50');

-- INSERTS client_modules (3 colonnes)
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

-- INSERTS collaborator_permissions (3 colonnes)
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
