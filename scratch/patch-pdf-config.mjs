import fs from "fs";

let content = fs.readFileSync("src/features/pdf-editor/pdfConfig.ts", "utf-8");

// We need to remove the global console.warn interception
// and just run the function directly.
content = content.replace(
  /export async function withImageDecodeCheck[\s\S]+?\}\n\}/,
  'export async function withImageDecodeCheck<T>(fn: () => Promise<T>): Promise<{ result: T; failedImages: string[] }> {\n  try {\n    const result = await fn();\n    return { result, failedImages: [] };\n  } catch (error) {\n    if (error instanceof Error && (error.name === "Jbig2Error" || error.message.includes("Jbig2Error") || error.message.includes("decode"))) {\n      return { result: null as any, failedImages: ["dependent-image"] };\n    }\n    throw error;\n  }\n}'
);

fs.writeFileSync("src/features/pdf-editor/pdfConfig.ts", content);
