import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('D:/iamani SaaS/src/App.tsx', 'utf8');

// Remove the extra </div> added by fix-end.mjs
const oldEnd = '    </div>\r\n    </div>\r\n);\r\n}';
const newEnd = '    </div>\r\n);\r\n}';

if (content.endsWith(oldEnd)) {
  content = content.slice(0, -oldEnd.length) + newEnd;
  writeFileSync('D:/iamani SaaS/src/App.tsx', content, 'utf8');
  console.log('Done: removed extra </div>');
} else {
  console.log('Pattern not found');
  process.exit(1);
}
