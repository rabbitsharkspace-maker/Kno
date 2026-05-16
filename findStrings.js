const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'components');
const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const content = fs.readFileSync(path.join(targetDir, file), 'utf-8');
    const lines = content.split('\n');
    let inJSX = 0;
    
    // Quick regex to find exact matches of common English text that isn't wrapped in t()
    const found = [];
    const ignoreList = ['Kno', 'App', 'div', 'span', 'button', 'input'];
    
    for (let i = 0; i<lines.length; i++) {
        const line = lines[i];
        
        // Find placeholders
        let match = line.match(/placeholder="([^"]+)"/);
        if (match) {
            found.push(`Line ${i+1}: placeholder="${match[1]}"`);
        }
        
        // Find basic JSX text elements: >text<
        // This regex is very crude but should spot obvious ones
        const innerTexts = line.match(/>\s*([A-Z][a-z0-9\s,'.-]+)\s*</g);
        if (innerTexts) {
            for (let t of innerTexts) {
                let text = t.substring(1, t.length-1).trim();
                // ignore if very short or in ignore list
                if (text.length > 2 && !ignoreList.includes(text) && !text.includes('className') && !text.includes('/>') ) {
                    found.push(`Line ${i+1}: >${text}<`);
                }
            }
        }
    }
    
    if (found.length > 0) {
        console.log(`\n--- ${file} ---`);
        console.log(found.slice(0, 15).join('\n'));
    }
}
