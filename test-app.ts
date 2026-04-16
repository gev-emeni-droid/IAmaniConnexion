import app from './src/server/app';

async function test() {
    try {
        console.log('Testing /api/health...');
        const resHealth = await app.fetch(new Request('http://localhost/api/health'));
        console.log('Health Status:', resHealth.status);
        console.log('Health Body:', await resHealth.json());

        console.log('\nTesting /api/me with invalid token...');
        const resMe = await app.fetch(new Request('http://localhost/api/me', {
            headers: { 'Authorization': 'Bearer invalid-token' }
        }));
        console.log('Me Status:', resMe.status);
        console.log('Me Body:', await resMe.json());

        console.log('\nTesting /api/login with invalid credentials...');
        const resLogin = await app.fetch(new Request('http://localhost/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nonexistent@example.com', password: 'wrong' })
        }));
        console.log('Login Status:', resLogin.status);
        console.log('Login Body:', await resLogin.json());
    } catch (e) {
        console.error('Test failed:', e);
    }
}
test();
