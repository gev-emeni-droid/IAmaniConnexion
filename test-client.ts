import app from './src/server/app';
import { sign } from 'hono/jwt';

const DEFAULT_JWT_SECRET = 'super-secret-key';

async function testClient() {
    try {
        console.log('Logging in as admin to create client...');
        const resLoginAdmin = await app.fetch(new Request('http://localhost/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'gev-emeni@outlook.fr', password: 'Amani2024!' })
        }));
        const adminData = await resLoginAdmin.json();
        const adminToken = adminData.token;

        console.log('\nCreating a new client...');
        const resCreate = await app.fetch(new Request('http://localhost/api/admin/clients', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ 
                name: 'Test Client', 
                email: 'client@test.com',
                modules: ['planning', 'evenementiel', 'crm']
            })
        }));
        const createData = await resCreate.json();
        console.log('Create Status:', resCreate.status);
        console.log('Create Body:', JSON.stringify(createData));

        if (resCreate.status === 200) {
            console.log('\nLogging in as client...');
            const resLoginClient = await app.fetch(new Request('http://localhost/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'client@test.com', password: createData.tempPassword })
            }));
            const clientData = await resLoginClient.json();
            const clientToken = clientData.token;
            console.log('Client Login Status:', resLoginClient.status);

            console.log('\nTesting /api/crm/contacts as client...');
            const resCrm = await app.fetch(new Request('http://localhost/api/crm/contacts', {
                headers: { 'Authorization': `Bearer ${clientToken}` }
            }));
            console.log('CRM Status:', resCrm.status);
            console.log('CRM Body:', await resCrm.json());

            console.log('\nTesting /api/facture as client (not active)...');
            const resFacture = await app.fetch(new Request('http://localhost/api/facture', {
                headers: { 'Authorization': `Bearer ${clientToken}` }
            }));
            console.log('Facture Status:', resFacture.status);
            console.log('Facture Body:', await resFacture.json());
        }
    } catch (e) {
        console.error('Test failed:', e);
    }
}
testClient();
