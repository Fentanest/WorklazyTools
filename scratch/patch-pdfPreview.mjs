import fs from "fs";

let content = fs.readFileSync("src/features/pdf-editor/pdfPreview.ts", "utf-8");

content = content.replace(/import\s*\{\s*featureMessage\s*\}\s*from\s*"[^"]+";/, 'import { featureMessage, featureMessageOrDefault } from "../../i18n/featureMessages";');

content = content.replace(/featureMessage\([^,]+,\s*"pdf\.messages\.pdfPreview\.imageDecodingFailed"\)\s*\?\?\s*(`[^`]+`)/g, '(featureMessageOrDefault(language, "pdf.messages.pdfPreview.imageDecodingFailed", null, $1))');

fs.writeFileSync("src/features/pdf-editor/pdfPreview.ts", content);
