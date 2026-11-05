const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const root = path.resolve(__dirname, '..');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function load(file, mocks = {}, cache = new Map()) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(/\.tsx?$/.test(target) ? target : target + '.ts', mocks, cache);
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const settingsModule = () => load('lib/tiktokSettings.ts');
const creator = { creator_nickname:'Creator', creator_username:'creator', creator_avatar_url:'https://example.test/avatar', privacy_level_options:['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','SELF_ONLY'], comment_disabled:false, duet_disabled:false, stitch_disabled:false, max_video_post_duration_sec:180, accountId:'account' };
function settings(extra = {}) { return { ...settingsModule().emptyTikTokSettings, privacyLevel:'SELF_ONLY', ...extra }; }
function post(extra = {}) { return { id:'post', calendarId:'calendar', platform:'TIKTOK', internalReviewStatus:'APPROVED', approvalStatus:'APPROVED', isAiDraft:false, tikTokPublishStatus:'NOT_SCHEDULED', updatedAt:new Date('2026-10-08T10:00:00Z'), postDate:new Date('2026-10-09T10:00:00Z'), caption:'Caption', cta:null, hashtags:'#original', taggedAccounts:null, linkUrl:null, postType:null, tikTokSettings:null, tikTokInitStartedAt:null, tikTokPublishId:null, assets:[{ id:'asset',fileKey:'asset.mp4',mediaType:'VIDEO',displayOrder:0,contentUrl:'https://example.test/asset.mp4' }], ...extra }; }

test('explicit privacy, disclosure classification and inverse interaction semantics', () => {
  const m=settingsModule();
  assert.equal(m.emptyTikTokSettings.privacyLevel,null);
  for (const key of ['allowComment','allowDuet','allowStitch','disclosureEnabled']) assert.equal(m.emptyTikTokSettings[key],false);
  assert.throws(()=>m.parseTikTokSettings({...settings(),privacyLevel:null}),/visibility/);
  assert.throws(()=>m.parseTikTokSettings({...settings(),allowComment:'true'}),/valid/);
  assert.throws(()=>m.validateTikTokSettings(settings({privacyLevel:'FOLLOWER_OF_CREATOR'}),creator,true),/no longer/);
  assert.throws(()=>m.validateTikTokSettings(settings({disclosureEnabled:true}),creator,true),/indicate/);
  assert.throws(()=>m.validateTikTokSettings(settings({disclosureEnabled:true,brandedContent:true}),creator,true),/cannot be set to private/);
  assert.throws(()=>m.validateTikTokSettings(settings({allowComment:true}),{...creator,comment_disabled:true},true),/disabled/);
  assert.throws(()=>m.validateTikTokSettings(settings({allowDuet:true}),creator,false),/photo/);
  const off=m.tikTokPostInfo(settings(),creator,true); assert.equal(off.disable_comment,true);assert.equal(off.disable_duet,true);assert.equal(off.disable_stitch,true);
  const both=settings({privacyLevel:'PUBLIC_TO_EVERYONE',allowComment:true,allowDuet:true,allowStitch:true,disclosureEnabled:true,yourBrand:true,brandedContent:true});
  m.validateTikTokSettings(both,creator,true);const info=m.tikTokPostInfo(both,creator,true);assert.equal(info.disable_comment,false);assert.equal(info.disable_duet,false);assert.equal(info.brand_content_toggle,true);assert.equal(info.brand_organic_toggle,true);
  assert.equal(m.tikTokPostInfo(settings(),creator,false).disable_duet,undefined);
});

test('consent is invalidated by caption, assets, settings, or account changes',()=>{
  const {tikTokConsentHash:hash}=load('lib/tiktokConsent.ts');const p=post(),s=settings();const initial=hash(p,s,'account');
  assert.equal(initial,hash(p,s,'account'));
  for(const changed of [post({caption:'Edited'}),post({assets:[{id:'other',fileKey:'other',mediaType:'VIDEO'}]}),post({hashtags:'#changed'})]) assert.notEqual(initial,hash(changed,s,'account'));
  assert.notEqual(initial,hash(p,settings({allowComment:true}),'account'));
  assert.notEqual(initial,hash(p,s,'different-account'));
});

test('actual media metadata rejects duration, encoding, dimensions, frame rate and unsupported images',()=>{
  const {validateTikTokMediaProbe:validate}=load('lib/tiktokMedia.ts',{'@/lib/r2':{}});
  const video={format:{duration:'30',format_name:'mov,mp4'},streams:[{codec_type:'video',codec_name:'h264',width:1080,height:1920,avg_frame_rate:'30/1'}]};
  assert.doesNotThrow(()=>validate(video,1000,'VIDEO',180));
  assert.throws(()=>validate(video,1000,'VIDEO',20),/Shorten/);
  assert.throws(()=>validate({...video,streams:[{...video.streams[0],codec_name:'mpeg2video'}]},1000,'VIDEO',180),/encoding/);
  assert.throws(()=>validate({...video,streams:[{...video.streams[0],avg_frame_rate:'120/1'}]},1000,'VIDEO',180),/FPS/);
  assert.throws(()=>validate({...video,streams:[{...video.streams[0],width:100}]},1000,'VIDEO',180),/dimensions/);
  assert.throws(()=>validate(video,5*1024**3,'VIDEO',180),/4 GB/);
  const photo={streams:[{codec_type:'video',codec_name:'mjpeg',width:1080,height:1920}]};
  assert.doesNotThrow(()=>validate(photo,1000,'PHOTO',180));
  assert.throws(()=>validate({...photo,streams:[{...photo.streams[0],codec_name:'png'}]},1000,'PHOTO',180),/JPEG/);
  assert.throws(()=>validate(photo,21*1024**2,'PHOTO',180),/20 MB/);
});

function authorization(p=post(),info=creator) {
  let update,mediaChecks=0;
  const connection={platformAccountId:'account'};
  const api=load('lib/tiktokAuthorization.ts',{'@/lib/publishing/scheduler':{runScheduledPublishing:async()=>({dispatched:1})},'@/lib/db':{db:{calendarPost:{updateMany:async args=>{update=args;return{count:1};}}}},'@/lib/tiktokConnection':{getTikTokCreator:async()=>({connection,info})},'@/lib/tiktokMedia':{validateTikTokMedia:async()=>{mediaChecks++;}}});
  return {run:body=>api.authorizeTikTokPost(p,'actor',body),update:()=>update,mediaChecks:()=>mediaChecks};
}
const authorizeBody=(extra={})=>({action:'schedule',accountId:'account',settings:settings(),consent:true,...extra});
test('authorization rejects missing consent, invalid settings, changed account and unapproved content',async()=>{
  for(const [p,body] of [[post(),authorizeBody({consent:false})],[post(),authorizeBody({accountId:'different'})],[post(),authorizeBody({settings:settings({disclosureEnabled:true})})],[post({approvalStatus:'PENDING'}),authorizeBody()],[post({internalReviewStatus:'PENDING'}),authorizeBody()],[post({internalReviewStatus:undefined}),authorizeBody()]]){
    const h=authorization(p);assert.equal((await h.run(body)).status,400);assert.equal(h.update(),undefined);
  }
});
test('scheduling stores settings, actor, account and content consent together',async()=>{
  const h=authorization();const response=await h.run(authorizeBody());assert.equal(response.status,200);const data=h.update().data;
  assert.equal(data.tikTokPublishStatus,'SCHEDULED');assert.equal(data.tikTokConsentBy,'actor');assert.equal(data.tikTokConsentAccountId,'account');assert.ok(data.tikTokConsentHash);assert.deepEqual(data.tikTokSettings,settings());assert.equal(h.mediaChecks(),1);
});
test('publish now uses a due timestamp while cancel clears authorization',async()=>{
  const h=authorization();await h.run(authorizeBody({action:'publish'}));assert.ok(h.update().data.postDate instanceof Date);
  const cancelled=authorization(post({tikTokPublishStatus:'SCHEDULED'}));assert.equal((await cancelled.run({action:'cancel'})).status,200);assert.equal(cancelled.update().data.tikTokConsentHash,null);assert.equal(cancelled.update().data.tikTokPublishStatus,'NOT_SCHEDULED');
});
test('ambiguous initialization requires explicit retry confirmation',async()=>{
  const p=post({tikTokPublishStatus:'FAILED',tikTokInitStartedAt:new Date()});
  const no=authorization(p);assert.equal((await no.run(authorizeBody({action:'retry'}))).status,400);
  const yes=authorization(p);assert.equal((await yes.run(authorizeBody({action:'retry',confirmedNotPublished:true}))).status,200);assert.equal(yes.update().data.tikTokInitStartedAt,null);
});

test('video and photo API payloads preserve explicit commercial, interaction and title choices',async()=>{
  const calls=[];global.fetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify({error:{code:'ok'},data:{publish_id:'provider'}}));};
  const api=load('lib/tiktok.ts');const s=settings({privacyLevel:'PUBLIC_TO_EVERYONE',disclosureEnabled:true,yourBrand:true,brandedContent:true,allowComment:true,allowDuet:true,photoTitle:'Chosen title'});const info=settingsModule().tikTokPostInfo(s,creator,true);
  await api.initTikTokVideoPublish({accessToken:'fake',videoUrl:'https://example.test/v',caption:'Exact caption',privacyLevel:s.privacyLevel,disableComment:info.disable_comment,postInfo:info});
  await api.initTikTokPhotoPublish({accessToken:'fake',photoUrls:['https://example.test/p'],caption:'Exact caption',photoTitle:s.photoTitle,privacyLevel:s.privacyLevel,postInfo:settingsModule().tikTokPostInfo(s,creator,false),isAigc:true});
  assert.equal(calls[0].body.post_info.disable_duet,false);assert.equal(calls[0].body.post_info.disable_stitch,true);assert.equal(calls[0].body.post_info.brand_content_toggle,true);
  assert.equal(calls[1].body.post_info.title,'Chosen title');assert.equal(calls[1].body.post_info.description,'Exact caption');assert.equal(calls[1].body.post_info.disable_duet,undefined);assert.equal(calls[1].body.is_aigc,true);
});

function publisher(extra={},providerStatus='PROCESSING_DOWNLOAD') {
  const s=settings(),p=post({tikTokPublishStatus:'PUBLISHING',tikTokSettings:s,tikTokConsentAt:new Date(),tikTokConsentBy:'actor',tikTokConsentAccountId:'account',tikTokConsentVersion:settingsModule().TIKTOK_CONSENT_VERSION,...extra});
  p.tikTokConsentHash=extra.tikTokConsentHash || load('lib/tiktokConsent.ts').tikTokConsentHash(p,s,'account');let inits=0;const updates=[],videoUrls=[];
  const connection={id:'connection',platformAccountId:'account',status:'CONNECTED',accessToken:'fake'};
  const db={calendarPost:{findUniqueOrThrow:async()=>p,updateMany:async args=>{updates.push(args.data);return{count:1};},update:async args=>{updates.push(args.data);Object.assign(p,args.data);return p;}},socialConnection:{findFirst:async()=>extra.disconnected?null:connection,findUniqueOrThrow:async()=>connection}};
  const api=load('lib/tiktokPublishing.ts',{'@/lib/db':{db},'@/lib/r2':{publicUrlFor:k=>'https://example.test/'+k},'@/lib/socialReporting':{recordPublishedSocialPost:async()=>{}},'@/lib/socialTokens':{requireScopes(){}},'@/lib/tiktokMedia':{validateTikTokMedia:async (assets,_creator,options)=>{assert.equal(options.publish,true);return assets.map(()=>({url:'https://example.test/prepared.mp4',converted:true}));}},'@/lib/tiktokConnection':{freshTikTokConnection:async c=>c,reserveTikTokRequest:async()=>{},TikTokRequestBusyError:class extends Error{}},'@/lib/tiktok':{queryTikTokCreatorInfo:async()=>creator,initTikTokVideoPublish:async args=>{videoUrls.push(args.videoUrl);inits++;return{publish_id:'provider'};},checkTikTokPublishStatus:async()=>({status:providerStatus}),TikTokApiError:class extends Error{}}});
  return{run:()=>api.publishPostToTikTok('post'),p,inits:()=>inits,updates,videoUrls};
}
test('worker preserves processing and resumes status checks without another initialization',async()=>{
  const h=publisher();await h.run();assert.equal(h.p.tikTokPublishStatus,'PUBLISHING',h.p.tikTokPublishError);assert.equal(h.p.tikTokPublishId,'provider');assert.equal(h.p.publishWorkerStartedAt,null);await h.run();assert.equal(h.inits(),1);
});
test('worker blocks disconnected account, stale consent and legacy posts before transfer',async()=>{
  for(const extra of [{disconnected:true},{tikTokConsentHash:'stale'},{tikTokConsentAt:null}]) {const h=publisher(extra);await h.run();assert.equal(h.inits(),0);assert.equal(h.p.tikTokPublishStatus,'FAILED');}
});
test('worker stores success only after TikTok confirms completion',async()=>{
  const h=publisher({},'PUBLISH_COMPLETE');await h.run();assert.equal(h.p.tikTokPublishStatus,'PUBLISHED');assert.ok(h.p.tikTokPublishedAt);
});

function nodes(node, match) { if(Array.isArray(node))return node.flatMap(n=>nodes(n,match));if(!React.isValidElement(node))return[];return[...(match(node)?[node]:[]),...nodes(node.props.children,match)]; }
function text(node) {if(Array.isArray(node))return node.map(text).join('');if(React.isValidElement(node))return text(node.props.children);return typeof node==='string'?node:'';}
function ui(info=creator,p=post()) {
  const values=[];let cursor=0;
  const react={...React,useState(initial){const index=cursor++;if(!(index in values))values[index]=index===1?info:index===2?{protocol:'legacy'}:index===3?false:typeof initial==='function'?initial():initial;return[values[index],value=>{values[index]=typeof value==='function'?value(values[index]):value;}];},useEffect(){},useCallback:f=>f};
  const mod=load('components/calendars/TikTokPublishing.tsx',{react,'next/navigation':{useRouter:()=>({refresh(){}})}});
  return{render(){cursor=0;return mod.default({calendarId:'calendar',post:p});}};
}
test('UI starts unchecked with no default privacy and displays the real account',()=>{
  const h=ui(),tree=h.render();assert.match(text(tree),/Creator/);assert.match(text(tree),/@creator/);
  assert.equal(nodes(tree,n=>n.type==='select')[0].props.value,'');
  for(const n of nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox'))assert.equal(n.props.checked,false);
  assert.equal(nodes(tree,n=>n.type==='button'&&text(n)==='Authorize and schedule')[0].props.disabled,true);
});
test('UI displays disclosure branches, conditional policies, and both privacy restriction orders',()=>{
  const h=ui();let tree=h.render();nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value:'PUBLIC_TO_EVERYONE'}});tree=h.render();nodes(tree,n=>n.type==='input'&&n.props.role==='switch')[0].props.onChange({target:{checked:true}});tree=h.render();assert.match(text(tree),/Your Brand/);assert.match(text(tree),/Branded Content/);assert.match(text(tree),/indicate/);
  const toggle=label=>nodes(tree,n=>n.type==='label'&&text(n)===label)[0].props.children[0].props.onChange({target:{checked:true}});
  toggle('Your Brand');tree=h.render();assert.match(text(tree),/Promotional content/);
  toggle('Branded Content');tree=h.render();assert.match(text(tree),/Paid partnership/);assert.equal(nodes(tree,n=>n.type==='a'&&text(n)==='Branded Content Policy').length,1);assert.equal(nodes(tree,n=>n.type==='option'&&n.props.value==='SELF_ONLY')[0].props.disabled,true);
  nodes(tree,n=>n.type==='input'&&n.props.role==='switch')[0].props.onChange({target:{checked:false}});tree=h.render();assert.equal(nodes(tree,n=>n.type==='a'&&text(n)==='Branded Content Policy').length,0);
  nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value:'SELF_ONLY'}});nodes(tree,n=>n.type==='input'&&n.props.role==='switch')[0].props.onChange({target:{checked:true}});tree=h.render();assert.equal(nodes(tree,n=>n.type==='label'&&text(n)==='Branded Content')[0].props.children[0].props.disabled,true);
});
test('UI disables restricted video interactions and hides Duet/Stitch for photos',()=>{
  const tree=ui({...creator,comment_disabled:true,duet_disabled:true}).render();
  for(const label of ['Allow commentsDisabled in TikTok','Allow DuetDisabled in TikTok'])assert.equal(nodes(tree,n=>n.type==='label'&&text(n)===label)[0].props.children[0].props.disabled,true);
  const photos=ui(creator,post({assets:[{id:'photo',mediaType:'PHOTO',contentUrl:'https://example.test/p'}]})).render();assert.doesNotMatch(text(photos),/Allow Duet|Allow Stitch/);assert.match(text(photos),/Photo title/);
});
test('publishing OAuth uses expiring browser-bound state and the actual callback path',()=>{
  const old=process.env.JWT_SECRET;process.env.JWT_SECRET='test-secret';try{const m=load('lib/channelOAuthState.ts'),s=m.createChannelOAuthState('tiktok','calendar');assert.equal(m.verifyChannelOAuthState('tiktok',s.state,s.nonce),'calendar');assert.equal(m.verifyChannelOAuthState('tiktok',s.state,'wrong'),null);assert.equal(m.verifyChannelOAuthState('tiktok','calendar',s.nonce),null);assert.equal(m.channelOAuthCookieOptions('tiktok',600).path,'/api/calendars/tiktok/callback');}finally{if(old===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=old;}
});

test('creator response must contain complete current permissions and propagates account limits',async()=>{
  const api=load('lib/tiktok.ts');
  global.fetch=async()=>new Response(JSON.stringify({error:{code:'ok'},data:creator}));
  assert.deepEqual(await api.queryTikTokCreatorInfo('fake'),creator);
  global.fetch=async()=>new Response(JSON.stringify({error:{code:'ok'},data:{privacy_level_options:['SELF_ONLY']}}));
  await assert.rejects(api.queryTikTokCreatorInfo('fake'),/complete creator permissions/);
  global.fetch=async()=>new Response(JSON.stringify({error:{code:'spam_risk_too_many_posts'},data:{}}));
  await assert.rejects(api.queryTikTokCreatorInfo('fake'),/daily posting limit/);
});

test('scheduler reconciles accepted TikTok operations and excludes them from stale failure',async()=>{
  const oldUrl=process.env.URL,oldSecret=process.env.CRON_SECRET;process.env.URL='https://example.test';process.env.CRON_SECRET='test';
  let selection;const updates=[];global.fetch=async()=>new Response('{}');
  const db={calendarPost:{updateMany:async args=>{updates.push(args);return{count:1};},findMany:async args=>{selection=args;return[{id:'post',platform:'TIKTOK',tikTokPublishStatus:'PUBLISHING',updatedAt:new Date()}];}}};
  try{const m=load('lib/publishing/scheduler.ts',{'@/lib/db':{db}});assert.equal((await m.runScheduledPublishing(['TIKTOK'])).dispatched,1);assert.equal(updates[0].where.tikTokPublishId,null);assert.ok(selection.where.OR.some(q=>q.tikTokPublishStatus==='PUBLISHING'&&q.tikTokPublishId.not===null));assert.equal(updates[1].where.tikTokPublishStatus,'PUBLISHING');}
  finally{if(oldUrl===undefined)delete process.env.URL;else process.env.URL=oldUrl;if(oldSecret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=oldSecret;}
});

test('creator endpoint returns restriction flags and no credentials',async()=>{
  const route=load('app/api/calendars/[id]/tiktok/creator-info/route.ts',{'@/lib/auth':{getCurrentCreator:async()=>({id:'manager'})},'@/lib/calendarPermissions':{hasCalendarPermission:async()=>true},'@/lib/tiktokConnection':{getTikTokCreator:async()=>({connection:{platformAccountId:'account',accessToken:'never-expose',refreshToken:'never-expose'},info:{...creator,comment_disabled:true}})}});
  const response=await route.GET({}, {params:Promise.resolve({id:'calendar'})});const result=await response.json();assert.equal(result.comment_disabled,true);assert.deepEqual(result.privacyOptions,creator.privacy_level_options);assert.equal(result.accountId,'account');assert.doesNotMatch(JSON.stringify(result),/never-expose/);assert.equal(response.headers.get('cache-control'),'no-store');
});

test('token rotation is serialized, updates refresh expiry and synchronizes account connections',async()=>{
  const connection={id:'c',platformAccountId:'account',status:'CONNECTED',accessToken:'expired',accessTokenExpiresAt:new Date(0),refreshToken:'old',refreshTokenExpiresAt:new Date(Date.now()+100000)};let lock=0;const writes=[];
  const tx={$executeRaw:async()=>{lock++;},socialConnection:{findUniqueOrThrow:async()=>connection,updateMany:async args=>{writes.push(args);Object.assign(connection,args.data);return{count:1};}},socialCalendar:{updateMany:async()=>({count:1})}};
  const m=load('lib/tiktokConnection.ts',{'@/lib/db':{db:{$transaction:async fn=>fn(tx)}},'@/lib/tiktok':{refreshTikTokAccessToken:async()=>({open_id:'account',access_token:'new',refresh_token:'rotated',expires_in:7200,refresh_expires_in:15552000,scope:'video.publish'})},'@/lib/socialTokens':{}});
  const result=await m.freshTikTokConnection(connection);assert.equal(lock,1);assert.equal(result.refreshToken,'rotated');assert.ok(result.refreshTokenExpiresAt.getTime()>Date.now());assert.equal(writes[0].where.platformAccountId,'account');assert.equal(writes[0].where.refreshToken,'old');
});

test('client approval does not schedule TikTok and revision removes prior authorization',async()=>{
  let changed;const p=post({approvalStatus:'PENDING'});const calendar={id:'calendar',manager:{email:'manager@example.test'},collaborators:[]};
  const db={socialCalendar:{findUnique:async()=>calendar},socialConnection:{findFirst:async()=>({id:'connection'})},calendarPost:{findUnique:async()=>p,updateMany:async args=>{changed=args.data;return{count:1};},findUniqueOrThrow:async()=>({...p,assets:[],videoComments:[],customFields:[]})}};
  const route=load('app/api/social-calendar/[slug]/posts/[postId]/review/route.ts',{'@/lib/db':{db},'@/lib/calendarPermissions':{canAccessCalendarById:async()=>true},'@/lib/auth':{verifyViewerToken:()=>({email:'viewer@example.test'})},'@/lib/resend':{sendCalendarPostReviewedEmail:async()=>{}},'@/lib/r2':{publicUrlFor:k=>k}});
  const req=action=>({cookies:{get:()=>({value:'mock'})},json:async()=>({action})}),params={params:Promise.resolve({slug:'calendar',postId:'post'})};
  assert.equal((await route.POST(req('approve'),params)).status,200);assert.equal(changed.approvalStatus,'APPROVED');assert.equal(changed.tikTokPublishStatus,undefined);
  p.tikTokPublishStatus='SCHEDULED';assert.equal((await route.POST(req('request_revision'),params)).status,200);assert.equal(changed.tikTokPublishStatus,'NOT_SCHEDULED');assert.equal(changed.tikTokConsentHash,null);
});


test('closely spaced creator requests reserve the next slot instead of rejecting settings loading',async()=>{
  const rows={};let transactions=0;
  const tx={$executeRaw:async()=>{},tikTokAccountRuntime:{upsert:async()=>rows,update:async args=>{Object.assign(rows,args.data);}}};
  const m=load('lib/tiktokConnection.ts',{'@/lib/db':{db:{$transaction:async fn=>{transactions++;return fn(tx);}}},'@/lib/tiktok':{},'@/lib/socialTokens':{}});
  await m.reserveTikTokRequest('account','creator');
  const first=rows.creatorNextAt.getTime();
  rows.creatorNextAt=new Date(Date.now()+20);
  await m.reserveTikTokRequest('account','creator');
  assert.equal(transactions,2);assert.ok(rows.creatorNextAt.getTime()>=first);
  rows.creatorNextAt=new Date(Date.now()+20000);
  await assert.rejects(m.reserveTikTokRequest('account','creator'),error=>error instanceof m.TikTokRequestBusyError&&error.retryAfter>0);
});

test('creator endpoint distinguishes local request congestion from provider failures',async()=>{
  const {TikTokRequestBusyError}=load('lib/tiktokConnection.ts',{'@/lib/db':{},'@/lib/tiktok':{},'@/lib/socialTokens':{}});
  const route=load('app/api/calendars/[id]/tiktok/creator-info/route.ts',{'@/lib/auth':{getCurrentCreator:async()=>({id:'manager'})},'@/lib/calendarPermissions':{hasCalendarPermission:async()=>true},'@/lib/tiktokConnection':{TikTokRequestBusyError,getTikTokCreator:async()=>{throw new TikTokRequestBusyError(20);}}});
  const response=await route.GET({}, {params:Promise.resolve({id:'calendar'})});assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'20');
});

test('TikTok PKCE uses a fresh verifier, hex SHA256 challenge and browser-state binding',()=>{
  const {createHash}=require('node:crypto'),m=load('lib/tiktokOAuthPkce.ts');const a=m.createTikTokPkce(),b=m.createTikTokPkce();
  assert.match(a.verifier,/^[A-Za-z0-9_-]{43}$/);assert.match(a.challenge,/^[a-f0-9]{64}$/);assert.equal(a.challenge,createHash('sha256').update(a.verifier).digest('hex'));assert.notEqual(a.verifier,b.verifier);
  assert.equal(m.readTikTokVerifier('nonce.'+a.verifier,'nonce'),a.verifier);assert.equal(m.readTikTokVerifier('nonce.'+a.verifier,'wrong'),null);assert.equal(m.readTikTokVerifier(undefined,'nonce'),null);
});

test('TikTok authorization and token exchange pass the matching PKCE pair',async()=>{
  const oldKey=process.env.TIKTOK_CLIENT_KEY,oldSecret=process.env.TIKTOK_CLIENT_SECRET;process.env.TIKTOK_CLIENT_KEY='test-key';process.env.TIKTOK_CLIENT_SECRET='test-secret';
  try{const api=load('lib/tiktok.ts'),pkce=load('lib/tiktokOAuthPkce.ts').createTikTokPkce();const url=new URL(api.buildTikTokAuthUrl({redirectUri:'https://example.test/callback',state:'signed-state',codeChallenge:pkce.challenge}));assert.equal(url.searchParams.get('code_challenge'),pkce.challenge);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.has('code_verifier'),false);
    global.fetch=async(_url,init)=>{const body=new URLSearchParams(init.body);assert.equal(body.get('code_verifier'),pkce.verifier);assert.equal(body.get('redirect_uri'),'https://example.test/callback');return new Response(JSON.stringify({open_id:'account',access_token:'fake',refresh_token:'fake',expires_in:86400,refresh_expires_in:100000,scope:'video.publish'}));};await api.exchangeCodeForTikTokTokens('code','https://example.test/callback',pkce.verifier);
  }finally{if(oldKey===undefined)delete process.env.TIKTOK_CLIENT_KEY;else process.env.TIKTOK_CLIENT_KEY=oldKey;if(oldSecret===undefined)delete process.env.TIKTOK_CLIENT_SECRET;else process.env.TIKTOK_CLIENT_SECRET=oldSecret;}
});

test('connect route stores the PKCE verifier only in a protected callback cookie',async()=>{
  let challenge;
  const route=load('app/api/calendars/[id]/tiktok/connect/route.ts',{'@/lib/calendarPermissions':{hasCalendarPermission:async()=>true},'@/lib/auth':{getCurrentCreator:async()=>({id:'manager'})},'@/lib/db':{db:{socialCalendar:{findUnique:async()=>({managerId:'manager'})}}},'@/lib/url':{appUrl:()=> 'https://example.test'},'@/lib/channelOAuthState':{createChannelOAuthState:()=>({state:'signed',nonce:'nonce',cookieName:'showwork_tiktok_oauth_state',maxAge:600}),channelOAuthCookieOptions:()=>({httpOnly:true,secure:true,sameSite:'lax',path:'/api/calendars/tiktok/callback',maxAge:600})},'@/lib/tiktok':{buildTikTokAuthUrl:input=>{challenge=input.codeChallenge;return 'https://www.tiktok.com/v2/auth/authorize/?code_challenge='+challenge;}}});
  const response=await route.GET({}, {params:Promise.resolve({id:'calendar'})});const cookie=response.cookies.get('showwork_tiktok_pkce');const verifier=load('lib/tiktokOAuthPkce.ts').readTikTokVerifier(cookie.value,'nonce');assert.ok(verifier);assert.equal(require('node:crypto').createHash('sha256').update(verifier).digest('hex'),challenge);assert.equal(cookie.httpOnly,true);assert.equal(cookie.path,'/api/calendars/tiktok/callback');assert.ok(!response.headers.get('location').includes(verifier));
});

test('callback rejects a missing PKCE cookie before exchange and clears temporary cookies',async()=>{
  let exchanges=0;
  const route=load('app/api/calendars/tiktok/callback/route.ts',{'@/lib/channelOAuthState':{verifyChannelOAuthState:()=> 'calendar',channelOAuthCookieOptions:()=>({httpOnly:true,path:'/api/calendars/tiktok/callback',maxAge:0})},'@/lib/auth':{},'@/lib/db':{},'@/lib/url':{appUrl:()=> 'https://example.test'},'@/lib/socialReporting':{},'@/lib/tiktok':{exchangeCodeForTikTokTokens:async()=>{exchanges++;}}});
  const response=await route.GET({nextUrl:new URL('https://example.test/api/calendars/tiktok/callback?state=signed&code=code'),cookies:{get:name=>name==='showwork_tiktok_oauth_state'?{value:'nonce'}:undefined}});assert.equal(exchanges,0);assert.match(response.headers.get('location'),/missing_state/);assert.equal(response.cookies.get('showwork_tiktok_pkce').maxAge,0);
});

test('probe failures distinguish deployment, network, timeout and invalid media',()=>{
  const m=load('lib/tiktokProbe.ts');
  assert.match(m.tikTokProbeError({code:'ENOENT'}).message,/server/);
  assert.match(m.tikTokProbeError({code:'EACCES'}).message,/startup/);
  assert.match(m.tikTokProbeError({killed:true,signal:'SIGTERM'}).message,/timed out/);
  assert.match(m.tikTokProbeError({code:1,stderr:'Protocol https not on whitelist'}).message,/public media URL/);
  assert.match(m.tikTokProbeError({code:1,stderr:'Invalid data found when processing input'}).message,/decode/);
});

test('probe resolves from the Lambda task root even with a different working directory',async()=>{
  const expected=require('node:path').join('/bundle','node_modules','ffprobe-static','bin',process.platform,process.arch,process.platform==='win32'?'ffprobe.exe':'ffprobe');const old=process.env.LAMBDA_TASK_ROOT;process.env.LAMBDA_TASK_ROOT='/bundle';
  try{const m=load('lib/tiktokProbe.ts',{'node:fs/promises':{access:async file=>{if(file!==expected)throw Object.assign(new Error(),{code:'ENOENT'});}}});assert.equal(await m.resolveTikTokProbe(),expected);}
  finally{if(old===undefined)delete process.env.LAMBDA_TASK_ROOT;else process.env.LAMBDA_TASK_ROOT=old;}
});

test('probe missing from the deployment produces a configuration error before inspecting media',async()=>{
  const m=load('lib/tiktokProbe.ts',{'node:fs/promises':{access:async()=>{throw Object.assign(new Error(),{code:'ENOENT'});}}});await assert.rejects(m.resolveTikTokProbe(),/probe missing/);
});

test('TikTok prepares PNG, WebP, TIFF and SVG photos as correctly sized JPEGs',async()=>{
  const sharp=require('sharp'),m=load('lib/tiktokMedia.ts',{'@/lib/r2':{}});
  const base=sharp({create:{width:2400,height:1200,channels:4,background:{r:255,g:0,b:0,alpha:0.5}}});
  const inputs=[await base.clone().png().toBuffer(),await base.clone().webp().toBuffer(),await base.clone().tiff().toBuffer(),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="blue"/></svg>')];
  for(let i=0;i<inputs.length;i++) {
    const jpeg=await m.convertTikTokImage(inputs[i]),meta=await sharp(jpeg).metadata();
    assert.equal(meta.format,'jpeg');assert.equal(meta.hasAlpha,false);
    assert.ok(Math.max(meta.width,meta.height)<=1920);assert.ok(Math.min(meta.width,meta.height)<=1080);
    assert.ok(Math.abs(meta.width/meta.height-(i===3?2/3:2))<0.005);
  }
});
test('TikTok converts a real AVI into compliant MP4',async()=>{
  const run=require('node:util').promisify(require('node:child_process').execFile),fsp=require('node:fs/promises');
  const directory=await fsp.mkdtemp(path.join(require('node:os').tmpdir(),'tiktok-video-test-'));
  const m=load('lib/tiktokMedia.ts',{'@/lib/r2':{}});
  try {
    const input=path.join(directory,'source.avi'),output=path.join(directory,'prepared.mp4');
    const ffmpeg=require('ffmpeg-static'),ffprobe=require('ffprobe-static').path;
    await run(ffmpeg,['-y','-v','error','-f','lavfi','-i','color=c=blue:s=640x480:r=12','-t','1','-c:v','mpeg4',input]);
    const source=JSON.parse((await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',input])).stdout);
    const args=m.tikTokConversionArgs(input,output,source);args[args.indexOf('-protocol_whitelist')+1]='file,pipe';
    await run(ffmpeg,args);
    const metadata=JSON.parse((await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',output])).stdout);
    assert.equal(metadata.streams[0].width/metadata.streams[0].height,4/3);
    assert.doesNotThrow(()=>m.validateTikTokMediaProbe(metadata,fs.statSync(output).size,'VIDEO',180));
  } finally {await fsp.rm(directory,{recursive:true,force:true});}
});
test('TikTok publishing stores a JPEG copy while preflight preserves the original',async()=>{
  const sharp=require('sharp'),source=await sharp({create:{width:800,height:600,channels:3,background:'red'}}).png().toBuffer();
  let uploaded;
  const m=load('lib/tiktokMedia.ts',{'@/lib/r2':{publicUrlFor:key=>'https://media.test/'+key,putTikTokPreparedFile:async(key,bytes,type,size)=>{uploaded={key,bytes,type,size};}}});
  global.fetch=async(url,options)=>options.method==='HEAD'?new Response(null,{headers:{'content-length':String(source.length)}}):new Response(source);
  const asset={fileKey:'calendars/c/p/source.png',mediaType:'PHOTO'};
  await m.validateTikTokMedia([asset],creator);assert.equal(uploaded,undefined);
  const [result]=await m.validateTikTokMedia([asset],creator,{publish:true});
  assert.equal(result.url,'https://media.test/'+uploaded.key);assert.equal(uploaded.type,'image/jpeg');
  assert.equal((await sharp(uploaded.bytes).metadata()).format,'jpeg');assert.equal(asset.fileKey,'calendars/c/p/source.png');
});
test('worker submits the prepared media URL to TikTok',async()=>{
  const h=publisher();await h.run();assert.deepEqual(h.videoUrls,['https://example.test/prepared.mp4']);
});

test('a successful retry hides the historical publishing error immediately',async()=>{
  const oldWindow=global.window;global.window={dispatchEvent(){}};
  global.fetch=async()=>new Response(JSON.stringify({ok:true,status:'SCHEDULED'}));
  try{
    const h=ui(creator,post({tikTokPublishStatus:'FAILED',tikTokPublishError:'Old media inspection failure'}));let tree=h.render();
    assert.match(text(tree),/Previous publishing attempt: Old media inspection failure/);
    nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value:'SELF_ONLY'}});tree=h.render();
    nodes(tree,n=>n.type==='label'&&text(n).startsWith('By posting'))[0].props.children[0].props.onChange({target:{checked:true}});
    nodes(tree,n=>n.type==='label'&&text(n).startsWith('I checked TikTok'))[0].props.children[0].props.onChange({target:{checked:true}});tree=h.render();
    nodes(tree,n=>n.type==='button'&&text(n)==='Authorize and retry')[0].props.onClick();
    await new Promise(resolve=>setImmediate(resolve));tree=h.render();
    assert.match(text(tree),/scheduled/);assert.doesNotMatch(text(tree),/Old media inspection failure/);
  }finally{if(oldWindow===undefined)delete global.window;else global.window=oldWindow;}
});
