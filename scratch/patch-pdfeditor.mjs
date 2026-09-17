import fs from "fs";

let content = fs.readFileSync("src/features/pdf-editor/PdfEditorPage.tsx", "utf-8");

content = content.replace(/import\s*\{\s*ToolGuide\s*\}\s*from\s*"[^"]+ToolGuide";/, 'import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";');

content = content.replace(/<ToolGuide\s+title=\{guide\.title\}\s+description=\{guide\.description\}\s+blocks=\{guide\.blocks\}\s+faq=\{guide\.faq\}\s*\/>/, '<ToolGuideWrapper slug={mode === "convert" ? "pdfEditor.convert" : "pdfEditor.standard"} />');

fs.writeFileSync("src/features/pdf-editor/PdfEditorPage.tsx", content);
