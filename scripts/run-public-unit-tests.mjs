import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

import { VIDEO_STUDIO_PUBLIC } from "../src/app/publicServiceConfig.mjs";

const selected = readdirSync("tests/unit")
  .filter((name) => name.endsWith(".test.ts") && (VIDEO_STUDIO_PUBLIC || !name.startsWith("video-")))
  .sort()
  .map((name) => `tests/unit/${name}`);

if (!selected.length) throw new Error("No unit tests selected");
console.log(`Selected ${selected.length} unit test files; Video Studio functional tests ${VIDEO_STUDIO_PUBLIC ? "included" : "omitted while unpublished"}.`);
const result = spawnSync(process.execPath, ["--test", "--experimental-strip-types", ...selected, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
