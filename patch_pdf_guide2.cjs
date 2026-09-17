const fs = require('fs');
let content = fs.readFileSync('src/features/pdf-editor/PdfEditorPage.tsx', 'utf8');

// Remove PdfGuideCopy interface
content = content.replace(/interface PdfGuideCopy \{[^}]*\};\n\}\n/m, '');

fs.writeFileSync('src/features/pdf-editor/PdfEditorPage.tsx', content);
