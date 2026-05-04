const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components/SettingsModal.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Regex to find className={...} or className="..."
// We target the content inside carefully.
// Actually, global replace of ` - ` with `-` inside specific lines might be enough if we target lines starting with `className`.

// FIX 1: Remove spaces around hyphens in class strings
// We look for patterns like "text - sm", "px - 6", "border - b"
// Pattern: "word space - space word"
content = content.replace(/([a-z0-9])\s+-\s+([a-z0-9])/gi, '$1-$2');

// FIX 2: Remove spaces around colons (hover: scale)
// Pattern: "word : space word"
content = content.replace(/([a-z0-9]):\s+([a-z0-9])/gi, '$1:$2');

// FIX 3: Remove spaces around brackets (text - [10px])
// Pattern: "- [", "- ]" ? No, usually "text-[10px]"
// Corrupted: "text - [10px]"
content = content.replace(/([a-z0-9])\s+-\s+\[/gi, '$1-[');

// Fix "rounded - full" -> "rounded-full" (Covered by FIX 1)

// FIX 4: Special case for "hover: bg" -> "hover:bg" (Covered by FIX 2?)
// "hover: bg" -> "hover:bg"

// Fix "border - 2" -> "border-2" (Covered by FIX 1)

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed SettingsModal.tsx');
