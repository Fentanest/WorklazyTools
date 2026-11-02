import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export const PAGES_BUDGET = Object.freeze({ limit: 1_073_741_824, minimumHeadroom: 52_428_800 });
export async function enforcePagesBudget(root, budget = PAGES_BUDGET) {
  async function sum(directory) {
    let bytes = 0, files = 0;
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Unexpected upload symlink: ${file}`);
      if (entry.isDirectory()) { const child = await sum(file); bytes += child.bytes; files += child.files; }
      else if (entry.isFile()) { bytes += (await fs.stat(file)).size; files++; }
    }
    return { bytes, files };
  }
  const result = await sum(root);
  const measured = { ...result, ...budget, headroom: budget.limit - result.bytes };
  if (!result.files) throw new Error('Pages upload tree is empty');
  if (result.bytes > budget.limit || measured.headroom < budget.minimumHeadroom) throw new Error(`Pages upload budget exceeded: ${JSON.stringify(measured)}`);
  return measured;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await enforcePagesBudget(process.argv[2] || 'dist')));
}
