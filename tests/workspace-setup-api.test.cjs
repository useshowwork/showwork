const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
const {load}=require('./helpers/load-typescript.cjs');
const fresh={enabled:true,publishingChosen:false,autoPublishEnabled:false,hasKnowledge:false,hasBrandVoice:false,hasChannels:false,hasContent:false,complete:false};
function harness({state=fresh,creator={id:'owner'},allowed=true}={}){
 const writes=[];
 const api=load('app/api/calendars/[id]/setup/route.ts',{
  '@/lib/auth':{getCurrentCreator:async()=>creator},
  '@/lib/calendarPermissions':{hasCalendarPermission:async()=>allowed},
  '@/lib/workspaceSetupServer':{getWorkspaceSetup:async()=>state},
  '@/lib/db':{db:{socialCalendar:{update:async args=>{writes.push(args);return {};}}}},
 });
 const request=(body,origin='http://localhost:3000')=>new NextRequest('http://localhost:3000/api/calendars/work/setup',{method:'PATCH',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 return {api,writes,request,context:{params:Promise.resolve({id:'work'})}};
}
test('setup rejects unauthorized changes and invalid origins',async()=>{
 for(const options of [{creator:null},{allowed:false}]){const h=harness(options);const r=await h.api.PATCH(h.request({action:'publishing',autoPublishEnabled:true}),h.context);assert.equal(r.status,options.creator===null?401:403);assert.equal(h.writes.length,0);}
 const h=harness();assert.equal((await h.api.PATCH(h.request({action:'complete'},'https://other.example'),h.context)).status,403);assert.equal(h.writes.length,0);
});
test('manual publishing is an explicit saved choice, not an unfinished step',async()=>{
 const h=harness();assert.equal((await h.api.PATCH(h.request({action:'publishing',autoPublishEnabled:false}),h.context)).status,200);assert.equal(h.writes[0].data.autoPublishEnabled,false);assert.ok(h.writes[0].data.publishingPreferenceSetAt instanceof Date);
});
test('cannot finish setup before knowledge and content are ready',async()=>{
 const h=harness();assert.equal((await h.api.PATCH(h.request({action:'complete'}),h.context)).status,409);assert.equal(h.writes.length,0);
 const ready=harness({state:{...fresh,publishingChosen:true,hasKnowledge:true,hasBrandVoice:true,hasChannels:false,hasContent:true}});assert.equal((await ready.api.PATCH(ready.request({action:'complete'}),ready.context)).status,200);assert.ok(ready.writes[0].data.setupCompletedAt instanceof Date);
});
test('first-time generation is blocked before enqueueing or canonical dispatch',async()=>{
 const api=load('app/api/calendars/[id]/ai-generate/route.ts',{
 '@/lib/knowledge/generationPreflight':{generationPreflight:async req=>req},
 '@/lib/auth':{getCurrentCreator:async()=>({id:'owner'})},
 '@/lib/calendarPermissions':{hasCalendarPermission:async()=>true},
 '@/lib/workspaceSetupServer':{getWorkspaceSetup:async()=>fresh},
 '@/lib/aiGenerationJobs':{enqueueAiGeneration:()=>assert.fail('must not enqueue')},
 '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>assert.fail('must not dispatch')},
 });
 const req=new NextRequest('http://localhost:3000/api/calendars/work/ai-generate',{method:'POST',body:'{}'});
 assert.equal((await api.POST(req,{params:Promise.resolve({id:'work'})})).status,409);
});
