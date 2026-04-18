
-- ...existing code...
INSERT INTO collaborators VALUES('53a10142','c7317f37','soniadouadi@outlook.fr','polpo.hotesse','$2b$10$k0qoMLvYXVI5DuMPkAQKbeZf.5fKEMBltGntyUVXBnf5pKO03Vvl6','Commercial & Hôtessse',NULL,0,'active','2026-04-14 11:32:46','["evenementiel","crm","facture"]');
INSERT INTO collaborators VALUES('5720b0a0','c7317f37',NULL,'polpo.rh','$2b$10$j3vHodU94lrPY63RwjIc2.n.hccD9anuD8kkD0TuTd3HCLnc8eNMy','Ressources Humaines','RH',0,'active','2026-04-15 13:29:50','["planning","employes"]');
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
INSERT INTO evenementiel_calendars VALUES('4f2c527e','c7317f37',4,2026,'OPEN','2026-04-14 08:32:29');
INSERT INTO evenementiel_calendars VALUES('4eb93569','c7317f37',2,2026,'ARCHIVED','2026-04-14 11:49:35');
INSERT INTO evenementiel_calendars VALUES('51b6d207','c7317f37',5,2026,'OPEN','2026-04-14 19:57:40');
INSERT INTO evenementiel_calendars VALUES('b6eaefa4','32b862fe',4,2026,'OPEN','2026-04-14 20:52:58');
INSERT INTO evenementiel_spaces VALUES('9cff54f3','c7317f37','POLPO NORD','#a020f0','2026-04-14 11:42:19');
INSERT INTO evenementiel_spaces VALUES('da46ed59','c7317f37','Restaurant','#1f26ef','2026-04-14 13:59:19');
INSERT INTO evenementiel_staff_types VALUES('500de5af','c7317f37','H├┤tesses','2026-04-14 09:20:07');
INSERT INTO evenementiel VALUES('2e07b20e','c7317f37','4f2c527e','PROFESSIONNEL','','',NULL,'2026-04-09T19:00:00','2026-04-10T02:00:00',180,'[]','','','AG2R LA MONDIAL','','2026-04-14 15:44:15','b13aad76');
INSERT INTO evenementiel VALUES('8cc62467','c7317f37','4f2c527e','PROFESSIONNEL','','',NULL,'2026-04-14T09:00:00','2026-04-14T17:00:00',150,'[]','','','ERES GROUP','','2026-04-14 16:58:01','5b07ba0e');
INSERT INTO evenementiel VALUES('38ae920d','c7317f37','4f2c527e','PROFESSIONNEL','','',NULL,'2026-04-14T17:00:00','2026-04-15T02:00:00',150,'[]','','','ERES GROUP','','2026-04-14 17:00:43','5b07ba0e');
INSERT INTO evenementiel VALUES('f6cf1fd2','c7317f37','4f2c527e','PROFESSIONNEL','','',NULL,'2026-04-16T19:00:00','2026-04-17T02:00:00',130,'[]','','','ESPACE TEMPS','','2026-04-14 17:02:34','5b07ba0e');
INSERT INTO evenementiel VALUES('abaea39e','c7317f37','4f2c527e','PRIV├뿯½','','',NULL,'2026-04-18T11:30:00','2026-04-18T16:30:00',140,'[]','Madame','ACHACH','','','2026-04-14 17:13:38','b13aad76');
INSERT INTO evenementiel VALUES('eb60de42','c7317f37','4f2c527e','PRIV├뿯½','','',NULL,'2026-04-18T19:00:00','2026-04-19T04:00:00',120,'[]','MADAME','TEULIERES','','','2026-04-14 19:11:30','b13aad76');
INSERT INTO evenementiel VALUES('c5b1dc69','c7317f37','51b6d207','PRIV├뿯½','','',NULL,'2026-05-07T19:00:00','2026-05-08T02:00:00',140,'[]','MADAME','TRAN','','','2026-04-15 13:47:36','b13aad76');
INSERT INTO evenementiel VALUES('56f2e2cf','c7317f37','51b6d207','PROFESSIONNEL','','',NULL,'2026-05-08T19:00:00','2026-05-09T02:00:00',400,'[]','','','THEA PHARMA','','2026-04-15 13:49:24','b13aad76');
INSERT INTO evenementiel VALUES('979b3e07','c7317f37','51b6d207','PROFESSIONNEL','','',NULL,'2026-05-21T12:00:00','2026-05-21T16:00:00',300,'[]','','','BANG BANG EVENT','','2026-04-15 13:52:14','b13aad76');
-- ...et toutes les autres instructions INSERT INTO du dump.sql pour chaque table de données...

