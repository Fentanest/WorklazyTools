import assert from 'node:assert/strict';
import { LUNAR_ANCHORS } from '../src/features/work-calculator/lunarAnchors.ts';
// Independent ICU cross-check for updating the build-time table; not a runtime dependency.
const formatter = new Intl.DateTimeFormat('en-US-u-ca-dangi',{month:'numeric',day:'numeric',timeZone:'Asia/Seoul'});
assert.equal(formatter.resolvedOptions().calendar,'dangi','Dangi unsupported: do not regenerate from Gregorian values');
const found={};
for(let year=2000;year<=2050;year++){
 const anchors=[];
 for(let time=Date.UTC(year,0,1,3);time<Date.UTC(year+1,0,1,3);time+=86400000){
  const p=formatter.formatToParts(new Date(time));const month=p.find(x=>x.type==='month')?.value;const day=Number(p.find(x=>x.type==='day')?.value);
  if(!month||!/^[0-9]+$/.test(month))continue; // exclude intercalary months
  const index=Number(month)===1&&day===1?0:Number(month)===4&&day===8?1:Number(month)===8&&day===15?2:-1;
  if(index>=0)anchors[index]=new Date(time).toISOString().slice(0,10);
 }
 found[year]=anchors;
}
const mismatches=Object.entries(found).filter(([year,dates])=>JSON.stringify(dates)!==JSON.stringify(LUNAR_ANCHORS[year]));
console.log(JSON.stringify({calendar:formatter.resolvedOptions().calendar,years:51,anchors:153,mismatches},null,2));
if(mismatches.length)process.exitCode=1;
