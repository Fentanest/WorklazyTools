import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const worker = fileURLToPath(new URL("./owned-preview-worker.mjs", import.meta.url));

export async function startOwnedPreview({ repositoryRoot, port, outDir = path.join(repositoryRoot, "dist"), timeoutMs = 30_000 }) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid preview port: ${port}`);
  // Fail before spawning even when an unrelated server returns HTTP 200.
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", (error) => reject(new Error(`Preview port ${host}:${port} is unavailable: ${error.code}`, { cause: error })));
    probe.listen({ host, port, exclusive: true }, resolve);
  });
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));

  const token = randomUUID();
  const child = spawn(process.execPath, [worker, JSON.stringify({ repositoryRoot, port, outDir, token })], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output = (output + chunk).slice(-16_384); });
  child.stderr.on("data", (chunk) => { output = (output + chunk).slice(-16_384); });
  const controller = new AbortController();
  let timer;
  let onMessage;
  let onError;
  let onExit;
  try {
    await new Promise((resolve, reject) => {
      onError = reject;
      onExit = (code, signal) => {
        controller.abort();
        reject(new Error(`Vite preview exited early (${code ?? signal}): ${output}`));
      };
      onMessage = async (message) => {
        if (message?.type !== "listening") return;
        try {
          if (message.pid !== child.pid || message.port !== port || message.host !== host || message.token !== token) {
            throw new Error("Vite preview child listening identity mismatch");
          }
          // A competing listener between probe.close() and Vite.listen() cannot
          // satisfy both the child IPC receipt and this per-run HTTP identity.
          const baseUrl = `http://${host}:${port}`;
          const response = await fetch(`${baseUrl}/__harness_preview_identity/${token}`, { signal: controller.signal, redirect: "error" });
          const identity = await response.json();
          if (!response.ok || identity.token !== token || identity.pid !== child.pid || identity.port !== port) {
            throw new Error("Vite preview HTTP identity mismatch");
          }
          const page = await fetch(baseUrl, { signal: controller.signal, redirect: "error" });
          await page.body?.cancel();
          if (!page.ok) throw new Error(`Vite preview returned HTTP ${page.status}`);
          if (child.exitCode !== null || child.signalCode !== null) throw new Error("Vite preview exited during readiness check");
          resolve();
        } catch (error) { reject(error); }
      };
      child.once("error", onError);
      child.once("exit", onExit);
      child.on("message", onMessage);
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Timed out waiting for owned preview on port ${port}: ${output}`));
      }, timeoutMs);
    });
    return child;
  } catch (error) {
    await stopOwnedPreview(child);
    throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
    child.off("message", onMessage);
    child.off("error", onError);
    child.off("exit", onExit);
  }
}

export async function stopOwnedPreview(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill("SIGTERM");
  });
}
