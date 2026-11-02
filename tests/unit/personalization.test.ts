import assert from "node:assert/strict";
import test from "node:test";
import { createPersonalizationStore, PERSONALIZATION_KEYS as keys, toolIdForPersonalization } from "../../src/app/personalization.ts";
import { tools } from "../../src/app/toolRegistry.ts";

function fixture(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  let blocked = false;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) { if (blocked) throw new DOMException("Full", "QuotaExceededError"); values.set(key, value); },
    removeItem(key: string) { if (blocked) throw new DOMException("Blocked", "SecurityError"); values.delete(key); },
  };
  return { store: createPersonalizationStore(() => storage), values, block: () => { blocked = true; } };
}

test("recent tools deduplicate in visit order, cap at six and accept published IDs only", () => {
  const { store, values } = fixture();
  for (const tool of tools.slice(0, 8)) store.record(tool.id);
  const expected = tools.slice(2, 8).map(tool => tool.id).reverse();
  assert.deepEqual(store.getSnapshot().recent, expected);
  store.record(expected[3]);
  assert.deepEqual(store.getSnapshot().recent, [expected[3], ...expected.filter(id => id !== expected[3])]);
  const before = values.get(keys.recent);
  for (const id of ['private-file.pdf', '?q=secret', 'video-studio', '']) store.record(id);
  assert.equal(values.get(keys.recent), before);
});

test("favorites toggle and clear keys independently, reload preserves valid state", () => {
  const { store, values } = fixture();
  store.record(tools[0].id); store.toggle(tools[1].id); store.toggle(tools[2].id); store.toggle(tools[1].id);
  assert.deepEqual(store.getSnapshot().favorites, [tools[2].id]);
  assert.deepEqual(fixture(Object.fromEntries(values)).store.getSnapshot(), store.getSnapshot());
  assert.equal(store.clear("recent"), true);
  assert.equal(values.has(keys.recent), false);
  assert.deepEqual(store.getSnapshot().favorites, [tools[2].id]);
  store.clear("favorites"); assert.equal(values.has(keys.favorites), false);
});

test("invalid JSON, schema, duplicates, unknown IDs and oversized arrays stay byte-identical", () => {
  for (const kind of ['recent', 'favorites'] as const) for (const raw of ['{broken', 'null', '{}', '42', '["private.pdf"]', JSON.stringify([tools[0].id, tools[0].id]), JSON.stringify(Array(50).fill(tools[0].id))]) {
    const { store, values } = fixture({ [keys[kind]]: raw });
    assert.deepEqual(store.getSnapshot()[kind], []); assert.equal(store.getSnapshot()[`${kind}Enabled`], false);
    store.record(tools[0].id); store.toggle(tools[0].id); store.clear(kind);
    assert.equal(values.get(keys[kind]), raw);
  }
});

test("blocked access and quota/remove failures disable storage without throwing or changing bytes", () => {
  const denied = createPersonalizationStore(() => { throw new DOMException("Denied", "SecurityError"); });
  assert.equal(denied.getSnapshot().recentEnabled, false); denied.record(tools[0].id); denied.toggle(tools[0].id);
  for (const operation of ['record', 'toggle', 'clear'] as const) {
    const { store, values, block } = fixture({ [keys.recent]: JSON.stringify([tools[0].id]) });
    store.getSnapshot(); block();
    if (operation === 'record') store.record(tools[1].id);
    else if (operation === 'toggle') store.toggle(tools[1].id);
    else store.clear('recent');
    assert.equal(store.getSnapshot()[operation === 'toggle' ? 'favoritesEnabled' : 'recentEnabled'], false);
    assert.equal(values.get(keys.recent), JSON.stringify([tools[0].id]));
  }
});

test("cross-tab refresh updates subscribers and corruption arriving before a write is preserved", () => {
  const { store, values } = fixture(); let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  values.set(keys.favorites, JSON.stringify([tools[1].id])); store.refresh();
  assert.deepEqual(store.getSnapshot().favorites, [tools[1].id]);
  values.set(keys.favorites, '{corrupted elsewhere'); store.toggle(tools[0].id);
  assert.equal(values.get(keys.favorites), '{corrupted elsewhere'); assert.equal(calls, 2);
  unsubscribe(); store.refresh(); assert.equal(calls, 2);
});

test("route matching uses segment boundaries and maps nested tool screens to catalog IDs", () => {
  assert.equal(toolIdForPersonalization('/tools/pdf-editor/stamp/'), 'pdf-editor');
  assert.equal(toolIdForPersonalization('/tools/excel-merger/xls-preserve'), 'excel-merger');
  for (const route of ['/', '/privacy', '/tools', '/tools/pdf-editor-secret', '/tools/video-studio']) assert.equal(toolIdForPersonalization(route), undefined);
});

test("writes merge remote visits and favorites before queued storage events refresh snapshots", () => {
  const { store: first, values } = fixture();
  const second = createPersonalizationStore(() => ({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  }));
  first.getSnapshot(); second.getSnapshot();
  const [a, b, c] = tools.map(tool => tool.id);
  first.toggle(a); second.toggle(b);
  assert.deepEqual(JSON.parse(values.get(keys.favorites)!), [a, b]);
  first.toggle(c);
  assert.deepEqual(first.getSnapshot().favorites, [a, b, c]);
  second.toggle(a);
  assert.deepEqual(second.getSnapshot().favorites, [b, c]);
  first.toggle(b); // Preserve the removal of a from the other tab.
  assert.deepEqual(JSON.parse(values.get(keys.favorites)!), [c]);
  first.record(a); second.record(b); first.record(a); // Local first ID was already a.
  assert.deepEqual(first.getSnapshot().recent, [a, b]);
  for (const tool of tools.slice(2, 8)) second.record(tool.id);
  first.record(a);
  assert.deepEqual(first.getSnapshot().recent, [a, ...tools.slice(3, 8).map(tool => tool.id).reverse()]);
  second.clear("favorites"); first.toggle(b);
  assert.deepEqual(JSON.parse(values.get(keys.favorites)!), [b]);
});
