const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const stamp=date=>new Date(date+'T12:00:00Z');
const leads=[
 {id:'old',calendarId:'workspace',createdAt:stamp('2026-10-01'),status:'LOST',milestones:[{kind:'HOT',occurredAt:stamp('2026-11-03')},{kind:'CUSTOMER',occurredAt:stamp('2026-11-05')}]},
 {id:'new',calendarId:'workspace',createdAt:stamp('2026-11-02'),temperature:'HOT',status:'QUALIFIED',milestones:[{kind:'HOT',occurredAt:stamp('2026-11-04')},{kind:'HOT',occurredAt:stamp('2026-11-09')}]},
 {id:'outside',calendarId:'workspace',createdAt:stamp('2026-10-01'),status:'CUSTOMER',temperature:'WARM',milestones:[{kind:'CUSTOMER',occurredAt:stamp('2026-10-31')}]},
 {id:'other',calendarId:'other-workspace',createdAt:stamp('2026-11-02'),milestones:[{kind:'CUSTOMER',occurredAt:stamp('2026-11-05')}]},
];
function fixture(missingMigration=false,historyStart=stamp('2026-09-01')){
 const db={socialConnection:{findMany:async()=>[],findFirst:async()=>null},publishedSocialPost:{findMany:async()=>[]},reportingInsight:{findMany:async()=>[]},
 leadAnalyticsTracking:{findUnique:async()=>{if(missingMigration)throw Object.assign(Error('Missing table'),{code:'P2021'});return {startedAt:historyStart};}},
 calendarLead:{count:async({where})=>leads.filter(lead=>{
  if(lead.calendarId!==where.calendarId)return false;
  if(where.temperature && lead.temperature!==where.temperature)return false;
  if(typeof where.status==='string' && lead.status!==where.status)return false;
  if(where.status?.notIn?.includes(lead.status))return false;
  if(where.createdAt?.gte && lead.createdAt<where.createdAt.gte)return false;
  if(where.createdAt?.lte && lead.createdAt>where.createdAt.lte)return false;
  if(where.milestones){const event=where.milestones.some;return lead.milestones.some(m=>m.kind===event.kind&&m.occurredAt>=event.occurredAt.gte&&m.occurredAt<=event.occurredAt.lte);}
  return true;
 }).length,findMany:()=>assert.fail('Clients must not query private lead identities')},};
 return load('lib/reporting/data.ts',{'@/lib/db':{db},'@/lib/calendarPermissions':{canUseCalendarFeature:async()=>true},'@/lib/r2':{publicUrlFor:()=>null}}).getCalendarReportingData;
}
test('October leads converted in November count in November, and repeated hot events count once',async()=>{
 const report=await fixture()('workspace',new URLSearchParams({from:'2026-11-01',to:'2026-11-13'}),false,false,true);
 assert.equal(report.leads.total,3);assert.equal(report.leads.acquired.value,1);assert.equal(report.leads.hotCount,2);assert.equal(report.leads.customers,1);
 assert.deepEqual(report.leads.hottest,[]);assert.equal(report.leads.milestoneCountsAvailable,true);
});
test('a missing migration shows current customers without claiming conversion-date accuracy',async()=>{
 const report=await fixture(true)('workspace',new URLSearchParams({from:'2026-11-01',to:'2026-11-13'}),false,false,true);
 assert.equal(report.leads.acquired.value,1);assert.equal(report.leads.hotCount,1);assert.equal(report.leads.customers,1);assert.equal(report.leads.milestoneBasis,'current');assert.equal(report.leads.historyStartedAt,null);
});

test('a conversion recorded after tracking began stays visible when the selected range starts earlier',async()=>{
 const report=await fixture(false,stamp('2026-11-03'))('workspace',new URLSearchParams({from:'2026-11-01',to:'2026-11-13'}),false,false,true);
 assert.equal(report.leads.customers,1);assert.equal(report.leads.milestoneBasis,'tracked-period');assert.equal(report.leads.milestoneCountsComplete,false);
});
