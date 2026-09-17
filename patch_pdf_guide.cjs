const fs = require('fs');
let content = fs.readFileSync('src/features/pdf-editor/PdfEditorPage.tsx', 'utf8');

// Remove the `guides: ...` type declaration from PdfPageCopy interface
content = content.replace(/\n\s*guides:\s*\{[^}]*\};\n/, '\n');

// Remove the `const guide = ...` line from PdfGuide component
content = content.replace(/\s*const guide = page\.guides\[[^\]]+\];/g, '');

fs.writeFileSync('src/features/pdf-editor/PdfEditorPage.tsx', content);
