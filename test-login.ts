import app from './src/server/app';

async function testLogin() {
    try {
        console.log('Testing /api/login with seeded admin...');
        const res = await app.fetch(new Request('http://localhost/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'gev-emeni@outlook.fr', password: 'Amani2024!' })
        }));
        
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Body:', JSON.stringify(data));
        
        if (res.status === 200 && data.token) {
            console.log('\nTesting /api/me with received token...');
            const resMe = await app.fetch(new Request('http://localhost/api/me', {
                headers: { 'Authorization': `Bearer ${data.token}` }
            }));
            console.log('Me Status:', resMe.status);
            console.log('Me Body:', await resMe.json());

            console.log('\nTesting /api/crm/contacts as admin...');
            const resCrm = await app.fetch(new Request('http://localhost/api/crm/contacts', {
                headers: { 'Authorization': `Bearer ${data.token}` }
            }));
            console.log('CRM Status:', resCrm.status);
            console.log('CRM Body:', await resCrm.json());

            console.log('\nTesting /api/evenementiel as admin...');
            const resEv = await app.fetch(new Request('http://localhost/api/evenementiel', {
                headers: { 'Authorization': `Bearer ${data.token}` }
            }));
            console.log('Evenementiel Status:', resEv.status);
            console.log('Evenementiel Body:', await resEv.json());
        }
    } catch (e) {
        console.error('Test failed:', e);
    }
}
testLogin();
