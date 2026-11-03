import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { revealShellTab } from '../../src/app/shellFocus.ts';

for (const control of [
  { name: 'native time control', markup: '<input type="time">', selector: 'input' },
  { name: 'SVG map button', markup: '<svg><g role="button" tabindex="0"></g></svg>', selector: 'g' },
]) test(`Tab reveals the ${control.name} even when its host is not focus-visible`, () => {
  const dom = new JSDOM(`<div class="app-shell"><main class="main-content">${control.markup}</main></div>`, { url: 'https://example.test/' });
  const frames: FrameRequestCallback[] = [];
  const values = { window: dom.window, document: dom.window.document, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window), innerHeight: 456,
    requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback) };
  const saved = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
    const root = dom.window.document.documentElement;
    root.style.scrollPaddingBlockStart = '80px'; root.style.scrollPaddingBlockEnd = '89px';
    const input = dom.window.document.querySelector(control.selector)! as HTMLElement | SVGElement;
    input.focus();
    const matches = input.matches.bind(input);
    // Chrome's internal time segments can have keyboard focus while the host
    // reports false here. This was the remaining 32.953125px header overlap.
    input.matches = selector => selector === ':focus-visible' ? false : matches(selector);
    input.getBoundingClientRect = () => ({ top: 30, bottom: 70, left: 420, right: 599, width: 179, height: 40 }) as DOMRect;
    const scrolls: unknown[] = [];
    input.scrollIntoView = options => { scrolls.push(options); };
    revealShellTab({ key: 'ArrowUp', target: input });
    assert.equal(frames.length, 0, 'editing keys retain native behavior');
    revealShellTab({ key: 'Tab', target: input });
    for (const frame of frames.splice(0)) frame(0);
    assert.deepEqual(scrolls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
    assert.equal(dom.window.document.activeElement, input, 'scrolling must not reassign focus');
  } finally {
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
