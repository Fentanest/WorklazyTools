import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

// BentoPDF's checked-in public WASM files match its asset-introduction lock at
// @matbee/libreoffice-converter 2.3.1, even though its later HEAD lock advanced.
// Keep browser API, Worker, JS, WASM and data from that same actual build.
const VERSION = "2.3.1";
const assets = [
  ["wasm/soffice.js", "ec4925ebc12832e7da56fe406a4a804265e58dfcb2c9cdcf5a3790c20ff8aad2"],
  ["wasm/soffice.worker.js", "458bc142e7f837baf44a2d186a0b65b0a11ece760e5dab79ebca2789c9feeef5"],
  ["dist/browser.worker.global.js", "9fffabd06765f4915ff20e2a659bd7d47db26c11509ceb3291d801502576c86e"],
  ["wasm/soffice.wasm", "2d23fd5845e169e16e3979db37ba11aefa77e474c6db38815531800a63a3c5d5"],
  ["wasm/soffice.data", "c837ad74b017f5226eb5d027f7c2dcbff913eea2eb762e875f875ca992f57a3e"],
];
const workerPingAnchor = 'self.onmessage=async l=>{let e=l.data;switch(e.type){case "init":';
const workerPingReplacement = 'self.onmessage=async l=>{let e=l.data;switch(e.type){case "worklazy-ping":self.postMessage({type:"ready",id:e.id});break;case "init":';
const moduleStartAnchor = 'self.Module={mainScriptUrlOrBlob:e';
const moduleStartReplacement = 'self.__worklazyFont=await(async()=>{const r=await fetch(new URL("NanumGothic-Regular.ttf",e));if(!r.ok)throw new Error("Office font download failed");const b=new Uint8Array(await r.arrayBuffer());if(b.byteLength!==2054744)throw new Error("Office font size mismatch");return b})(),self.Module={noInitialRun:!0,preRun:[()=>{for(const d of ["/instdir","/instdir/share","/instdir/share/fonts","/instdir/share/fonts/truetype"])try{self.Module.FS.mkdir(d)}catch{}self.Module.FS.writeFile("/instdir/share/fonts/truetype/NanumGothic-Regular.ttf",self.__worklazyFont)}],mainScriptUrlOrBlob:e';
const patchedWorkerSha256 = "9396e0969f4d37001f00bbff6957aa9009e623a1c1e51d99707cdeb548dda999";
const fontSha256 = "76f45ef4a6bcff344c837c95a7dcc26e017e38b5846d5ae0cdcb5b86be2e2d31";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const source = path.join(root, "node_modules", "@matbee", "libreoffice-converter");
const packageInfo = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
if (packageInfo.version !== VERSION) throw new Error(`LibreOffice converter version mismatch: ${packageInfo.version}`);
const destination = path.join(root, "public", "vendor", "libreoffice-converter", VERSION);
const staging = `${destination}.staging-${process.pid}`;
await fs.rm(staging, { recursive: true, force: true });
await fs.mkdir(staging, { recursive: true });
try {
  for (const [relative, expected] of assets) {
    const input = path.join(source, relative);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(input)) hash.update(chunk);
    if (hash.digest("hex") !== expected) throw new Error(`LibreOffice asset mismatch: ${relative}`);
    const name = path.basename(relative);
    if (name.endsWith(".wasm") || name.endsWith(".data")) {
      await pipeline(createReadStream(input), createGzip({ level: 9, mtime: 0 }), createWriteStream(path.join(staging, `${name}.gz`)));
    } else if (name === "browser.worker.global.js") {
      const original = await fs.readFile(input, "utf8");
      if (original.split(workerPingAnchor).length !== 2) throw new Error("LibreOffice worker cleanup probe anchor changed");
      if (original.split(moduleStartAnchor).length !== 2) throw new Error("LibreOffice module startup anchor changed");
      // Fetch the fixed TTF before importScripts; preRun installs it before
      // LibreOffice main/LOK/fontconfig. noInitialRun prevents a second native
      // main from racing LOK while the font is scanned.
      const patched = original.replace(workerPingAnchor, workerPingReplacement)
        .replace(moduleStartAnchor, moduleStartReplacement);
      if (createHash("sha256").update(patched).digest("hex") !== patchedWorkerSha256) throw new Error("LibreOffice worker cleanup probe hash mismatch");
      await fs.writeFile(path.join(staging, name), patched);
    } else {
      await fs.copyFile(input, path.join(staging, name));
    }
  }
  // The existing pinned font snapshot is generated before this converter step.
  // Only its TTF is copied; the Bento runtime never loads another Office engine.
  const fontSource = path.join(root, "public", "vendor", "zetaoffice", "2026-10-07", "NanumGothic-Regular.ttf");
  const fontBytes = await fs.readFile(fontSource);
  if (fontBytes.length !== 2054744 || createHash("sha256").update(fontBytes).digest("hex") !== fontSha256) {
    throw new Error("Office font snapshot mismatch");
  }
  await fs.writeFile(path.join(staging, "NanumGothic-Regular.ttf"), fontBytes);
  await fs.writeFile(path.join(staging, "manifest.json"), `${JSON.stringify({ version: VERSION, package: "@matbee/libreoffice-converter", upstreamCommit: "b94b8a6887d223be93b082543f5fd32bbd8dc646", sourceSha256: Object.fromEntries(assets), workerPatch: { fontPreRun: true, noInitialRun: true, cleanupProbe: "worklazy-ping", outputSha256: patchedWorkerSha256 }, font: { name: "NanumGothic-Regular.ttf", sha256: fontSha256 } }, null, 2)}\n`);
  await fs.rm(destination, { recursive: true, force: true });
  await fs.rename(staging, destination);
} catch (error) {
  await fs.rm(staging, { recursive: true, force: true });
  throw error;
}
