import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export function runAllUnitSuites(run = (args) => spawnSync(process.execPath,args,{stdio:'inherit'})) {
  const commands = [ ['scripts/run-public-unit-tests.mjs'], ['--test','--experimental-strip-types','src/features/image-studio/bgRemoval/tests/unit.test.ts','src/features/image-studio/bgRemoval/tests/mask-quality.test.ts'] ];
  const results = commands.map(args => run(args));
  return results.every(result => result.status === 0 && !result.error) ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode=runAllUnitSuites();
