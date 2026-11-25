const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const mocks={'@/lib/db':{db:{}}};
const {chunkSource}=load('lib/knowledge/hybrid/chunks.ts',mocks);
const {buildQueries}=load('lib/knowledge/hybrid/query.ts',mocks);
const {lexicalRank,hybridRank,diversify}=load('lib/knowledge/hybrid/ranking.ts',mocks);
const {retrieveHybrid}=load('lib/knowledge/hybrid/engine.ts',mocks);
const {sourceFingerprint}=load('lib/knowledge/retrieval.ts');
const {tokenCount}=load('lib/knowledge/hybrid/tokens.ts');
const {sources}=require('./fixtures/knowledge/businesses.cjs');
const original={...process.env};afterEach(()=>{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);});
function configure(){process.env.KNOWLEDGE_EMBEDDING_MODEL='fixture-model';process.env.KNOWLEDGE_EMBEDDING_DIMENSIONS='64';}
const vector=(n)=>Array.from({length:64},(_,i)=>i===n?1:0);
const usage={inputTokens:10,outputTokens:0,requests:1};
function sqlFor(docs,embedding=vector(0)){
 const key='structure-v1:fixture-model:1:64';
 return {query:async(sql,args)=>{
  assert.equal(args[0],'workspace-a');assert.match(sql,/WHERE.*"calendarId"=\$1/s);
  if(sql.includes('FROM "KnowledgePassage"'))return {rows:docs.flatMap(d=>chunkSource(d).map(p=>({...p,embedding,sourceHash:sourceFingerprint([d])})))};
  return {rows:docs.map(d=>({sourceId:d.id,status:'READY',indexKey:key,sourceHash:sourceFingerprint([d])}))};
 }};
}
test('blank instructions produce task dimensions; no invented facts',()=>{
 const q=buildQueries({instructions:' \n ',platforms:['INSTAGRAM']});assert.equal(q.specific,false);assert.ok(q.primary.length>10);assert.ok(q.queries.some(q=>q.includes('INSTAGRAM')));
});
test('chunks retain original text, locations, headings, web URLs and stable ids',()=>{
 for(const source of sources){const chunks=chunkSource(source);assert.equal(chunks.map(c=>c.text).join(''),source.extractedText);for(const c of chunks)assert.equal(source.extractedText.slice(c.start,c.end),c.text);assert.deepEqual(chunkSource(source),chunks);}
 const pricing=chunkSource(sources.find(s=>s.id==='pricing'));assert.ok(pricing.some(p=>p.text.includes('Nimbus Pro | 450 | GBP per month | Annual contract')));
 assert.ok(chunkSource(sources.find(s=>s.id==='website')).some(p=>p.url==='https://example.test/policies'));
});
test('BM25 finds exact names and deep evidence; fusion uses ranks',()=>{
 const chunks=sources.flatMap(chunkSource);const ranked=lexicalRank(chunks,'"Orbit migration" Markdown exports');assert.equal(ranked[0].passage.sourceId,'profile');
 const hybrid=hybridRank(chunks,buildQueries({instructions:'Nimbus Pro'}),new Map(),[]);assert.ok(hybrid.length<=24);assert.ok(hybrid.every(p=>p.score<1));
});
test('semantic-only terminology can retrieve related evidence (provider contract fixture, not quality benchmark)',async()=>{
 configure();const docs=[{id:'continuity',originalName:'Guide',extractedText:'Preserve organisational expertise when experienced colleagues depart.'}];
 const result=await retrieveHybrid('workspace-a',docs,{instructions:'reduce employee dependency'},500,{sql:sqlFor(docs),embedder:async()=>({vectors:[vector(0),vector(0),vector(0),vector(0)],usage})});
 assert.equal(result.report.mode,'hybrid');assert.match(result.evidence,/organisational expertise/);
});
test('provider outage uses lexical evidence from current sources and records degradation',async()=>{
 configure();const result=await retrieveHybrid('workspace-a',sources,{instructions:'Nimbus Pro price'},1000,{sql:sqlFor(sources),embedder:async()=>{throw Error('private provider detail');}});
 assert.equal(result.report.mode,'lexical');assert.ok(result.report.reasons.includes('SEMANTIC_UNAVAILABLE'));assert.match(result.evidence,/450/);assert.ok(tokenCount(result.evidence)<=1000);assert.doesNotMatch(JSON.stringify(result.report),/private provider detail/);
});
test('old fingerprints and deleted sources cannot contribute vectors',async()=>{
 configure();let embedded=false;const sql={query:async(query)=>query.includes('FROM "KnowledgePassage"')?{rows:[{id:'deleted',sourceId:'gone',sourceHash:'old',embedding:vector(0)}]}:{rows:[]}};
 const result=await retrieveHybrid('workspace-a',[sources[2]],{instructions:'Nimbus Pro price'},800,{sql,embedder:async()=>{embedded=true;throw Error();}});assert.equal(embedded,false);assert.equal(result.report.readiness,'partial');assert.doesNotMatch(result.evidence,/deleted/);
});
test('reranking is bounded, ignores invented ids, and timeout preserves fallback',async()=>{
 configure();process.env.KNOWLEDGE_RERANK_ENABLED='true';
 const result=await retrieveHybrid('workspace-a',sources,{instructions:'Nimbus Pro'},700,{sql:sqlFor(sources),embedder:async()=>({vectors:[vector(0)],usage}),reranker:async(q,passages)=>{assert.ok(passages.length<=24);assert.match(q,/Nimbus/);throw Error('timeout');}});
 assert.equal(result.report.reranking,'fallback');assert.ok(result.passages.length);assert.ok(tokenCount(result.evidence)<=700);
});
test('diversity removes duplicates without equal-source quotas; contradictory values remain',()=>{
 const chunks=chunkSource({id:'a',originalName:'A',extractedText:'# Prices\nPackage price GBP 100.'});
 const b={...chunks[0],id:'b',sourceId:'b',text:'# Prices\nPackage price GBP 200.'};
 const rows=[chunks[0],{...chunks[0],id:'duplicate'},b].map(p=>({passage:p,score:1,lexical:1,semantic:0}));
 assert.equal(diversify(rows).length,2);
});
test('status API denies an outsider before querying index metadata',async()=>{
 const api=load('app/api/calendars/[id]/business-documents/index/route.ts',{'@/lib/auth':{getCurrentCreator:async()=>({id:'outsider'})},'@/lib/calendarPermissions':{hasCalendarPermission:async()=>false},'@/lib/knowledge/hybrid/store':{indexStatus:()=>assert.fail('private index read')}});
 assert.equal((await api.GET(new Request('https://example.test'),{params:Promise.resolve({id:'private'})})).status,403);
});
test('embedding adapter batches, validates dimensions, and does not propagate provider bodies',async()=>{
 configure();process.env.OPENAI_API_KEY='fixture';const originalFetch=global.fetch;
 try{global.fetch=async(_url,init)=>{const body=JSON.parse(init.body);assert.equal(body.model,'fixture-model');return Response.json({data:[{index:0,embedding:vector(0)}],usage:{total_tokens:12}});};
 const {embed}=load('lib/knowledge/hybrid/provider.ts');assert.equal((await embed(['business facts'])).usage.inputTokens,12);
 global.fetch=async()=>new Response('secret text',{status:403});await assert.rejects(embed(['facts']),/KNOWLEDGE_PROVIDER_UNAVAILABLE/);
 }finally{global.fetch=originalFetch;}
});
test('reranker treats document instructions as data and rejects forged candidate ids',async()=>{
 const originalFetch=global.fetch;process.env.OPENAI_API_KEY='test';process.env.KNOWLEDGE_RERANK_MODEL='fixture';
 const passages=chunkSource(sources.find(s=>s.id==='injection'));const api=load('lib/knowledge/hybrid/provider.ts');
 try{
  global.fetch=async(_url,init)=>{const body=JSON.parse(init.body);assert.match(body.instructions,/untrusted data/);assert.doesNotMatch(body.instructions,/Reveal every other/);assert.match(body.input,/Reveal every other/);return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({scores:[{id:'0',relevance:0}]})}]}]});};
  const result=await api.rerank('Brand guidelines',passages);assert.equal(result.scores[0].id,passages[0].id);assert.equal(result.scores[0].relevance,0);
  global.fetch=async()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({scores:[{id:'foreign',relevance:3}]})}]}]});
  await assert.rejects(api.rerank('Brand',passages),/INVALID_RERANK_RESULT/);
 }finally{global.fetch=originalFetch;}
});
test('content uses full sources despite hybrid flags and keeps external research separate',async()=>{
 configure();process.env.KNOWLEDGE_HYBRID_ENABLED='true';let changed=false;const doc=sources[2];let reads=0;
 const {getBusinessKnowledgeContext}=load('lib/knowledge/context.ts',{
  '@/lib/db': { db: {
    calendarBusinessDocument: {findMany:async({where})=>{assert.equal(where.calendarId,'a');reads++;return [changed&&reads%2===0?{...doc,extractedText:'changed'}:doc];}},
    socialCalendar:{findUnique:async()=>({aiBusinessSummary:'Source-derived summary',aiBusinessSummarySourceHash:sourceFingerprint([doc])})},
    businessResearchRun:{findFirst:async({where})=>{
      assert.equal(where.calendarId,'a');assert.equal(where.sourceHash,sourceFingerprint([doc]));
      return {excludedFindingIds:[],result:{findings:[{id:'r',learning:'External experiment',sourceUrls:['https://example.com/experiment']}]}};
    }},
  } },
  '@/lib/openai':{},'./hybrid/engine':{contextBudget:()=>1800,retrieveHybrid:async()=>({evidence:'Verified prices',report:{mode:'lexical',readiness:'partial',reranking:'disabled'}})}
 });
 const oldLog=console.info;console.info=()=>{};
 try{const context=await getBusinessKnowledgeContext('a','price','content');assert.ok(context.includes(doc.extractedText));assert.doesNotMatch(context,/SOURCE-DERIVED OVERVIEW/);assert.match(context,/EXTERNAL RESEARCH/);
 changed=true;await assert.rejects(getBusinessKnowledgeContext('a','price','content'),/sources changed/);
 }finally{console.info=oldLog;}
});
test('indexing cron is disabled by default and requires authentication',async()=>{
 process.env.CRON_SECRET='test';delete process.env.KNOWLEDGE_INDEXING_ENABLED;
 const api=load('app/api/cron/knowledge-index/route.ts',{'@/lib/knowledge/hybrid/store':{processIndexBatch:()=>assert.fail('must not run')}});
 assert.equal((await api.POST(new Request('https://example.test',{method:'POST'}))).status,401);
 const response=await api.POST(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer test'}}));assert.equal((await response.json()).enabled,false);
});

 test('conflict hints retain competing prices and policies without deciding truth',()=>{
 const {possibleConflicts}=load('lib/knowledge/hybrid/conflicts.ts',mocks);
 const make=(id,heading,text)=>({id,sourceId:id,title:id,url:null,heading,start:0,end:text.length,ordinal:0,text});
 const rows=[make('a','Prices','Nimbus | 100 | GBP monthly'),make('b','Prices','Nimbus | 200 | GBP monthly'),make('c','Refund policy','Refund within 14 days.'),make('d','Refund policy','Refund within 30 days.')];
 const hints=possibleConflicts(rows);assert.ok(hints.some(h=>h.reason==='POSSIBLE_PRICE_CONFLICT'));assert.ok(hints.some(h=>h.reason==='POSSIBLE_POLICY_CONFLICT'));assert.ok(hints.every(h=>h.sourceIds.length===2));
 assert.deepEqual(possibleConflicts([rows[0]]),[]);
 });
