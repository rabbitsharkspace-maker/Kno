const fs = require('fs');
const execSync = require('child_process').execSync;

// Run tsc to get errors
try {
    execSync('npx tsc --noEmit', { encoding: 'utf8' });
} catch (e) {
    const output = e.stdout || '';
    const lines = output.split('\n');
    
    const fileErrors = {};
    
    lines.forEach(line => {
        const match = line.match(/^([^:]+)\(\d+,\d+\): error TS6133: '([^']+)' is declared but its value is never read\./);
        if (match) {
            const file = match[1];
            const variable = match[2];
            if (!fileErrors[file]) fileErrors[file] = [];
            fileErrors[file].push(variable);
        }
    });

    for (const file in fileErrors) {
        let content = fs.readFileSync(file, 'utf8');
        const vars = fileErrors[file];
        
        vars.forEach(v => {
            // Try to remove from imports: `v, ` or `, v` or `{ v }`
            const importRegex1 = new RegExp(`\\b${v}\\s*,\\s*`, 'g');
            content = content.replace(importRegex1, '');
            const importRegex2 = new RegExp(`,\\s*\\b${v}\\b`, 'g');
            content = content.replace(importRegex2, '');
            const importRegex3 = new RegExp(`\\{\\s*\\b${v}\\b\\s*\\}`, 'g');
            content = content.replace(importRegex3, '{}');
            
            // Try to remove from interface/type destructured props
            const propRegex1 = new RegExp(`\\b${v}\\s*,\\s*`, 'g');
            content = content.replace(propRegex1, '');
            const propRegex2 = new RegExp(`,\\s*\\b${v}\\b`, 'g');
            content = content.replace(propRegex2, '');
        });
        
        // Clean up empty imports
        content = content.replace(/import\s*\{\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
        
        fs.writeFileSync(file, content, 'utf8');
    }
    console.log("Cleaned up unused variables.");
}
