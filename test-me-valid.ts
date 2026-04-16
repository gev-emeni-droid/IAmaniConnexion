import { sign } from 'hono/jwt';
import app from './src/server/app';

const DEFAULT_JWT_SECRET = 'super-secret-key';

async function test() {
    try {
        const payload = { 
            id: "wuf4yjnz9", 
            email: "gev-emeni@outlook.fr", 
            type: "admin",
            clientId: null,
            isTemporary: false,
            exp: Math.floor(Date.now() / 1000) + 60 * 60
        };
        
        const token = await sign(payload, DEFAULT_JWT_SECRET, 'HS256');
        console.log('Token generated');

        const res = await app.fetch(new Request('http://localhost/api/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        }));
        
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Body:', JSON.stringify(data));
    } catch (e) {
        console.error('Test failed:', e);
    }
}
test();
