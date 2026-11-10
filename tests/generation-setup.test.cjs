const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {initialGenerationDates,generationFrequencyError}=load('lib/content/generationSetup.ts');
const {contentSlots}=load('lib/content/schedule.ts');
test('default date range is exactly one inclusive week, including month and year rollover',()=>{
 for(const [date,start,end] of [[new Date(2026,10,10),'2026-11-10','2026-11-16'],[new Date(2026,11,29),'2026-12-29','2027-01-04'],[new Date(2028,1,26),'2028-02-26','2028-03-03']]){
   const range=initialGenerationDates(date);assert.deepEqual(range,{start,end});assert.equal(contentSlots(range.start,range.end,7).length,7);
 }
});
test('cleared, zero, fractional and out-of-range frequencies cannot proceed',()=>{
 for(const value of ['', ' ', '0', '-1','1.5','15','NaN','Infinity']) assert.ok(generationFrequencyError(value),value);
 for(let number=1;number<=14;number++) assert.equal(generationFrequencyError(String(number)),null);
});
