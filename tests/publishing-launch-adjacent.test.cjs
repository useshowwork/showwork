'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./helpers/load-typescript.cjs');
test('retained Netlify hosts can read hidden-content projection without installing a publisher',async()=>{
 const old=process.env.SHOWWORK_PUBLISHING_PROTOCOL;process.env.SHOWWORK_PUBLISHING_PROTOCOL='canonical';
 try{const boundary=load('lib/publishing/applicationBoundary.ts');assert.throws(()=>boundary.publishingIntegrationInstalled(),/BOOTSTRAP_REQUIRED/);
  const {scopedApplicationDatabase}=load('lib/publishing/nativeApplicationContext.ts');let observed;
  const db=scopedApplicationDatabase({$queryRawUnsafe:async()=>[{resourceType:'WORKSPACE',resourceId:'deleted'}],socialCalendar:{findMany:async args=>{observed=args;return [{id:'visible'},{id:'deleted'}];}}});
  assert.deepEqual(await db.socialCalendar.findMany(),[{id:'visible'}]);assert.deepEqual(observed.where.NOT,[{id:{in:['deleted']}}]);
  assert.throws(()=>boundary.publishingIntegrationInstalled(),/BOOTSTRAP_REQUIRED/);
 }finally{if(old===undefined)delete process.env.SHOWWORK_PUBLISHING_PROTOCOL;else process.env.SHOWWORK_PUBLISHING_PROTOCOL=old;}
});
test('analytics and inbox reads remain available while every public creation endpoint is denied',async()=>{
 const old=process.env.SHOWWORK_PUBLISHING_PROTOCOL,original=global.fetch;process.env.SHOWWORK_PUBLISHING_PROTOCOL='canonical';let calls=0;
 global.fetch=async(_url,options)=>{calls++;assert.equal(options.redirect,'error');assert.ok(options.signal);return Response.json({data:[]});};
 try{const {publishingFetch}=load('lib/publishing/executionContext.ts');
  await publishingFetch('https://api.x.com/2/dm_events');await publishingFetch('https://api.x.com/2/users/123/tweets');await publishingFetch('https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=me');
  await publishingFetch('https://api.x.com/2/dm_conversations/with/123/messages',{method:'POST',body:'{}'});assert.equal(calls,4);
  for(const url of ['https://api.x.com/2/tweets','https://api.linkedin.com/rest/posts','https://graph.facebook.com/v26.0/123/media_publish','https://graph.facebook.com/v26.0/123/feed','https://graph-video.facebook.com/v26.0/123/videos','https://open.tiktokapis.com/v2/post/publish/video/init/'])await assert.rejects(publishingFetch(url,{method:'POST',body:'{}'}),/RETIRED/);
  for(const url of ['https://api.x.com/2/dm_events?method=POST','http://api.x.com/2/dm_events','https://api.x.com/2/tweets/123'])await assert.rejects(publishingFetch(url),/BOOTSTRAP_REQUIRED/);
  await assert.rejects(publishingFetch('https://api.x.com/2/dm_events',{headers:{'x-http-method-override':'POST'}}));assert.equal(calls,4);
 }finally{global.fetch=original;if(old===undefined)delete process.env.SHOWWORK_PUBLISHING_PROTOCOL;else process.env.SHOWWORK_PUBLISHING_PROTOCOL=old;}
});
test('auxiliary refresh preserves identity, returns no capability, and rejects reconnect during lookup',async()=>{
 const row={id:'connection',calendarId:'calendar',platform:'X',platformAccountId:'provider',status:'CONNECTED',connectedAt:new Date(0),accessToken:'synthetic',accessTokenExpiresAt:new Date(Date.now()+600000),bindingId:'binding',currentVersion:4};let reads=0,changed=false;
 const database={transaction:async fn=>fn({query:async(sql,args)=>{reads++;if(sql.includes('"connectedAt"=$5')){assert.deepEqual(args,['calendar','X','connection','provider',row.connectedAt]);return {rows:[{...row,currentVersion:changed&&reads>2?5:4}]};}return {rows:[row]};}})};
 const accounts=load('lib/publishing/showworkPublishingAccounts.ts').createShowworkPublishingAccounts({database,accountFetch:async()=>{throw Error('UNEXPECTED_HTTP');}},{},{});
 const result=await accounts.freshConnection(row);assert.equal(result.id,'connection');assert.equal(result.accessToken,'synthetic');assert.equal(result.maySend,undefined);assert.equal(result.bindingId,undefined);
 changed=true;reads=0;await assert.rejects(accounts.freshConnection(row),/ACCOUNT_CHANGED/);
 await assert.rejects(accounts.freshConnection({...row,status:'DISCONNECTED'}),/DISCONNECTED/);
});
test('business-document deletion retains native authorization scope and delegates cleanup',async()=>{
 const boundary=load('lib/publishing/applicationBoundary.ts');const entry='app/api/calendars/[id]/business-documents/[documentId]/route.ts#DELETE@14';
 const removed=[],data={id:'doc',calendarId:'calendar',fileKey:'calendars/calendar/business-documents/one',sizeBytes:5n,calendar:{managerId:'owner'}};
 const db={socialCalendar:{update:async({data})=>{assert.equal(data.aiBusinessSummary,null);assert.equal(data.aiBusinessSummarySourceHash,null);}},calendarBusinessDocument:{findUnique:async()=>data,delete:async()=>removed.push('row')},contentWorkspaceUsage:{updateMany:async()=>({count:1})},$transaction:async fn=>fn(db)};
 const route=load('app/api/calendars/[id]/business-documents/[documentId]/route.ts',{'@/lib/auth':{getCurrentCreator:async()=>({id:'owner'})},'@/lib/db':{db},'@/lib/calendarPermissions':{hasCalendarPermission:async()=>true},'@/lib/r2':{deleteObject:async key=>removed.push(key)}});
 const uninstall=boundary.installDisabledPublishingApplication({host:'NEXT',publishingEnabled:false,invoke:async()=>{throw Error('RECURSIVE_ROUTE');}});
 try{const result=await boundary.runNativePublishingPolicy(entry,()=>route.DELETE(new Request('https://synthetic.invalid'),{params:Promise.resolve({id:'calendar',documentId:'doc'})}));assert.equal(result.status,200);assert.deepEqual(removed,[data.fileKey,'row']);}finally{uninstall();}
});
test('late reporting success or failure cannot reconnect a disconnected account',async()=>{
 for(const fail of [false,true]){
  const stored={id:'connection',calendarId:'calendar',platform:'X',platformAccountId:'provider',status:'CONNECTED',accessToken:'synthetic',connectedAt:new Date(0),publishedPosts:[]};
  const db={socialConnection:{findMany:async()=>[{...stored}],update:async({data})=>Object.assign(stored,data),updateMany:async({where,data})=>{assert.equal(where.status,'CONNECTED');assert.equal(where.accessToken,'synthetic');assert.equal(where.connectedAt.getTime(),0);if(stored.status!==where.status)return {count:0};Object.assign(stored,data);return {count:1};}},socialAccountMetricSnapshot:{findFirst:async()=>null,upsert:async()=>{}},socialPostMetricSnapshot:{upsert:async()=>{}},$transaction:async p=>Promise.all(p)};
  const reporting=load('lib/reporting/sync.ts',{'@/lib/calendarPermissions':{canAccessCalendarById:async()=>true},'@/lib/db':{db},'@/lib/reporting/adapters':{getSocialReportingAdapter:()=>({fetchAccountMetrics:async()=>{stored.status='DISCONNECTED';if(fail)throw Error('permission is missing');return {followers:1};},fetchPostMetrics:async()=>new Map()})},'@/lib/socialReporting':{utcSnapshotDate:()=>new Date(0)}});
  await reporting.syncCalendarSocialReporting('calendar');assert.equal(stored.status,'DISCONNECTED');
 }
});
test('legacy upsert callers divert to canonical routes or retired factories; intended Netlify tree excludes both publishers',()=>{
 const fs=require('node:fs');
 for(const file of ['app/api/calendars/channels/[channel]/callback/route.ts','app/api/calendars/instagram/callback/route.ts','app/api/calendars/tiktok/callback/route.ts','app/api/calendars/[id]/channels/facebook/select-page/route.ts','app/api/calendars/[id]/channels/linkedin/pages/route.ts']){
  const source=fs.readFileSync(file,'utf8');assert.ok(source.indexOf('/* canonical-integration-boundary */')<source.indexOf('await upsertSocialConnection('),file);assert.match(source,/return (?:await )?invokePublishingEntrypoint/);
 }
 for(const file of ['lib/publishing/worker.ts','lib/publishing/platformIntegration.ts','lib/tiktokPublishing.ts'])assert.match(fs.readFileSync(file,'utf8'),/assertLegacyFactoryNotRetired|assertLegacyPublishingAllowed/);
 assert.equal(fs.readFileSync('netlify.toml','utf8').includes('directory = "netlify/functions'), false);
 const source=fs.readFileSync('scripts/vps/prepare-netlify-handoff.mjs','utf8');assert.ok(source.includes('publish-post-background.ts') && source.includes('social-publish-cron.ts'));
 const bundle=fs.readFileSync('dist-worker-native/metafile.json','utf8');assert.ok(!Object.keys(JSON.parse(bundle).inputs).includes('lib/socialReporting.ts'));
});
test('trial notifications and AI research no longer need publication authority',async()=>{
 const deny={publishingIntegrationInstalled:()=>{throw Error('UNEXPECTED_PUBLICATION_AUTH');}};
 let writes=0;
 const research=load('lib/aiResearchScheduler.ts',{'@/lib/publishing/applicationBoundary':deny,'@/lib/db':{db:{socialCalendar:{findMany:async()=>[{id:'calendar',manager:{},clientName:'synthetic'}]},businessResearchRun:{findUnique:async()=>({status:'SUCCEEDED'})}}},'@/lib/knowledge/research':{queueBusinessResearch:async()=>({id:'run'}),executeBusinessResearch:async()=>{writes++;}},'@/lib/contentWorkspaceUsage':{canAccessContentWorkspace:()=>true}});
 assert.equal((await research.runScheduledAiBusinessResearch()).researched,1);assert.equal(writes,1);
 const emails=load('lib/calendarTrialEmails.ts',{'@/lib/publishing/applicationBoundary':deny,'@/lib/db':{db:{creator:{findMany:async()=>[]}}},'@/lib/resend':{}});assert.equal((await emails.runCalendarTrialEmailCheck()).checked,0);
});
