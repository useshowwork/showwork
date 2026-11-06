const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
process.env.CONTENT_BRIEF_GENERATION_ENABLED='false';
const originalEnv={...process.env},originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];Object.assign(process.env,originalEnv);});
const brief={audience:'Small studio owners',objective:'Help evaluate workflow fit',centralMessage:'Make handovers understandable',sequence:'Recognise the problem, demonstrate the method, invite evaluation',angles:Array.from({length:4},(_,i)=>({tension:`Problem ${i}`,approach:`Distinct treatment ${i}`,execution:`Film practical scene ${i}`,evidenceBoundary:'No invented outcomes'}))};
const post=(platform='INSTAGRAM',contentUnit=1)=>({platform,contentUnit,postType:'Image',category:'Education',hook:'A concrete hook',script:'',caption:'Supported explanation',contentIdea:'A specific scene',cta:'Save for your next handover',hashtags:'#workflow'});
const api=()=>load('lib/content/creativeGeneration.ts',{'@/lib/db':{db:{}}});
test('memory reads only the workspace and deduplicates shared-platform copies',async()=>{
 process.env.CONTENT_CREATIVE_PIPELINE_ENABLED='true';let query;
 const mod=load('lib/content/creativeGeneration.ts',{'@/lib/db':{db:{calendarPost:{findMany:async q=>{query=q;return [{platform:'INSTAGRAM',hook:'h',contentIdea:'idea',caption:'caption'},{platform:'FACEBOOK',hook:'h',contentIdea:'idea',caption:'caption'}];}}}}});
 const rows=await mod.recentContentMemory('workspace-a');assert.deepEqual(query.where,{calendarId:'workspace-a',deletedAt:null});assert.equal(query.take,60);assert.equal(rows.length,1);
});
test('disabled creative pipeline does not read content memory',async()=>{delete process.env.CONTENT_CREATIVE_PIPELINE_ENABLED;assert.deepEqual(await api().recentContentMemory('workspace'),[]);});
test('planner receives business facts, request, history and stream boundaries',async()=>{
 const planned=await api().planCampaign(async input=>{assert.equal(input.attempts,1);assert.equal(input.timeoutMs,45000);const body=JSON.parse(input.input);assert.equal(body.customInstructions,'Omit unverified prices');assert.equal(body.recentContent.length,1);assert.match(input.instructions,/NOT verified business evidence/);return JSON.stringify(brief);},{businessSummary:'Verified offerings',customInstructions:'Omit unverified prices',recentContent:[{platform:'INSTAGRAM',hook:'Previous hook',idea:'Previous idea',caption:'Previous caption'}],streams:[{id:'ALL',platforms:['INSTAGRAM','FACEBOOK']}],unitCount:3});
 assert.equal(JSON.parse(planned).angles.length,4);
});
test('invalid or oversized plans fail before drafting rather than pretending planning succeeded',async()=>{
 await assert.rejects(api().planCampaign(async()=>JSON.stringify({...brief,angles:[]}),{businessSummary:'Facts',streams:[{id:'ALL',platforms:['INSTAGRAM']}],unitCount:1}),/incomplete/);
 await assert.rejects(api().planCampaign(()=>assert.fail('paid call'),{businessSummary:'Facts',streams:[{id:'ALL',platforms:['INSTAGRAM']}],unitCount:61}),/shorter date range/);
});
test('review cannot mutate dates, platform identity or content unit even if model includes extra fields',async()=>{
 const input={...post(),postDate:'2026-10-26'};
 const result=await api().reviewCreativeBatch(async()=>JSON.stringify({edits:[{id:'0',platform:'X',contentUnit:99,postDate:'2030-01-01',changes:[{field:'caption',value:'Improved supported caption'}]}]}),[input],{brief:JSON.stringify(brief),businessSummary:'Facts'});
 assert.equal(result[0].platform,'INSTAGRAM');assert.equal(result[0].contentUnit,1);assert.equal(result[0].postDate,'2026-10-26');assert.equal(result[0].caption,'Improved supported caption');
});
test('missing, duplicate or invented review IDs are rejected',async()=>{
 for(const edits of [[],[{...post(),id:'99'}],[{...post(),id:'0'},{...post(),id:'0'}]])await assert.rejects(api().reviewCreativeBatch(async()=>JSON.stringify({edits}),[post()],{brief:'brief',businessSummary:'facts'}),/review returned/);
});
test('review is batched and later batches see prior edits for duplicate awareness',async()=>{
 let calls=0;const posts=Array.from({length:13},(_,i)=>({...post('INSTAGRAM',i+1),hook:`Original ${i}`}));
 const output=await api().reviewCreativeBatch(async request=>{calls++;const input=JSON.parse(request.input);assert.ok(input.items.length<=3);if(calls===3)assert.equal(input.overview[0].hook,'Edited 0');return JSON.stringify({edits:input.items.map(item=>({id:item.id,changes:[{field:'hook',value:`Edited ${item.id}`}]}))});},posts,{brief:'brief',businessSummary:'facts'});
 assert.equal(calls,5);assert.equal(output.length,13);assert.equal(output[12].hook,'Edited 12');
});
for(const [strategy,groups,expectedCanonical] of [['SAME_CONTENT',undefined,1],['DIFFERENT_CONTENT',undefined,2],['CUSTOM_GROUPS',[['INSTAGRAM','FACEBOOK']],1]]){
 test(`full generation preserves ${strategy} distribution through plan and review`,async()=>{
  process.env.CONTENT_CREATIVE_PIPELINE_ENABLED='true';process.env.OPENAI_API_KEY='fixture-only';const stages=[];
  global.fetch=async(_url,init)=>{const body=JSON.parse(init.body),name=body.text?.format?.name;assert.equal(body.model,'gpt-6.1-sol');assert.deepEqual(body.reasoning,{effort:name==='creative_campaign_brief'?'medium':'low'});assert.ok(body.max_output_tokens>=4096);stages.push(name);let output;
   if(name==='creative_campaign_brief')output=brief;
   else if(name==='content_calendar'){assert.match(body.input,/CREATIVE CAMPAIGN PLAN/);output={posts:expectedCanonical===1?[post()]:[post(),post('FACEBOOK')]};}
   else if(name==='creative_content_edits'){const input=JSON.parse(body.input);output={edits:input.items.map(item=>({id:item.id,changes:[{field:'caption',value:`Edited for ${item.platform}`}]}))};}
   else assert.fail(`Unexpected model call: ${name}`);
   return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
  };
  const {generateContentCalendar}=load('lib/openai.ts',{'@/lib/db':{db:{}}});
  const posts=await generateContentCalendar({clientName:'Studio',businessSummary:'Studio services',startDate:'2026-10-26',endDate:'2026-11-01',postsPerWeek:1,platforms:['INSTAGRAM','FACEBOOK'],contentStrategy:strategy,contentGroups:groups});
  assert.deepEqual(stages,['creative_campaign_brief','content_calendar','creative_content_edits']);assert.equal(posts.length,2);assert.ok(posts.every(p=>p.postDate==='2026-10-28'));
  if(expectedCanonical===1)assert.equal(posts[0].caption,posts[1].caption);else assert.notEqual(posts[0].caption,posts[1].caption);
 });
}
test('sparse review preserves strong posts and rejects edits to protected fields',async()=>{
 const original=post();
 const kept=await api().reviewCreativeBatch(async()=>JSON.stringify({edits:[{id:'0',changes:[]}]}),[original],{brief:'brief',businessSummary:'facts'});
 assert.deepEqual(kept,[original]);
 await assert.rejects(api().reviewCreativeBatch(async()=>JSON.stringify({edits:[{id:'0',changes:[{field:'platform',value:'X'}]}]}),[original],{brief:'brief',businessSummary:'facts'}),/invalid content/);
});
test('review has at most two batches in flight and preserves every item',async()=>{
 let active=0,max=0;const items=Array.from({length:10},(_,i)=>post('INSTAGRAM',i+1));
 const edited=await api().reviewCreativeBatch(async request=>{active++;max=Math.max(max,active);const input=JSON.parse(request.input);await new Promise(resolve=>setTimeout(resolve,2));active--;return JSON.stringify({edits:input.items.map(p=>({id:p.id,changes:[]}))});},items,{brief:'brief',businessSummary:'facts'});
 assert.equal(max,2);assert.deepEqual(edited,items);
});
