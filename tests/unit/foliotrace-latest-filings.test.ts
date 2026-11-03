import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { FilingEvent } from "../../src/features/foliotrace/contracts.ts";
import { latestFilingsByStock, isLateFilingWithOlderBasis } from "../../src/features/foliotrace/ui/holdings.ts";
import { validSnapshot } from "../../src/features/foliotrace/data/loadSnapshot.ts";

test("the latest-filings browser fixture satisfies the unchanged snapshot contract", () => {
  const snapshot = JSON.parse(readFileSync(new URL("../fixtures/foliotrace/latest-filings.json", import.meta.url), "utf8"));
  assert.equal(validSnapshot(snapshot, snapshot.datasetVersion), true);
});

function event(overrides: Partial<FilingEvent> = {}): FilingEvent {
  return { corpCode: "00100001", stockCode: "100001", receiptDate: "2026-11-02",
    receiptNo: "20261102000001", basisDate: "2026-10-01", kind: "increase",
    correctionOf: null, isCorrectionOrWithdrawal: false, quantity: "100",
    companyOwnershipPercent: "5.1", source: "dart-structured", filingUrl: null, ...overrides };
}

test("latest filing uses receipt date then receipt number, never holding basis date", () => {
  const old = event({ receiptDate: "2026-10-30", receiptNo: "20261030999999", basisDate: "2026-10-29" });
  const sameDay = event({ receiptNo: "20261102000002", basisDate: "2026-10-31" });
  const latest = event({ receiptNo: "20261102000003", basisDate: "2026-01-01" });
  for (const input of [[old, latest, sameDay], [sameDay, latest, old]]) {
    assert.deepEqual(latestFilingsByStock(input), [latest]);
  }
});

test("common and preferred securities of one company remain separate and sort by receipt", () => {
  const common = event();
  const preferred = event({ stockCode: "100002", receiptNo: "20261102000002" });
  const older = event({ stockCode: "100003", corpCode: "00100003", receiptDate: "2026-11-01" });
  assert.deepEqual(latestFilingsByStock([older, common, preferred]), [preferred, common, older]);
});

test("corrections and withdrawals can be latest even with unknown quantities and an older basis", () => {
  const original = event({ basisDate: "2026-10-31" });
  const correction = event({ receiptNo: "20261102000002", basisDate: "2026-01-01",
    isCorrectionOrWithdrawal: true, correctionOf: original.receiptNo, quantity: null });
  assert.deepEqual(latestFilingsByStock([correction, original]), [correction]);
  assert.deepEqual(latestFilingsByStock([original, { ...correction, correctionOf: null }]),
    [{ ...correction, correctionOf: null }]);
});

test("missing stock codes use a separate company key without merging identified securities", () => {
  const common = event();
  const unknown = event({ stockCode: null, receiptNo: "20261102000002" });
  const olderUnknown = event({ stockCode: null });
  const other = event({ stockCode: null, corpCode: "00100002" });
  assert.deepEqual(latestFilingsByStock([common, olderUnknown, unknown, other]), [unknown, common, other]);
});

test("latest selection retains indirect and former holdings without a source or 30-row cut", () => {
  const events = Array.from({ length: 35 }, (_, i) => event({ stockCode: String(100000 + i),
    receiptNo: `20261102${String(i).padStart(6, "0")}`, source: "indirect-observation" }));
  const result = latestFilingsByStock(events);
  assert.equal(result.length, 35);
  assert.equal(result[0], events[34]);
  assert.equal(result[34], events[0]);
});

test("selection never changes the raw events used by security history, including duplicate observations", () => {
  const first = Object.freeze(event());
  const duplicate = Object.freeze(event({ quantity: "200" }));
  const input = Object.freeze([first, duplicate]);
  assert.deepEqual(latestFilingsByStock(input), [first]);
  assert.equal(input.length, 2);
  assert.equal(input[1].quantity, "200");
  assert.deepEqual(latestFilingsByStock([]), []);
});

test("late receipt note needs both a later receipt and an earlier basis than the current holding", () => {
  const current = { holdingDate: "2026-09-29", receiptDate: "2026-09-30" } as import("../../src/features/foliotrace/contracts.ts").Holding;
  const late = event({ receiptDate: "2026-10-02", basisDate: "2026-07-30" });
  assert.equal(isLateFilingWithOlderBasis(late, current), true);
  assert.equal(isLateFilingWithOlderBasis({ ...late, basisDate: current.holdingDate }, current), false);
  assert.equal(isLateFilingWithOlderBasis({ ...late, receiptDate: current.receiptDate }, current), false);
  assert.equal(isLateFilingWithOlderBasis({ ...late, basisDate: null }, current), false);
  assert.equal(isLateFilingWithOlderBasis(late, undefined), false);
});
