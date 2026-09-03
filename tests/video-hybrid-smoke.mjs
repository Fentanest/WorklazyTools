import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-video-hybrid-smoke-"));
try {
  for (const extra of [[], ["--concat"]]) await runBenchmark(extra);
  const report = JSON.parse(await fs.readFile(path.join(outputDirectory, "video-hybrid-benchmark.json"), "utf8"));
  if (report.fixture.width !== 640 || report.fixture.height !== 360 || report.route.route !== "hybrid") {
    throw new Error(`Small hybrid route assertion failed: ${JSON.stringify(report.route)}`);
  }
  if (Math.abs(report.output.sync.deltaStartSeconds) > 0.05
    || Math.abs(report.output.sync.driftSeconds) > report.output.sync.driftLimitSeconds
    || report.output.oomOccurred || report.output.fullDecodeExitCode !== 0) {
    throw new Error(`Small hybrid sync/decode assertion failed: ${JSON.stringify(report.output)}`);
  }
  console.log("Video hybrid small smoke passed.");
} finally {
  await fs.rm(outputDirectory, { recursive: true, force: true });
}

function runBenchmark(extra) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/benchmark-video-hybrid.mjs", "--small", ...extra, "--output-dir", outputDirectory], {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Hybrid smoke exited with ${code ?? signal}`)));
  });
}
