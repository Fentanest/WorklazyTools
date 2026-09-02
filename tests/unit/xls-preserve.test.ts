import assert from "node:assert/strict";
import test from "node:test";

import { hasOleCompoundSignature, xlsPreserveError } from "../../src/features/excel-merger/xlsPreserve.ts";

test("XLS preservation routes only OLE compound inputs to legacy conversion", async () => {
  assert.equal(await hasOleCompoundSignature(new Blob([Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1)])), true);
  assert.equal(await hasOleCompoundSignature(new Blob([new TextEncoder().encode("\uFEFF<?xml version=\"1.0\"?>")])), false);
  assert.equal(await hasOleCompoundSignature(new Blob([Uint8Array.of(0xd0, 0xcf, 0x11)])), false);
});

test("XLS conversion errors identify the original file in Korean and English", () => {
  const fileName = "전각 ８５８ 보존.xls";
  assert.equal(
    xlsPreserveError(new Error("convert-failed"), "ko", fileName),
    `'${fileName}' 파일을 변환하지 못했습니다. 파일이 손상되지 않았는지, 암호로 보호되지 않았는지 확인한 뒤 다시 시도해 주세요.`,
  );
  assert.equal(
    xlsPreserveError(new Error("convert-failed"), "en", fileName),
    `Could not convert '${fileName}'. Check that the file is not damaged or password-protected, then try again.`,
  );
});
