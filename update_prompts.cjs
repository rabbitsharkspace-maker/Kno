const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');
code = code.replace(/contents: prompt,/g, 'contents: prompt + `\\n\\nRespond entirely in ${getSystemLanguage()}.`,');
code = code.replace(/contents: prompt\n\s*}\)\);/g, 'contents: prompt + `\\n\\nRespond entirely in ${getSystemLanguage()}.`\n        }));');
fs.writeFileSync('services/geminiService.ts', code);
console.log('Done');
