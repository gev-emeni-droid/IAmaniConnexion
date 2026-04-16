import db from './database';
const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get('gev-emeni@outlook.fr');
console.log(JSON.stringify(admin));
