const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./helpers/load-typescript.cjs');
const baseConnection=(id,status)=>({id,platform:'INSTAGRAM',platformAccountId:id,status,connectedAt:new Date('2026-10-01'),disconnectedAt:status==='DISCONNECTED'?new Date('2026-11-08'):null,lastSyncAt:new Date('2026-11-07'),accountMetricSnapshots:[{snapshotDate:new Date('2026-11-07'),followers:200,reach:100,views:1000,engagement:10}],accountPosts:[{id,platformPostId:id,caption:id,publishedAt:new Date('2026-11-05'),metricsUpdatedAt:new Date(),views:1000,reach:100,engagement:10,likes:10,comments:0,shares:0,saves:0,impressions:null}]});
const insight=(id,platform,date,ids)=>({id,platform,generatedAt:new Date(date),supportingData:ids?{connectionIds:ids}:{},recommendation:'Try '+id});
function fixture(connections,insights=[]){
 const queries=[];
 const db={socialConnection:{findMany:async()=>connections,findFirst:async args=>args.where.disconnectedAt?{disconnectedAt:new Date('2026-11-08')}:null},publishedSocialPost:{findMany:async args=>{queries.push(args);return connections.map(c=>({id:c.id,platform:c.platform,publishedAt:new Date('2026-11-05'),metricSnapshots:[],connection:{id:c.id,status:c.status},calendarPost:{caption:c.id,postType:'POST',assets:[]}}));}},reportingInsight:{findMany:async()=>insights},calendarLead:{count:async args=>{queries.push(args);return 0;},findMany:async()=>[]}};
 const api=load('lib/reporting/data.ts',{'@/lib/db':{db},'@/lib/calendarPermissions':{canUseCalendarFeature:async()=>true},'@/lib/r2':{publicUrlFor:()=>null}});
 return {queries,report:client=>api.getCalendarReportingData('workspace',new URLSearchParams({from:'2026-11-01',to:'2026-11-10'}),!client)};
}
test('disconnected account metrics and posts disappear even if stored history still exists',async()=>{
 for(const client of [false,true]){
 const f=fixture([baseConnection('old','DISCONNECTED'),baseConnection('current','CONNECTED')]);const report=await f.report(client);
 assert.deepEqual(report.connections.map(c=>c.id),['current']);assert.deepEqual(report.accountPosts.map(p=>p.connectionId),['current']);assert.deepEqual(report.posts.map(p=>p.id),['current']);assert.equal(report.performance.followers.value,200);assert.equal(report.performance.reach.value,100);
 assert.deepEqual(f.queries[0].where.connection.status.in,['CONNECTED','NEEDS_REAUTH']);
 }
});
test('disconnecting all accounts leaves no historical social results or AI recommendations',async()=>{
 const report=await fixture([baseConnection('old','DISCONNECTED')],[insight('old','INSTAGRAM','2026-11-07')]).report(false);
 assert.equal(report.connections.length,0);assert.equal(report.accountPosts.length,0);assert.equal(report.posts.length,0);assert.equal(report.insights.length,0);assert.equal(report.performance.followers.value,null);
});
test('analysis based on old or disconnected sources is hidden; fresh current-source analysis remains',async()=>{
 const f=fixture([baseConnection('current','CONNECTED')],[
 insight('legacy-all',null,'2026-11-07'),insight('old-source','INSTAGRAM','2026-11-09',['disconnected']),insight('current-source','INSTAGRAM','2026-11-09',['current']),insight('other-platform','FACEBOOK','2026-11-09'),
 ]);const report=await f.report(false);assert.deepEqual(report.insights.map(i=>i.id),['current-source']);
 const lead=f.queries[1].where.AND[0].OR;
 assert.deepEqual(lead[0],{socialConversation:null});assert.deepEqual(lead[1].socialConversation.connection.status.in,['CONNECTED','NEEDS_REAUTH']);
});

test('monthly strategies use the exact platform scope and newest version only',async()=>{
 const current=baseConnection('current','CONNECTED');
 const make=(id,scope,date)=>({...insight(id,null,date,['current']),supportingData:{version:1,scope,connectionIds:['current'],strategy:{version:1,title:id}}});
 const f=fixture([current],[make('latest','ALL','2026-11-11'),make('older','ALL','2026-11-10'),make('instagram-only','INSTAGRAM','2026-11-12')]);
 const report=await f.report(false);assert.deepEqual(report.insights.map(item=>item.id),['latest']);assert.equal(report.insights[0].strategy.title,'latest');
});
