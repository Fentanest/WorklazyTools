import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GUIDE_INITIAL_LAYOUT_MS, restoreGuideFragment } from '../../src/app/guideFragment.ts';

function fixture(hash = '#tool-guide-title', navigation = 'navigate') {
  const dom = new JSDOM('<main class="main-content"><div id="page"><h2 id="tool-guide-title">Guide</h2></div></main>', { url: `https://example.test/tools/text-tools/${hash}` });
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  let clock = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  dom.window.setTimeout = ((callback: () => void, delay: number) => {
    timers.set(++sequence, { at: clock + delay, callback }); return sequence;
  }) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = id => { timers.delete(id); };
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
  const values = { performance: { getEntriesByType: () => [{ type: navigation }] }, window: dom.window, document: dom.window.document, Element: dom.window.Element,
    ResizeObserver: Observer, requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); } };
  const saved = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const title = dom.window.document.querySelector('h2')!;
  const scrolls: unknown[] = [];
  let documentY = 1000;
  title.getBoundingClientRect = () => ({ top: documentY - dom.window.scrollY }) as DOMRect;
  const scrollTo = (y: number) => {
    Object.defineProperty(dom.window, 'scrollY', { configurable: true, value: y });
    dom.window.dispatchEvent(new dom.window.Event('scroll'));
  };
  title.scrollIntoView = options => {
    scrolls.push(options);
    // Real browsers dispatch this asynchronously, after the expected position
    // has been recorded by the correction. Tests deliver it explicitly.
    Object.defineProperty(dom.window, 'scrollY', { configurable: true, value: documentY - 100 });
  };
  const stop = restoreGuideFragment(title);
  return { dom, title, fonts, scrolls, frames, observed, resolveFonts, timers, scrollTo,
    shift: (dy: number) => { documentY += dy; },
    advance: (ms: number) => {
      clock += ms;
      for (const [id, timer] of timers) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
    },
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
      assert.equal(f.timers.size, 0);
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

test('initial layout deadline permanently releases the guide without user input', async () => {
  const f = fixture();
  try {
    f.frame();
    f.advance(GUIDE_INITIAL_LAYOUT_MS - 1);
    f.resize(); f.frame();
    assert.equal(f.scrolls.length, 2, 'initial delayed layout is still corrected');
    f.resize(); // A frame queued immediately before expiry must also be cancelled.
    f.advance(1);
    assert.equal(f.disconnected(), true);
    assert.equal(f.timers.size, 0);
    f.resize(); f.resolveFonts(); await Promise.resolve();
    f.fonts.dispatchEvent(new f.dom.window.Event('loadingdone'));
    f.dom.window.dispatchEvent(new f.dom.window.Event('load'));
    f.dom.window.dispatchEvent(new f.dom.window.Event('scroll'));
    f.title.dispatchEvent(new f.dom.window.Event('animationend', { bubbles: true }));
    f.frame(); f.advance(GUIDE_INITIAL_LAYOUT_MS); f.resize(); f.frame();
    assert.equal(f.scrolls.length, 2, 'late automatic results must not renew alignment');
    assert.equal(f.frames.size, 0);
    assert.equal(f.dom.window.location.hash, '#tool-guide-title');
  } finally { f.close(); }
});

test('own delayed scroll event does not schedule another correction or release layout tracking', () => {
  const f = fixture();
  try {
    f.frame();
    f.scrollTo(f.dom.window.scrollY); f.frame();
    assert.equal(f.scrolls.length, 1);
    assert.equal(f.disconnected(), false);
    f.resize(); f.frame();
    assert.equal(f.scrolls.length, 2);
  } finally { f.close(); }
});

for (const navigation of ['navigate', 'reload', 'back_forward']) for (const y of [0, 320]) {
  test(`${navigation}: pointerless scroll to ${y} permanently releases correction`, async () => {
    const f = fixture('#tool-guide-title', navigation);
    try {
      f.frame();
      // A genuine restoration checkpoint is already over before user scroll.
      f.dom.window.dispatchEvent(new f.dom.window.PageTransitionEvent('pageshow'));
      f.frame();
      const before = f.scrolls.length;
      f.resize(); // Even a queued correction must be cancelled immediately.
      f.scrollTo(y);
      assert.equal(f.disconnected(), true);
      assert.equal(f.frames.size, 0);
      assert.equal(f.timers.size, 0);
      f.shift(200); f.resize();
      f.resolveFonts(); await Promise.resolve();
      f.dom.window.dispatchEvent(new f.dom.window.Event('load')); f.frame();
      assert.equal(f.scrolls.length, before);
      assert.equal(f.dom.window.scrollY, y);
    } finally { f.close(); }
  });
}

test('layout scroll before ResizeObserver delivery is corrected', () => {
  const f = fixture();
  try {
    f.frame(); f.shift(200); f.scrollTo(1100); f.frame();
    assert.equal(f.scrolls.length, 2);
    assert.equal(f.disconnected(), false);
  } finally { f.close(); }
});

for (const navigation of ['reload', 'back_forward']) {
  test(`${navigation}: one pageshow restoration is corrected without a layout or font change`, () => {
    const f = fixture('#tool-guide-title', navigation);
    try {
      f.frame();
      f.dom.window.dispatchEvent(new f.dom.window.PageTransitionEvent('pageshow'));
      f.scrollTo(0); f.frame();
      assert.equal(f.scrolls.length, 2);
      assert.equal(f.dom.window.scrollY, 900);
      assert.equal(f.disconnected(), false);
      f.dom.window.dispatchEvent(new f.dom.window.PageTransitionEvent('pageshow'));
      f.scrollTo(0); f.frame();
      assert.equal(f.scrolls.length, 2, 'restoration checkpoint is one-shot');
      assert.equal(f.disconnected(), true);
    } finally { f.close(); }
  });
}

test('manual history scroll restoration grants no scroll exception', () => {
  const f = fixture('#tool-guide-title', 'reload');
  try {
    f.dom.window.history.scrollRestoration = 'manual';
    f.frame();
    f.dom.window.dispatchEvent(new f.dom.window.PageTransitionEvent('pageshow'));
    f.scrollTo(0); f.frame();
    assert.equal(f.scrolls.length, 1);
    assert.equal(f.disconnected(), true);
  } finally { f.close(); }
});
