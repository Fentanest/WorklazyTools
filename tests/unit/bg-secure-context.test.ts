import assert from 'node:assert/strict';
import test from 'node:test';
import { BackgroundRemovalController } from '../../src/features/image-studio/bgRemoval/controller.ts';
for (const missing of ['secure-origin', 'crypto'] as const)
    test(`background removal rejects missing ${missing} before consent, cache, download or worker`, async () => {
        const secure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext'), crypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
        let consent = 0, cache = 0, fetches = 0, workers = 0;
        Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: missing !== 'secure-origin' });
        if (missing === 'crypto')
            Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
        try {
            const controller = new BackgroundRemovalController({ confirm: () => { consent++; return true; }, cacheStorage: { open: async () => { cache++; throw new Error('must not reach cache'); } } as unknown as CacheStorage, fetcher: (async () => { fetches++; throw new Error('must not fetch'); }) as typeof fetch, workerFactory: () => { workers++; throw new Error('must not create worker'); } });
            await assert.rejects(controller.removeBackground(new Blob(['synthetic'], { type: 'image/png' }), { mode: 'person' }), error => error instanceof Error && 'code' in error && error.code === 'bg-secure-context-required');
            assert.deepEqual({ consent, cache, fetches, workers }, { consent: 0, cache: 0, fetches: 0, workers: 0 });
        }
        finally {
            if (secure)
                Object.defineProperty(globalThis, 'isSecureContext', secure);
            else
                Reflect.deleteProperty(globalThis, 'isSecureContext');
            if (crypto)
                Object.defineProperty(globalThis, 'crypto', crypto);
        }
    });
