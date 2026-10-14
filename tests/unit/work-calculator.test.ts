import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {calculateBusinessDays as business,calculateAnnualLeave as leave,getKoreanHolidays,validateWorkDate,parseCustomHolidays,seoulToday,WorkDateError} from '../../src/features/work-calculator/workCalculator.ts';
import { dateOrdinal,addIsoDays,nextPeriodBoundary } from '../../src/features/work-calculator/workDate.ts';
import { substituteHolidays } from '../../src/features/work-calculator/koreanHolidays.ts';
// Expected dates/rules are sourced independently in docs/work-calculator-rules.md.
for(const [date,expected,name] of [
 ['2026-05-01',0,'노동절'],['2026-07-17',0,'제헌절'],['2026-06-03',0,'선거'],['2025-01-27',0,'임시공휴일'],['2025-06-03',0,'선거'],['2020-03-02',1,''],['2022-12-26',1,''],
 ['2025-05-01',1,''],['2025-07-17',1,''],['2007-07-17',0,'제헌절'],['2008-07-17',1,''],['2005-04-05',0,'식목일'],['2006-04-05',1,''],['2012-10-09',1,''],['2013-10-09',0,'한글날'],
 ['2021-08-16',0,'대체'],['2023-05-29',0,'대체'],['2026-09-28',1,''],['2027-05-03',0,'대체'],['2027-07-19',0,'대체'],
] as const)test(`official single-day regression ${date}`,()=>{const r=business(date,date);assert.equal(r.business,expected);assert.equal(r.total,1);if(name)assert.match(r.excluded[0].reason,new RegExp(name));});

test('strict date validation and ordering reject every empty/impossible/out-of-range value',()=>{
 for(const field of ['start','end','hire','asOf','custom'] as const)for(const value of ['','2026-','2026-2-01','2026-02-30','2025-02-29','2026-13-01','9999-01-01'])assert.throws(()=>validateWorkDate(value,field,'ko',field==='hire'||field==='asOf'?'leave':'business'),WorkDateError);
 assert.ok(Number.isInteger(validateWorkDate('2024-02-29','start')));assert.throws(()=>business('2026-01-02','2026-01-01'),(e:WorkDateError)=>e.code==='order');assert.throws(()=>leave('2026-02-01','2026-01-01','hire'),(e:WorkDateError)=>e.code==='order');assert.throws(()=>leave('','2026-01-01','hire'));assert.throws(()=>leave('2025-01-01','','hire'));
});
test('exclusion reasons preserve holidays, weekends and custom entries without duplicate subtraction',()=>{
 const r=business('2025-05-03','2025-05-07',['2025-05-05','2025-05-05','2024-12-31','2025-05-04']);assert.equal(r.total,5);assert.equal(r.business,1);assert.equal(r.excludedCount,4);
 assert.equal(r.excluded.find(d=>d.date==='2025-05-05')!.reasons.length,3);assert.equal(r.excluded.find(d=>d.date==='2025-05-04')!.reasons.length,2);
 assert.deepEqual(parseCustomHolidays('2026-03-02, 2026-03-02\n2026-03-03'),['2026-03-02','2026-03-03']);assert.throws(()=>parseCustomHolidays('2026-03-02 2026-02-30'));
 assert.equal(business('2026-01-05','2026-01-05').business,1);assert.equal(business('2026-01-04','2026-01-04').business,0);
});
test('summary conservation, lazy bounded pages, custom permutation and cache mutation protection',()=>{
 for(const [start,end] of [['2000-01-01','2050-12-31'],['2025-12-30','2026-01-03'],['2024-02-28','2024-03-01']]){
  const r=business(start,end);assert.equal(r.total,r.business+r.excludedCount);assert.ok(Number.isInteger(r.business)&&r.business>=0);assert.ok(r.excludedPage(0,40).items.length<=40);assert.equal(r.excluded.length,r.excludedCount);
 }
 assert.equal(business('2025-01-01','2025-12-31',['2025-02-03','2025-02-04']).business,business('2025-01-01','2025-12-31',['2025-02-04','2025-02-03']).business);
 const a=getKoreanHolidays(2025);a[0].name='changed';assert.notEqual(getKoreanHolidays(2025)[0].name,'changed');assert.equal(business('2027-01-01','2027-12-31').holidayInfo.status,'projected');assert.equal(business('2026-12-30','2027-01-02').holidayInfo.status,'mixed');
});
test('reviewed static lunar data works when Intl Dangi is unavailable or silently Gregorian',()=>{
 const original=Intl.DateTimeFormat;try{(Intl as any).DateTimeFormat=()=>{throw new Error('no dangi');};assert.ok(getKoreanHolidays(2033).some(h=>h.date==='2033-09-08'&&h.name==='추석'));(Intl as any).DateTimeFormat=function(){return {resolvedOptions:()=>({calendar:'gregory'})};};assert.ok(getKoreanHolidays(2040).some(h=>h.name==='설날'));}finally{Intl.DateTimeFormat=original;}
});
test('substitute claims deduplicate same original overlap, separate distinct collisions and cross year',()=>{
 assert.equal(getKoreanHolidays(2025).filter(h=>h.substitute&&h.date.startsWith('2025-05')).length,1);
 assert.ok(getKoreanHolidays(2017).some(h=>h.date==='2017-10-06'&&h.substitute));assert.ok(getKoreanHolidays(2027).some(h=>h.date==='2027-02-09'&&h.substitute));
 const synthetic=[{date:'2027-12-25',name:'A',group:'A',kind:'fixed' as const,rule:'any' as const},{date:'2027-12-26',name:'B',group:'B',kind:'fixed' as const,rule:'any' as const}];
 assert.deepEqual(substituteHolidays(synthetic,'ko').map(h=>h.date),['2027-12-27','2027-12-28']);
 assert.deepEqual(substituteHolidays([{date:'2028-12-31',name:'A',group:'A',kind:'fixed',rule:'any'},{date:'2029-01-01',name:'B',group:'B',kind:'fixed',rule:'none'}],'ko').map(h=>h.date),['2029-01-02']);
});
test('civil month expiry: Jan/Mar month end and leap February, with contiguous non-drifting periods',()=>{
 for(const [hire,before,on] of [['2026-01-31','2026-02-28','2026-03-01'],['2026-03-31','2026-04-30','2026-05-01'],['2024-01-31','2024-02-29','2024-03-01'],['2024-02-29','2024-03-28','2024-03-29'],['2026-01-30','2026-02-28','2026-03-01'],['2026-01-28','2026-02-27','2026-02-28'],['2026-01-29','2026-02-28','2026-03-01']]){
  assert.equal(leave(hire,before,'hire').monthly.total,0);assert.equal(leave(hire,on,'hire').monthly.total,1);
  const r=leave(hire,`${Number(hire.slice(0,4))+1}-12-31`,'hire');assert.equal(r.monthly.events.length,11);r.monthly.events.forEach((e,i)=>{assert.equal(e.date,addIsoDays(e.periodEnd,1));if(i)assert.equal(e.periodStart,r.monthly.events[i-1].date);assert.equal(e.date,nextPeriodBoundary(e.periodStart,1));});
 }
 assert.equal(leave('2026-01-31','2026-03-01','hire').monthly.events[0].date,'2026-03-01'); // Sunday+holiday: no business-day shift
});
test('hire anniversary grants, third year increment, maximum and leap renewal period',()=>{
 assert.equal(leave('2025-07-01','2026-06-30','hire').annual,null);assert.equal(leave('2025-07-01','2026-07-01','hire').annual?.days,15);assert.equal(leave('2025-07-01','2026-07-02','hire').annual?.days,15);
 assert.equal(leave('2023-07-01','2026-06-30','hire').annual?.days,15);assert.equal(leave('2023-07-01','2026-07-01','hire').annual?.days,16);assert.equal(leave('2000-01-01','2026-01-01','hire').annual?.days,25);
 assert.equal(leave('2024-02-29','2025-02-28','hire').annual,null);assert.equal(leave('2024-02-29','2025-03-01','hire').annual?.days,15);assert.equal(leave('2024-02-29','2028-02-29','hire').annual?.date,'2027-03-01');assert.equal(leave('2024-02-29','2028-03-01','hire').annual?.periodStart,'2027-03-01');
});
test('fiscal transition keeps monthly history independent and never combines alternate grants',()=>{
 for(const [asOf,count] of [['2025-12-31',5],['2026-01-01',6],['2026-06-01',11],['2026-07-01',11]] as const){const a=leave('2025-07-01',asOf,'hire'),b=leave('2025-07-01',asOf,'fiscal');assert.equal(b.monthly.total,count);assert.deepEqual(a.monthly,b.monthly);if(asOf>='2026-01-01'){assert.equal(b.annual?.days,15*184/365);assert.equal(b.annual?.date,'2026-01-01');}assert.equal('days' in b,false);}
 const small=leave('2025-12-31','2026-11-30','fiscal');assert.equal(small.monthly.total,10);assert.equal(small.annual?.days,15/365);assert.ok(small.annual!.days>0);assert.equal(small.nextEvent?.date,'2026-12-01');
 const leap=leave('2024-07-01','2025-01-01','fiscal');assert.equal(leap.annual?.numerator,184);assert.equal(leap.annual?.denominator,366);assert.equal(leap.annual?.days,15*184/366);
 assert.equal(leave('2000-01-01','2026-01-01','hire').monthly.total,null);assert.equal(leave('2000-01-01','2026-01-01','hire').annual?.days,25);
});
test('same-defined monthly cumulative events do not reverse with advancing asOf',()=>{let count=0;for(let day=dateOrdinal('2025-07-01');day<=dateOrdinal('2026-08-01');day++){const date=new Date(day*86400000).toISOString().slice(0,10),r=leave('2025-07-01',date,'fiscal');assert.ok(r.monthly.total!>=count);count=r.monthly.total!;}});
test('date-only results and Seoul today agree across UTC, LA DST and Kiritimati',()=>{
 const code=`import {calculateBusinessDays as b,calculateAnnualLeave as a,seoulToday} from './src/features/work-calculator/workCalculator.ts';console.log(JSON.stringify([b('2024-03-01','2024-11-10'),a('2024-02-29','2025-03-01','hire'),seoulToday(new Date('2026-10-13T16:00:00Z'))]));`;
 const runs=['UTC','America/Los_Angeles','Pacific/Kiritimati'].map(TZ=>execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code],{env:{...process.env,TZ},encoding:'utf8'}));assert.equal(new Set(runs).size,1);assert.equal(seoulToday(new Date('2026-10-13T16:00:00Z')),'2026-10-14');
});

test('fiscal-aligned full first year is an ordinary annual grant, not a prorated estimate',()=>{const r=leave('2025-01-01','2026-01-01','fiscal');assert.equal(r.annual?.kind,'annual');assert.equal(r.annual?.days,15);assert.equal(r.annual?.numerator,undefined);});

test('2025 annual official schedule plus weekends excludes121 of365 days',()=>{const r=business('2025-01-01','2025-12-31');assert.equal(r.excludedCount,121);assert.equal(r.business,244);});
