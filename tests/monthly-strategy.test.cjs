const {test}=require('node:test'), assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {strategy}=require('./fixtures/monthly-strategy.cjs');
const api=load('lib/reporting/monthlyStrategy.ts');
test('concise strategy handoff retains reasoning without prescribing calendar settings',()=>{
 const value=strategy();assert.deepEqual(api.parseMonthlyStrategy(value,new Set(['post:one'])),value);
 const brief=api.strategyBrief(value);for(const text of [value.direction,value.working,value.rationale,value.limitation])assert.ok(brief.includes(text));
 assert.doesNotMatch(brief,/WEEKLY PLAN|CHANNEL EXECUTION|posts per week|MONTHLY OBJECTIVE/);
});
test('rejects invented evidence, oversized prose and implementation-plan fields',()=>{
 for(const mutate of [s=>s.evidence[0].sourceId='invented',s=>s.direction='x'.repeat(481),s=>s.weeks=[],s=>s.channels=[],s=>s.questions=['Was this boosted?']]){const s=strategy();mutate(s);assert.throws(()=>api.parseMonthlyStrategy(s,new Set(['post:one'])));}
});
test('saved version-one reports hand off only strategy, without schedule or questions',()=>{
 const old=require('./fixtures/monthly-strategy.cjs').legacyStrategy();old.status='NEEDS_CONTEXT';old.questions=['Was this boosted?'];
 const brief=api.strategyBrief(old);assert.match(brief,/CONTENT STRATEGY V2/);assert.doesNotMatch(brief,/Decision stage|posts\/week|Was this boosted|MONTHLY/);
});
test('cohorts keep accounts and age groups separate and preserve unknown metrics and promotion',()=>{
 const post=(accountId,reach,age=2)=>({accountId,platform:'INSTAGRAM',postType:'REEL',publishedAt:'2026-11-01',snapshots:[{date:`2026-11-${String(age+1).padStart(2,'0')}`,reach,engagement:null}]});
 const groups=api.summarizeStrategyPosts([post('a',10),post('a',100),post('a',null),post('b',900),post('a',500,20)]);
 assert.equal(groups.length,3);assert.equal(groups[0].medianReach,55);assert.equal(groups[0].posts,3);assert.equal(groups[0].reachCoverage,2);assert.equal(groups[0].medianEngagement,null);assert.equal(groups[0].promotion,'UNKNOWN');
});
test('model call requests one plan, carries context and refuses invalid evidence',async()=>{
 const fs=require('node:fs');const mocks={};
 for(const match of fs.readFileSync('lib/openai.ts','utf8').matchAll(/from "(@\/[^\"]+)"/g))mocks[match[1]]={};
 mocks['@/lib/reporting/monthlyStrategy']=api;
 mocks['@/lib/content/model']=load('lib/content/model.ts');
 const oldFetch=global.fetch,oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';
 let request,output=strategy();global.fetch=async(_url,options)=>{request=JSON.parse(options.body);return{ok:true,status:200,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]})};};
 try{
 const model=load('lib/openai.ts',mocks);const input={clientName:'Wedding studio',businessSummary:'Wedding packages',periodStart:'2026-10-01',periodEnd:'2026-10-31',sampledPostCount:1,totalPostCount:1,accounts:[],posts:[{sourceId:'post:one'}],planningPlatforms:['INSTAGRAM'],planningContext:{promotion:'UNKNOWN'}};
 const result=await model.generateReportingInsights(input);assert.equal(result.length,1);assert.equal(result[0].strategy.direction,output.direction);assert.match(result[0].recommendation,/CONTENT STRATEGY V2/);assert.match(request.instructions,/Promotion is UNKNOWN/);assert.equal(request.tools[0].type,'web_search');assert.equal(JSON.parse(request.input).planningContext.promotion,'UNKNOWN');
 output=strategy();output.evidence[0].sourceId='fabricated';await assert.rejects(()=>model.generateReportingInsights(input),/unavailable evidence/);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
});
