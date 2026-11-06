const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-typescript.cjs');
const plan = load('lib/knowledge/researchPlan.ts');
test('plan validates limits and normalizes domains without accepting arbitrary protocols', () => {
  assert.deepEqual(plan.parseResearchPlan({goal:' Leads ',audience:'Teams',priorities:'Questions',excludedDomains:['','https://www.example.com/news','example.com']}), {goal:'Leads',audience:'Teams',priorities:'Questions',excludedDomains:['example.com']});
  assert.throws(() => plan.parseResearchPlan({goal:'x'.repeat(1201),audience:'',priorities:'',excludedDomains:[]}));
  assert.throws(() => plan.parseResearchPlan({goal:'',audience:'',priorities:'',excludedDomains:['not-a-domain']}));
});
test('source exclusions block subdomains but not lookalike domains, and reject executable URLs', () => {
  assert.equal(plan.sourceAllowed('https://news.example.com/a',['example.com']),false);
  assert.equal(plan.sourceAllowed('https://notexample.com/a',['example.com']),true);
  assert.equal(plan.sourceAllowed('javascript:alert(1)',[]),false);
});
test('brief handoff is workspace scoped, consumed once, and does not trigger generation', () => {
  const events=[]; global.window={dispatchEvent:e=>events.push(e)};global.CustomEvent=class {constructor(type){this.type=type;}};
  const storage=new Map();global.sessionStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)};
  try {
    const h=load('lib/knowledge/researchHandoff.ts');
    const text=h.opportunityInstructions({title:'Audience objection',learning:'Evidence',application:'Test a demonstration',sourceUrls:['https://example.com']});
    assert.match(text,/hypothesis/);assert.match(text,/https:\/\/example.com/);
    h.queueResearchBrief('a',text);assert.equal(h.consumeResearchBrief('b'),undefined);assert.equal(h.consumeResearchBrief('a'),text);assert.equal(h.consumeResearchBrief('a'),undefined);assert.equal(events.length,1);
  } finally { delete global.window;delete global.CustomEvent;delete global.sessionStorage; }
});
function apiHarness() {
  const writes=[];let allowed=true;
  const runs=[{id:'run-a',calendarId:'a',status:'SUCCEEDED',result:{findings:[{id:'finding-1'}]},excludedFindingIds:[],findingFeedback:null}];
  const db={socialCalendar:{update:async args=>{writes.push(args);return args;}},$queryRaw:async()=>[],businessResearchRun:{findFirst:async({where})=>runs.find(r=>r.id===where.id&&r.calendarId===where.calendarId),update:async args=>{writes.push(args);return args;}}};db.$transaction=async fn=>fn(db);
  const api=load('app/api/calendars/[id]/research/route.ts',{
    'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status??200})},after:()=>{throw Error('Unexpected paid research');}},
    '@/lib/auth':{getCurrentCreator:async()=>({id:'manager'})},
    '@/lib/calendarPermissions':{hasCalendarPermission:async()=>allowed,canAccessCalendarById:async()=>true,calendarFeatureGate:async()=>null},
    '@/lib/db':{db},'@/lib/knowledge/research':{},'@/lib/knowledge/retrieval':{},
  });
  return {writes,api,setAllowed:v=>allowed=v,patch:(id,body)=>api.PATCH({json:async()=>body},{params:Promise.resolve({id})})};
}
test('saved plans require workspace permission and do not execute research',async()=>{
  const h=apiHarness();const body={action:'savePlan',plan:{goal:'Enquiries',audience:'Teams',priorities:'Pricing questions',excludedDomains:[]}};
  h.setAllowed(false);assert.equal((await h.patch('a',body)).status,403);assert.equal(h.writes.length,0);
  h.setAllowed(true);assert.equal((await h.patch('a',body)).status,200);assert.equal(h.writes[0].where.id,'a');assert.equal(h.writes[0].data.researchPlan.goal,'Enquiries');
});
test('feedback cannot alter a different workspace and excludes rejected findings atomically',async()=>{
  const h=apiHarness();const body={runId:'run-a',findingId:'finding-1',excluded:true,verdict:'incorrect',note:'Wrong market'};
  assert.equal((await h.patch('b',body)).status,404);assert.equal(h.writes.length,0);
  assert.equal((await h.patch('a',body)).status,200);assert.deepEqual(h.writes[0].data.excludedFindingIds,['finding-1']);assert.equal(h.writes[0].data.findingFeedback['finding-1'].note,'Wrong market');
});
test('research combines plan, knowledge and manager feedback while keeping private evidence out of the public focus',async()=>{
  const calls=[];const updates=[];
  const db={
    businessResearchRun:{updateMany:async args=>{updates.push(args);return {count:1}},findUniqueOrThrow:async()=>({id:'run',calendarId:'a',focus:'Audience questions',calendar:{clientName:'Business',researchPlan:{goal:'Enquiries',audience:'Teams',priorities:'Objections',excludedDomains:['excluded.test']}}}),findMany:async()=>[{findingFeedback:{f:{verdict:'incorrect',note:'Wrong audience'}},result:{findings:[{id:'f',title:'Old claim',learning:'Old learning'}]}}]},
    calendarBusinessDocument:{findMany:async()=>[{websiteUrl:'https://business.test'}]},socialCalendar:{update:async()=>{}}
  };
  const research=load('lib/knowledge/research.ts',{'@/lib/db':{db},'@/lib/openai':{researchBusinessWithSources:async(...args)=>{calls.push(args);return {summary:'Report',findings:[],unknowns:[],sources:[]}}},'./context':{getBusinessKnowledgeContext:async()=> 'PRIVATE DOCUMENT EVIDENCE'},'./retrieval':{}});
  await research.executeBusinessResearch('run');
  assert.equal(calls.length,1);assert.match(calls[0][1],/Enquiries/);assert.match(calls[0][1],/business.test/);assert.doesNotMatch(calls[0][1],/PRIVATE|Wrong audience/);
  assert.match(calls[0][3],/PRIVATE DOCUMENT EVIDENCE/);assert.match(calls[0][3],/Wrong audience/);assert.deepEqual(calls[0][4],['excluded.test']);assert.ok(updates.some(u=>u.data.status==='SUCCEEDED'));
});
test('Randy confirmed-topic research excludes saved preferences and websites from the public query',async()=>{
 const calls=[];const db={businessResearchRun:{updateMany:async()=>({count:1}),findUniqueOrThrow:async()=>({id:'run',calendarId:'w',focus:'Confirmed public topic',calendar:{clientName:'Public Brand',researchPlan:{goal:'PRIVATE GOAL',audience:'PRIVATE AUDIENCE',priorities:'PRIVATE PRIORITIES',excludedDomains:[]}}}),findMany:async()=>[]},calendarBusinessDocument:{findMany:async()=>[{websiteUrl:'https://unconfirmed-site.test'}]},socialCalendar:{update:async()=>{}}};
 const research=load('lib/knowledge/research.ts',{'@/lib/db':{db},'@/lib/openai':{researchBusinessWithSources:async(...args)=>{calls.push(args);return{summary:'Synthetic',findings:[],sources:[],unknowns:[]}}},'./context':{getBusinessKnowledgeContext:async()=> 'PRIVATE DOCUMENT EVIDENCE'},'./retrieval':{}});
 await research.executeBusinessResearch('run',{publicTopicOnly:true});
 assert.equal(calls[0][1],'Confirmed public topic');assert.doesNotMatch(calls[0][1],/PRIVATE|unconfirmed-site/);assert.match(calls[0][3],/PRIVATE GOAL/);
});
