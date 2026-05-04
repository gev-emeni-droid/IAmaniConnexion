import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('D:/iamani SaaS/src/App.tsx', 'utf8');

const commentStr = '                                {/* Si tu veux afficher Accès modules ici, déplace ce bloc dans la bonne section ou retire-le */}';
const gridStr = '                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">';

const commentStart = content.indexOf(commentStr);
if (commentStart === -1) { console.log('Comment not found'); process.exit(1); }

const gridStart = content.indexOf(gridStr, commentStart);
if (gridStart === -1) { console.log('Grid not found'); process.exit(1); }

const endOfGrid = gridStart + gridStr.length;
const oldPart = content.substring(commentStart, endOfGrid);

const newPart = `                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">`;

content = content.substring(0, commentStart) + newPart + content.substring(endOfGrid);
writeFileSync('D:/iamani SaaS/src/App.tsx', content, 'utf8');
console.log('Done! Fixed Contact gestionnaire section.');
