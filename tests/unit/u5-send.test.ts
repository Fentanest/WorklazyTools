import assert from "node:assert/strict";
import test from "node:test";
import { fileAccepts, acceptsFile } from "../../src/app/fileAccepts.ts";
import { validateHandoff, stageHandoff, claimHandoff, cancelStagedHandoff } from "../../src/app/memoryHandoff.ts";
import { relatedToolsFor } from "../../src/app/relatedTools.ts";
const cases = ["image-to-pdf", "pdf-to-image", "pdf-to-document"] as const;
test("Send-to receivers bind the canonical converter path and exact count limits", () => {
  for (const receiverId of cases) {
    const definition = fileAccepts[receiverId];
    assert.deepEqual(definition.paths, [`/tools/pdf-converter/${receiverId}`]); assert.equal(definition.kind, "inspection");
    const file = new File([], receiverId === "image-to-pdf" ? "generated.PNG" : "generated.PDF");
    for (const count of [0, 1, 2, 50, 51]) {
      const value = { receiverId, entryPath: definition.paths[0], files: Array(count).fill(file), origin: "generated" as const, source: "unit" };
      assert.equal(validateHandoff(value), count > 0 && count <= definition.max ? null : "count");
    }
    assert.equal(validateHandoff({ receiverId, entryPath: "/tools/pdf-converter", files: [file], origin: "user-input", source: "unit" }), "destination");
  }
});
test("image-to-pdf keeps JPG/PNG only, while image receivers retain WebP support", () => {
  for (const extension of ["jpg", "jpeg", "png"]) assert.equal(acceptsFile("image-to-pdf", new File([], `result.${extension.toUpperCase()}`)), true);
  const webp = new File([], "result.webp", { type: "image/webp" });
  assert.equal(acceptsFile("image-to-pdf", webp), false);
  for (const id of ["image-edit", "image-batch", "image-privacy"] as const) assert.equal(acceptsFile(id, webp), true);
});
test("converter tokens carry identity only and cannot be claimed by another receiver", () => {
  for (const receiverId of cases) {
    const entryPath = fileAccepts[receiverId].paths[0], text = "synthetic private bytes";
    const token = stageHandoff({ receiverId, entryPath, files: [new File([text], receiverId === "image-to-pdf" ? "input.png" : "input.pdf")], origin: "user-input", source: "unit" });
    assert.deepEqual(Object.keys(token).sort(), ["id", "nonce"]); assert.ok(!JSON.stringify(token).includes(text));
    assert.equal(claimHandoff(token, "pdf-organize", entryPath), null); cancelStagedHandoff(token);
    assert.equal(claimHandoff(token, receiverId, entryPath), null);
  }
});
test("related canonical links include the implemented follow-on image workflows", () => {
  assert.ok(relatedToolsFor("/tools/image-studio").includes("/tools/pdf-converter/image-to-pdf"));
  assert.ok(relatedToolsFor("/tools/image-privacy").includes("/tools/image-studio"));
  assert.ok(relatedToolsFor("/tools/pdf-converter").includes("/tools/image-studio"));
});
