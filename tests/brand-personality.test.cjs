const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');
const brand=load('lib/knowledge/brandPersonality.ts');
const makeProfile=(other=false)=>({version:1,answers:Object.fromEntries(brand.PERSONALITY_QUESTIONS.map((q,i)=>[q.key,{choice:other&&i===0?'Other':q.options[i===0?2:0],custom:other&&i===0?'Curiosity and shared progress':''}]))});
test('five single-choice answers and custom answers validate and round-trip',()=>{
 const profile=brand.parseBrandPersonality(makeProfile(true));
 assert.deepEqual(brand.readBrandPersonality(brand.serializeBrandPersonality(profile)),profile);
 assert.equal(profile.answers.represents.custom,'Curiosity and shared progress');
 assert.equal(brand.parseBrandPersonality({version:1,answers:{}}).answers.personality.choices.length,0);
 const invalid=makeProfile(true);invalid.answers.represents.custom=' ';assert.throws(()=>brand.parseBrandPersonality(invalid));
 invalid.answers.represents.custom='x'.repeat(201);assert.throws(()=>brand.parseBrandPersonality(invalid));
 const multiple=makeProfile();multiple.answers.represents.choice=['Teamwork','Community'];assert.throws(()=>brand.parseBrandPersonality(multiple));
});
test('standard answers discard stale custom values and malformed stored data is ignored',()=>{
 const profile=makeProfile();profile.answers.personality.custom='Old custom answer';
 assert.equal(brand.parseBrandPersonality(profile).answers.personality.custom,'');
 assert.equal(brand.readBrandPersonality('not a profile'),null);
});
function fixture(){
 const records=new Map();let reads=0,writes=0;let permission=true,manage=true,actor={id:'manager'};
 const api=load('app/api/calendars/[id]/business-documents/brand-personality/route.ts',{
 '@/lib/auth':{getCurrentCreator:async()=>actor},
 '@/lib/calendarPermissions':{hasCalendarPermission:async(_creator,_workspace,action)=>permission&&(action!=='knowledge.manage'||manage)},
 '@/lib/db':{db:{calendarBusinessDocument:{
 findFirst:async({where})=>{reads++;assert.equal(where.id,brand.brandPersonalityDocumentId(where.calendarId));return records.get(where.calendarId)||null;},
 upsert:async({where,create,update})=>{writes++;assert.equal(where.id_calendarId.id,brand.brandPersonalityDocumentId(where.id_calendarId.calendarId));assert.equal(create.calendarId,where.id_calendarId.calendarId);const current=records.get(create.calendarId);const next=current?{...current,...update}:create;records.set(create.calendarId,next);return next;},
 }}},
 });
 const request=value=>new Request('http://localhost/api',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
 const params=id=>({params:Promise.resolve({id})});
 return {api,records,reads:()=>reads,writes:()=>writes,setPermission:v=>permission=v,setManage:v=>manage=v,setActor:v=>actor=v,
 save:(id,profile)=>api.PUT(request(profile),params(id)),
 get:id=>api.GET(new Request('http://localhost/api'),params(id))};
}
test('workspace profiles save reload update and remain isolated without duplicate knowledge records',async()=>{
 const f=fixture();const a=makeProfile(true),b=makeProfile();
 b.answers.communication={choice:'Calm',custom:''};
 assert.equal((await f.save('a',a)).status,200);assert.equal((await f.save('b',b)).status,200);
 assert.deepEqual((await (await f.get('a')).json()).profile,brand.parseBrandPersonality(a));
 assert.deepEqual((await (await f.get('b')).json()).profile,brand.parseBrandPersonality(b));
 a.answers.personality={choice:'Bold',custom:''};await f.save('a',a);
 assert.deepEqual((await (await f.get('a')).json()).profile.answers.personality.choices,['Bold']);
 assert.deepEqual((await (await f.get('b')).json()).profile.answers.personality.choices,[b.answers.personality.choice]);
 assert.equal(f.records.size,2);
});
test('permission and authentication checks occur before reading or writing knowledge',async()=>{
 const f=fixture();f.setActor(null);assert.equal((await f.get('a')).status,401);
 f.setActor({id:'outsider'});f.setPermission(false);assert.equal((await f.get('a')).status,404);assert.equal((await f.save('a',makeProfile())).status,403);
 assert.equal(f.reads(),0);assert.equal(f.writes(),0);
});
test('read-only knowledge users can inspect profiles but cannot update them',async()=>{
 const f=fixture();await f.save('a',makeProfile());f.setManage(false);
 const response=await f.get('a');assert.equal(response.status,200);assert.equal((await response.json()).canManage,false);
 assert.equal((await f.save('a',makeProfile(true))).status,403);assert.equal(f.writes(),1);
});
test('invalid saves never replace the existing knowledge profile',async()=>{
 const f=fixture();await f.save('a',makeProfile());const before=JSON.stringify(f.records.get('a'));
 assert.equal((await f.save('a',{version:1,answers:{personality:{choices:['Invalid trait'],custom:''}}})).status,400);assert.equal(JSON.stringify(f.records.get('a')),before);
});
test('content and reply context include only their own personality and separate preferences from factual documents',async()=>{
 const profiles={a:makeProfile(true),b:makeProfile()};profiles.b.answers.communication={choice:'Calm',custom:''};
 const rows=id=>[{id:'facts-'+id,originalName:'Business.pdf',extractedText:'Confirmed product facts for '+id},{id:brand.brandPersonalityDocumentId(id),originalName:'Brand personality',extractedText:brand.serializeBrandPersonality(profiles[id])}];
 const db={calendarBusinessDocument:{findMany:async({where})=>rows(where.calendarId)},socialCalendar:{findUnique:async()=>null},businessResearchRun:{findFirst:async()=>null}};
 const {getBusinessKnowledgeContext}=load('lib/knowledge/context.ts',{'@/lib/db':{db},'@/lib/openai':{}});
 for(const purpose of ['content','reply']){
  const a=await getBusinessKnowledgeContext('a','Product question',purpose),b=await getBusinessKnowledgeContext('b','Product question',purpose);
  assert.match(a,/Curiosity and shared progress/);assert.doesNotMatch(b,/Curiosity and shared progress/);
  assert.match(a,/Confirmed product facts for a/);assert.doesNotMatch(a,/Confirmed product facts for b/);
  assert.match(a,/Personality never overrides documented facts/);assert.match(a,/Interpret the five preferences together/);
  assert.ok(a.indexOf('BRAND_PERSONALITY_CONTEXT_V1')<a.indexOf('BUSINESS SOURCE EVIDENCE'));
  assert.doesNotMatch(a,/SHOWWORK_BRAND_PERSONALITY_V1/);
 }
});
test('unconfigured personality adds no style marker or default persona',async()=>{
 const db={calendarBusinessDocument:{findMany:async()=>[{id:'doc',originalName:'Business',extractedText:'Documented offering'}]},socialCalendar:{findUnique:async()=>null},businessResearchRun:{findFirst:async()=>null}};
 const {getBusinessKnowledgeContext}=load('lib/knowledge/context.ts',{'@/lib/db':{db},'@/lib/openai':{}});
 assert.doesNotMatch(await getBusinessKnowledgeContext('a','','content'),/BRAND_PERSONALITY_CONTEXT/);
});
const oldFetch=global.fetch,oldKey=process.env.OPENAI_API_KEY;
afterEach(()=>{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;});
test('customer reply request receives holistic voice with factual sensitivity and handoff priority',async()=>{
 process.env.OPENAI_API_KEY='fixture';let body;
 global.fetch=async(_url,init)=>{body=JSON.parse(init.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({shouldReply:true,replyText:'Helpful response',handoffReason:null})}]}]});};
 const {generateSocialInboxAutoReply}=load('lib/openai.ts',{'@/lib/db':{db:{}}});
 await generateSocialInboxAutoReply({clientName:'Studio',businessSummary:brand.brandPersonalityContext(makeProfile())+'Confirmed facts',conversation:[],latestInbound:'I have a complaint',mode:'draft'});
 assert.match(body.instructions,/Interpret the saved brand personality as a coherent default voice/);
 assert.match(body.instructions,/must never make complaints or sensitive replies playful/);
 assert.match(body.instructions,/handoff rules always take priority/);
 assert.match(body.input,/BRAND_PERSONALITY_CONTEXT_V1/);
});
test('AI Studio passes personality into campaign planning with holistic interpretation instructions',async()=>{
 process.env.OPENAI_API_KEY='fixture';let body;
 global.fetch=async(_url,init)=>{body=JSON.parse(init.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]});};
 const {generateContentCalendar}=load('lib/openai.ts',{'@/lib/db':{db:{}}});
 await assert.rejects(generateContentCalendar({clientName:'Studio',businessSummary:brand.brandPersonalityContext(makeProfile())+'Documented product facts',startDate:'2026-10-26',endDate:'2026-10-26',postsPerWeek:3,platforms:['INSTAGRAM']}));
 assert.equal(body.text.format.name,'creative_campaign_brief');
 assert.match(body.instructions,/five-part brand personality holistically/);
 assert.match(body.instructions,/Do not mechanically repeat/);
 assert.match(body.input,/BRAND_PERSONALITY_CONTEXT_V1/);
});
test('checkbox form displays five questions and custom input only for Other',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {BrandPersonalityQuestions}=load('components/calendars/BrandPersonalityCard.tsx');
 const render=answers=>renderToStaticMarkup(React.createElement(BrandPersonalityQuestions,{calendarId:'workspace',answers,disabled:false,onAnswer:()=>{}}));
 const blank=render({});assert.equal((blank.match(/<fieldset/g)||[]).length,5);assert.equal((blank.match(/type="checkbox"/g)||[]).length,30);assert.doesNotMatch(blank,/type="text"/);
 const custom=render(brand.parseBrandPersonality(makeProfile(true)).answers);assert.match(custom,/type="text"/);assert.match(custom,/Curiosity and shared progress/);assert.match(custom,/name="workspace-represents"/);assert.match(custom,/maxLength="200"/i);
});
test('personality by itself never becomes factual business knowledge',async()=>{
 const db={calendarBusinessDocument:{findMany:async()=>[{id:brand.brandPersonalityDocumentId('a'),originalName:'Brand personality',extractedText:brand.serializeBrandPersonality(makeProfile())}]},socialCalendar:{findUnique:async()=>null},businessResearchRun:{findFirst:async()=>null}};
 const {getBusinessKnowledgeContext}=load('lib/knowledge/context.ts',{'@/lib/db':{db},'@/lib/openai':{}});
 const result=await getBusinessKnowledgeContext('a','What does this product cost?','reply');
 assert.match(result,/Brand personality is style only/);assert.match(result,/do not invent business facts/);assert.doesNotMatch(result,/BUSINESS SOURCE EVIDENCE/);
});

test('multiple choices and optional questions survive save, reload and AI context',async()=>{
 const partial={version:1,answers:{personality:{choices:['Professional','Friendly','Professional'],custom:''},represents:{choices:['Community','Other'],custom:'Shared progress'}}};
 const normalized=brand.parseBrandPersonality(partial);
 assert.deepEqual(normalized.answers.personality.choices,['Professional','Friendly']);
 const f=fixture();assert.equal((await f.save('multi',partial)).status,200);
 assert.deepEqual((await (await f.get('multi')).json()).profile,normalized);
 const context=brand.brandPersonalityContext(normalized);
 for(const selected of ['Professional','Friendly','Community','Shared progress'])assert.ok(context.includes(selected));
 assert.equal(brand.brandPersonalityContext(brand.parseBrandPersonality({version:1,answers:{}})),'');
});
test('legacy single-choice profiles remain readable as checkbox selections',()=>{
 const old='SHOWWORK_BRAND_PERSONALITY_V1\n'+JSON.stringify(makeProfile());
 assert.deepEqual(brand.readBrandPersonality(old).answers.personality.choices,['Fun']);
});
