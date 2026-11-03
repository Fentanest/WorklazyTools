import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { startOwnedPreview, stopOwnedPreview } from "../helpers/owned-preview.mjs";

async function listen(server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as { port: number }).port;
}
async function freePort() {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
async function fixture(t, config = "export default {};") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "owned-preview-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const outDir = path.join(root, "custom-dist");
  await fs.mkdir(outDir);
  await fs.writeFile(path.join(outDir, "index.html"), "<html>owned preview fixture</html>");
  await fs.writeFile(path.join(root, "vite.config.mjs"), config);
  return { repositoryRoot: root, outDir, port: await freePort() };
}

test("owned preview rejects an existing HTTP 200 server and leaves it alive", async () => {
  let requests = 0;
  const foreign = http.createServer((_request, response) => { requests++; response.end("foreign build"); });
  const port = await listen(foreign);
  try {
    await assert.rejects(startOwnedPreview({ repositoryRoot: process.cwd(), port }), /port .*unavailable: EADDRINUSE/);
    assert.equal(requests, 0, "must fail before polling the unrelated server");
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), "foreign build");
  } finally { await new Promise<void>((resolve) => foreign.close(() => resolve())); }
});

test("owned preview verifies the child PID, port and fresh token over HTTP; custom dist and headers survive", async (t) => {
  const options = await fixture(t, 'export default { preview: { headers: { "X-Harness-Fixture": "preserved" } } };');
  const tokens = new Set();
  for (let run = 0; run < 2; run++) {
    const child = await startOwnedPreview(options);
    try {
      const response = await fetch(`http://127.0.0.1:${options.port}`);
      assert.equal(await response.text(), "<html>owned preview fixture</html>");
      assert.equal(response.headers.get("x-harness-fixture"), "preserved");
      // The token is passed only to this child, not written into dist/config.
      const { token } = JSON.parse(child.spawnargs.at(-1));
      tokens.add(token);
      const identity = await (await fetch(`http://127.0.0.1:${options.port}/__harness_preview_identity/${token}`)).json();
      assert.deepEqual(identity, { token, pid: child.pid, port: options.port });
    } finally { await stopOwnedPreview(child); }
    assert.notEqual(child.exitCode ?? child.signalCode, null);
  }
  assert.equal(tokens.size, 2);
});

test("owned preview rejects a port stolen after preflight without falling back", async (t) => {
  const options = await fixture(t);
  await fs.writeFile(path.join(options.repositoryRoot, "vite.config.mjs"), `
    import http from "node:http";
    const other = http.createServer((_req, res) => res.end("racing foreign build"));
    await new Promise(resolve => other.listen(${options.port}, "127.0.0.1", resolve));
    export default {};
  `);
  await assert.rejects(startOwnedPreview(options), /exited early.*Port .* is already in use/s);
  const next = http.createServer();
  await new Promise<void>((resolve, reject) => { next.once("error", reject); next.listen(options.port, "127.0.0.1", resolve); });
  await new Promise<void>((resolve) => next.close(() => resolve()));
});

test("owned preview rejects a mismatched HTTP identity and releases its child port", async (t) => {
  const options = await fixture(t, `export default { plugins: [{ name: "wrong-identity", enforce: "pre",
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => {
      if (!req.url.startsWith("/__harness_preview_identity/")) return next();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ token: "stale", pid: process.pid, port: 1 }));
    }); }
  }] };`);
  await assert.rejects(startOwnedPreview(options), /HTTP identity mismatch/);
  await fs.writeFile(path.join(options.repositoryRoot, "vite.config.mjs"), "export default {};\n");
  const child = await startOwnedPreview(options);
  await stopOwnedPreview(child);
});

test("owned preview bounds startup waits and handles child startup failure", async (t) => {
  const options = await fixture(t, "await new Promise(resolve => setTimeout(resolve, 30_000)); export default {};");
  await assert.rejects(startOwnedPreview({ ...options, timeoutMs: 500 }), /Timed out/);
  await fs.writeFile(path.join(options.repositoryRoot, "vite.config.mjs"), 'throw new Error("controlled startup failure");');
  await assert.rejects(startOwnedPreview(options), /exited early.*controlled startup failure/s);
  await assert.rejects(startOwnedPreview({ ...options, repositoryRoot: path.join(options.repositoryRoot, "missing") }), /ENOENT/);
});

test("owned preview rejects a forged listening receipt before accepting HTTP readiness", async (t) => {
  const options = await fixture(t, 'process.send({ type: "listening", pid: process.pid, port: 1, token: "stale", host: "127.0.0.1" }); export default {};');
  await assert.rejects(startOwnedPreview(options), /child listening identity mismatch/);
});

test("owned preview aborts stalled identity responses and cleans up the child", async (t) => {
  const options = await fixture(t, `export default { plugins: [{ name: "stalled-identity", enforce: "pre",
    configurePreviewServer(server) { server.middlewares.use((req, _res, next) => {
      if (!req.url.startsWith("/__harness_preview_identity/")) next();
    }); }
  }] };`);
  await assert.rejects(startOwnedPreview({ ...options, timeoutMs: 1_500 }), /Timed out/);
  await fs.writeFile(path.join(options.repositoryRoot, "vite.config.mjs"), "export default {};\n");
  const child = await startOwnedPreview(options);
  await stopOwnedPreview(child);
});

test("both target harnesses delegate readiness and cleanup to the owned preview helper", async () => {
  const foreign = http.createServer((_request, response) => response.end("foreign build"));
  const port = await listen(foreign);
  try {
    for (const name of ["pdf-finish-smoke.mjs", "accessibility-audit.mjs"]) {
      const source = await fs.readFile(new URL(`../${name}`, import.meta.url), "utf8");
      const start = source.match(/async function startPreview\(\) \{[\s\S]*?\n\}/)?.[0];
      assert.ok(start);
      assert.match(source, /await stopOwnedPreview\(child\)/);
      assert.doesNotMatch(source, /spawn\(/);
      await assert.rejects(vm.runInNewContext(`${start}; startPreview();`, {
        startOwnedPreview, repositoryRoot: process.cwd(), port, distDirectory: "unused-on-occupied-port",
      }), /unavailable: EADDRINUSE/);
      assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), "foreign build");
    }
  } finally { await new Promise<void>((resolve) => foreign.close(() => resolve())); }
});

test("browser smoke executes and reports only completed scopes, including PDF only", async () => {
  const source = await fs.readFile(new URL("../browser-smoke.mjs", import.meta.url), "utf8");
  const dispatch = source.slice(source.indexOf('    if (process.env.TEST_SCOPE === "pdf")'), source.indexOf('    if (pageErrors.length)'));
  const guards = source.slice(source.indexOf('    if (pageErrors.length)'), source.indexOf("  } finally {"));
  const summary = source.match(/^  console\.log\(`Browser smoke tests passed:.*$/m)?.[0];
  assert.ok(summary);
  const cases = [
    ["pdf", ["testPdfTools"], "PDF edit/range split and PDF conversion"],
    ["excel", ["testEncryptedExcelMerge", "testExcelThemeColors", "testFormulaTranslation", "testExcelSheetSelection", "testExcelSheetGridLayout", "testExcelSheetTrim"], "Excel"],
    ["word", ["testWordCompare"], "Word comparison"],
    [undefined, ["testEncryptedExcelMerge", "testExcelThemeColors", "testFormulaTranslation", "testExcelSheetSelection", "testExcelSheetGridLayout", "testExcelSheetTrim", "testWordCompare", "testPdfTools"], "Excel, Word comparison, PDF edit/range split and PDF conversion"],
  ];
  for (const [scope, expectedCalls, expectedText] of cases) {
    const calls = [];
    const logs = [];
    const context = { process: { env: { TEST_SCOPE: scope } }, completedScopes: [], page: {}, fixtures: {}, tempDir: "", pageErrors: [], outboundWrites: [], console: { log: (line) => logs.push(line) } };
    for (const name of cases[3][1]) context[name] = async () => { calls.push(name); };
    const run = () => vm.runInNewContext(`(async () => { ${dispatch}\n${guards}\n${summary} })()`, context);
    await run();
    assert.deepEqual(calls, expectedCalls);
    assert.deepEqual(logs, [`Browser smoke tests passed: ${expectedText}.`]);
    logs.length = 0;
    context.pageErrors.push("controlled browser error");
    await assert.rejects(run(), /controlled browser error/);
    assert.deepEqual(logs, []);
  }
});

test("owned dev preserves fixture URLs, config headers, child env and the HMR client; close releases the listener", async (t) => {
  const options = await fixture(t, 'export default { server: { headers: { "X-Harness-Fixture": "dev-preserved", "X-Child-Env": process.env.HARNESS_DEV_MARKER } } };');
  await fs.mkdir(path.join(options.repositoryRoot, "tests"));
  await fs.writeFile(path.join(options.repositoryRoot, "index.html"), "<html>dev root</html>");
  await fs.writeFile(path.join(options.repositoryRoot, "tests/fixture.html"), "<html>dev fixture</html>");
  const child = await startOwnedPreview({ ...options, mode: "dev", readinessPath: "/tests/fixture.html", env: { HARNESS_DEV_MARKER: "preserved" } });
  try {
    const base = `http://127.0.0.1:${options.port}`;
    const response = await fetch(`${base}/tests/fixture.html`);
    assert.equal(response.headers.get("x-harness-fixture"), "dev-preserved");
    assert.equal(response.headers.get("x-child-env"), "preserved");
    assert.match(await response.text(), /dev fixture/);
    const client = await fetch(`${base}/@vite/client`);
    assert.equal(client.status, 200);
    assert.match(await client.text(), /WebSocket/);
    const socket = new WebSocket(base.replace("http:", "ws:"), "vite-hmr");
    try {
      const connected = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("HMR WebSocket did not connect")), 5_000);
        socket.addEventListener("message", (event) => { clearTimeout(timer); resolve(JSON.parse(String(event.data))); }, { once: true });
        socket.addEventListener("error", (error) => { clearTimeout(timer); reject(error); }, { once: true });
      });
      assert.deepEqual(connected, { type: "connected" });
    } finally { socket.close(); }

    const { token } = JSON.parse(child.spawnargs.at(-1));
    assert.deepEqual(await (await fetch(`${base}/__harness_preview_identity/${token}`)).json(), { token, pid: child.pid, port: options.port });
  } finally { await stopOwnedPreview(child); }
  const next = http.createServer();
  await new Promise<void>((resolve, reject) => { next.once("error", reject); next.listen(options.port, "127.0.0.1", resolve); });
  await new Promise<void>((resolve) => next.close(() => resolve()));
});

test("owned dev rejects foreign listeners, wrong identities, missing fixtures and post-preflight port theft", async (t) => {
  const foreign = http.createServer((_req, res) => res.end("foreign"));
  const port = await listen(foreign);
  try {
    await assert.rejects(startOwnedPreview({ repositoryRoot: process.cwd(), port, mode: "dev" }), /EADDRINUSE/);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), "foreign");
  } finally { await new Promise<void>((resolve) => foreign.close(() => resolve())); }
  const options = await fixture(t, `export default { plugins: [{ name: "wrong-dev-identity", enforce: "pre",
    configureServer(server) { server.middlewares.use((req, res, next) => {
      if (!req.url.startsWith("/__harness_preview_identity/")) return next();
      res.setHeader("Content-Type", "application/json"); res.end('{"token":"wrong"}');
    }); }
  }] };`);
  await assert.rejects(startOwnedPreview({ ...options, mode: "dev" }), /HTTP identity mismatch/);
  await fs.writeFile(path.join(options.repositoryRoot, "vite.config.mjs"), 'export default { appType: "mpa" };');
  await assert.rejects(startOwnedPreview({ ...options, mode: "dev", readinessPath: "/missing-fixture.html" }), /HTTP 404/);
  await fs.writeFile(path.join(options.repositoryRoot, "vite.config.mjs"), `
    import http from "node:http";
    const other = http.createServer((_req, res) => res.end("racing foreign"));
    await new Promise(resolve => other.listen(${options.port}, "127.0.0.1", resolve));
    export default {};
  `);
  await assert.rejects(startOwnedPreview({ ...options, mode: "dev" }), /exited early.*Port .* is already in use/s);
});

test("all 22 consumers start their real lifecycle functions with owned preview/dev identity and await cleanup", async (t) => {
  const { consumerLifecycle, ownedServerConsumers } = await import("../helpers/owned-server-consumers.mjs");
  const options = await fixture(t);
  await fs.writeFile(path.join(options.repositoryRoot, "index.html"), "<html>dev fixture</html>");
  await fs.mkdir(path.join(options.repositoryRoot, "tests"));
  await fs.writeFile(path.join(options.repositoryRoot, "tests/ui-primitives-fixture.html"), "<html>UI fixture</html>");
  await fs.cp(options.outDir, path.join(options.repositoryRoot, "dist"), { recursive: true });
  assert.equal(ownedServerConsumers.length, 22);
  assert.equal(ownedServerConsumers.filter((row) => row[2] === "dev").length, 7);
  for (const consumer of ownedServerConsumers) {
    // Only the benchmark log sink is controlled; the actual start/stop bodies run.
    const lifecycle = await consumerLifecycle(consumer, { ...options, fileURLToPath: () => options.repositoryRoot, fs: { writeSync() {} }, viteLog: 1 });
    const child = await lifecycle.start();
    try { assert.ok(child.pid); } finally { await lifecycle.stop(child); }
    assert.notEqual(child.exitCode ?? child.signalCode, null, `${consumer[0]}: child not reaped`);
  }
});
