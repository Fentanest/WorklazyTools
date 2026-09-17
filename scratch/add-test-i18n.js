const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts['test:i18n'] = 'node scripts/validate-i18n.mjs';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
