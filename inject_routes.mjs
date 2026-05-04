import { readFileSync, writeFileSync, statSync } from 'fs';

const p = 'functions/api/[[path]].js';
let c = readFileSync(p, 'utf8');

const marker = '// --- PLANNING ---';
const newRoutes = `
// --- PASSWORD RESET ---
app.post('/admin/clients/:id/reset-password', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Unauthorized' }, 401);
        const id = c.req.param('id');
        const client = await safeFirst(c, 'SELECT id, email, name FROM clients WHERE id = ?', [id]);
        if (!client) return c.json({ error: 'Client not found' }, 404);
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let tempPwd = '';
        for (let i = 0; i < 10; i++) tempPwd += chars[Math.floor(Math.random() * chars.length)];
        await c.env.DB.prepare('UPDATE clients SET password = ?, is_temporary_password = 1 WHERE id = ?').bind(tempPwd, id).run();
        return c.json({ success: true, newPassword: tempPwd, email: client.email });
    } catch (e) { return c.json({ error: 'Erreur reset password' }, 500); }
});

app.post('/admin/clients/:id/force-reset-password', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Unauthorized' }, 401);
        const id = c.req.param('id');
        const client = await safeFirst(c, 'SELECT id, email, name FROM clients WHERE id = ?', [id]);
        if (!client) return c.json({ error: 'Client not found' }, 404);
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let tempPwd = '';
        for (let i = 0; i < 12; i++) tempPwd += chars[Math.floor(Math.random() * chars.length)];
        await c.env.DB.prepare('UPDATE clients SET password = ?, is_temporary_password = 1 WHERE id = ?').bind(tempPwd, id).run();
        return c.json({ success: true, newPassword: tempPwd, email: client.email });
    } catch (e) { return c.json({ error: 'Erreur force reset password' }, 500); }
});

app.post('/admin/clients/:clientId/collaborators/:collabId/reset-password', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Unauthorized' }, 401);
        const clientId = c.req.param('clientId');
        const collabId = c.req.param('collabId');
        const collab = await safeFirst(c, 'SELECT id, email, name FROM collaborators WHERE id = ? AND client_id = ?', [collabId, clientId]);
        if (!collab) return c.json({ error: 'Collaborateur introuvable' }, 404);
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let tempPwd = '';
        for (let i = 0; i < 10; i++) tempPwd += chars[Math.floor(Math.random() * chars.length)];
        await c.env.DB.prepare('UPDATE collaborators SET password = ? WHERE id = ? AND client_id = ?').bind(tempPwd, collabId, clientId).run();
        return c.json({ success: true, newPassword: tempPwd, email: collab.email });
    } catch (e) { return c.json({ error: 'Erreur reset collab password' }, 500); }
});

app.post('/admin/clients/:clientId/collaborators/:collabId/force-reset-password', async (c) => {
    try {
        const user = await getUserFromReq(c);
        if (!user || user.type !== 'admin') return c.json({ error: 'Unauthorized' }, 401);
        const clientId = c.req.param('clientId');
        const collabId = c.req.param('collabId');
        const collab = await safeFirst(c, 'SELECT id, email, name FROM collaborators WHERE id = ? AND client_id = ?', [collabId, clientId]);
        if (!collab) return c.json({ error: 'Collaborateur introuvable' }, 404);
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let tempPwd = '';
        for (let i = 0; i < 12; i++) tempPwd += chars[Math.floor(Math.random() * chars.length)];
        await c.env.DB.prepare('UPDATE collaborators SET password = ? WHERE id = ? AND client_id = ?').bind(tempPwd, collabId, clientId).run();
        return c.json({ success: true, newPassword: tempPwd, email: collab.email });
    } catch (e) { return c.json({ error: 'Erreur force reset collab password' }, 500); }
});

`;

if (!c.includes(marker)) {
    console.error('ERROR: marker not found!');
    process.exit(1);
}

c = c.replace(marker, newRoutes + marker);
writeFileSync(p, c, 'utf8');
console.log('Done. force-reset present:', c.includes('force-reset-password'));
console.log('New size:', statSync(p).size);
