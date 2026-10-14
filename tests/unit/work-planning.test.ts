import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBusinessDays, shiftBusinessDate, planVacation, workDayClassifier, WorkDateError } from '../../src/features/work-calculator/workCalculator.ts';

test('exclusive buckets conserve dates while every overlapping reason remains visible', () => {
 const result = calculateBusinessDays('2025-05-03','2025-05-09',['2025-05-04','2025-05-05','2025-05-07','2025-05-07']);
 assert.deepEqual(result.breakdown,{weekend:2,publicHoliday:2,customHoliday:1});
 assert.equal(result.business,2); assert.equal(result.total,result.business + Object.values(result.breakdown).reduce((a,b)=>a+b));
 assert.equal(workDayClassifier(['2025-05-05'])('2025-05-05').reasons.length,3);
 assert.equal(workDayClassifier(['2025-05-04'])('2025-05-04').reasons.length,2);
});
test('offset before/after, zero, working-only inclusion and shared public/custom rules', () => {
 assert.equal(shiftBusinessDate('2026-01-09',1,'after'), '2026-01-12');
 assert.equal(shiftBusinessDate('2026-01-12',1,'before'), '2026-01-09');
 assert.equal(shiftBusinessDate('2026-01-09',1,'after',true), '2026-01-09');
 assert.equal(shiftBusinessDate('2026-01-10',1,'after',true), '2026-01-12');
 assert.equal(shiftBusinessDate('2026-01-10',0,'before',true), '2026-01-10');
 assert.equal(shiftBusinessDate('2026-04-30',1,'after',false,['2026-05-04']), '2026-05-06');
 assert.equal(shiftBusinessDate('2026-05-06',1,'before',false,['2026-05-04']), '2026-04-30');
});
test('offset validates integers, supported inputs and both result boundaries', () => {
 for (const count of [-1,0.5,Infinity,NaN,18629,Number.MAX_SAFE_INTEGER]) assert.throws(()=>shiftBusinessDate('2026-01-09',count,'after'),RangeError);
 assert.throws(()=>shiftBusinessDate('','1' as any,'after'),WorkDateError);
 assert.throws(()=>shiftBusinessDate('2000-01-01',1,'before'),WorkDateError);
 assert.throws(()=>shiftBusinessDate('2050-12-31',1,'after'),WorkDateError);
});
test('vacation full days connect surrounding weekends; working half days split rest', () => {
 const full=planVacation([{date:'2026-01-09',units:1},{date:'2026-01-12',units:1}]);
 assert.equal(full.needed,2); assert.deepEqual(full.restPeriods,[{start:'2026-01-09',end:'2026-01-12',days:4}]);assert.equal(full.longestRest,4);
 const half=planVacation([{date:'2026-01-09',units:0.5},{date:'2026-01-12',units:1}]);
 assert.equal(half.needed,1.5); assert.deepEqual(half.restPeriods,[{start:'2026-01-10',end:'2026-01-12',days:3}]);
 assert.equal(planVacation([{date:'2026-01-09',units:0.5}]).longestRest,0);
 const holidayHalf=planVacation([{date:'2026-01-09',units:1},{date:'2026-01-12',units:1},{date:'2026-01-11',units:0.5}]);assert.equal(holidayHalf.needed,2);assert.equal(holidayHalf.longestRest,4);
});
test('vacation replacement, disjoint selections, holidays and support-boundary truncation', () => {
 assert.deepEqual(planVacation([]).restPeriods,[]);
 const p=planVacation([{date:'2026-01-09',units:1},{date:'2026-01-09',units:0.5},{date:'2026-01-16',units:1}]);
 assert.equal(p.entries.length,2);assert.equal(p.needed,1.5);assert.deepEqual(p.restPeriods,[{start:'2026-01-16',end:'2026-01-18',days:3}]);
 assert.equal(planVacation([{date:'2026-01-12',units:1}],['2026-01-12']).needed,0);
 assert.equal(planVacation([{date:'2000-01-01',units:1}]).rangeLimited,true);
 assert.equal(planVacation([{date:'2050-12-31',units:1}]).rangeLimited,true);
 assert.throws(()=>planVacation([{date:'1999-12-31',units:1}]),WorkDateError);
 assert.throws(()=>planVacation([{date:'2026-01-09',units:0.25 as any}]),RangeError);
});
