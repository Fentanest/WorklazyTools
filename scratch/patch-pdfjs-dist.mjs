import fs from "fs";

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let code = fs.readFileSync(filePath, "utf8");
  const target = 'warn(`Unable to decode image "${objId}": "${reason}".`);';
  if (code.includes(target)) {
    code = code.replace(
      target,
      'if (reason?.name === "Jbig2Error" || (reason?.message && reason.message.includes("Jbig2Error"))) { throw reason; }\n      warn(`Unable to decode image "${objId}": "${reason}".`);'
    );
    fs.writeFileSync(filePath, code);
    console.log(`Patched ${filePath}`);
  }
}

patchFile("node_modules/pdfjs-dist/build/pdf.worker.mjs");
patchFile("node_modules/pdfjs-dist/build/pdf.worker.js");
