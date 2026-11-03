import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ProductRecoveryMarker, IOS_PRODUCT_RUN_KEY, productRecoveryMessages } from '../../src/features/image-studio/bgRemoval/recovery.ts';
import { BgRemovalError, messages, productRiskMessages } from '../../src/features/image-studio/bgRemoval/errors.ts';

// Run the production React state/events. Model and vendor callbacks are controlled
// boundaries so a delayed restriction error can be injected during a portrait run.
async function mount(recovery = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/ko/tools/image-studio/' });
  const before = new Map(['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const key of ['window', 'document', 'navigator'] as const) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const recoveryMarker = new ProductRecoveryMarker(() => dom.window.sessionStorage);
  if (recovery) dom.window.sessionStorage.setItem(IOS_PRODUCT_RUN_KEY, '1');
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const media = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const noop = () => {};
  let vendor: any;
  let finish!: (blob: Blob) => void;
  class Controller {
    async defaultMode() { return 'person'; }
    removeBackground() { return new Promise<Blob>(resolve => { finish = resolve; }); }
    cancel() {} dispose() {} onImageReplaced() {}
  }
  const shell = ({ children }: any) => React.createElement('div', null, children);
  const button = ({ children, variant, ...props }: any) => React.createElement('button', props, children);
  const require = (id: string): any => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsx;
    if (id.endsWith('.css')) return {};
    if (id === '@ascentsparksoftware/react-image-editor') return { ERROR_MESSAGES: {}, ImageEditor: (props: any) => { vendor = props; return React.createElement('div'); } };
    if (id === 'react-i18next') return { useTranslation: () => ({ i18n: { language: 'ko' }, t: (key: string, options?: any) => options?.returnObjects ? {} : key }) };
    if (id.endsWith('components/ui/button')) return { Button: button };
    if (id.endsWith('components/ui')) return { FileDropZone: shell };
    if (id.endsWith('UtilitySurface')) return { UtilitySectionCard: shell, UtilityNotice: ({ children, role, 'data-testid': id }: any) => React.createElement('div', { role, 'data-testid': id }, children) };
    if (id.endsWith('toolState')) return { setUnsavedWork: noop };
    if (id.endsWith('imageStudioShared')) return { ClipboardHint: shell, filterRasterImages: (x: any) => x, RASTER_IMAGE_ACCEPT: 'image/*' };
    if (id.endsWith('/bgRemoval')) return { BackgroundRemovalController: Controller, BgRemovalError, messages, productRiskMessages, productRecoveryMessages, productRecoveryMarker: recoveryMarker, productDeviceRestriction: () => 'low-memory' };
    if (id === './d6Policy') return { classifyD6: noop, draftD6Props: () => ({ resolutionLimits: { inputMaxDimension: 4096 } }), actualShrinkNotice: noop };
    if (id === './prepareImage') return { prepareImage: noop };
    if (id === './resizeResult') return { resizeResult: noop };
    if (id === './encodeSendImage') return { encodeSendImage: noop };
    if (id === './useImageSend') return { useImageSend: () => ({ invalidatePrepared: noop, captureSendRevision: () => 0 }) };
    throw Error('Unexpected fixture dependency: ' + id);
  };
  const file = process.env.BG_NOTICE_COMPONENT_SOURCE || 'src/features/image-studio/editor/LibraryImageEditor.tsx';
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  vm.runInNewContext(code, { require, exports, console, setTimeout, clearTimeout, Blob, File, AbortController,
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator, matchMedia: media,
    MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle,
    screen: { width: 1280, height: 900 }, Element: dom.window.Element, HTMLInputElement: dom.window.HTMLInputElement,
    requestAnimationFrame: (f: Function) => setTimeout(() => f(0), 0), cancelAnimationFrame: clearTimeout,
  }, { filename: file });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const props = { active: true, handleRef: { current: undefined }, onDirty: noop, onEditedResult: noop, batchCount: 0 };
  const view = (value: any) => recovery ? React.createElement(React.StrictMode, null, React.createElement(exports.default, value)) : React.createElement(exports.default, value);
  await React.act(async () => root.render(view(props)));
  const error = async (code = 'bg-product-device-restricted') => { await React.act(async () => vendor.onError({ code })); };
  return {
    dom, error,
    recoveryText: () => dom.window.document.querySelector('[data-testid=image-background-recovery]')?.textContent ?? '',
    recoveryFlag: () => dom.window.sessionStorage.getItem(IOS_PRODUCT_RUN_KEY),
    dismissRecovery: async () => { await React.act(async () => { const button = Array.from(dom.window.document.querySelectorAll('button')).find(n => n.textContent === productRecoveryMessages.ko.dismiss)!; button.click(); }); },
    text: () => dom.window.document.querySelector('[role=alert]')?.textContent ?? '',
    mode: async () => { await React.act(async () => { const select = dom.window.document.querySelector('select')!; select.value = 'person'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); }); },
    run: async () => { let pending!: Promise<Blob>; await React.act(async () => { const loader = await vendor.backgroundRemovalLoader(); pending = loader.removeBackground(new Blob(['synthetic'])); }); return { complete: async () => { await React.act(async () => { finish(new Blob(['cutout'])); await pending; }); } }; },
    deactivate: async () => { await React.act(async () => root.render(view({ ...props, active: false }))); },
    close: async () => { await React.act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of before) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } },
  };
}

test('mode change removes the previous device restriction alert', async () => {
  const page = await mount();
  try { await page.error(); assert.match(page.text(), /4GB/); await page.mode(); assert.equal(page.text(), ''); }
  finally { await page.close(); }
});
test('new background run clears restriction feedback before it finishes', async () => {
  const page = await mount();
  try { await page.error(); const run = await page.run(); assert.equal(page.text(), ''); await run.complete(); assert.equal(page.text(), ''); }
  finally { await page.close(); }
});
test('successful current run clears a late restriction callback but preserves unrelated errors', async () => {
  const page = await mount();
  try {
    const first = await page.run(); await page.error(); assert.match(page.text(), /4GB/); await first.complete(); assert.equal(page.text(), '');
    const next = await page.run(); await page.error('bg-inference-failed'); await next.complete(); assert.equal(page.text(), messages.ko['bg-inference-failed']);
  } finally { await page.close(); }
});
test('stale completion after deactivation cannot clear a newer restriction alert', async () => {
  const page = await mount();
  try { const run = await page.run(); await page.deactivate(); await page.error(); await run.complete(); assert.match(page.text(), /4GB/); }
  finally { await page.close(); }
});

test('recovery is read non-destructively during StrictMode render and acknowledged after mounting', async () => {
  const page = await mount(true);
  try { assert.ok(page.recoveryText().includes(productRecoveryMessages.ko.body)); assert.equal(page.recoveryFlag(), null); await page.dismissRecovery(); assert.equal(page.recoveryText(), ''); }
  finally { await page.close(); }
});
test('choosing the next mode clears the interruption hint', async () => {
  const page = await mount(true);
  try { assert.ok(page.recoveryText()); await page.mode(); assert.equal(page.recoveryText(), ''); }
  finally { await page.close(); }
});
