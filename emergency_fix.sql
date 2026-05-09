-- Supprimer les postes temporaires (pos-X)
DELETE FROM job_posts WHERE client_id = 'c7317f37';

-- Restaurer les postes avec leurs IDs ORIGINAUX trouvés dans la table employes
INSERT INTO job_posts (id, client_id, title) VALUES ('c7cf2d36', 'c7317f37', 'ENCADREMENT');
INSERT INTO job_posts (id, client_id, title) VALUES ('5e37f4a8', 'c7317f37', 'BARMAN');
INSERT INTO job_posts (id, client_id, title) VALUES ('9cdc151d', 'c7317f37', 'CHEF DE RANG');
INSERT INTO job_posts (id, client_id, title) VALUES ('ac4995b0', 'c7317f37', 'RUNNER');
INSERT INTO job_posts (id, client_id, title) VALUES ('c0c35e06', 'c7317f37', 'PLAGE / RUNNER');
INSERT INTO job_posts (id, client_id, title) VALUES ('607593c6', 'c7317f37', 'EXTRA 3');
INSERT INTO job_posts (id, client_id, title) VALUES ('ab5d02d1', 'c7317f37', 'APPRENTI');
INSERT INTO job_posts (id, client_id, title) VALUES ('7e08e219', 'c7317f37', 'COMMERCIAL & ADMIN');
INSERT INTO job_posts (id, client_id, title) VALUES ('66813213', 'c7317f37', 'ASSISTANT MANAGERS');
INSERT INTO job_posts (id, client_id, title) VALUES ('ffff996d', 'c7317f37', 'ACCUEIL');

-- Mettre à jour les modèles de planning pour utiliser les vrais IDs
-- (Je vais écraser planning_templates avec les bons role IDs)
-- Note: Je dois mapper les IDs de templates aussi s'ils étaient utilisés dans le passé, 
-- mais l'utilisateur a dit que les données ont été supprimées, donc je repars sur mes IDs de templates (tpl-X) mais liés aux bons roles.

INSERT INTO planning_templates (id, client_id, payload_json) VALUES ('c7317f37', 'c7317f37', '[
  {"id":"tpl-1","name":"Ouverture - 17h00","role":"c7cf2d36","serviceType":"midi","slots":[{"start":"09:00","end":"17:00"}],"color":"#99f6e4"},
  {"id":"tpl-2","name":"Midi","role":"c7cf2d36","serviceType":"midi","slots":[{"start":"11:45","end":"22:00"}],"color":"#60a5fa"},
  {"id":"tpl-3","name":"Fermeture","role":"c7cf2d36","serviceType":"soir","slots":[{"start":"16:30","end":"01:00"}],"color":"#fde047"},
  {"id":"tpl-dir","name":"Direction","role":"c7cf2d36","serviceType":"midi","slots":[{"start":"09:00","end":"18:00"}],"color":"#60a5fa"},
  {"id":"tpl-4","name":"Coupure","role":"607593c6","serviceType":"midi+soir","slots":[{"start":"10:00","end":"15:00"},{"start":"18:30","end":"23:00"}],"color":"#4ade80"},
  {"id":"tpl-5","name":"Midi","role":"607593c6","serviceType":"midi","slots":[{"start":"10:00","end":"18:00"}],"color":"#60a5fa"},
  {"id":"tpl-6","name":"Soir","role":"607593c6","serviceType":"soir","slots":[{"start":"16:30","end":"23:00"}],"color":"#fde047"},
  {"id":"tpl-7","name":"Fermeture","role":"5e37f4a8","serviceType":"soir","slots":[{"start":"17:00","end":"23:30"}],"color":"#fde047"},
  {"id":"tpl-8","name":"Midi","role":"5e37f4a8","serviceType":"midi","slots":[{"start":"10:00","end":"11:00"},{"start":"11:45","end":"17:00"}],"color":"#60a5fa"},
  {"id":"tpl-9","name":"Ouverture-coupure","role":"5e37f4a8","serviceType":"midi+soir","slots":[{"start":"09:00","end":"14:30"},{"start":"18:00","end":"23:30"}],"color":"#4ade80"},
  {"id":"tpl-10","name":"Coupure","role":"5e37f4a8","serviceType":"midi+soir","slots":[{"start":"10:00","end":"14:30"},{"start":"18:00","end":"23:30"}],"color":"#4ade80"},
  {"id":"tpl-11","name":"Coupure","role":"9cdc151d","serviceType":"midi+soir","slots":[{"start":"11:45","end":"15:00"},{"start":"19:00","end":"00:00"}],"color":"#4ade80"},
  {"id":"tpl-12","name":"Fermeture","role":"9cdc151d","serviceType":"soir","slots":[{"start":"17:00","end":"00:00"}],"color":"#fde047"},
  {"id":"tpl-13","name":"Midi","role":"9cdc151d","serviceType":"midi","slots":[{"start":"11:45","end":"18:00"}],"color":"#60a5fa"},
  {"id":"tpl-14","name":"Ouverture","role":"9cdc151d","serviceType":"midi","slots":[{"start":"09:00","end":"17:00"}],"color":"#cbd5e1"},
  {"id":"tpl-11r","name":"Coupure","role":"ac4995b0","serviceType":"midi+soir","slots":[{"start":"11:45","end":"15:00"},{"start":"19:00","end":"00:00"}],"color":"#4ade80"},
  {"id":"tpl-12r","name":"Fermeture","role":"ac4995b0","serviceType":"soir","slots":[{"start":"17:00","end":"00:00"}],"color":"#fde047"},
  {"id":"tpl-13r","name":"Midi","role":"ac4995b0","serviceType":"midi","slots":[{"start":"11:45","end":"18:00"}],"color":"#60a5fa"},
  {"id":"tpl-14r","name":"Ouverture","role":"ac4995b0","serviceType":"midi","slots":[{"start":"09:00","end":"17:00"}],"color":"#cbd5e1"},
  {"id":"tpl-15","name":"Week-end","role":"c0c35e06","serviceType":"midi+soir","slots":[{"start":"13:00","end":"18:30"},{"start":"19:00","end":"00:30"}],"color":"#fde047"},
  {"id":"tpl-16","name":"Semaine","role":"c0c35e06","serviceType":"midi+soir","slots":[{"start":"15:00","end":"18:30"},{"start":"19:00","end":"00:30"}],"color":"#fde047"}
]') ON CONFLICT(id) DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = CURRENT_TIMESTAMP;

-- Mettre à jour l''ordre des rôles
INSERT INTO planning_settings (client_id, payload_json) VALUES ('c7317f37', '{"rolesOrder":["c7cf2d36","607593c6","5e37f4a8","9cdc151d","ac4995b0","c0c35e06","ab5d02d1"]}') ON CONFLICT(client_id) DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = CURRENT_TIMESTAMP;
