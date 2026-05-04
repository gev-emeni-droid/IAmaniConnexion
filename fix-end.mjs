import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('D:/iamani SaaS/src/App.tsx', 'utf8');

// Add the missing </div> before ); at the end
// The current ending is:    </div>\r\n);\r\n}
// We need:    </div>\r\n    </div>\r\n);\r\n}

const oldEnd = '    </div>\r\n);\r\n}';
const newEnd = '    </div>\r\n    </div>\r\n);\r\n}';

if (!content.endsWith(oldEnd)) {
  // Try with just \n
  const oldEndLF = '    </div>\n);\n}';
  const newEndLF = '    </div>\n    </div>\n);\n}';
  if (content.endsWith(oldEndLF)) {
    content = content.slice(0, -oldEndLF.length) + newEndLF;
    writeFileSync('D:/iamani SaaS/src/App.tsx', content, 'utf8');
    console.log('Done (LF)');
  } else {
    console.log('Pattern not found! Last chars:', JSON.stringify(content.slice(-50)));
    process.exit(1);
  }
} else {
  content = content.slice(0, -oldEnd.length) + newEnd;
  writeFileSync('D:/iamani SaaS/src/App.tsx', content, 'utf8');
  console.log('Done (CRLF)');
}
