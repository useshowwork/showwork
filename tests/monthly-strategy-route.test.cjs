const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const {strategy}=require('./fixtures/monthly-strategy.cjs');
function fixture({allowed=true,gate=null,history=[]}={}){
 let input,saved,quota=0,knowledgeQuery;
 const db={socialCalendar:{findUnique:async()=>({clientName:'Wedding studio'})},reportingInsight:{findMany:async()=>history},$transaction:async fn=>fn({reportingInsight:{createMany:async({data})=>{saved=data;}}})};
 const post={id:'one',platform:'INSTAGRAM',platformPostId:'native-1',publishedAt:new Date('2026-10-10'),connection:{id:'account-a'},calendarPost:{caption:'Wedding packages',postType:'CAROUSEL',category:'Education'},metricSnapshots:[{snapshotDate:new Date('2026-10-15'),reach:100,engagement:10,likes:7,comments:2,shares:1,saves:null,views:null,engagementRate:10,engagementRateBasis:'reach',clicks:3,impressions:120}]};
 const report={posts:[post],accountPosts:[{id:'duplicate',connectionId:'account-a',platform:'INSTAGRAM',platformPostId:'native-1',publishedAt:'2026-10-10',reach:100}],connections:[{id:'account-a',platform:'INSTAGRAM',status:'CONNECTED',username:'studio',lastSyncAt:new Date('2026-10-15'),accountMetricSnapshots:[]}],comparisonPeriod:{start:'2026-09-01'},performance:{reach:{value:100}},leads:null};
 const api=load('app/api/calendars/[id]/reporting/analyze/route.ts',{
 '@/lib/db':{db},'@/lib/auth':{getCurrentCreator:async()=>({id:'manager'})},
 '@/lib/calendarPermissions':{hasCalendarPermission:async()=>allowed,canAccessCalendarById:async()=>true,calendarFeatureGate:async()=>gate},
 '@/lib/contentWorkspaceUsage':{consumeCalendarAiGeneration:async()=>{quota++;return{allowed:true};}},
 '@/lib/knowledge/context':{getBusinessKnowledgeContext:async(_id,query)=>{knowledgeQuery=query;return 'Documented wedding packages';}},
 '@/lib/reporting/data':{reportingPeriod:()=>({start:new Date('2026-10-01'),end:new Date('2026-10-31')}),getCalendarReportingData:async()=>report},
 '@/lib/openai':{generateReportingInsights:async value=>{input=value;return[{platform:'ALL',type:'RECOMMENDATION',title:'Monthly plan',description:'Diagnosis',recommendation:'Complete plan',evidence:'post:one',strategy:strategy()}];}},
 });
 return {post:body=>api.POST(new Request('http://localhost/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id:'calendar'})}),get input(){return input;},get saved(){return saved;},get quota(){return quota;},get knowledgeQuery(){return knowledgeQuery;}};
}
const body={from:'2026-10-01',to:'2026-10-31',platform:'INSTAGRAM',objective:'Qualified enquiries'};
test('analysis carries manager context, scoped history, cohort summaries and metric bases, preserving one version',async()=>{
 const history=[{generatedAt:new Date(),supportingData:{scope:'INSTAGRAM',connectionIds:['account-a'],strategy:strategy()}},{generatedAt:new Date(),supportingData:{scope:'FACEBOOK',connectionIds:['account-a'],strategy:strategy()}},{generatedAt:new Date(),supportingData:{scope:'INSTAGRAM',connectionIds:['removed'],strategy:strategy()}}];
 const f=fixture({history});const result=await f.post(body);assert.equal(result.status,200);assert.equal(f.quota,1);assert.equal(f.input.posts.length,1,'native duplicate excluded within the same account');assert.equal(f.input.posts[0].promotionStatus,'UNKNOWN');assert.equal(f.input.posts[0].snapshots[0].engagementRateBasis,'reach');assert.equal(f.input.posts[0].snapshots[0].clicks,3);assert.equal(f.input.priorStrategies.length,1);assert.match(f.knowledgeQuery,/Qualified enquiries/);assert.match(f.input.planningContext.promotion,/UNKNOWN/);assert.equal(f.input.planningContext.targetMonth,undefined);assert.ok(f.input.accounts.some(item=>item.sourceId.startsWith('cohort:')));assert.equal(f.saved.length,1);assert.equal(f.saved[0].supportingData.scope,'INSTAGRAM');assert.equal(f.saved[0].supportingData.strategy.version,2);
});
test('analysis rejects invalid context before quota or model execution',async()=>{
 for(const change of [{objective:'x'.repeat(4001)},{objective:123}]){const f=fixture();assert.equal((await f.post({...body,...change})).status,400);assert.equal(f.quota,0);assert.equal(f.input,undefined);}
});
test('analytics permission is required before analysis',async()=>{const f=fixture({allowed:false});assert.equal((await f.post(body)).status,403);assert.equal(f.quota,0);});
