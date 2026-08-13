import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const publicVendorRoot = path.join(projectRoot, "public", "vendor");

await copyPyodide();
await copyTesseract();

async function copyPyodide() {
  const source = path.join(projectRoot, "node_modules", "pyodide");
  const destination = path.join(publicVendorRoot, "pyodide", "0.29.4");
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  await Promise.all([
    "pyodide-lock.json",
    "pyodide.asm.js",
    "pyodide.asm.wasm",
    "pyodide.mjs",
    "python_stdlib.zip",
  ].map((fileName) => fs.copyFile(path.join(source, fileName), path.join(destination, fileName))));
}

async function copyTesseract() {
  const destination = path.join(publicVendorRoot, "tesseract", "7.0.0");
  const coreSource = path.join(projectRoot, "node_modules", "tesseract.js-core");
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.join(destination, "core"), { recursive: true });
  await fs.mkdir(path.join(destination, "lang"), { recursive: true });

  await fs.copyFile(
    path.join(projectRoot, "node_modules", "tesseract.js", "dist", "worker.min.js"),
    path.join(destination, "worker.min.js"),
  );
  const coreFiles = (await fs.readdir(coreSource)).filter((fileName) => /^tesseract-core.*\.wasm\.js$/.test(fileName));
  await Promise.all(coreFiles.map((fileName) => fs.copyFile(path.join(coreSource, fileName), path.join(destination, "core", fileName))));
  await Promise.all(["eng", "kor"].map((language) => fs.copyFile(
    path.join(projectRoot, "node_modules", "@tesseract.js-data", language, "4.0.0_best_int", `${language}.traineddata.gz`),
    path.join(destination, "lang", `${language}.traineddata.gz`),
  )));
}
