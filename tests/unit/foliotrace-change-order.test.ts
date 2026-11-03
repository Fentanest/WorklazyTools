import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { FilingEvent, Holding } from "../../src/features/foliotrace/contracts.ts";
import {
  compareFilingOrder, filingChangesForEvents, filingChangesForHoldings,
  filingDeltaLabel, formatFilingDelta, latestFilingsByStock, reportedDelta,
} from "../../src/features/foliotrace/ui/holdings.ts";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/foliotrace/filing-change-order.json", import.meta.url), "utf8")) as {
  holdings: Holding[]; events: FilingEvent[];
};

test("public snapshot restores Samsung Electro-Mechanics and LIG changes with independent signs", () => {
  for (const events of [fixture.events, [...fixture.events].reverse()]) {
    const changes = filingChangesForHoldings(fixture.holdings, events);
    const samsung = fixture.holdings.find(h => h.stockCode === "009150")!;
    const lig = fixture.holdings.find(h => h.stockCode === "079550")!;
    assert.deepEqual(changes.get(samsung), {
      quantity: "up", ownership: "down", quantityDelta: "59757", ownershipDelta: "-0.13",
    });
    assert.deepEqual(changes.get(lig), {
      quantity: "down", ownership: "down", quantityDelta: "-18774", ownershipDelta: "-0.08",
    });
    const latest = latestFilingsByStock(events).find(e => e.stockCode === samsung.stockCode)!;
    assert.equal(latest.receiptNo, samsung.receiptNo);
    assert.deepEqual(filingChangesForEvents(events).get(latest), changes.get(samsung));
  }
});

test("the other two public-data cases retain neutral holdings when no comparable pair exists", () => {
  const changes = filingChangesForHoldings(fixture.holdings, fixture.events);
  const posco = fixture.holdings.find(h => h.stockCode === "005490")!;
  const yg = fixture.holdings.find(h => h.stockCode === "122870")!;
  assert.equal(changes.has(posco), false, "POSCO has no earlier basis; both available reports have identical values");
  const poscoEvents = fixture.events.filter(e => e.stockCode === posco.stockCode).sort(compareFilingOrder);
  assert.equal(poscoEvents.length, 2);
  assert.equal(poscoEvents[0].basisDate, poscoEvents[1].basisDate);
  assert.deepEqual(filingChangesForEvents(poscoEvents).get(poscoEvents[1]), {
    quantity: null, ownership: null, quantityDelta: "0", ownershipDelta: "0",
  });
  assert.equal(changes.has(yg), false, "YG's holding receipt is absent from public events");
  assert.equal(fixture.events.some(e => e.receiptNo === yg.receiptNo), false);
});

const base: FilingEvent = { corpCode: "00100000", stockCode: "005930", receiptNo: "20261104000001",
  receiptDate: "2026-11-04", basisDate: "2026-11-01", kind: "increase", correctionOf: null,
  isCorrectionOrWithdrawal: false, quantity: "100", companyOwnershipPercent: "6", source: "dart-structured", filingUrl: null };

test("equal basis dates compare receipt dates before receipt numbers, independent of input order", () => {
  const prior = { ...base, receiptDate: "2026-11-02", receiptNo: "20261102999999", quantity: "90", companyOwnershipPercent: "6.1" };
  const sameDay = { ...base, receiptNo: "20261104000000", quantity: "95", companyOwnershipPercent: "6.2" };
  for (const events of [[base, prior, sameDay], [sameDay, base, prior]]) {
    assert.deepEqual([...events].sort(compareFilingOrder), [prior, sameDay, base]);
    assert.deepEqual(filingChangesForEvents(events).get(base), {
      quantity: "up", ownership: "down", quantityDelta: "5", ownershipDelta: "-0.2",
    });
    assert.deepEqual(latestFilingsByStock(events), [base]);
  }
  // Deliberately nonchronological receipt number isolates the date tie breaker.
  assert.ok(compareFilingOrder({ ...base, receiptNo: "00000000000001" }, prior) > 0);
  assert.equal(compareFilingOrder({ ...base, basisDate: null }, { ...base, basisDate: base.receiptDate }), 0);
});

test("event changes keep correction, withdrawal, first-report and indirect exclusions", () => {
  const prior = { ...base, receiptNo: "20261103000001", receiptDate: "2026-11-03", quantity: "90" };
  for (const patch of [
    { isCorrectionOrWithdrawal: true }, { isCorrectionOrWithdrawal: null }, { correctionOf: prior.receiptNo },
    { kind: "new-report" }, { kind: "tracking-reentry" }, { source: "indirect-observation" },
  ] as Partial<FilingEvent>[]) {
    const current = { ...base, ...patch };
    assert.equal(filingChangesForEvents([prior, current]).has(current), false);
  }
  assert.equal(filingChangesForEvents([{ ...prior, isCorrectionOrWithdrawal: true }, base]).has(base), false);
  const estimated = { ...base, numericKind: "estimated" as const };
  assert.deepEqual(filingChangesForEvents([prior, estimated]).get(estimated), {
    quantity: "up", ownership: null, quantityDelta: "10", ownershipDelta: null,
  });
});

test("exact signed differences use shares and percentage points in both languages", () => {
  assert.equal(reportedDelta("9007199254740993", "9007199254740992"), "1");
  assert.equal(reportedDelta("9.74", "9.87"), "-0.13");
  assert.equal(reportedDelta("1.000", "1"), "0");
  assert.equal(reportedDelta("-2.5", "1.05"), "-3.55");
  assert.equal(reportedDelta("0.001", "0.01"), "-0.009");
  assert.equal(reportedDelta(null, "1"), null);
  assert.equal(reportedDelta("invalid", "1"), null);
  assert.equal(formatFilingDelta("59757", "quantity", "ko"), "+59,757주");
  assert.equal(formatFilingDelta("-18774", "quantity", "en"), "−18,774 shares");
  assert.equal(formatFilingDelta("-0.13", "ownership", "ko"), "−0.13%p");
  assert.equal(formatFilingDelta("0", "quantity", "ko"), "0주");
  assert.equal(filingDeltaLabel("59757", "quantity", "ko"), "수량 +59,757주");
  assert.equal(filingDeltaLabel("-0.13", "ownership", "en"), "Ownership −0.13%p");
});
