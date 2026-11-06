const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {load}=require('./helpers/load-typescript.cjs');const original={...process.env},originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);});
const {parseCreativeBrief,briefSnapshot}=load('lib/content/brief.ts');
const {contentSlots,generationCount,scheduledContentDate}=load('lib/content/schedule.ts');
const {generateBriefCalendar}=load('lib/content/briefGeneration.ts',{'@/lib/db':{db:{}}});
const brief=(i,format='Reel')=>({version:2,hook:'A specific opening angle',caption:'Useful complete audience-facing copy with a natural next step.',hashtags:'#StudioWorkflow',format,title:`Working idea ${i}`,objective:'Help the audience evaluate their options',targetAudience:'Small studio owners choosing a workflow',coreIdea:`A distinctive audience situation number ${i}`,keyMessage:`A useful takeaway ${i}`,creativeDirection:'Explore a relatable workplace situation; the creator can interpret it through humour, demonstration or storytelling.',desiredResponse:'Recognise the issue and consider their current approach',brandConnection:'Relevant supported business context',suggestedCta:'Discuss your approach',pillar:`Education ${i%3}`});
const strategy={audience:'Studio owners',objective:'Education',centralMessage:'Choose a process thoughtfully',sequence:'Explore distinct needs and options',angles:Array.from({length:4},(_,i)=>({tension:`Need ${i}`,approach:`Angle ${i}`,execution:'Flexible creative interpretation',evidenceBoundary:'Only supported facts'}))};
function fixtureModel(extra={}){const calls=[];const model=async request=>{calls.push(request);const name=request.jsonSchema.name;if(name==='creative_campaign_brief'){const input=JSON.parse(request.input);return JSON.stringify({audience:'Studio owners',objective:'Education',centralMessage:'A useful campaign',progression:'Explore needs then relevant choices',pillars:['Education','Demonstration'],editorialPlan:input.identities.map((p,i)=>({...p,format:extra.format||'Reel',topic:`Specific topic ${i}`,audienceNeed:`Audience need ${i}`,keyMessage:`Takeaway ${i}`,angle:`Creative approach ${i}`,pillar:i%2?'Education':'Demonstration',concept:{situation:`Recognisable customer situation ${i}`,premise:`Specific contrast ${p.platform}-${i}`,treatment:i%2?'comparison':'practical teaching',evidenceAnchor:'Verified business offerings'}}))});}if(name==='creative_brief_quality'){const input=JSON.parse(request.input);assert.ok(input.items.length);return JSON.stringify(extra.quality||{acceptable:true,revisions:[]});}assert.equal(name,'creative_brief_calendar');const slots=JSON.parse(request.input.split('ASSIGNED CONTENT ITEMS FOR THIS CALL:\n')[1]);return JSON.stringify({posts:slots.map(p=>({...p,brief:brief(`${p.platform}-${p.contentUnit}`,extra.format||'Reel')}))});};return {calls,model};}
const request={clientName:'Studio',businessSummary:'Verified business offerings',startDate:'2026-10-26',endDate:'2026-11-25',postsPerWeek:3,platforms:['INSTAGRAM']};
test('documented month rhythm yields fourteen slots, not forty-two; no duplicate days',()=>{const slots=contentSlots(request.startDate,request.endDate,3);assert.equal(slots.length,14);assert.equal(new Set(slots).size,14);assert.equal(slots[0],'2026-10-26');assert.equal(slots.at(-1),'2026-11-25');});
test('partial weeks and explicitly doubled daily frequencies are handled consistently',()=>{assert.equal(contentSlots('2026-10-26','2026-10-27',3).length,1);assert.equal(contentSlots('2026-10-28','2026-10-28',3).length,1);assert.equal(contentSlots('2026-10-26','2026-10-26',1).length,0);assert.equal(contentSlots('2026-10-26','2026-11-01',14).length,14);assert.equal(contentSlots('2026-10-30','2026-11-01',14).length,6);assert.throws(()=>contentSlots('2026-02-30','2026-03-01',3));});
test('platform sharing counts are explicit and repeated platforms/groups are rejected',()=>{assert.equal(generationCount(request.startDate,request.endDate,3,['INSTAGRAM','FACEBOOK']).drafts,28);assert.equal(generationCount(request.startDate,request.endDate,3,['INSTAGRAM','FACEBOOK'],'DIFFERENT_CONTENT').ideas,28);assert.throws(()=>generationCount(request.startDate,request.endDate,3,['INSTAGRAM','INSTAGRAM']));assert.throws(()=>generationCount(request.startDate,request.endDate,3,['INSTAGRAM','FACEBOOK'],'CUSTOM_GROUPS',[['INSTAGRAM'],['INSTAGRAM','FACEBOOK']]));});
test('selected timezone and explicit second slots produce correct distinct instants',()=>{assert.equal(scheduledContentDate('2026-10-26','09:00','Africa/Lagos').toISOString(),'2026-10-26T08:00:00.000Z');assert.notEqual(scheduledContentDate('2026-10-26','09:00','Africa/Lagos',1).toISOString(),scheduledContentDate('2026-10-26','09:00','Africa/Lagos').toISOString());assert.equal(scheduledContentDate('2026-10-26','23:30','Africa/Lagos',1).toISOString(),'2026-10-26T21:30:00.000Z');});
for(const format of ['Reel','Carousel'])test(`${format} generation generates complete content without automatic scripts`,async()=>{const f=fixtureModel({format});const posts=await generateBriefCalendar(f.model,{...request,endDate:'2026-11-01'});assert.equal(posts.length,3);assert.equal(posts[0].creativeBrief.format,format);for(const p of posts){assert.equal(p.script,'');assert.ok(p.caption);assert.ok(p.hook);assert.ok(p.cta);assert.ok(p.hashtags);assert.ok(p.creativeBrief.objective);assert.doesNotMatch(p.creativeBrief.creativeDirection,/\d+:\d+|Slide 1:/);}assert.equal(f.calls.filter(c=>c.jsonSchema.name==='creative_brief_quality').length,1);});
test('one semantic quality check sees all ideas and can replace a weaker concept',async()=>{const replacement=brief('replacement');const f=fixtureModel({quality:{acceptable:true,revisions:[{id:'1',reason:'Semantically repetitive',brief:replacement}]}});const posts=await generateBriefCalendar(f.model,request);assert.equal(posts.length,14);assert.deepEqual(posts[1].creativeBrief,replacement);const quality=JSON.parse(f.calls.find(c=>c.jsonSchema.name==='creative_brief_quality').input);assert.equal(quality.items.length,14);assert.match(f.calls.find(c=>c.jsonSchema.name==='creative_brief_quality').instructions,/semantic duplication/);});
test('quality rejection and invalid replacements retain complete drafts with a visible review warning',async()=>{for(const quality of [{acceptable:false,revisions:[]},{acceptable:true,revisions:[{id:'99',brief:brief('x'),reason:'x'}]}]){const f=fixtureModel({quality});const posts=await generateBriefCalendar(f.model,{...request,endDate:'2026-11-01'});assert.equal(posts.length,3);assert.ok(posts.every(post=>post.creativeBrief.reviewWarnings?.length));assert.equal(f.calls.filter(c=>c.jsonSchema.name==='creative_brief_quality').length,1);}});
test('same-content briefs are shared unchanged, different streams keep distinct ideas',async()=>{for(const contentStrategy of ['SAME_CONTENT','DIFFERENT_CONTENT','CUSTOM_GROUPS']){const f=fixtureModel();const rows=await generateBriefCalendar(f.model,{...request,endDate:'2026-11-01',platforms:['INSTAGRAM','FACEBOOK'],contentStrategy,contentGroups:[['INSTAGRAM','FACEBOOK']]});assert.equal(rows.length,6);if(contentStrategy==='DIFFERENT_CONTENT')assert.notEqual(rows[0].creativeBrief.coreIdea,rows[3].creativeBrief.coreIdea);else assert.equal(briefSnapshot(rows[0].creativeBrief),briefSnapshot(rows[1].creativeBrief));}});
test('new output is the default public generator path and does not repair blank scripts',async()=>{delete process.env.CONTENT_BRIEF_GENERATION_ENABLED;process.env.OPENAI_API_KEY='fixture';const f=fixtureModel();global.fetch=async(_url,init)=>{const body=JSON.parse(init.body);const text=await f.model({instructions:body.instructions,input:body.input,jsonSchema:body.text.format});return Response.json({output:[{type:'message',content:[{type:'output_text',text}]}]});};const api=load('lib/openai.ts',{'@/lib/db':{db:{}}});const rows=await api.generateContentCalendar({...request,endDate:'2026-11-01'});assert.equal(rows.length,3);assert.equal(rows[0].script,'');assert.equal(f.calls.some(c=>c.jsonSchema.name==='video_fields'),false);});
test('brief publishing requires finished copy while legacy media posts retain existing rules',()=>{const {validatePublishContent}=load('lib/publishing/state.ts');assert.throws(()=>validatePublishContent('INSTAGRAM',[],'','Reel',false),/finished copy/);assert.doesNotThrow(()=>validatePublishContent('INSTAGRAM',[{mediaType:'PHOTO'}],'','Image'));});
test('editor groups optional tools and retains historical artifacts without overwriting',()=>{const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const Editor=load('components/calendars/CreativeBriefEditor.tsx').default;const html=renderToStaticMarkup(React.createElement(Editor,{calendarId:'a',post:{id:'p',updatedAt:'2026-10-26T00:00:00Z',platform:'INSTAGRAM',creativeBrief:brief('x'),caption:'Historical caption',script:'Historical script'},onUpdated:()=>{}}));assert.match(html,/Post copy/);assert.match(html,/Strategy/);assert.match(html,/Creative direction/);assert.match(html,/Improve with AI/);assert.doesNotMatch(html,/A timed shoot-and-edit script/);});
test('additive migration preserves old caption/script data and permits structured JSON',async()=>{const {PGlite}=require(process.env.SHOWWORK_REVIEW_PGLITE_PATH||'/private/tmp/showwork-workflow-qa/node_modules/@electric-sql/pglite');const pg=new PGlite();try{await pg.exec(`CREATE TABLE "CalendarPost" (id TEXT PRIMARY KEY,caption TEXT,script TEXT);CREATE TABLE "CalendarPostAiGeneration" (id TEXT PRIMARY KEY);INSERT INTO "CalendarPost" VALUES ('old','Original caption','Original script');`);await pg.exec(fs.readFileSync('prisma/migrations/20261026090000_creative_briefs/migration.sql','utf8'));const old=(await pg.query('SELECT * FROM "CalendarPost"')).rows[0];assert.equal(old.caption,'Original caption');assert.equal(old.script,'Original script');assert.equal(old.creativeBrief,null);await pg.query('UPDATE "CalendarPost" SET "creativeBrief"=$1::jsonb WHERE id=$2',[JSON.stringify(brief('new')),'old']);assert.equal((await pg.query('SELECT "creativeBrief" FROM "CalendarPost"')).rows[0].creativeBrief.title,'Working idea new');}finally{await pg.close();}});

test('v2 requires complete default copy and v1 preserves historical brief data',()=> {
  const complete=brief('required');
  for(const field of ['hook','objective','targetAudience','caption','creativeDirection','suggestedCta']) {
    assert.throws(()=>parseCreativeBrief({...complete,[field]:''}));
  }
  assert.equal(parseCreativeBrief({...complete,hashtags:''}).hashtags,'');
  const old={...complete,version:1};delete old.hook;delete old.caption;delete old.hashtags;
  assert.deepEqual(parseCreativeBrief(old),old);
});
test('v2 editor shows copy first and exposes strategy and creative direction as accessible tabs',()=> {
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const Editor=load('components/calendars/CreativeBriefEditor.tsx').default;
  const html=renderToStaticMarkup(React.createElement(Editor,{calendarId:'a',post:{id:'p',platform:'INSTAGRAM',creativeBrief:brief('ui')},onUpdated:()=>{}}));
  assert.equal((html.match(/role="tab"/g)||[]).length,3);
  for(const label of ['Caption','Call to Action','Hashtags'])assert.match(html,new RegExp('aria-label="'+label+'"'));
  assert.doesNotMatch(html,/aria-label="Objective"/);
  assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
});

test('all older post types show objective and audience without a script field',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const Editor=load('components/calendars/CreativeBriefEditor.tsx',{react:{...React,useState:initial=>[initial==='copy'?'strategy':typeof initial==='function'?initial():initial,()=>{}]}}).default;
 const {editablePostBrief}=load('lib/content/brief.ts');
 for(const platform of ['INSTAGRAM','TIKTOK','YOUTUBE','FACEBOOK','LINKEDIN','X']){
  const post={id:'old',platform,script:'Historical script',caption:'Existing caption',hook:'Existing hook',contentIdea:'Original direction',cta:'Reply',hashtags:'#Example'};
  const editable=editablePostBrief(post);
  assert.equal(editable.objective,'');assert.equal(editable.targetAudience,'');
  assert.equal(editable.caption,post.caption);assert.equal(post.script,'Historical script');
  const html=renderToStaticMarkup(React.createElement(Editor,{calendarId:'a',post,onUpdated:()=>{}}));
  assert.match(html,/>Objective</);assert.match(html,/>Target Audience</);
  assert.doesNotMatch(html,/>Script</);assert.doesNotMatch(html,/Historical script/);
 }
});

test('writing and whole-batch review receive one concept per post without alternatives',async()=>{
 const f=fixtureModel();await generateBriefCalendar(f.model,{...request,endDate:'2026-11-01'});
 const writing=f.calls.find(c=>c.jsonSchema.name==='creative_brief_calendar');
 const context=JSON.parse(writing.input.split('\n\nASSIGNED CONTENT ITEMS FOR THIS CALL:')[0]);
 for(const item of context.campaignStrategy.editorialPlan){assert.ok(item.concept.premise);assert.equal(item.conceptOptions,undefined);}
 const review=JSON.parse(f.calls.find(c=>c.jsonSchema.name==='creative_brief_quality').input);
 assert.deepEqual(review.campaign,context.campaignStrategy);
 assert.match(writing.instructions,/single assigned concept/);
});

test('planner writer and reviewer receive the full evidence including late document sections',async()=>{
 const evidence='Verified business offerings\n'+'Detailed business knowledge. '.repeat(4500)+'\nFINAL_SECTION_UNIQUE_PRODUCT_CONTEXT';
 const f=fixtureModel();await generateBriefCalendar(f.model,{...request,endDate:'2026-11-01',businessSummary:evidence});
 for(const call of f.calls) assert.ok(call.input.includes('FINAL_SECTION_UNIQUE_PRODUCT_CONTEXT'),call.jsonSchema.name);
 const schema=f.calls[0].jsonSchema.schema.properties.editorialPlan.items.properties;
 assert.ok(schema.concept);assert.equal(schema.conceptOptions,undefined);
});
test('saved objectives arriving after initial render refresh empty fields while preserving manual edits',()=>{
 const {editablePostBrief,reconcileBrief}=load('lib/content/brief.ts');
 const previous=editablePostBrief({caption:'Saved caption'});
 const incoming=editablePostBrief({creativeBrief:brief('incoming'),caption:'Saved caption'});
 const current={...previous,caption:'Unsaved manual caption'};
 const result=reconcileBrief(current,previous,incoming);
 assert.equal(result.objective,incoming.objective);
 assert.equal(result.targetAudience,incoming.targetAudience);
 assert.equal(result.caption,'Unsaved manual caption');
});

test('review timeout preserves complete paid writing as drafts needing editorial review without a second model call',async()=>{
 const f=fixtureModel();const model=async request=>{if(request.jsonSchema.name==='creative_brief_quality'){const error=Error('timeout');error.name='TimeoutError';throw error;}return f.model(request);};
 const posts=await generateBriefCalendar(model,{...request,endDate:'2026-11-01'});
 assert.equal(posts.length,3);assert.ok(posts.every(post=>post.creativeBrief.reviewWarnings.length));
 assert.ok(posts.every(post=>post.creativeBrief.objective&&post.creativeBrief.targetAudience&&post.caption));
});
test('compact planning and sparse review omit redundant complete-brief output',async()=>{
 const f=fixtureModel();await generateBriefCalendar(f.model,{...request,endDate:'2026-11-01'});
 const plan=f.calls.find(c=>c.jsonSchema.name==='creative_campaign_brief').jsonSchema.schema.properties.editorialPlan.items.properties;
 assert.ok(plan.concept);for(const field of ['topic','keyMessage','angle'])assert.equal(plan[field],undefined);
 const revision=f.calls.find(c=>c.jsonSchema.name==='creative_brief_quality').jsonSchema.schema.properties.revisions.items.properties;
 assert.ok(revision.changes);assert.equal(revision.brief,undefined);
});
