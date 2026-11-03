import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { restoreGuideFragment } from '../../src/app/guideFragment.ts';

function fixture(hash = '#tool-guide-title') {
  const dom = new JSDOM('<main class="main-content"><div id="page"><h2 id="tool-guide-title">Guide</h2></div></main>', { url: `https://example.test/tools/text-tools/${hash}` });
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  let resize: ResizeObserverCallback | undefined;
  let disconnected = false;
  let resolveFonts!: () => void;
  const fonts = new dom.window.EventTarget();
  Object.defineProperty(fonts, 'ready', { value: new Promise<void>(resolve => { resolveFonts = resolve; }) });
  Object.defineProperty(dom.window.document, 'fonts', { value: fonts });
  const observed: Element[] = [];
  class Observer {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe(element: Element) { observed.push(element); }
    disconnect() { disconnected = true; }
  }
  const values = { window: dom.window, document: dom.window.document, Element: dom.window.Element,
    ResizeObserver: Observer, requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); } };
  const saved = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const title = dom.window.document.querySelector('h2')!;
  const scrolls: unknown[] = [];
  title.scrollIntoView = options => { scrolls.push(options); };
  const stop = restoreGuideFragment(title);
  return { dom, title, fonts, scrolls, frames, observed, resolveFonts,
    resize: () => resize?.([], {} as ResizeObserver),
    frame: () => { const batch = [...frames.values()]; frames.clear(); for (const callback of batch) callback(0); },
    disconnected: () => disconnected,
    close: () => {
      stop?.(); dom.window.close();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('initial guide entry follows delayed tool layout and font completion without moving focus', async () => {
  const f = fixture();
  try {
    assert.deepEqual(f.observed, [f.dom.window.document.querySelector('main')]);
    f.frame();
    f.resize(); f.resize(); f.frame();
    f.resolveFonts(); await Promise.resolve(); f.frame();
    f.fonts.dispatchEvent(new f.dom.window.Event('loadingdone')); f.frame();
    assert.equal(f.scrolls.length, 4);
    assert.deepEqual(f.scrolls[0], { block: 'start', behavior: 'instant' });
    assert.equal(f.dom.window.document.activeElement, f.dom.window.document.body);
  } finally { f.close(); }
});

for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'hashchange']) {
  test(`${event} releases initial fragment alignment and pending async callbacks`, async () => {
    const f = fixture();
    try {
      f.dom.window.dispatchEvent(new f.dom.window.Event(event));
      f.resize(); f.resolveFonts(); await Promise.resolve(); f.frame();
      f.dom.window.dispatchEvent(new f.dom.window.Event('load')); f.frame();
      assert.equal(f.scrolls.length, 0);
      assert.equal(f.disconnected(), true);
      assert.equal(f.frames.size, 0);
    } finally { f.close(); }
  });
}

for (const hash of ['', '#other']) test(`entry ${hash || 'without a fragment'} retains normal scrolling`, () => {
  const f = fixture(hash);
  try { f.frame(); assert.equal(f.scrolls.length, 0); assert.equal(f.observed.length, 0); }
  finally { f.close(); }
});

test('only the guide ancestor animation schedules alignment; unmount cancels it', () => {
  const f = fixture();
  try {
    f.frame();
    f.title.dispatchEvent(new f.dom.window.Event('animationend', { bubbles: true })); f.frame();
    assert.equal(f.scrolls.length, 2);
    f.dom.window.document.querySelector('main')!.dispatchEvent(new f.dom.window.Event('animationend', { bubbles: true }));
    f.title.remove(); f.frame();
    assert.equal(f.scrolls.length, 2);
  } finally { f.close(); }
});
