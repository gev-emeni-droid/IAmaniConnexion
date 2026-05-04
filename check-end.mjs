import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('D:/iamani SaaS/src/App.tsx', 'utf8');

// Check last 200 chars
const last = content.substring(content.length - 200);
console.log('Last 200 chars hex-visible:');
for (let i = 0; i < last.length; i++) {
  const ch = last[i];
  if (ch === '\r') process.stdout.write('\\r');
  else if (ch === '\n') process.stdout.write('\\n\n');
  else process.stdout.write(ch);
}
console.log('\n---');
console.log('Last 5 chars codes:', [...last.slice(-5)].map(c => c.charCodeAt(0)));
