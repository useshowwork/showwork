const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
// Transpile isolated modules with explicit DB/storage doubles. No .env load,
// real provider calls, database writes, or package installation is required.
function load(file, mocks = {}, cache = new Map()) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  function localRequire(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(target.endsWith('.ts') ? target : target + '.ts', mocks, cache);
    }
    return require(name);
  }
  new Function('require', 'module', 'exports', source)(localRequire, mod, mod.exports);
  cache.set(file, mod.exports); return mod.exports;
}
const state = () => load('lib/publishing/state.ts');
const tokenMock = { requireScopes: (c, scopes) => { if (scopes.some(scope => !c.tokenScopes?.split(' ').includes(scope))) throw new Error('permission is missing'); } };
const providers = (extra = {}) => load('lib/publishing/providers.ts', { '@/lib/r2': { publicUrlFor: key => `https://storage.test/${key}` }, '@/lib/socialTokens': tokenMock, ...extra });
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const post = (assets = []) => ({ caption: 'Hello', cta: null, hashtags: null, taggedAccounts: null, linkUrl: null, postType: null, assets });
const connection = (tokenScopes = '') => ({ connectedAt: new Date('2026-01-01T00:00:00Z'), platformAccountId: '123', accessToken: 'fake-test-token', tokenScopes });

test('shared status does not overwrite legacy Instagram/TikTok status', () => {
  const s = state();
  assert.deepEqual(s.statusUpdate('FACEBOOK', 'FAILED', 'bad'), { publishStatus: 'FAILED', publishError: 'bad' });
  assert.deepEqual(s.statusWhere('TIKTOK', 'SCHEDULED'), { platform: 'TIKTOK', tikTokPublishStatus: 'SCHEDULED' });
  assert.equal(s.statusField('INSTAGRAM'), 'instagramPublishStatus');
});
test('reject mixed TikTok media, documents and X photo overflow before a provider call', () => {
  const { validatePublishContent: validate } = state();
  assert.throws(() => validate('TIKTOK', [{ mediaType: 'VIDEO' }, { mediaType: 'PHOTO' }], 'Caption'), /Mixed media/);
  assert.throws(() => validate('FACEBOOK', [{ mediaType: 'PDF' }], 'Caption'), /photos and videos/);
  assert.throws(() => validate('X', Array(5).fill({ mediaType: 'PHOTO' }), 'Caption'), /at most 4/);
  assert.throws(() => validate('TIKTOK', Array(36).fill({ mediaType: 'PHOTO' }), 'Caption'), /at most 35/);
});
test('text-only posts allowed on Facebook, LinkedIn and X, but not TikTok/Instagram', () => {
  for (const platform of ['FACEBOOK','LINKEDIN','X']) assert.doesNotThrow(() => state().validatePublishContent(platform, [], 'Caption'));
  for (const platform of ['INSTAGRAM','TIKTOK']) assert.throws(() => state().validatePublishContent(platform, [], 'Caption'), /Add content/);
});
test('Facebook text/link post uses Page feed and returns provider ID', async () => {
  global.fetch = async (url, init) => { assert.match(url, /123\/feed$/); assert.equal(JSON.parse(init.body).message, 'Hello'); return response({ id: '123_456' }); };
  assert.equal((await providers().publishFacebook(post(), connection('pages_manage_posts pages_read_engagement'))).id, '123_456');
});
test('Facebook carousel uploads unpublished photos then publishes one feed post', async () => {
  const calls = [];
  global.fetch = async (url, init) => { const body = JSON.parse(init.body); calls.push({url, body}); return response({ id: url.endsWith('/photos') ? `photo${calls.length}` : 'feed123' }); };
  await providers().publishFacebook(post([{ mediaType:'PHOTO', fileKey:'a' }, { mediaType:'PHOTO', fileKey:'b' }]), connection('pages_manage_posts pages_read_engagement'));
  assert.equal(calls.length, 3); assert.equal(calls[0].body.published, false);
  assert.deepEqual(calls[2].body.attached_media, [{ media_fbid: 'photo1' }, { media_fbid: 'photo2' }]);
});
test('Facebook rejects publishing without granted scope', async () => {
  global.fetch = async () => assert.fail('must not call provider');
  await assert.rejects(providers().publishFacebook(post(), connection()), /permission/);
});
test('Facebook video retry checks existing ID instead of uploading twice', async () => {
  global.fetch = async (url, init) => { assert.equal(init.method, undefined); assert.match(url, /existing\?fields=status/); return response({ status: { video_status: 'ready' } }); };
  const result = await providers().publishFacebook({ ...post([{ mediaType:'VIDEO', fileKey:'video' }]), platformPostId:'existing' }, connection('pages_manage_posts pages_read_engagement'));
  assert.equal(result.id, 'existing');
});
test('Facebook Reel uses hosted upload, finish and confirmed status', async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push(url);
    if (url.includes('rupload.')) { assert.equal(init.headers.file_url, 'https://storage.test/v'); return response({success:true}); }
    if (url.includes('fields=status')) return response({status:{video_status:'ready', publishing_phase:{status:'complete'}}});
    const body = JSON.parse(init.body);
    return response(body.upload_phase === 'start' ? {video_id:'reel1',upload_url:'https://rupload.facebook.com/video-upload/v26.0/reel1'} : {success:true});
  };
  let saved;
  const result = await providers().publishFacebook({...post([{mediaType:'VIDEO',fileKey:'v'}]),postType:'Reel'}, connection('pages_manage_posts pages_read_engagement'), async id => { saved = id; });
  assert.equal(saved,'reel1'); assert.match(result.permalink,/\/reel\/reel1/); assert.equal(calls.length,4);
});
test('LinkedIn text posts use member author and returned URN', async () => {
  global.fetch = async (url, init) => { assert.equal(url,'https://api.linkedin.com/rest/posts'); const body=JSON.parse(init.body); assert.equal(body.author,'urn:li:person:123'); assert.equal(body.lifecycleState,'PUBLISHED'); return response({},201,{'x-restli-id':'urn:li:share:456'}); };
  assert.equal((await providers().publishLinkedIn(post(),connection('w_member_social'))).id,'urn:li:share:456');
});
test('LinkedIn image publishing does not require unauthorized image GET', async () => {
  const calls=[];
  global.fetch=async (url,init={}) => { calls.push(url);
    if(url.includes('initializeUpload')) return response({value:{image:'urn:li:image:1',uploadUrl:'https://www.linkedin.com/upload/1'}});
    if(url.startsWith('https://storage.test')) return new Response('image',{headers:{'content-type':'image/jpeg'}});
    if(url==='https://www.linkedin.com/upload/1') return new Response(null,{status:201});
    assert.equal(url,'https://api.linkedin.com/rest/posts'); assert.equal(JSON.parse(init.body).content.media.id,'urn:li:image:1'); return response({},201,{'x-restli-id':'urn:li:share:1'});
  };
  await providers().publishLinkedIn(post([{mediaType:'PHOTO',fileKey:'a'}]),connection('w_member_social')); assert.equal(calls.length,4);
});
test('X media upload uses chunk endpoints and attaches resulting ID', async () => {
  const calls=[];
  global.fetch = async(url,init={}) => { calls.push(url);
    if(init.method==='HEAD') return new Response(null,{headers:{'content-length':'4','content-type':'image/jpeg'}});
    if(url.startsWith('https://storage.test')) return new Response('test',{status:206,headers:{'content-type':'image/jpeg'}});
    if(url.endsWith('/initialize')) return response({data:{id:'media1'}});
    if(url.endsWith('/append')) {assert.equal(init.body.get('segment_index'),'0');return new Response(null,{status:204});}
    if(url.endsWith('/finalize')) return response({data:{id:'media1'}});
    assert.equal(url,'https://api.x.com/2/tweets'); assert.deepEqual(JSON.parse(init.body).media.media_ids,['media1']); return response({data:{id:'tweet1'}});
  };
  assert.equal((await providers().publishX(post([{mediaType:'PHOTO',fileKey:'a'}]),connection('tweet.write media.write'))).id,'tweet1');
  assert.equal(calls.length,6);
});
test('provider API errors never count as successful publishing', async () => {
  global.fetch=async()=>response({errors:[{detail:'Access denied'}]},403);
  await assert.rejects(providers().publishX(post(),connection('tweet.write')),/Access denied/);
});
test('TikTok photo description preserves full caption and obeys title length', async () => {
  global.fetch=async(url,init)=>{const body=JSON.parse(init.body); assert.equal(body.post_info.description,'a'.repeat(150));assert.equal(body.post_info.title.length,90);assert.equal(body.post_info.disable_comment,true);return response({error:{code:'ok'},data:{publish_id:'p1'}});};
  const tiktok=load('lib/tiktok.ts'); await tiktok.initTikTokPhotoPublish({accessToken:'fake',photoUrls:['https://storage.test/a'],caption:'a'.repeat(150),photoTitle:'Chosen title'.padEnd(90,'!'),privacyLevel:'SELF_ONLY',disableComment:true});
});
test('X reporting keeps unavailable counters null, rather than inventing zeros',()=>{
  const {xMetrics}=load('lib/reporting/adapters/x.ts',{'@/lib/socialTokens':{},'@/lib/publishing/http':{}});
  assert.equal(xMetrics({id:'1',text:''}).engagement,null);
  const m=xMetrics({id:'1',text:'',public_metrics:{like_count:2,reply_count:3,retweet_count:4,quote_count:1,impression_count:100}});
  assert.equal(m.engagement,10);assert.equal(m.engagementRate,.1);
});
test('worker duplicate lease never makes a platform call',async()=>{
  const {runPublishJob}=load('lib/publishing/worker.ts',{'@/lib/db':{db:{calendarPost:{updateMany:async()=>({count:0})}}},'@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, },'@/lib/instagramPublishing':{},'@/lib/tiktokPublishing':{},'@/lib/socialReporting':{},'@/lib/socialTokens':{},'./providers':{}});
  await runPublishJob('post','FACEBOOK',new Date());
});
test('dispatch timeout fails ambiguous job instead of automatically retrying',async()=>{
  const updates=[]; const env={URL:process.env.URL,CRON_SECRET:process.env.CRON_SECRET}; process.env.URL='https://site.test'; process.env.CRON_SECRET='fake';
  try {
    global.fetch=async()=>{throw new Error('timeout');};
    const {runScheduledPublishing}=load('lib/publishing/scheduler.ts',{'@/lib/db':{db:{calendarPost:{updateMany:async args=>{updates.push(args);return {count:1};},findMany:async()=>[{id:'p',platform:'FACEBOOK'}]}}}});
    await runScheduledPublishing(['FACEBOOK']);
    const last=updates.at(-1);assert.equal(last.data.publishStatus,'FAILED');assert.equal(last.where.publishWorkerStartedAt,null);
  } finally { for(const [key,value] of Object.entries(env)) {if(value===undefined)delete process.env[key];else process.env[key]=value;} }
});
test('duplicate inbox event does not increment unread counts or create a lead',async()=>{
  const tx={socialLeadConversation:{upsert:async()=>({id:'thread',leadStatus:'NEW'}),update:async()=>assert.fail('duplicate unread'),updateMany:async()=>assert.fail('duplicate preview')},socialLeadMessage:{createMany:async()=>({count:0})},calendarLead:{upsert:async()=>assert.fail('duplicate lead')}};
  const {ingestSocialMessage}=load('lib/socialMessaging/ingest.ts',{'@/lib/db':{db:{$transaction:fn=>fn(tx)}}});
  assert.equal(await ingestSocialMessage({id:'connection',calendarId:'workspace',platform:'X'},{conversationId:'external',messageId:'m1',participantId:'person',text:'hello',createdAt:new Date(),outbound:false}),false);
});
test('new inbox event scopes conversation and CRM lead to its connection workspace',async()=>{
  let conversationArgs,leadArgs,messageArgs,unread=0;
  const tx={socialLeadConversation:{upsert:async args=>{conversationArgs=args;return{id:'thread',leadStatus:'NEW'};},update:async()=>{unread++;},updateMany:async()=>({count:1})},socialLeadMessage:{createMany:async args=>{messageArgs=args;return{count:1};}},calendarLead:{upsert:async args=>{leadArgs=args;}}};
  const {ingestSocialMessage}=load('lib/socialMessaging/ingest.ts',{'@/lib/db':{db:{$transaction:fn=>fn(tx)}}});
  await ingestSocialMessage({id:'connectionA',calendarId:'workspaceA',platform:'X'},{conversationId:'external',messageId:'m1',participantId:'person',text:'hello',createdAt:new Date(),outbound:false});
  assert.equal(conversationArgs.create.calendarId,'workspaceA');assert.equal(conversationArgs.where.socialConnectionId_providerConversationId.socialConnectionId,'connectionA');assert.equal(leadArgs.create.calendarId,'workspaceA');assert.equal(unread,1);assert.equal(messageArgs.data[0].autoReplyEligible,false);
});
test('shared messaging dispatch keeps Meta and X separate',async()=>{
  const {sendSocialInboxMessage}=load('lib/socialMessaging/registry.ts',{'@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature:async()=>true,canAccessCalendarById:async()=>true},'@/lib/socialTokens':{freshConnection:async c=>c,requireScopes:tokenMock.requireScopes},'./meta':{sendMetaInboxMessage:async()=> 'meta-message'},'@/lib/publishing/http':{providerJson:async(url,init)=>{assert.match(url,/with\/recipient\/messages$/);assert.equal(JSON.parse(init.body).text,'Hello');return{data:{dm_event_id:'x-message'}};}}});
  assert.equal(await sendSocialInboxMessage({connection:{status:'CONNECTED',platform:'FACEBOOK'},recipientId:'recipient',text:'Hello'}),'meta-message');
  assert.equal(await sendSocialInboxMessage({connection:{status:'CONNECTED',platform:'X',tokenScopes:'dm.write'},recipientId:'recipient',text:'Hello'}),'x-message');
  await assert.rejects(sendSocialInboxMessage({connection:{status:'CONNECTED',platform:'TIKTOK'},recipientId:'recipient',text:'Hello'}),/approval/);
});
test('initial X inbox history cannot trigger AI replies, and group DMs are excluded',async()=>{
  const ingested=[];
  const now=new Date();
  const {syncXInbox}=load('lib/socialMessaging/x.ts',{
    '@/lib/db':{db:{socialInboxSettings:{findUnique:async()=>({aiAutoReplyEnabled:true})},socialConnection:{updateMany:async()=>({count:1})}}},
    '@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, canAccessCalendarById:async()=>true},
    '@/lib/socialTokens':{freshConnection:async c=>c,requireScopes:()=>{}},
    '@/lib/publishing/http':{providerJson:async()=>({data:[{id:'message1',sender_id:'other',participant_ids:['me','other'],dm_conversation_id:'me-other',created_at:now.toISOString(),text:'Hello'},{id:'group',sender_id:'other',participant_ids:['me','other','third'],dm_conversation_id:'group',created_at:now.toISOString(),text:'Hello'}]})},
    './ingest':{ingestSocialMessage:async(c,event)=>ingested.push(event)},
  });
  await syncXInbox({id:'conn',platformAccountId:'me',calendarId:'calendar',messagingLastSyncAt:null});
  assert.equal(ingested.length,1);assert.equal(ingested[0].autoReplyEligible,false);
});
test('publishing route denies an unapproved post without changing state',async()=>{
  const {POST}=load('app/api/calendars/[id]/posts/[postId]/publish/route.ts',{
    '@/lib/auth':{getCurrentCreator:async()=>({id:'creator'})},
    '@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, hasCalendarPermission:async()=>true,canAccessCalendarById:async()=>true},
    '@/lib/db':{db:{calendarPost:{findFirst:async()=>({platform:'FACEBOOK',publishStatus:'NOT_SCHEDULED',approvalStatus:'PENDING'}),updateMany:async()=>assert.fail('must not schedule')}}},
  });
  const result=await POST(new Request('https://site.test',{method:'POST',body:JSON.stringify({action:'schedule'})}),{params:Promise.resolve({id:'workspace',postId:'post'})});
  assert.equal(result.status,409);
});
test('publishing route requires duplicate-risk acknowledgment before retry',async()=>{
  const {POST}=load('app/api/calendars/[id]/posts/[postId]/publish/route.ts',{
    '@/lib/auth':{getCurrentCreator:async()=>({id:'creator'})},
    '@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, hasCalendarPermission:async()=>true,canAccessCalendarById:async()=>true},
    '@/lib/db':{db:{calendarPost:{findFirst:async()=>({platform:'FACEBOOK',publishStatus:'FAILED',approvalStatus:'APPROVED',isAiDraft:false}),updateMany:async()=>assert.fail('must not retry')}}},
  });
  const result=await POST(new Request('https://site.test',{method:'POST',body:JSON.stringify({action:'retry'})}),{params:Promise.resolve({id:'workspace',postId:'post'})});
  assert.equal(result.status,409);
});
test('publishing worker requires matching lease and approved non-draft content',async()=>{
  const stamp=new Date();let query;
  const {runPublishJob}=load('lib/publishing/worker.ts',{'@/lib/db':{db:{calendarPost:{updateMany:async args=>{query=args.where;return{count:0};}}}},'@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, },'@/lib/instagramPublishing':{},'@/lib/tiktokPublishing':{},'@/lib/socialReporting':{},'@/lib/socialTokens':{},'./providers':{}});
  await runPublishJob('post','X',stamp);assert.equal(query.updatedAt,stamp);assert.equal(query.approvalStatus,'APPROVED');assert.equal(query.isAiDraft,false);assert.equal(query.publishWorkerStartedAt,null);
});
test('client revision cancels a scheduled post atomically',async()=>{
  let update;
  const stamp=new Date();
  const current={id:'post',calendarId:'calendar',platform:'FACEBOOK',approvalStatus:'APPROVED',publishStatus:'SCHEDULED',isAiDraft:false,updatedAt:stamp,assets:[{sizeBytes:1n,fileKey:'a'}]};
  const db={socialCalendar:{findUnique:async()=>({id:'calendar',collaborators:[],manager:{email:'test@example.invalid'},clientName:'Test'})},socialConnection:{findFirst:async()=>null},calendarPost:{findUnique:async()=>current,updateMany:async args=>{update=args;return{count:1};},findUniqueOrThrow:async()=>({...current,approvalNote:'Change caption'})}};
  const {POST}=load('app/api/social-calendar/[slug]/posts/[postId]/review/route.ts',{'@/lib/calendarPermissions':{canAccessCalendarById:async()=>true},'@/lib/db':{db},'@/lib/auth':{verifyViewerToken:()=>({})},'@/lib/resend':{sendCalendarPostReviewedEmail:async()=>{}},'@/lib/r2':{publicUrlFor:()=> 'https://storage.test/a'}});
  const {NextRequest}=require('next/server');
  const req=new NextRequest('https://site.test',{method:'POST',headers:{cookie:'calendar_viewer_calendar=fake'},body:JSON.stringify({action:'request_revision',note:'Change caption'})});
  const result=await POST(req,{params:Promise.resolve({slug:'calendar',postId:'post'})});
  assert.equal(result.status,200);assert.equal(update.data.publishStatus,'NOT_SCHEDULED');assert.equal(update.data.approvalStatus,'NEEDS_REVISION');assert.equal(update.where.publishStatus,'SCHEDULED');assert.equal(update.where.updatedAt,stamp);
});

function xInboxFixture(pages = [], overrides = {}) {
  const writes = [], messages = [], requests = [];
  const stored = { id:'x-connection', calendarId:'workspace', platformAccountId:'me', status:'CONNECTED', tokenScopes:'dm.read tweet.read users.read', messagingLastSyncAt:new Date() };
  const mod = load('lib/socialMessaging/x.ts', {
    '@/lib/db':{db:{socialInboxSettings:{findUnique:async()=>({aiAutoReplyEnabled:true})},socialConnection:{findMany:async query=>{assert.equal(query.where.tokenScopes,undefined);return [stored];},updateMany:async update=>{writes.push(update);return {count:1};}}}},
    '@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, canAccessCalendarById:async()=>true},
    '@/lib/socialTokens':{freshConnection:async c=>c,requireScopes:tokenMock.requireScopes},
    '@/lib/publishing/http':{providerJson:async url=>{requests.push(new URL(url));return pages.shift();}},
    './ingest':{ingestSocialMessage:async(c,event)=>{messages.push(event);return true;}},
    ...overrides,
  });
  return {...mod, stored, writes, messages, requests};
}
const xEvent = (extra={}) => ({id:'dm1',sender_id:'other',dm_conversation_id:'me-other',created_at:new Date().toISOString(),text:'Hello',...extra});
test('X participant parsing handles absent, empty and recipient-only lists without losing ID precision',()=>{
  const {xMessageParticipant:parse}=xInboxFixture();
  for(const participant_ids of [undefined,[],['me'],['other'],['me','other']]) assert.equal(parse(xEvent({participant_ids}),'me'),'other');
  assert.equal(parse(xEvent({sender_id:'90071992547409931',dm_conversation_id:'90071992547409930-90071992547409931'}),'90071992547409930'),'90071992547409931');
  assert.equal(parse(xEvent({participant_ids:['me','other','third']}),'me'),null);
  assert.equal(parse(xEvent({sender_id:'third'}),'me'),null);
  assert.equal(parse(xEvent(),'unrelated'),null);
});
test('X manual recovery imports skipped history, follows pagination and never enables AI replies',async()=>{
  const f=xInboxFixture([{data:[xEvent({participant_ids:[],created_at:'2026-01-01T00:00:00Z'})],meta:{next_token:'page2'}},{data:[xEvent({id:'dm2',sender_id:'me'})]}]);
  const result=await f.syncXInbox(f.stored,{fullHistory:true,maxPages:2,pageSize:25});
  assert.equal(result.imported,2);assert.equal(result.complete,true);
  assert.equal(f.requests[1].searchParams.get('pagination_token'),'page2');
  assert.match(f.requests[0].searchParams.get('dm_event.fields'),/sender_id/);
  assert.equal(f.messages[0].outbound,false);assert.equal(f.messages[1].outbound,true);
  assert.ok(f.messages.every(m=>m.autoReplyEligible===false));
  assert.ok(f.writes[0].data.messagingLastSyncAt instanceof Date);
});
test('X truncated or partial retrieval preserves the previous watermark',async()=>{
  for(const page of [{data:[xEvent()],meta:{next_token:'more'}},{data:[xEvent()],errors:[{detail:'Profile unavailable'}]}]) {
    const f=xInboxFixture([page]);
    const result=await f.syncXInbox(f.stored,{fullHistory:true,maxPages:1});
    assert.ok(result.warning);assert.equal(f.writes[0].data.messagingLastSyncAt,undefined);
  }
});
test('X missing read scope is surfaced instead of silently excluding the connected account',async()=>{
  const f=xInboxFixture();f.stored.tokenScopes='tweet.read users.read';
  const result=await f.syncSocialInboxes('workspace');
  assert.equal(result.checked,1);assert.equal(result.synced,0);assert.match(result.errors[0],/permission/);
  assert.equal(f.requests.length,0);assert.equal(f.writes[0].data.messagingLastSyncAt,undefined);
});
test('X provider failures retain HTTP status and produce actionable inbox errors',async()=>{
  const {providerJson}=load('lib/publishing/http.ts');
  const {xInboxErrorMessage}=xInboxFixture();
  for(const [status,pattern] of [[401,/reconnect/],[402,/billing/],[403,/DM access/],[429,/rate-limited/]]) {
    global.fetch=async()=>response({detail:'Provider failure'},status);
    await assert.rejects(providerJson('https://api.x.com/2/dm_events'),error=>{assert.equal(error.status,status);assert.match(xInboxErrorMessage(error),pattern);return true;});
  }
});
test('manual X sync route enforces workspace permission before provider access',async()=>{
  const {POST}=load('app/api/calendars/[id]/inbox/sync/route.ts',{
    '@/lib/auth':{getCurrentCreator:async()=>({id:'creator'})},
    '@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, hasCalendarPermission:async()=>false,canAccessCalendarById:async()=>true},
    '@/lib/socialMessaging/x':{syncSocialInboxes:async()=>assert.fail('unauthorized sync')},
  });
  assert.equal((await POST(new Request('https://site.test'),{params:Promise.resolve({id:'workspace'})})).status,403);
});
test('manual X sync route scopes recovery and returns missing-account/provider failure statuses',async()=>{
  for(const [summary,status] of [[{checked:0,synced:0,errors:[]},409],[{checked:1,synced:0,errors:['Denied']},502],[{checked:1,synced:1,errors:[]},200]]) {
    const {POST}=load('app/api/calendars/[id]/inbox/sync/route.ts',{
      '@/lib/auth':{getCurrentCreator:async()=>({id:'creator'})},
      '@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, hasCalendarPermission:async()=>true,canAccessCalendarById:async()=>true},
      '@/lib/socialMessaging/x':{syncSocialInboxes:async(id,options)=>{assert.equal(id,'workspace');assert.deepEqual(options,{fullHistory:true,maxPages:2,pageSize:25});return summary;}},
    });
    assert.equal((await POST(new Request('https://site.test'),{params:Promise.resolve({id:'workspace'})})).status,status);
  }
});

test('X rejects missing payload instead of reporting an empty inbox',async()=>{
  for(const payload of [{},{data:[],errors:[{detail:'DM access unavailable'}]}]) {
    const f=xInboxFixture([payload]);
    await assert.rejects(f.syncXInbox(f.stored,{fullHistory:true}),/unexpected response|DM access unavailable/);
    assert.equal(f.writes.length,0);
  }
});
test('X empty manual sync verifies token owner and reports the actual account',async()=>{
  const f=xInboxFixture([{meta:{result_count:0}},{data:{id:'me',username:'test_account'}}]);
  const result=await f.syncXInbox(f.stored,{fullHistory:true});
  assert.match(result.warning,/@test_account/);
  assert.equal(f.requests[1].pathname,'/2/users/me');
});
test('X empty manual sync rejects a mismatched token owner without advancing checkpoint',async()=>{
  const f=xInboxFixture([{data:[],meta:{result_count:0}},{data:{id:'wrong',username:'another'}}]);
  await assert.rejects(f.syncXInbox(f.stored,{fullHistory:true}),/different account/);
  assert.equal(f.writes.length,0);
});

test('targeted X recovery resolves username and imports through the conversation endpoint without advancing global sync',async()=>{
  const f=xInboxFixture([{data:{id:'other',username:'Randymqvm',name:'Randy'}},{data:[xEvent()]}]);
  const result=await f.syncXInbox(f.stored,{fullHistory:true,participantUsername:'@Randymqvm'});
  assert.equal(f.requests[0].pathname,'/2/users/by/username/Randymqvm');
  assert.equal(f.requests[1].pathname,'/2/dm_conversations/with/other/dm_events');
  assert.equal(result.imported,1);assert.equal(f.messages[0].username,'Randymqvm');
  assert.equal(f.messages[0].autoReplyEligible,false);assert.equal(f.writes[0].data.messagingLastSyncAt,undefined);
});
test('targeted X recovery rejects the connected account as sender',async()=>{
  const f=xInboxFixture([{data:{id:'me'}}]);
  await assert.rejects(f.syncXInbox(f.stored,{participantUsername:'same'}),/other person's/);
  assert.equal(f.requests.length,1);
});

const chatProvider = () => load('lib/xChat/provider.ts', {'@/lib/socialTokens':{freshConnection:async c=>c,requireScopes:()=>{}}});
test('X Chat transport accepts only bounded encrypted payloads and rejects PIN/plaintext fields',()=>{
  const {encryptedSendBody}=chatProvider();
  const body={message_id:'12345678-1234-4234-8234-123456789012',encoded_message_create_event:'YWJj',encoded_message_event_signature:'YWJj'};
  assert.deepEqual(encryptedSendBody(body),body);
  for(const extra of [{pin:'1234'},{text:'secret'},{privateKey:'secret'}]) assert.throws(()=>encryptedSendBody({...body,...extra}),/Only encrypted/);
  assert.throws(()=>encryptedSendBody({...body,encoded_message_create_event:'a'.repeat(100001)}),/payload/);
});
test('X Chat rejects unrelated, self and group conversation IDs',()=>{
  const {participantForConversation:participant}=chatProvider();
  assert.equal(participant('123-456','123'),'456');assert.equal(participant('456:123','123'),'456');assert.equal(participant('456','123'),'456');
  for(const id of ['123','g456','456-789','123/../../users','123-123']) assert.throws(()=>participant(id,'123'),/one-to-one/);
});
test('X Chat browser displays only verified messages from the selected conversation',()=>{
  const {verifiedMessages}=load('lib/xChat/browser.ts');
  const event={type:'message',verified:true,id:'m1',senderId:'456',conversationId:'123:456',createdAtMsec:1,content:{contentType:'text',text:'Hello'}};
  const result=verifiedMessages([event,{...event,verified:false},{...event,conversationId:'123:789'},{...event,senderId:'789'}],'123','456');
  assert.equal(result.length,1);assert.equal(result[0].text,'Hello');
});
test('X Chat backup callback resolves documented realm tokens without substituting OAuth credentials',()=>{
  const {realmToken}=load('lib/xChat/browser.ts');
  assert.equal(realmToken({token_map:[{key:'realm',value:{token:'realm-token'}}]},'realm'),'realm-token');
  assert.equal(realmToken({tokens:{realm:'realm-token'}},'realm'),'realm-token');
  assert.throws(()=>realmToken({accessToken:'oauth'},'missing'),/did not provide/);
});
test('X Chat provider errors never reflect sensitive response bodies',async()=>{
  global.fetch=async()=>response({errors:[{detail:'sensitive-provider-value'}]},403);
  await assert.rejects(chatProvider().chatRequest(connection(),'users/123/public_keys'),error=>{assert.match(error.message,/denied Chat/);assert.ok(!error.message.includes('sensitive-provider'));return true;});
});
function chatRouteFixture({owner=true,connected=true}={}) {
  const calls=[];
  const route=load('app/api/calendars/[id]/inbox/x-chat/route.ts',{
    '@/lib/auth':{getCurrentCreator:async()=>({id:'owner'})},
    '@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, canAccessCalendarById:async()=>true},
    '@/lib/db':{db:{socialCalendar:{findFirst:async query=>{assert.deepEqual(query.where,{id:'workspace',managerId:'owner'});return owner?{id:'workspace'}:null;}},socialConnection:{findFirst:async query=>{assert.deepEqual(query.where,{id:'connection',calendarId:'workspace',platform:'X',status:'CONNECTED'});return connected?{...connection(),id:'connection',connectedAt:new Date('2026-01-01T00:00:00Z')}:null;}}}},
    '@/lib/socialTokens':{freshConnection:async c=>c,requireScopes:()=>{}},
  });
  return route;
}
test('X Chat setup enforces owner permission and workspace-scoped connection before provider access',async()=>{
  const {NextRequest}=require('next/server');global.fetch=async()=>assert.fail('provider must not be called');
  for(const [options,status] of [[{owner:false},403],[{connected:false},404]]) {
    const result=await chatRouteFixture(options).GET(new NextRequest('https://site.test/api?connectionId=connection'),{params:Promise.resolve({id:'workspace'})});
    assert.equal(result.status,status);assert.match(result.headers.get('Cache-Control'),/no-store/);
  }
});
test('X Chat setup checks token identity and selects newest existing key backup',async()=>{
  const {NextRequest}=require('next/server');
  global.fetch=async url=>response(url.endsWith('users/me')?{data:{id:'123',username:'account'}}:{data:[{public_key_version:'9',juicebox_config:{tokens:{}}},{public_key_version:'10',juicebox_config:{tokens:{}}}]});
  const result=await chatRouteFixture().GET(new NextRequest('https://site.test/api?connectionId=connection'),{params:Promise.resolve({id:'workspace'})});
  assert.equal(result.status,200);assert.equal((await result.json()).record.public_key_version,'10');
});
test('X Chat event retrieval includes key changes and signing keys for both participants',async()=>{
  const {NextRequest}=require('next/server');
  global.fetch=async url=>{
    if(url.includes('/events?')) {assert.match(url,/conversations\/456\/events/);return response({data:[{encoded_event:'ciphertext'}],meta:{conversation_key_events:['wrapped-keys']}});}
    assert.ok(!url.includes('juicebox_config'));return response({data:[{public_key_version:'1',public_key:'identity',signing_public_key:'signing',identity_public_key_signature:'signature'}]});
  };
  const result=await chatRouteFixture().GET(new NextRequest('https://site.test/api?connectionId=connection&action=events&conversationId=123-456'),{params:Promise.resolve({id:'workspace'})});
  const data=await result.json();assert.equal(result.status,200);assert.deepEqual(data.meta.conversation_key_events,['wrapped-keys']);assert.deepEqual(data.signingKeys.map(k=>k.userId),['123','456']);
});
test('X Chat sends only validated ciphertext and keeps the SDK message ID on retries',async()=>{
  const {NextRequest}=require('next/server');const sent=[];
  global.fetch=async(url,init)=>{assert.match(url,/chat\/conversations\/456\/messages$/);sent.push(JSON.parse(init.body));return response({data:{encoded_message_event:'ciphertext'}},201);};
  const body={message_id:'12345678-1234-4234-8234-123456789012',encoded_message_create_event:'YWJj',encoded_message_event_signature:'YWJj'};
  for(let i=0;i<2;i++) {
    const result=await chatRouteFixture().POST(new NextRequest('https://site.test/api?connectionId=connection&conversationId=123-456',{method:'POST',headers:{origin:'https://site.test'},body:JSON.stringify(body)}),{params:Promise.resolve({id:'workspace'})});
    assert.equal(result.status,200);
  }
  assert.deepEqual(sent,[body,body]);
});
test('X Chat rejects cross-origin sends before provider access',async()=>{
  const {NextRequest}=require('next/server');global.fetch=async()=>assert.fail('must not send');
  const result=await chatRouteFixture().POST(new NextRequest('https://site.test/api?connectionId=connection&conversationId=123-456',{method:'POST',headers:{origin:'https://other.test'},body:'{}'}),{params:Promise.resolve({id:'workspace'})});
  assert.equal(result.status,403);
});

test('X Chat serializes secure-backup recovery across connected accounts and releases failed attempts',async()=>{
  const {withExclusiveUnlock}=load('lib/xChat/browser.ts');
  let release;const running=withExclusiveUnlock(()=>new Promise(resolve=>{release=resolve;}));
  await assert.rejects(withExclusiveUnlock(async()=>{}),/Another X Chat/);
  release();await running;
  await assert.rejects(withExclusiveUnlock(async()=>{throw new Error('failed');}),/failed/);
  assert.equal(await withExclusiveUnlock(async()=>true),true);
});

test('X Chat list resolves names from participant expansion and drops self conversations',async()=>{
  global.fetch=async url=>{if(url.includes('/events?'))return response({data:[{sender_id:'456',created_at:'2026-09-01T00:00:00Z',encoded_event:'cipher'}]});assert.equal(new URL(url).searchParams.get('expansions'),'participant_ids');return response({data:[{id:'123-123'},{id:'123-456'},{id:'g789'}],includes:{users:[{id:'456',name:'Randy',username:'Randymqvm'}]},meta:{next_token:'next'}});};
  const result=await chatProvider().chatConversations(connection());
  assert.equal(result.data.length,1);assert.equal(result.data[0].name,'Randy');assert.equal(result.data[0].username,'Randymqvm');assert.equal(result.meta.next_token,'next');
});
test('X Chat list batches missing profiles and preserves usable partial results',async()=>{
  let calls=0;
  global.fetch=async url=>{calls++;if(url.includes('/events?'))return response({data:[{sender_id:url.includes('/456/')?'456':'789',created_at:'2026-09-01T00:00:00Z',encoded_event:'cipher'}]});if(url.includes('chat/conversations'))return response({data:[{id:'123-456'},{id:'123-789'}]});assert.equal(new URL(url).searchParams.get('ids'),'456,789');return response({data:[{id:'456',name:'Randy',username:'Randymqvm'}],errors:[{detail:'Other user unavailable'}]});};
  const result=await chatProvider().chatConversations(connection());
  assert.equal(calls,4);assert.equal(result.data[0].username,'Randymqvm');assert.equal(result.data[1].username,null);
});

test('unified inbox merges encrypted X and Meta conversations in recency order and shares platform/search filters',()=>{
  const {mergeInboxConversations:merge}=load('lib/xChat/inbox.ts');
  const meta={id:'meta',platform:'FACEBOOK',participantName:'Alice',participantUsername:'alice',leadStatus:'NEW',unreadCount:1,lastMessageAt:'2026-09-29T00:00:00Z',messages:[]};
  const x={id:'xchat:connection:123-456',platform:'X',participantName:'Randy',participantUsername:'Randymqvm',leadStatus:'',unreadCount:0,lastMessageAt:'2026-09-30T00:00:00Z',messages:[{text:'Recent encrypted test'}],encrypted:{connectionId:'connection',conversationId:'123-456'}};
  const filters={platform:'',status:'',search:'',unreadOnly:false};
  assert.deepEqual(merge([meta],[x],filters).map(c=>c.id),[x.id,meta.id]);
  assert.deepEqual(merge([meta],[x],{...filters,platform:'X'}).map(c=>c.id),[x.id]);
  assert.deepEqual(merge([meta],[x],{...filters,search:'randymqvm'}).map(c=>c.id),[x.id]);
  assert.deepEqual(merge([meta],[x],{...filters,search:'encrypted test'}).map(c=>c.id),[x.id]);
  assert.deepEqual(merge([meta],[x],{...filters,unreadOnly:true}).map(c=>c.id),[meta.id]);
  assert.deepEqual(merge([meta],[],filters).map(c=>c.id),[meta.id]);
});

test('real X Chat WASM verified text reaches the inbox with the SDK content_type discriminator',async()=>{
  const {pathToFileURL}=require('node:url');
  const sdkDir=path.join(root,'node_modules/@xdevplatform/chat-xdk/pkg');
  const wasm=await import(pathToFileURL(path.join(sdkDir,'chat_xdk_wasm.js')).href);
  await wasm.default({module_or_path:fs.readFileSync(path.join(sdkDir,'chat_xdk_wasm_bg.wasm'))});
  const v=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/xchat-sdk-message.json'),'utf8'));
  const chat=new wasm.Chat();
  try {
    // Only the upstream public synthetic fixture is imported. Production
    // key recovery continues to use the browser PIN flow, never raw imports.
    chat.importKeys(Buffer.from(v.private_keys_concat_b64,'base64'),v.event_recipient_key_version);
    chat.setIdentity(v.event_sender_id,v.event_recipient_key_version);
    chat.setRejectUnverified(true);
    chat.setCacheKeys(true);
    chat.setSigningKeys([{userId:v.event_sender_id,publicKeyVersion:v.event_signing_key_version,publicKey:v.signing_public_b64,identityPublicKey:v.identity_public_b64,identityPublicKeySignature:v.identity_public_key_signature_b64}]);
    const decrypted=chat.decryptEvents([v.event_key_change_b64,v.event_message_b64]);
    assert.deepEqual(decrypted.errors,{});
    const {verifiedMessages}=load('lib/xChat/browser.ts');
    const [account,participant]=v.event_conversation_id.split(':');
    const display=verifiedMessages(decrypted.messages.map(m=>m.event),account,participant);
    assert.equal(display.length,1);assert.equal(display[0].text,v.event_message_text);
    const {sendPayload}=load('lib/xChat/browser.ts');
    for (let i=0;i<20;i++) {
      const payload=sendPayload(chat.encryptMessage({conversationId:v.event_conversation_id.replace(':','-'),text:'Synthetic reply '+i}));
      assert.deepEqual(chatProvider().encryptedSendBody(payload),payload);
    }
    const message=decrypted.messages.find(m=>m.event.type==='message').event;
    assert.equal(verifiedMessages([{...message,verified:false}],account,participant).length,0);
    assert.equal(verifiedMessages([message],account,'unrelated').length,0);
  } finally {chat.lock();chat.free();}
});

test('encrypted X contacts create named CRM leads once without saving messages or resetting qualification',async()=>{
  const conversations=new Map(),leads=new Map();const writes=[];
  const tx={socialLeadConversation:{upsert:async query=>{const key=JSON.stringify(query.where);writes.push(query);if(!conversations.has(key))conversations.set(key,{id:'crm-thread',leadStatus:'QUALIFIED',...query.create});return conversations.get(key);}},calendarLead:{upsert:async query=>{writes.push(query);if(!leads.has(query.where.socialConversationId))leads.set(query.where.socialConversationId,query.create);else Object.assign(leads.get(query.where.socialConversationId),query.update);}}};
  const {syncXChatLeads}=load('lib/xChat/leads.ts',{'@/lib/db':{db:{$transaction:async fn=>fn(tx)}},'@/lib/socialTokens':{}});
  const c={id:'connection',calendarId:'workspace',platformAccountId:'123'};
  await syncXChatLeads(c,[{id:'123-456',name:'Randy',username:'Randymqvm'}]);
  const result=await syncXChatLeads(c,[{id:'456:123',name:'Randy Updated',username:'Randymqvm'}]);
  assert.equal(conversations.size,1);assert.equal(leads.size,1);
  assert.equal(leads.get('crm-thread').name,'Randy Updated');assert.equal(leads.get('crm-thread').status,'QUALIFIED');assert.equal(leads.get('crm-thread').source,'SOCIAL');
  assert.equal(result[0].crmConversationId,'crm-thread');assert.equal(result[0].leadStatus,'QUALIFIED');
  assert.ok(writes.every(q=>!('text' in (q.create||{}))));
  assert.equal(writes[0].create.calendarId,'workspace');assert.equal(writes[0].create.providerConversationId,'xchat:123-456');
});
test('unified inbox merges stored X lead status with decrypted history without duplicate rows',()=>{
  const {mergeInboxConversations:merge}=load('lib/xChat/inbox.ts');
  const stored={id:'crm-thread',platform:'X',leadStatus:'QUALIFIED',unreadCount:0,messages:[],lastMessageAt:null};
  const live={...stored,leadStatus:'NEW',messages:[{text:'browser-only'}]};
  const result=merge([stored],[live],{platform:'X',status:'QUALIFIED',search:'',unreadOnly:false});
  assert.equal(result.length,1);assert.equal(result[0].leadStatus,'QUALIFIED');assert.equal(result[0].messages[0].text,'browser-only');
});

test('X Chat recipient rejection is actionable, sanitized and permits a corrected send',async()=>{
  global.fetch=async()=>response({type:'https://api.x.com/2/problems/recipient-not-messageable',detail:'sensitive-provider-value'},403);
  await assert.rejects(chatProvider().chatRequest(connection(),'chat/conversations/456/messages',{}),error=>{
    assert.match(error.message,/message this recipient/);assert.equal(error.retrySamePayload,false);assert.ok(!error.message.includes('sensitive-provider'));return true;
  });
  global.fetch=async()=>response({},503);
  await assert.rejects(chatProvider().chatRequest(connection(),'chat/conversations/456/messages',{}),error=>error.retrySamePayload===true);
});

test('X Chat displays only verified messages at or after the connection date',()=>{
  const {verifiedMessages}=load('lib/xChat/browser.ts');
  const connectedAt='2026-09-01T00:00:00Z', time=Date.parse(connectedAt);
  const event={type:'message',verified:true,id:'new',senderId:'456',conversationId:'123:456',createdAtMsec:time,content:{content_type:'text',text:'New message'}};
  const events=[{...event,id:'old',createdAtMsec:time-1},event,{...event,id:'later',createdAtMsec:time+1},{...event,id:'unknown',createdAtMsec:undefined}];
  assert.deepEqual(verifiedMessages(events,'123','456',connectedAt).map(m=>m.id),['new','later']);
  assert.deepEqual(verifiedMessages(events,'123','456','invalid'),[]);
});
test('X full-history recovery cannot import DMs from before connection',async()=>{
  const cutoff=new Date('2026-09-01T00:00:00Z');
  const f=xInboxFixture([{data:[xEvent({id:'old',created_at:new Date(cutoff.getTime()-1).toISOString()}),xEvent({id:'new',created_at:cutoff.toISOString()})]}]);
  f.stored.connectedAt=cutoff;
  const result=await f.syncXInbox(f.stored,{fullHistory:true});
  assert.deepEqual(f.messages.map(m=>m.messageId),['new']);assert.equal(result.skipped,1);
});

test('X conversation eligibility requires inbound activity since connection, including later pages',async()=>{
  const {hasRecentXInbound}=chatProvider();
  const c=connection();
  for (const events of [[],[{sender_id:'456',created_at:'2025-12-31T00:00:00Z',encoded_event:'cipher'}],[{sender_id:'123',created_at:'2026-09-01T00:00:00Z',encoded_event:'cipher'}]]) {
    global.fetch=async()=>response({data:events});
    assert.equal(await hasRecentXInbound(c,'456'),false);
  }
  let calls=0;
  global.fetch=async()=>response(++calls===1?{data:[{sender_id:'123',created_at:'2026-09-01T00:00:00Z',encoded_event:'cipher'}],meta:{next_token:'older'}}:{data:[{sender_id:'456',created_at:c.connectedAt.toISOString(),encoded_event:'cipher'}]});
  assert.equal(await hasRecentXInbound(c,'456'),true);assert.equal(calls,2);
});

test('X inbound eligibility caches metadata to avoid rescanning on each unlock',async()=>{
  const {hasRecentXInbound}=chatProvider();const c={...connection(),id:'cache-connection'};let calls=0;
  global.fetch=async()=>{calls++;return response({data:[{sender_id:'456',created_at:'2026-09-01T00:00:00Z',encoded_event:'cipher'}]});};
  assert.equal(await hasRecentXInbound(c,'456'),true);assert.equal(await hasRecentXInbound(c,'456'),true);assert.equal(calls,1);
  assert.equal(await hasRecentXInbound({...c,connectedAt:new Date('2026-10-01T00:00:00Z')},'456'),false);assert.equal(calls,2);
});

test('LinkedIn authorization requests analytics explicitly without requiring it for basic publishing',()=>{
  const keys=['LINKEDIN_CLIENT_ID','LINKEDIN_CLIENT_SECRET','LINKEDIN_ANALYTICS_ENABLED'];
  const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    process.env.LINKEDIN_CLIENT_ID='test';process.env.LINKEDIN_CLIENT_SECRET='test';process.env.LINKEDIN_ANALYTICS_ENABLED='false';
    const {buildChannelAuthorizationUrl}=load('lib/channelOAuth.ts',{'@/lib/linkedin/messagingAccess':{linkedInMessagingConfigured:()=>false}});
    const base={channel:'linkedin',redirectUri:'https://example.test/callback',state:'state'};
    const scopes=options=>new URL(buildChannelAuthorizationUrl({...base,...options})).searchParams.get('scope').split(' ');
    assert.ok(scopes({}).includes('w_member_social'));assert.ok(!scopes({}).includes('r_member_postAnalytics'));
    assert.ok(scopes({linkedInAnalytics:true}).includes('r_member_postAnalytics'));
    assert.ok(scopes({linkedInPages:true}).includes('rw_organization_admin'));assert.ok(!scopes({linkedInPages:true}).includes('r_member_postAnalytics'));
    process.env.LINKEDIN_ANALYTICS_ENABLED='true';assert.ok(scopes({}).includes('r_member_postAnalytics'));
  }finally{for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
test('LinkedIn reconnection preserves previously granted analytics permission',async()=>{
  const {NextRequest}=require('next/server');let authorization;
  const route=load('app/api/calendars/[id]/channels/[channel]/connect/route.ts',{
    '@/lib/calendarPermissions': { hasCalendarPermission: async () => true },
    '@/lib/auth':{getCurrentCreator:async()=>({id:'owner'})},
    '@/lib/db':{db:{socialCalendar:{findUnique:async()=>({managerId:'owner'})},socialConnection:{findFirst:async()=>({platformAccountId:'123',tokenScopes:'w_member_social,r_member_postAnalytics'})}}},
    '@/lib/url':{appUrl:()=> 'https://example.test'},
    '@/lib/channelOAuth':{buildChannelAuthorizationUrl:options=>{authorization=options;return 'https://www.linkedin.com/oauth/v2/authorization';}},
    '@/lib/channelOAuthState':{createChannelOAuthState:()=>({state:'state',cookieName:'oauth',nonce:'nonce',maxAge:600}),channelOAuthCookieOptions:()=>({})},
  });
  await route.GET(new NextRequest('https://example.test/api/calendars/c/channels/linkedin/connect'),{params:Promise.resolve({id:'c',channel:'linkedin'})});
  assert.equal(authorization.linkedInAnalytics,true);assert.equal(authorization.linkedInPages,false);
});
test('LinkedIn Page discovery includes only approved administrators and deduplicates organizations',async()=>{
  const {linkedInPages}=load('lib/linkedin/pages.ts',{'@/lib/socialTokens':tokenMock});
  global.fetch=async url=>url.includes('organizationAcls')?response({elements:[{organization:'urn:li:organization:9',role:'ADMINISTRATOR',state:'APPROVED'},{organization:'urn:li:organization:9',role:'ADMINISTRATOR',state:'APPROVED'},{organization:'urn:li:organization:8',role:'ANALYST',state:'APPROVED'},{organization:'urn:li:organization:7',role:'ADMINISTRATOR',state:'REQUESTED'}]}):response({localizedName:'Test Page'});
  assert.deepEqual(await linkedInPages(connection('rw_organization_admin w_organization_social')),[{id:'urn:li:organization:9',name:'Test Page'}]);
  await assert.rejects(linkedInPages(connection('w_member_social')),/permission/);
});
test('LinkedIn Page publishing requires organization scope and uses organization author',async()=>{
  const c={...connection('w_organization_social'),platformAccountId:'urn:li:organization:9'};
  global.fetch=async(url,init)=>{assert.equal(JSON.parse(init.body).author,c.platformAccountId);return response({},201,{'x-restli-id':'urn:li:share:99'});};
  assert.equal((await providers().publishLinkedIn(post(),c)).id,'urn:li:share:99');
  await assert.rejects(providers().publishLinkedIn(post(),{...c,tokenScopes:'w_member_social'}),/permission/);
});
test('LinkedIn video finalizes all uploaded parts before creating a post',async()=>{
  const calls=[];
  global.fetch=async(url,init={})=>{calls.push(url);
    if(url.includes('initializeUpload'))return response({value:{video:'urn:li:video:1',uploadToken:'upload',uploadInstructions:[{uploadUrl:'https://upload.test/1',firstByte:0,lastByte:3},{uploadUrl:'https://upload.test/2',firstByte:4,lastByte:7}]}});
    if(url.startsWith('https://storage.test'))return new Response('data',{status:206,headers:{'content-type':'video/mp4'}});
    if(url.startsWith('https://upload.test'))return new Response(null,{status:200,headers:{etag:url.endsWith('1')?'"part1"':'"part2"'}});
    if(url.includes('finalizeUpload')){assert.deepEqual(JSON.parse(init.body).finalizeUploadRequest.uploadedPartIds,['part1','part2']);return response({});}
    if(url.includes('/videos/'))return response({status:'AVAILABLE'});
    assert.ok(calls.some(value=>value.includes('finalizeUpload')));return response({},201,{'x-restli-id':'urn:li:ugcPost:1'});
  };
  assert.equal((await providers().publishLinkedIn(post([{mediaType:'VIDEO',fileKey:'v',sizeBytes:8}]),connection('w_member_social'))).id,'urn:li:ugcPost:1');
});
test('LinkedIn analytics preserve actual reporting day instead of duplicating counters into today',async()=>{
  const {linkedinReportingAdapter}=load('lib/reporting/adapters/linkedin.ts',{'@/lib/socialTokens':{...tokenMock,freshConnection:async c=>c}});
  global.fetch=async url=>response({elements:[{count:url.includes('IMPRESSION')?100:2,dateRange:{start:{year:2026,month:9,day:29}}}]});
  const data=await linkedinReportingAdapter.fetchAccountMetrics(connection('r_member_postAnalytics'));
  assert.equal(data.snapshotDate.toISOString(),'2026-09-29T00:00:00.000Z');assert.equal(data.impressions,100);assert.equal(data.engagement,6);
});
test('LinkedIn Page reporting routes to organization endpoints, with bounded daily history',async()=>{
  const {linkedinReportingAdapter}=load('lib/reporting/adapters/linkedin.ts',{'@/lib/socialTokens':{...tokenMock,freshConnection:async c=>c}});
  const c={...connection('rw_organization_admin'),platformAccountId:'urn:li:organization:9'};
  global.fetch=async url=>{
    assert.ok(!url.includes('memberCreator'));
    if(url.includes('networkSizes'))return response({firstDegreeSize:500});
    if(url.includes('timeIntervals'))return response({elements:[{timeRange:{start:Date.parse('2026-09-29')},totalShareStatistics:{impressionCount:100,likeCount:2,commentCount:3,shareCount:1}}]});
    assert.ok(url.includes('ugcPosts=List('));return response({elements:[{totalShareStatistics:{impressionCount:200,likeCount:4,commentCount:2,shareCount:1,clickCount:5}}]});
  };
  const account=await linkedinReportingAdapter.fetchAccountMetrics(c);assert.equal(account.followers,500);assert.equal(account.dailySnapshots[0].engagement,6);
  const posts=await linkedinReportingAdapter.fetchPostMetrics(c,[{id:'post',platformPostId:'urn:li:ugcPost:99'}]);assert.equal(posts.get('post').engagement,7);assert.equal(posts.get('post').clicks,5);
});
test('LinkedIn Page reporting keeps missing statistics unavailable and preserves explicit zeros',async()=>{
  const {linkedinReportingAdapter}=load('lib/reporting/adapters/linkedin.ts',{'@/lib/socialTokens':{...tokenMock,freshConnection:async c=>c}});
  const c={...connection('rw_organization_admin'),platformAccountId:'urn:li:organization:9'};
  const posts=[{id:'post',platformPostId:'urn:li:share:99'}];
  global.fetch=async()=>response({elements:[]});
  const missing=(await linkedinReportingAdapter.fetchPostMetrics(c,posts)).get('post');
  for(const field of ['impressions','clicks','likes','comments','shares','engagement'])assert.equal(missing[field],null);
  global.fetch=async()=>response({elements:[{totalShareStatistics:{impressionCount:0,clickCount:0,likeCount:0,commentCount:0,shareCount:0}}]});
  const zero=(await linkedinReportingAdapter.fetchPostMetrics(c,posts)).get('post');
  for(const field of ['impressions','clicks','likes','comments','shares','engagement'])assert.equal(zero[field],0);
});
test('LinkedIn Page selection rejects unauthorized owners, foreign Pages and cross-origin writes',async()=>{
  const {NextRequest}=require('next/server');let writes=0;let owner=true;
  const route=load('app/api/calendars/[id]/channels/linkedin/pages/route.ts',{
    '@/lib/auth':{getCurrentCreator:async()=>({id:'owner'})},
    '@/lib/db':{db:{socialCalendar:{findFirst:async()=>owner?{id:'workspace'}:null,update:async()=>{writes++;}},socialConnection:{findFirst:async()=>({...connection(),calendarId:'workspace'})}}},
    '@/lib/calendarPermissions':{hasCalendarPermission: async () => owner, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, canAccessCalendarById:async()=>true},
    '@/lib/socialTokens':{freshConnection:async c=>c},
    '@/lib/linkedin/pages':{linkedInPages:async()=>[{id:'urn:li:organization:9',name:'Page'}]},
    '@/lib/socialReporting':{upsertSocialConnection:async()=>{writes++;}},
    '@/lib/channelOAuth':{getLinkedInMember:async()=>({sub:'123',name:'Member'})},
  });
  const context={params:Promise.resolve({id:'workspace'})};
  const req=(pageId,origin='https://site.test')=>new NextRequest('https://site.test/api',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({pageId})});
  assert.equal((await route.POST(req('urn:li:organization:8'),context)).status,403);assert.equal(writes,0);
  assert.equal((await route.POST(req('urn:li:organization:9','https://evil.test'),context)).status,403);assert.equal(writes,0);
  owner=false;assert.notEqual((await route.POST(req('urn:li:organization:9'),context)).status,200);assert.equal(writes,0);
  owner=true;assert.equal((await route.POST(req('urn:li:organization:9'),context)).status,200);assert.equal(writes,2);
});

test('LinkedIn multi-image publishing preserves uploaded order and fails closed on upload errors',async()=>{
  let uploads=0;
  global.fetch=async(url,init={})=>{
    if(url.includes('initializeUpload'))return response({value:{image:`urn:li:image:${++uploads}`,uploadUrl:'https://upload.test/image'}});
    if(url.startsWith('https://storage.test'))return new Response('image',{headers:{'content-type':'image/jpeg'}});
    if(url.startsWith('https://upload.test'))return new Response(null,{status:201});
    assert.deepEqual(JSON.parse(init.body).content.multiImage.images,[{id:'urn:li:image:1'},{id:'urn:li:image:2'}]);return response({},201,{'x-restli-id':'urn:li:share:2'});
  };
  await providers().publishLinkedIn(post([{mediaType:'PHOTO',fileKey:'a'},{mediaType:'PHOTO',fileKey:'b'}]),connection('w_member_social'));
  global.fetch=async()=>response({message:'Upload denied'},403);
  await assert.rejects(providers().publishLinkedIn(post([{mediaType:'PHOTO',fileKey:'a'}]),connection('w_member_social')),/Upload denied/);
});

test('LinkedIn webhook signatures require the documented prefix and exact raw bytes',()=>{
  const {createHmac}=require('node:crypto');const {linkedInChallenge,verifyLinkedInSignature}=load('lib/linkedin/webhook.ts');
  const raw='{"text":"test"}',secret='synthetic-secret';
  const signature=createHmac('sha256',secret).update('hmacsha256='+raw).digest('hex');
  assert.equal(verifyLinkedInSignature(raw,signature,secret),true);
  assert.equal(verifyLinkedInSignature(raw+' ',signature,secret),false);
  assert.equal(verifyLinkedInSignature(raw,'hmacsha256='+signature,secret),false);
  assert.equal(verifyLinkedInSignature(raw,signature,undefined),false);
  assert.equal(linkedInChallenge('challenge',secret).challengeResponse,createHmac('sha256',secret).update('challenge').digest('hex'));
});
test('LinkedIn messaging remains unavailable with a flag alone and excludes personal accounts',()=>{
  const original=process.env.LINKEDIN_MESSAGING_ENABLED;process.env.LINKEDIN_MESSAGING_ENABLED='true';
  try {
    const base={platformAccountId:'urn:li:organization:9',status:'CONNECTED',tokenScopes:'partner-scope',messagingWebhookSubscribedAt:new Date(),messagingWebhookError:null};
    assert.equal(load('lib/linkedin/messagingAccess.ts').linkedInMessagingAccess(base).available,false);
    const mod=load('lib/linkedin/messagingAccess.ts',{'./messagingProvider':{linkedInMessagingProvider:{requiredScopes:['partner-scope']}}});
    assert.equal(mod.linkedInMessagingAccess(base).available,true);
    for(const patch of [{platformAccountId:'member'},{status:'DISCONNECTED'},{tokenScopes:''},{messagingWebhookSubscribedAt:null},{messagingWebhookError:'failed'}])assert.equal(mod.linkedInMessagingAccess({...base,...patch}).available,false);
  }finally{if(original===undefined)delete process.env.LINKEDIN_MESSAGING_ENABLED;else process.env.LINKEDIN_MESSAGING_ENABLED=original;}
});
function linkedinInboxFixture() {
  const seen=new Set();let unread=0;const leads=new Map();const writes=[];
  const connection={id:'li',platform:'LINKEDIN',platformAccountId:'urn:li:organization:9',calendarId:'workspace',status:'CONNECTED',connectedAt:new Date('2026-01-01'),tokenScopes:'partner-scope',messagingWebhookSubscribedAt:new Date(),messagingWebhookError:null};
  const tx={socialLeadConversation:{upsert:async query=>{writes.push(query);return{id:'thread',leadStatus:'QUALIFIED'};},update:async()=>{unread++;},updateMany:async()=>({count:1})},socialLeadMessage:{createMany:async query=>{const event=query.data[0];if(seen.has(event.providerMessageId))return{count:0};seen.add(event.providerMessageId);writes.push(event);return{count:1};}},calendarLead:{upsert:async query=>{if(!leads.has(query.where.socialConversationId))leads.set(query.where.socialConversationId,query.create);else Object.assign(leads.get(query.where.socialConversationId),query.update);}}};
  const mod=load('lib/socialMessaging/linkedin.ts',{
    '@/lib/db':{db:{$transaction:fn=>fn(tx),socialConnection:{findMany:async query=>{assert.equal(query.where.platformAccountId,connection.platformAccountId);return[connection];}},socialLeadConversation:{findUnique:async()=>null,findFirst:async query=>query.where.participantPlatformId==='member'?{id:'thread'}:null}}},
    '@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, canAccessCalendarById:async()=>true},
    '@/lib/socialTokens':{freshConnection:async c=>c},
    '@/lib/linkedin/messagingAccess':{linkedInMessagingConfigured:()=>true,linkedInMessagingAccess:c=>({available:c.status==='CONNECTED'})},
    '@/lib/linkedin/messagingProvider':{linkedInMessagingProvider:{decodeNotification:async events=>events,send:async()=>({messageId:'confirmed'})}},
  });
  const event={pageUrn:connection.platformAccountId,message:{conversationId:'conversation',messageId:'inbound',participantId:'member',name:'Prospect',text:'Hello',createdAt:new Date('2026-01-02'),outbound:false,autoReplyEligible:true}};
  return {...mod,connection,event,leads,writes,unread:()=>unread};
}
test('LinkedIn inbound messages create one lead and one unread entry across repeated deliveries',async()=>{
  const f=linkedinInboxFixture();
  assert.equal((await f.receiveLinkedInMessages([f.event])).imported,1);
  assert.equal((await f.receiveLinkedInMessages([f.event])).imported,0);
  assert.equal(f.unread(),1);assert.equal(f.leads.size,1);assert.equal(f.leads.get('thread').status,'QUALIFIED');
  assert.equal(f.leads.get('thread').calendarId,'workspace');
  assert.equal(f.writes.find(item=>item.providerMessageId)?.autoReplyEligible,false);
});
test('LinkedIn old messages and outbound-only threads do not create leads',async()=>{
  const f=linkedinInboxFixture();
  for(const message of [{...f.event.message,createdAt:new Date('2025-01-01')},{...f.event.message,outbound:true}])assert.equal((await f.receiveLinkedInMessages([{...f.event,message}])).imported,0);
  assert.equal(f.leads.size,0);assert.equal(f.unread(),0);
  await assert.rejects(f.receiveLinkedInMessages([{...f.event,message:{...f.event.message,createdAt:new Date('invalid')}}]),/Invalid/);
});
test('LinkedIn replies validate Page conversation ownership and require confirmation',async()=>{
  const f=linkedinInboxFixture();
  assert.equal(await f.sendLinkedInMessage({connection:f.connection,conversationId:'conversation',recipientId:'member',text:'Reply'}),'confirmed');
  await assert.rejects(f.sendLinkedInMessage({connection:f.connection,conversationId:'conversation',recipientId:'foreign',text:'Reply'}),/does not belong/);
  await assert.rejects(f.sendLinkedInMessage({connection:f.connection,recipientId:'member',text:'Reply'}),/Select/);
});
test('LinkedIn webhook rejects forged delivery, retries processing failures, and cannot act as a signing oracle',async()=>{
  const {NextRequest}=require('next/server');const {createHmac}=require('node:crypto');
  const saved={secret:process.env.LINKEDIN_CLIENT_SECRET,enabled:process.env.LINKEDIN_MESSAGING_ENABLED};process.env.LINKEDIN_CLIENT_SECRET='synthetic-secret';process.env.LINKEDIN_MESSAGING_ENABLED='true';
  let calls=0,fail=false;
  try {
    const route=load('app/api/webhooks/linkedin/messaging/route.ts',{'@/lib/linkedin/messagingAccess':{linkedInMessagingConfigured:()=>true},'@/lib/socialMessaging/linkedin':{receiveLinkedInMessages:async()=>{calls++;if(fail)throw new Error('db down');}}});
    assert.equal((await route.GET(new NextRequest('https://site.test/?challengeCode=hmacsha256%3D%7B%7D'))).status,400);
    assert.equal((await route.GET(new NextRequest('https://site.test/?challengeCode=12345678-1234-4234-8234-123456789012'))).status,200);
    const raw='{}',signature=createHmac('sha256','synthetic-secret').update('hmacsha256='+raw).digest('hex');
    const req=signature=>new NextRequest('https://site.test/',{method:'POST',headers:{'x-li-signature':signature},body:raw});
    assert.equal((await route.POST(req('forged'))).status,401);assert.equal(calls,0);
    assert.equal((await route.POST(req(signature))).status,200);assert.equal(calls,1);
    fail=true;assert.equal((await route.POST(req(signature))).status,503);
  }finally{for(const [key,value] of [['LINKEDIN_CLIENT_SECRET',saved.secret],['LINKEDIN_MESSAGING_ENABLED',saved.enabled]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('LinkedIn subscription setup cannot be enabled by an unauthorized user or a flag without an adapter',async()=>{
  const {NextRequest}=require('next/server');let owner=false;
  const route=load('app/api/calendars/[id]/channels/linkedin/messaging/route.ts',{
    '@/lib/auth':{getCurrentCreator:async()=>({id:'creator'})},
    '@/lib/db':{db:{socialCalendar:{findFirst:async()=>owner?{id:'workspace'}:null},socialConnection:{findFirst:async()=>assert.fail('must not load or subscribe')}}},
    '@/lib/calendarPermissions':{hasCalendarPermission: async () => owner, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, canAccessCalendarById:async()=>true},
    '@/lib/linkedin/messagingAccess':{linkedInMessagingConfigured:()=>false},
    '@/lib/url':{appUrl:()=> 'https://site.test'},
  });
  const req=()=>new NextRequest('https://site.test/api',{method:'POST',headers:{origin:'https://site.test'}});
  const context={params:Promise.resolve({id:'workspace'})};
  assert.equal((await route.POST(req(),context)).status,403);
  owner=true;assert.equal((await route.POST(req(),context)).status,409);
});

test('Meta replies require a confirmed message ID and reject expired connections',async()=>{
  const {sendMetaInboxMessage}=load('lib/socialMessaging/meta.ts');
  const input={connection:{platform:'FACEBOOK',status:'CONNECTED',platformAccountId:'page',accessToken:'test'},recipientId:'person',text:'Hello'};
  global.fetch=async()=>response({});
  await assert.rejects(sendMetaInboxMessage(input),/did not confirm/);
  global.fetch=async()=>response({message_id:'confirmed'});
  assert.equal(await sendMetaInboxMessage(input),'confirmed');
  global.fetch=async()=>assert.fail('expired token must not send');
  await assert.rejects(sendMetaInboxMessage({...input,connection:{...input.connection,accessTokenExpiresAt:new Date(0)}}),/Reconnect/);
});
test('Meta messaging subscription requires explicit confirmation',async()=>{
  const {subscribeMetaMessagingAccount}=load('lib/socialMessaging/meta.ts');
  global.fetch=async()=>response({});
  await assert.rejects(subscribeMetaMessagingAccount('page','token','FACEBOOK'),/not confirmed/);
  global.fetch=async()=>response({success:true});
  await subscribeMetaMessagingAccount('page','token','INSTAGRAM');
});
function autoReplyFixture({sendFails=false,persistFails=false,disabled=false,claimCount=1}={}) {
  const updates=[];let sends=0;let generated=0;
  const inbound={id:'message',conversationId:'thread',autoReplyAttemptCount:0,text:'Hello',conversation:{providerConversationId:'external-thread',platform:'FACEBOOK',participantPlatformId:'person',connection:{platform:'FACEBOOK',status:'CONNECTED'},calendar:{clientName:'Business',aiBusinessSummary:'Summary',instagramPageId:null},messages:[]}};
  const db={socialLeadConversation:{findUniqueOrThrow:async()=>({aiPausedAt:null,aiControlVersion:0})},socialInboxSettings:{findMany:async()=>[{calendarId:'calendar'}],findUnique:async()=>({aiAutoReplyEnabled:!disabled})},socialLeadMessage:{findFirst:async()=>null,findMany:async()=>[inbound],updateMany:async()=>({count:claimCount}),update:async args=>{updates.push(args);}},$transaction:async fn=>{if(persistFails)throw new Error('storage unavailable');await fn({socialLeadMessage:{createMany:async()=>({count:1}),update:async args=>updates.push(args)},socialLeadConversation:{update:async()=>{}}});}};
  const mod=load('lib/socialMessaging/autoReply.ts',{ './outbound': require('./helpers/mock-inbox-outbound.cjs').outboundMock(db),'@/lib/knowledge/context': { getBusinessKnowledgeContext: async () => 'Facts from current documents' },'@/lib/socialMessaging/handoff':{requiredHandoffReason:()=>null,handoffSocialConversation:async()=>({count:1})},'@/lib/socialMessaging/handoffNotifications':{deliverHandoffNotifications:async()=>{}}, '@/lib/contentWorkspaceUsage': { consumeCalendarAiGeneration: async () => ({ allowed: true, limit: 2000 }) },'@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature:async()=>true},'@/lib/db':{db},'@/lib/openai':{generateSocialInboxAutoReply:async()=>{generated++;return{shouldReply:true,replyText:'Hi'};}},'@/lib/socialMessaging/registry':{supportsMessaging:()=>true,sendSocialInboxMessage:async input=>{sends++;assert.equal(input.conversationId,'external-thread');if(sendFails)throw new Error('timeout');return 'confirmed';}}});
  return {...mod,updates,counts:()=>({sends,generated})};
}
test('AI replies pass conversation identity and persist confirmed delivery',async()=>{
  const f=autoReplyFixture();const result=await f.processSocialInboxAutoReplies();
  assert.equal(result.sent,1);assert.equal(f.counts().sends,1);assert.ok(f.updates.at(-1).data.autoReplyHandledAt);
});
test('AI sends with ambiguous delivery or failed persistence are handed off without automatic resend',async()=>{
  const old=console.error;console.error=()=>{};
  try{for(const options of [{sendFails:true},{persistFails:true}]){const f=autoReplyFixture(options);const result=await f.processSocialInboxAutoReplies();assert.equal(result.failed,1);assert.equal(f.counts().sends,1);assert.ok(f.updates.at(-1).data.autoReplyHandledAt);assert.match(f.updates.at(-1).data.autoReplyHandoffReason,/Check the platform inbox/);}}finally{console.error=old;}
});
test('AI rechecks disabled settings and a duplicate worker cannot send',async()=>{
  const disabled=autoReplyFixture({disabled:true});assert.equal((await disabled.processSocialInboxAutoReplies()).handedOff,1);assert.equal(disabled.counts().sends,0);
  const duplicate=autoReplyFixture({claimCount:0});await duplicate.processSocialInboxAutoReplies();assert.deepEqual(duplicate.counts(),{sends:0,generated:0});
});
test('Meta webhook ingests transactionally, dispatches only new inbound events, and ignores orphan echoes',async()=>{
  const {NextRequest}=require('next/server');const {createHmac}=require('node:crypto');
  const previous=process.env.META_APP_SECRET;process.env.META_APP_SECRET='test-secret';
  let existing=null;let inserted=true;let ingests=0;let dispatches=0;let eventSeen;
  const route=load('app/api/webhooks/meta/messaging/route.ts',{
    '@/lib/db':{db:{socialConnection:{findFirst:async()=>({id:'connection',calendarId:'workspace',platform:'FACEBOOK',platformAccountId:'page'})},socialInboxSettings:{upsert:async()=>({aiAutoReplyEnabled:true})},socialLeadConversation:{findUnique:async()=>existing,findUniqueOrThrow:async()=>({id:'thread'})},socialLeadMessage:{findUniqueOrThrow:async()=>({id:'message'})}}},
    '@/lib/socialMessaging/meta':{metaWebhookPlatform:()=> 'FACEBOOK'},
    '@/lib/socialMessaging/ingest':{ingestSocialMessage:async(connection,event)=>{ingests++;eventSeen=event;return inserted;}},
    '@/lib/socialMessaging/dispatchAutoReply':{dispatchSocialInboxAutoReply:async()=>{dispatches++;}},
  });
  const deliver=async(isEcho=false,text='Hello')=>{const raw=JSON.stringify({object:'page',entry:[{id:'page',messaging:[{sender:{id:isEcho?'page':'person'},recipient:{id:isEcho?'person':'page'},timestamp:Date.now(),message:{mid:'m',text,is_echo:isEcho}}]}]});const signature='sha256='+createHmac('sha256','test-secret').update(raw).digest('hex');return route.POST(new NextRequest('https://example.test/api/webhooks/meta/messaging',{method:'POST',headers:{'x-hub-signature-256':signature},body:raw}));};
  try{
    assert.equal((await deliver()).status,200);assert.equal(ingests,1);assert.equal(dispatches,1);assert.equal(eventSeen.autoReplyEligible,true);
    inserted=false;await deliver();assert.equal(dispatches,1);
    await deliver(true);assert.equal(ingests,2);
    existing={id:'thread'};inserted=true;await deliver(true);assert.equal(eventSeen.outbound,true);assert.equal(eventSeen.autoReplyEligible,false);assert.equal(dispatches,1);
  }finally{if(previous===undefined)delete process.env.META_APP_SECRET;else process.env.META_APP_SECRET=previous;}
});
test('TikTok analytics keep lifetime video counters separate from daily account metrics',async()=>{
  const {tiktokReportingAdapter}=load('lib/reporting/adapters/tiktok.ts',{'@/lib/db':{},'@/lib/tiktok':{}});
  const c={platform:'TIKTOK',tokenScopes:'user.info.stats,video.list',accessToken:'test'};
  global.fetch=async url=>response({error:{code:'ok'},data:url.includes('/user/info/')?{user:{follower_count:10}}:{videos:[{id:'video',create_time:Math.floor(Date.now()/1000),view_count:100,like_count:2,comment_count:3,share_count:1}],has_more:false}});
  const data=await tiktokReportingAdapter.fetchAccountMetrics(c);
  assert.equal(data.followers,10);assert.equal(data.views,null);assert.equal(data.engagement,null);assert.equal(data.accountPosts[0].views,100);assert.equal(data.accountPosts[0].engagement,6);
  global.fetch=async()=>response({error:{code:'scope_not_authorized',message:'denied'}},403);
  await assert.rejects(tiktokReportingAdapter.fetchPostMetrics(c,[{id:'post',platformPostId:'video'}]),/permission is missing/);
});
function tikTokNativeFixture({duplicate=false,enabled=true}={}) {
  const connection={id:'tik-connection',calendarId:'calendar',platform:'TIKTOK',status:'CONNECTED',platformAccountId:'publishing-id',accessToken:'publishing-token',
    tikTokMessagingBusinessId:'business-id',tikTokMessagingConnectedAt:new Date(Date.now()-60_000),tikTokMessagingScopes:'message.list.read,message.list.send,message.list.manage,user.account.type',
    messagingWebhookSubscribedAt:new Date(),messagingWebhookError:null,tikTokMessagingAccessToken:'business-token',tikTokMessagingTokenExpiresAt:new Date(Date.now()+3600_000)};
  const wire={conversation_id:'conversation+id',message_id:'message',timestamp:Date.now(),type:'text',text:{body:'Hello'},from:'person',from_user:{id:'person-id',role:'personal_account'},to_user:{id:'business-id',role:'business_account'}};
  const event={client_key:'business-app',event:'im_receive_msg',user_openid:'business-id',content:JSON.stringify(wire)};
  let stored=[],dispatches=0;
  const db={socialConnection:{findMany:async()=>[connection],updateMany:async()=>({count:1})},socialLeadConversation:{findUnique:async()=>null,findFirst:async args=>args.where.participantPlatformId==='person-id'?{messages:[{platformCreatedAt:new Date()}]}:null},socialInboxSettings:{findUnique:async()=>({aiAutoReplyEnabled:true})},socialLeadMessage:{findFirst:async()=>({id:'saved'})}};
  const mod=load('lib/socialMessaging/tiktok.ts',{'@/lib/db':{db},'@/lib/calendarPermissions':{hasCalendarPermission: async () => true, canUseCalendarFeature: async () => true, calendarFeatureGate: async () => null, canAccessCalendarById:async()=>true},
    '@/lib/tiktokMessaging':{...load('lib/tiktokMessaging.ts'),tikTokMessagingConfigured:()=>enabled},
    './ingest':{ingestSocialMessage:async(c,m)=>{stored.push(m);return !duplicate;}},'./dispatchAutoReply':{dispatchSocialInboxAutoReply:async()=>{dispatches++;}}});
  return {...mod,connection,wire,event,db,counts:()=>({stored,dispatches})};
}
test('TikTok incoming business messages reach shared lead ingestion and AI dispatch',async()=>{
  const previous=process.env.TIKTOK_BUSINESS_CLIENT_ID;process.env.TIKTOK_BUSINESS_CLIENT_ID='business-app';
  try {
    const f=tikTokNativeFixture();assert.equal((await f.receiveTikTokMessage(f.event)).imported,1);assert.equal(f.counts().dispatches,1);assert.equal(f.counts().stored[0].autoReplyEligible,true);
    const duplicate=tikTokNativeFixture({duplicate:true});assert.equal((await duplicate.receiveTikTokMessage(duplicate.event)).imported,0);assert.equal(duplicate.counts().dispatches,0);
  } finally {if(previous===undefined)delete process.env.TIKTOK_BUSINESS_CLIENT_ID;else process.env.TIKTOK_BUSINESS_CLIENT_ID=previous;}
});
test('TikTok rejects wrong account identities and disables AI for old, future and media messages',()=>{
  const f=tikTokNativeFixture();const normalize=f.normalizeTikTokMessage;
  assert.throws(()=>normalize({...f.wire,to_user:{id:'foreign',role:'business_account'}},'business-id'),/Invalid/);
  assert.throws(()=>normalize({...f.wire,timestamp:NaN},'business-id'),/Invalid/);
  assert.equal(normalize({...f.wire,timestamp:Date.now()-11*60_000},'business-id').autoReplyEligible,false);
  assert.equal(normalize({...f.wire,timestamp:Date.now()+30_000},'business-id').autoReplyEligible,false);
  assert.equal(normalize({...f.wire,type:'image'},'business-id').autoReplyEligible,false);
  assert.equal(normalize({...f.wire,message_tag:{source:'API'}},'business-id').autoReplyEligible,false);
});
test('TikTok orphan outbound echoes cannot create conversations or leads',async()=>{
  const previous=process.env.TIKTOK_BUSINESS_CLIENT_ID;process.env.TIKTOK_BUSINESS_CLIENT_ID='business-app';
  try {const f=tikTokNativeFixture();const wire={...f.wire,from_user:f.wire.to_user,to_user:f.wire.from_user};await f.receiveTikTokMessage({...f.event,event:'im_send_msg',content:JSON.stringify(wire)});assert.equal(f.counts().stored.length,0);}finally{if(previous===undefined)delete process.env.TIKTOK_BUSINESS_CLIENT_ID;else process.env.TIKTOK_BUSINESS_CLIENT_ID=previous;}
});
test('TikTok manual and AI replies enforce ownership, Business tokens and confirmed acceptance',async()=>{
  const f=tikTokNativeFixture();const input={connection:f.connection,conversationId:'conversation+id',recipientId:'person-id',text:'Reply'};
  global.fetch=async(url,init)=>{assert.match(url,/business\/message\/send\//);assert.equal(init.headers['Access-Token'],'business-token');assert.deepEqual(JSON.parse(init.body),{business_id:'business-id',recipient_type:'CONVERSATION',recipient:'conversation+id',message_type:'TEXT',text:{body:'Reply'}});return response({code:0,data:{message:{message_id:'confirmed'}}});};
  assert.equal(await f.sendTikTokMessage(input),'confirmed');await assert.rejects(f.sendTikTokMessage({...input,recipientId:'foreign'}),/existing inbound/);
  global.fetch=async()=>response({code:0,data:{}});await assert.rejects(f.sendTikTokMessage(input),/did not confirm/);
  await assert.rejects(tikTokNativeFixture({enabled:false}).sendTikTokMessage(input),/approval/);
  f.db.socialLeadConversation.findFirst=async()=>({messages:[{platformCreatedAt:new Date(Date.now()-49*3600_000)}]});await assert.rejects(f.sendTikTokMessage(input),/48-hour/);
});
test('TikTok signatures reject forgery, replay, missing headers and future timestamps',()=>{
  const {createHmac}=require('node:crypto');const mod=load('lib/tiktokMessaging.ts');const raw='{"event":"im_receive_msg"}';const now=Date.now();const t=String(Math.floor(now/1000));const sign=timestamp=>`t=${timestamp},s=${createHmac('sha256','test-secret').update(timestamp+'.'+raw).digest('hex')}`;
  assert.equal(mod.verifyTikTokMessagingSignature(raw,sign(t),'test-secret',now),true);
  assert.equal(mod.verifyTikTokMessagingSignature(raw+' ',sign(t),'test-secret',now),false);
  assert.equal(mod.verifyTikTokMessagingSignature(raw,sign(String(Number(t)-301)),'test-secret',now),false);
  assert.equal(mod.verifyTikTokMessagingSignature(raw,sign(String(Number(t)+301)),'test-secret',now),false);
  assert.equal(mod.verifyTikTokMessagingSignature(raw,null,'test-secret',now),false);
});
test('TikTok webhook rejects forged requests and requests retry on processing failure',async()=>{
  const {NextRequest}=require('next/server');let calls=0;let valid=false;const previous=process.env.TIKTOK_BUSINESS_CLIENT_SECRET;process.env.TIKTOK_BUSINESS_CLIENT_SECRET='test-secret';
  const route=load('app/api/webhooks/tiktok/messaging/route.ts',{'@/lib/tiktokMessaging':{verifyTikTokMessagingSignature:()=>valid},'@/lib/socialMessaging/tiktok':{receiveTikTokMessage:async()=>{calls++;throw new Error('database unavailable');}}});
  const req=()=>new NextRequest('https://example.test/api/webhooks/tiktok/messaging',{method:'POST',body:'{}'});
  try{assert.equal((await route.POST(req())).status,401);assert.equal(calls,0);valid=true;assert.equal((await route.POST(req())).status,503);assert.equal(calls,1);}finally{if(previous===undefined)delete process.env.TIKTOK_BUSINESS_CLIENT_SECRET;else process.env.TIKTOK_BUSINESS_CLIENT_SECRET=previous;}
});
test('TikTok history import encodes conversation IDs and never enables AI replies',async()=>{
  const f=tikTokNativeFixture();let requests=0;
  global.fetch=async url=>{requests++;const parsed=new URL(url);assert.equal(parsed.searchParams.get('business_id'),'business-id');if(url.includes('conversation/list'))return response({code:0,data:{conversations:[{conversation_id:'conversation+id'}],has_more:false}});assert.match(url,/conversation_id=conversation%2Bid/);return response({code:0,data:{messages:[{...f.wire,message_type:'TEXT'}],participants:[{id:'person-id',display_name:'Customer'}]}});};
  const result=await f.syncTikTokInbox(f.connection);assert.equal(requests,4);assert.equal(result.imported,2);assert.equal(f.counts().stored[0].autoReplyEligible,false);assert.equal(f.counts().stored[0].name,'Customer');assert.equal(f.counts().dispatches,0);
});
test('TikTok Business token refresh uses separate credentials and preserves rotated tokens',async()=>{
  const f=tikTokNativeFixture();const old={...f.connection,tikTokMessagingTokenExpiresAt:new Date(0),tikTokMessagingRefreshToken:'refresh',tikTokMessagingRefreshExpiresAt:new Date(Date.now()+3600_000)};let saved;
  f.db.socialConnection.updateMany=async args=>{saved=args;return{count:1}};f.db.socialConnection.findUniqueOrThrow=async()=>({...f.connection,...saved.data});
  global.fetch=async(url,init)=>{assert.match(url,/tt_user\/oauth2\/refresh_token/);assert.equal(JSON.parse(init.body).refresh_token,'refresh');return response({code:0,data:{access_token:'renewed',refresh_token:'rotated',open_id:'business-id',scope:f.connection.tikTokMessagingScopes,expires_in:86400,refresh_token_expires_in:100000}});};
  const renewed=await f.freshTikTokMessagingConnection(old);assert.equal(renewed.tikTokMessagingAccessToken,'renewed');assert.equal(renewed.tikTokMessagingRefreshToken,'rotated');assert.equal(saved.where.tikTokMessagingRefreshToken,'refresh');assert.equal(renewed.accessToken,'publishing-token');
});
test('TikTok Business OAuth state binds authorization to the connection, channel and browser',()=>{
  const old=process.env.JWT_SECRET;process.env.JWT_SECRET='test-state-secret';
  try {const state=load('lib/channelOAuthState.ts');const created=state.createChannelOAuthState('tiktok-messaging','connection-id');assert.equal(state.verifyChannelOAuthState('tiktok-messaging',created.state,created.nonce),'connection-id');assert.equal(state.verifyChannelOAuthState('x',created.state,created.nonce),null);assert.equal(state.verifyChannelOAuthState('tiktok-messaging',created.state,'foreign-browser'),null);assert.equal(state.channelOAuthCookieOptions('tiktok-messaging',600).path,'/api/calendars/channels/tiktok-messaging/callback');}finally{if(old===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=old;}
});
test('TikTok Business authorization validates the official host and requests fresh consent',()=>{
  const keys=['TIKTOK_BUSINESS_CLIENT_ID','TIKTOK_BUSINESS_CLIENT_SECRET','TIKTOK_BUSINESS_AUTH_URL'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try {process.env.TIKTOK_BUSINESS_CLIENT_ID='app';process.env.TIKTOK_BUSINESS_CLIENT_SECRET='secret';process.env.TIKTOK_BUSINESS_AUTH_URL='https://www.tiktok.com/v2/auth/authorize?client_key=app';const mod=load('lib/tiktokMessaging.ts');const url=new URL(mod.buildTikTokMessagingAuthUrl('signed','https://example.test/callback'));assert.equal(url.searchParams.get('state'),'signed');assert.equal(url.searchParams.get('disable_auto_auth'),'1');assert.equal(url.searchParams.get('redirect_uri'),'https://example.test/callback');assert.equal(url.searchParams.has('client_secret'),false);process.env.TIKTOK_BUSINESS_AUTH_URL='https://evil.test/authorize';assert.throws(()=>mod.buildTikTokMessagingAuthUrl('signed','https://example.test/callback'),/account holder/);}finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
test('TikTok Business token exchange rejects partial authorization before credentials are stored',async()=>{
  global.fetch=async(url,init)=>{assert.match(url,/tt_user\/oauth2\/token/);const body=JSON.parse(init.body);assert.equal(body.auth_code,'code');assert.equal(body.redirect_uri,'https://example.test/callback');return response({code:0,data:{access_token:'business',refresh_token:'refresh',open_id:'id',scope:'message.list.read',expires_in:86400,refresh_token_expires_in:100000}});};
  await assert.rejects(load('lib/tiktokMessaging.ts').tikTokMessagingTokens({code:'code',redirectUri:'https://example.test/callback'}),/all four/);
});


test('an open saved conversation survives list filters and updates when fresh history arrives', () => {
  const { resolveSelectedInboxConversation: select } = load('lib/xChat/inbox.ts');
  const previous = { id: 'meta', platform: 'FACEBOOK', messages: [{ id: 'old', text: 'Hello' }] };
  assert.equal(select([], 'meta', previous), previous);
  const refreshed = { ...previous, messages: [...previous.messages, { id: 'new', text: 'New reply' }] };
  assert.equal(select([refreshed], 'meta', previous), refreshed);
  const other = { id: 'other', platform: 'WHATSAPP', messages: [] };
  assert.equal(select([other], 'other', previous), other);
  assert.equal(select([], 'other', previous), null);
});

test('the active chat never falls back to cached decrypted X history after locking', () => {
  const { resolveSelectedInboxConversation: select } = load('lib/xChat/inbox.ts');
  const encrypted = { id: 'xchat:connection:thread', encrypted: { connectionId: 'connection', conversationId: 'thread' }, messages: [{ text: 'Private' }] };
  assert.equal(select([encrypted], encrypted.id, null), encrypted);
  assert.equal(select([], encrypted.id, encrypted), null);
});
