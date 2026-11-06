const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {calendarSlugBase}=load('lib/calendarSlug.ts');
test('calendar links normalize whitespace, accents and empty slugs',()=>{
 assert.equal(calendarSlugBase('  My New Brand! '),'my-new-brand');
 assert.equal(calendarSlugBase('Café Studio'),'cafe-studio');
 assert.equal(calendarSlugBase('✨'),'calendar');
});
function harness({collisions=[],allowed=true,race=false}={}){
 const calendar={id:'calendar',clientName:'Old Brand',slug:'old-brand'};let updates=0;
 const api=load('app/api/calendars/[id]/route.ts',{
 '@/lib/workspaceStorageCleanup':{},'@/lib/workspaceDeletion':{},'@/lib/workspaceUploadLocks':{},
 '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
 '@/lib/auth':{getCurrentCreator:async()=>({id:'owner'})},
 '@/lib/calendarPermissions':{hasCalendarPermission:async()=>allowed},'@/lib/r2':{},
 '@/lib/db':{db:{socialCalendar:{findUnique:async({where})=>where.id?calendar:collisions.includes(where.slug)?{id:'someone-else'}:where.slug===calendar.slug?{id:calendar.id}:null,update:async({data})=>{updates++;if(race&&updates===1)throw {code:'P2002'};Object.assign(calendar,data);return calendar;}}}},
 });
 return {calendar,updates:()=>updates,rename:name=>api.PATCH({json:async()=>({action:'update_details',clientName:name})},{params:Promise.resolve({id:'calendar'})})};
}
test('renaming saves the display name and public URL together',async()=>{
 const h=harness();const response=await h.rename('New Brand');assert.equal(response.status,200);assert.equal(h.calendar.clientName,'New Brand');assert.equal(h.calendar.slug,'new-brand');
});
test('existing public URLs are protected from collisions',async()=>{
 const h=harness({collisions:['new-brand','new-brand-2']});assert.equal((await h.rename('New Brand')).status,200);assert.equal(h.calendar.slug,'new-brand-3');
});
test('saving an unchanged name preserves its existing URL',async()=>{
 const h=harness();h.calendar.slug='old-brand-9';await h.rename('Old Brand');assert.equal(h.calendar.slug,'old-brand-9');
});
test('invalid names and unauthorized renames do not write',async()=>{
 const h=harness();assert.equal((await h.rename(123)).status,400);assert.equal(h.updates(),0);
 const denied=harness({allowed:false});assert.equal((await denied.rename('New Brand')).status,403);assert.equal(denied.updates(),0);
});
