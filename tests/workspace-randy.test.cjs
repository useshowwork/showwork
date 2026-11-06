const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const answer=load('lib/knowledge/randy/answer.ts');
const sources=[{id:'doc1',title:'Business facts'}];
const payload={text:'Your audience is local teams.',sourceIds:['doc1'],proposal:null,researchSuggested:false,researchQuery:null};
test('business answers validate citations, proposed additions and research topics',()=>{
 assert.equal(answer.parseBusinessChatAnswer(payload,sources).sources[0].id,'doc1');
 assert.throws(()=>answer.parseBusinessChatAnswer({...payload,sourceIds:['another-workspace']},sources));
 assert.throws(()=>answer.parseBusinessChatAnswer({...payload,proposal:{title:'Rule',text:''}},sources));
 assert.throws(()=>answer.parseBusinessChatAnswer({...payload,researchQuery:'short'},sources));
 assert.equal(answer.parseBusinessChatAnswer({...payload,proposal:{title:'Audience',text:'We serve small teams.'}},sources).proposal.text,'We serve small teams.');
 assert.equal(answer.parseBusinessChatAnswer({...payload,researchQuery:'Public audience trends for small teams'},sources).researchPlan.focus,'Public audience trends for small teams');
 for(const text of ['Research small agency trends','Can you research this?','Please look up team collaboration trends'])assert.equal(answer.researchRequested(text),true);
 assert.equal(answer.researchRequested('What research do we already have?'),false);
});
test('business provider uses synthetic mocked output, strict schema, no search tools and no stored response',async()=>{
 const original=global.fetch,key=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='synthetic-test-key';let body;
 global.fetch=async(_url,options)=>{body=JSON.parse(options.body);return{ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(payload)}]}]})};};
 try{await answer.businessChatAnswer({question:'Audience?',business:'Synthetic business',context:'Synthetic evidence',history:[],sources,canManage:true});assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.additionalProperties,false);}finally{global.fetch=original;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
function harness(){
 let allowed=true,manage=true;let documents=0,pending=[];const saved=[];let message={id:'m1',conversationId:'own',role:'assistant',body:{...payload,proposal:{title:'Audience',text:'We serve small teams.'}},knowledgeDocumentId:null};
 const conversation={id:'own',calendarId:'w1',creatorId:'u1',title:'Audience',processingAt:null};
 const db={workspaceRandyConversation:{findFirst:async({where})=>where.id==='own'&&where.calendarId==='w1'&&where.creatorId==='u1'?conversation:null,findMany:async()=>[conversation],update:async()=>conversation},workspaceRandyMessage:{findFirst:async({where})=>where.id==='m1'&&where.conversationId==='own'?message:null,findMany:async()=>[message],count:async()=>0,update:async({data})=>{message={...message,...data};return message},create:async({data})=>{saved.push(data);return data}},calendarBusinessDocument:{create:async({data})=>{documents++;return data}},$queryRaw:async()=>[]};db.$transaction=async(fn)=>fn(db);
 const api=load('app/api/calendars/[id]/randy/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})},after:fn=>pending.push(fn)},'@/lib/auth':{getCurrentCreator:async()=>({id:'u1'})},'@/lib/calendarPermissions':{hasCalendarPermission:async(_u,_w,p)=>p==='knowledge.manage'?manage:allowed,canAccessCalendarById:async()=>true,calendarFeatureGate:async()=>null},'@/lib/db':{db},'@/lib/knowledge/randy/service':{finishBusinessChat:async()=>{throw Error('No paid calls in tests');}}});
 function req(body){const request=new Request('https://example.test/api/calendars/w1/randy',{method:body?'POST':'GET',headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});request.nextUrl=new URL(request.url);return request;}
 return{api,db,req,context:{params:Promise.resolve({id:'w1'})},conversation,pending,saved,get documents(){return documents},deny:()=>{allowed=false},noManage:()=>{manage=false},researchProposal:()=>{message.body={text:'Research plan',sources:[],researchPlan:{focus:'Public small business audience trends'}}}};
}
test('conversation read/write access is scoped to workspace and member',async()=>{
 const h=harness();const request=h.req();request.nextUrl.searchParams.set('conversation','other');assert.equal((await h.api.GET(request,h.context)).status,404);
 assert.equal((await h.api.POST(h.req({conversationId:'other',text:'Hello'}),h.context)).status,404);
 h.deny();assert.equal((await h.api.GET(h.req(),h.context)).status,403);assert.equal((await h.api.POST(h.req({text:'Hello'}),h.context)).status,403);
 assert.equal(h.pending.length,0);
});
test('knowledge save requires permission, uses exact stored proposal and is idempotent',async()=>{
 const h=harness();const body={action:'confirmKnowledge',conversationId:'own',messageId:'m1',proposal:{text:'Untrusted substitution'}};
 assert.equal((await h.api.POST(h.req(body),h.context)).body.saved,true);assert.equal(h.documents,1);
 assert.equal((await h.api.POST(h.req(body),h.context)).body.saved,true);assert.equal(h.documents,1);assert.equal(h.pending.length,0);
 const denied=harness();denied.noManage();assert.equal((await denied.api.POST(denied.req(body),denied.context)).status,403);assert.equal(denied.documents,0);
});
test('pending conversations reject duplicates and research needs manager access',async()=>{
 const h=harness();h.conversation.processingAt=new Date();assert.equal((await h.api.POST(h.req({conversationId:'own',text:'Audience?'}),h.context)).status,409);assert.equal(h.saved.length,0);
 const denied=harness();denied.noManage();assert.equal((await denied.api.POST(denied.req({text:'Research local trends'}),denied.context)).status,403);
});
test('ordinary chat queues a reply but never writes Business Knowledge automatically',async()=>{
 const h=harness();assert.equal((await h.api.POST(h.req({conversationId:'own',text:'Remember our audience is small teams'}),h.context)).status,202);assert.equal(h.pending.length,1);assert.equal(h.documents,0);assert.equal(h.saved[0].body.text,'Remember our audience is small teams');
});
test('research confirmation uses stored public topic and prevents duplicate starts',async()=>{
 const h=harness();h.researchProposal();const body={action:'confirmResearch',conversationId:'own',messageId:'m1',text:'Do not use this browser substitution'};
 assert.equal((await h.api.POST(h.req(body),h.context)).status,202);assert.equal(h.saved[0].body.text,'Public small business audience trends');assert.equal(h.pending.length,1);assert.equal(h.documents,0);
 assert.equal((await h.api.POST(h.req(body),h.context)).status,409);
});
test('business service retrieves current workspace context and recent conversation without auto-saving',async()=>{
 let providerInput, saved;const lease=new Date();const db={socialCalendar:{findUniqueOrThrow:async()=>({clientName:'Synthetic Brand',researchPlan:null})},calendarBusinessDocument:{findMany:async args=>{assert.equal(args.where.calendarId,'w1');return[{id:'doc1',originalName:'Facts',extractedText:'Synthetic business facts',websiteUrl:null}]}},workspaceRandyMessage:{findMany:async()=>[{role:'user',body:{text:'What should we do next?'}},{role:'assistant',body:{text:'Earlier synthetic idea'}}],create:async args=>{saved=args.data.body}},businessResearchRun:{findFirst:async()=>null},workspaceRandyConversation:{findFirst:async()=>({id:'c'}),update:async()=>{}},$queryRaw:async()=>[]};db.$transaction=async fn=>fn(db);
 const service=load('lib/knowledge/randy/service.ts',{'@/lib/db':{db},'@/lib/knowledge/context':{getBusinessKnowledgeContext:async(id,q,purpose)=>{assert.equal(id,'w1');assert.equal(purpose,'analytics');return 'Selected PRIVATE evidence'}},'@/lib/knowledge/retrieval':{sourceFingerprint:()=> 'hash'},'@/lib/knowledge/research':{queueBusinessResearch:async()=>{throw Error('Unexpected search')}},'./answer':{businessChatAnswer:async input=>{providerInput=input;return{text:'A focused next step',sources:[],proposal:{title:'Proposed strategy',text:'A strategy to review, never automatically saved'}}}}});
 await service.finishBusinessChat('c','w1','What should we do next?',false,true,lease);
 assert.match(providerInput.context,/Selected PRIVATE evidence/);assert.equal(providerInput.history[0].text,'Earlier synthetic idea');assert.equal(providerInput.sources[0].id,'doc1');assert.equal(saved.proposal.title,'Proposed strategy');
});
test('approved research sends only confirmed topic to search and stale work cannot overwrite a new lease',async()=>{
 let topic,saved=0;const db={socialCalendar:{findUniqueOrThrow:async()=>({clientName:'Brand',researchPlan:null})},calendarBusinessDocument:{findMany:async()=>[]},workspaceRandyMessage:{findMany:async()=>[{role:'user',body:{text:'PRIVATE conversation detail'}}],create:async()=>{saved++}},businessResearchRun:{findFirst:async()=>({status:'SUCCEEDED',excludedFindingIds:[],result:{summary:'Sourced result',findings:[],unknowns:[],sources:[]}})},workspaceRandyConversation:{findFirst:async()=>null,update:async()=>{}},$queryRaw:async()=>[]};db.$transaction=async fn=>fn(db);
 const service=load('lib/knowledge/randy/service.ts',{'@/lib/db':{db},'@/lib/knowledge/context':{},'@/lib/knowledge/retrieval':{},'@/lib/knowledge/research':{queueBusinessResearch:async(id,focus)=>{topic=focus;return{id:'run',focus,status:'QUEUED'}},executeBusinessResearch:async()=>{}},'./answer':{businessChatAnswer:async()=>{throw Error('Unexpected paid AI')}}});
 await service.finishBusinessChat('c','w1','Public agency audience trends',true,true,new Date(),true);
 assert.equal(topic,'Public agency audience trends | Brand: Brand');assert.ok(!topic.includes('PRIVATE'));assert.equal(saved,0);
});
test('chat interface renders a clear Randy welcome, history and permission-aware composer',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
 const Panel=load('components/calendars/BusinessResearchPanel.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})}}).default;
 const html=renderToStaticMarkup(React.createElement(Panel,{calendarId:'w1',canManage:false,canGenerate:false}));
 for(const text of ['Randy','Ideas, research and clear next steps.','New chat','History','Getting Randy ready','AI generation permission is required to chat.'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('Research library'));assert.ok(!html.includes('A better question.'));assert.ok(!html.includes('Start research'));
});
test('content prompt responses are bounded and preserve supported source references',()=>{
 const brief={title:'Team collaboration campaign',prompt:'Objective: introduce our workflow. Audience: small teams. Use the supported business facts and treat research as hypotheses.'};
 const parsed=answer.parseBusinessChatAnswer({...payload,contentBrief:brief},sources);
 assert.deepEqual(parsed.contentBrief,brief);assert.equal(parsed.sources[0].id,'doc1');
 assert.throws(()=>answer.parseBusinessChatAnswer({...payload,contentBrief:{title:'Empty',prompt:''}},sources));
 assert.throws(()=>answer.parseBusinessChatAnswer({...payload,contentBrief:{title:'Too long',prompt:'x'.repeat(8001)}},sources));
});
test('prompt card transfers edited instructions to the correct workspace without running generation',()=>{
 const React=require('react');const captured=[],events=[];const previous=global.window;
 global.window={dispatchEvent:event=>events.push(event)};
 try{
  let state=0;
  const Card=load('components/calendars/RandyContentPrompt.tsx',{'react':{...React,useState:initial=>[state++===0?'Edited prompt for this business':initial,()=>{}]},'@/lib/knowledge/researchHandoff':{queueResearchBrief:(id,text)=>captured.push({id,text})}}).default;
  const tree=Card({calendarId:'workspace-a',brief:{title:'Campaign',prompt:'Original prompt'},canGenerate:true});const buttons=[];
  function visit(element){if(!element||typeof element!=='object')return;if(element.type==='button')buttons.push(element);React.Children.forEach(element.props?.children,visit);}visit(tree);
  const use=buttons.find(button=>React.Children.toArray(button.props.children).includes('Use in Generate'));assert.ok(use);use.props.onClick();
  assert.deepEqual(captured,[{id:'workspace-a',text:'Edited prompt for this business'}]);assert.equal(events[0].type,'showwork-workspace-navigate');assert.equal(events[0].detail.id,'generate');
 }finally{global.window=previous;}
});
test('prompt card keeps Generate unavailable when the user lacks generation permission',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const Card=load('components/calendars/RandyContentPrompt.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Card,{calendarId:'w',brief:{title:'Idea',prompt:'Supported direction'},canGenerate:false}));assert.ok(html.includes('Copy prompt'));assert.ok(!html.includes('Use in Generate'));assert.ok(html.includes('Supported direction'));
});
