// Run after building dist. Tests server ownership only; browser assertions and
// benchmark workloads are deliberately outside this lifecycle regression.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { consumerLifecycle, ownedServerConsumers } from "./helpers/owned-server-consumers.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const evidence = [];
async function listen(server, port = 0) {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return server.address().port;
}
async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
async function freePort() {
  const probe = http.createServer();
  const port = await listen(probe);
  await close(probe);
  return port;
}

test("all 22 actual harness start functions verify the real repository server and reap their child", async (t) => {
  for (const consumer of ownedServerConsumers) await t.test(consumer[0], async () => {
    const port = await freePort();
    const started = Date.now();
    const logfile = path.join(process.env.OWNED_SERVER_EVIDENCE_DIR ?? "/tmp", `u05b2-${consumer[0]}-vite.log`);
    const viteLog = fs.openSync(logfile, "w");
    let child;
    let lifecycle;
    let row;
    try {
      lifecycle = await consumerLifecycle(consumer, { repositoryRoot, outDir: path.join(repositoryRoot, "dist"), port, fs, viteLog });
      child = await lifecycle.start();
      const { token } = JSON.parse(child.spawnargs.at(-1));
      const response = await fetch(`http://127.0.0.1:${port}/__harness_preview_identity/${token}`);
      assert.equal(response.status, 200);
      const identity = await response.json();
      assert.deepEqual(identity, { token, pid: child.pid, port });
      const page = await fetch(`http://127.0.0.1:${port}${consumer[0].startsWith("ui-isolation") || consumer[0].startsWith("ui-primitives") ? "/tests/ui-primitives-fixture.html" : "/"}`);
      assert.equal(page.status, 200);
      assert.match(page.headers.get("content-type"), /html/);
      await page.body?.cancel();
      assert.equal(page.headers.get("cross-origin-opener-policy"), "same-origin");
      assert.equal(page.headers.get("cross-origin-embedder-policy"), "require-corp");
      if (consumer[2] === "dev") {
        const hmr = await fetch(`http://127.0.0.1:${port}/@vite/client`);
        assert.equal(hmr.status, 200);
        assert.match(await hmr.text(), /WebSocket/);
      }
      row = { harness: `${consumer[0]}.mjs`, mode: consumer[2], port, pid: child.pid, token, startedAt: new Date(started).toISOString(), identity: true, startupMs: Date.now() - started, body: "not_run_lifecycle_only" };
    } finally {
      try { if (child) await lifecycle.stop(child); } finally { fs.closeSync(viteLog); }
    }
    assert.notEqual(child.exitCode ?? child.signalCode, null);
    assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
    const next = http.createServer();
    await listen(next, port);
    await close(next);
    evidence.push({ ...row, childReaped: true, portReleased: true, endedAt: new Date().toISOString() });
    console.log(`OWNED_SERVER ${JSON.stringify(evidence.at(-1))}`);
  });
});

for (const [name, variable] of [["control-geometry-smoke", "CONTROL_GEOMETRY_TEST_PORT"], ["ui-shell-search", "UI_SHELL_PORT"]]) {
  test(`actual ${name} entrypoint immediately rejects an unrelated HTTP 200 listener`, async () => {
    let requests = 0;
    const foreign = http.createServer((_req, res) => { requests++; res.end("foreign HTTP 200"); });
    const port = await listen(foreign);
    const started = Date.now();
    let child;
    let timer;
    try {
      child = spawn(process.execPath, [path.join(repositoryRoot, "tests", `${name}.mjs`)], {
        cwd: repositoryRoot,
        env: { ...process.env, [variable]: String(port), TEST_BASE_URL: "" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", resolve);
        timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error(`negative control timed out: ${output}`)); }, 15_000);
      });
      assert.notEqual(code, 0, output);
      assert.match(output, /unavailable: EADDRINUSE/, output);
      assert.equal(requests, 0, "must reject before polling the foreign HTTP server");
      assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), "foreign HTTP 200");
      const row = { harness: `${name}.mjs`, negative: true, port, exitCode: code, elapsedMs: Date.now() - started, foreignSurvived: true, output };
      evidence.push(row);
      console.log(`OWNED_NEGATIVE ${JSON.stringify(row)}`);
    } finally {
      clearTimeout(timer);
      if (child && child.exitCode === null && child.signalCode === null) {
        await new Promise((resolve) => { child.once("exit", resolve); child.kill("SIGTERM"); });
      }
      await close(foreign);
    }
  });
}

test.after(() => {
  if (process.env.OWNED_SERVER_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.OWNED_SERVER_EVIDENCE_DIR, "startup-results.json"), `${JSON.stringify(evidence, null, 2)}\n`);
});
