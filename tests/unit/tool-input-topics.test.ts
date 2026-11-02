import assert from "node:assert/strict";
import test from "node:test";
import { tools } from "../../src/app/toolRegistry.ts";
import { toolFilterValues } from "../../src/app/publicService.ts";

// Independent snapshot of the published catalog before metadata derivation.
const expected: Record<string, string[]> = {
  pdf: ["pdf-editor", "pdf-converter", "pdf-compare", "document-redactor", "document-markdown"],
  image: ["image-studio", "image-privacy", "image-compare", "document-redactor", "pdf-converter", "qr-studio"],
  spreadsheet: ["excel-merger", "excel-cleaner", "excel-compare", "data-converter", "document-generator", "document-markdown", "office-editor", "product-banner", "qr-studio"],
  document: ["document-compare", "document-generator", "document-markdown", "office-editor", "pdf-converter", "hwp-editor"],
  hwp: ["hwp-editor", "document-compare", "pdf-converter"],
  text: ["text-compare", "text-merger", "text-tools", "text-formatter", "data-converter", "qr-studio"],
  audio: ["audio-studio"],
};

for (const topic of toolFilterValues.from) test(`catalog ${topic} topic retains exactly the existing tool set`, () => {
  assert.deepEqual(tools.filter(tool => tool.inputTopics?.includes(topic)).map(tool => tool.id).sort(), [...expected[topic]].sort());
});

test("every published tool has unique catalog topics and no accepts contract", () => {
  for (const tool of tools) {
    assert.ok(Array.isArray(tool.inputTopics), tool.id);
    assert.equal(new Set(tool.inputTopics).size, tool.inputTopics.length, tool.id);
    assert.ok(tool.inputTopics.every(topic => (toolFilterValues.from as readonly string[]).includes(topic)), tool.id);
    assert.equal("accepts" in tool, false, tool.id);
  }
});
