import { readFileSync } from 'fs';
const c = readFileSync('D:/iamani SaaS/functions/api/[[path]].js', 'utf8');
const matches = [...c.matchAll(/\.(get|post|put|patch|delete)\s*\(['"`]([^'"`]*collaborator[^'"`]*)['"`]/g)];
matches.forEach(m => console.log(m[1].toUpperCase(), m[2]));
// Also check routes in server/app.ts
const s = readFileSync('D:/iamani SaaS/src/server/app.ts', 'utf8');
const sm = [...s.matchAll(/\.(get|post|put|patch|delete)\s*\(['"`]([^'"`]*collaborator[^'"`]*)['"`]/g)];
console.log('\n--- server/app.ts ---');
sm.forEach(m => console.log(m[1].toUpperCase(), m[2]));
