import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('./model.manifest.json', import.meta.url), 'utf8'));
/** BG workers always inject verified wasmBinary. Omit Vite's unused fallback copies. */
export function verifiedRuntimeWasmPlugin() {
  return {
    name: 'bg-removal-verified-wasm-only', enforce: 'post',
    generateBundle(_options, bundle) {
      const scoped = Object.values(bundle).some(item => item.type === 'chunk' && item.isEntry &&
        item.facadeModuleId?.replaceAll('\\', '/').includes('/image-studio/bgRemoval/') && item.facadeModuleId.endsWith('.worker.ts'));
      if (!scoped) return;
      for (const [name, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !name.endsWith('.wasm')) continue;
        const bytes = typeof asset.source === 'string' ? Buffer.from(asset.source) : asset.source;
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (!manifest.runtimes.some(expected => expected.bytes === bytes.length && expected.sha256 === sha256))
          throw new Error(`Unrecognized BG worker fallback wasm: ${name}`);
        delete bundle[name];
      }
    },
  };
}
