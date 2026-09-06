import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Faults live on the server: browser interception would disable HTTP caching.
export async function startRecoveryServer({ root = "dist", port = 0, fault = "", asset = "AudioStudioPage-" } = {}) {
  const state = { root: path.resolve(root), htmlRoot: null, fault, asset, remaining: Infinity, delay: 0, transform: null, requests: [] };
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const record = { time: new Date().toISOString(), pathname, root: state.root, destination: request.headers["sec-fetch-dest"], cacheControl: request.headers["cache-control"] };
    state.requests.push(record);
    try {
      let file = path.resolve(state.root, `.${pathname}`);
      if (!file.startsWith(`${state.root}/`) && file !== state.root) throw new Error("Outside distribution");
      let stat = await fs.stat(file).catch(() => null);
      if (stat?.isDirectory()) {
        if (!pathname.endsWith("/")) {
          record.status = 301;
          response.writeHead(301, { Location: `${pathname}/${new URL(request.url, "http://localhost").search}` });
          response.end();
          return;
        }
        file = path.join(file, "index.html");
        stat = await fs.stat(file).catch(() => null);
      }
      const isHtml = file.endsWith(".html") || request.headers["sec-fetch-dest"] === "document";
      if (isHtml && state.htmlRoot) file = path.join(state.htmlRoot, path.relative(state.root, file));
      const match = pathname.includes(state.asset) && pathname.endsWith(".js") && state.remaining > 0;
      if (match) {
        state.remaining--;
        if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
        if (state.fault === "disconnect") { record.status = "disconnected"; response.destroy(); return; }
      }
      record.status = !stat?.isFile() || (match && state.fault === "404") ? 404 : 200;
      let body = record.status === 404
        ? isHtml ? await fs.readFile(path.join(state.htmlRoot || state.root, "404.html")) : Buffer.from("Unavailable")
        : await fs.readFile(file);
      if (record.status === 200 && state.transform) body = Buffer.from(await state.transform(pathname, body.toString(), body));
      const headers = { "Content-Type": isHtml ? "text/html; charset=utf-8" : contentType(file), "Cache-Control": "max-age=600", "Content-Length": body.length, Age: "0" };
      record.bytes = body.length;
      record.responseHeaders = headers;
      response.writeHead(record.status, headers);
      response.end(body);
    } catch (error) {
      record.status = 500;
      record.error = String(error);
      response.writeHead(500); response.end("Unavailable");
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return { state, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }) };
}

function contentType(file) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" })[path.extname(file)] || "application/octet-stream";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startRecoveryServer({ root: process.env.RECOVERY_DIST || "dist", port: Number(process.env.PORT || 4188), fault: process.env.RECOVERY_FAULT || "", asset: process.env.RECOVERY_ASSET || "AudioStudioPage-" });
  console.log(`Recovery preview: ${server.url} (${server.state.fault || "normal"}, ${server.state.asset})`);
}
