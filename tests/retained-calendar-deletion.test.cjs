const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
const cleanup=load('lib/workspaceStorageCleanup.ts',{'@/lib/db':{db:{}},'@/lib/r2':{},'@/lib/publishing/applicationBoundary':{publishingRetentionRequired:()=>false}});
function fixture(){
 const posts=[{id:'active',calendarId:'w',hook:'Active campaign',postDate:new Date('2026-11-06'),platform:'FACEBOOK',publishStatus:'PUBLISHING',publishWorkerStartedAt:new Date(),approvalStatus:'APPROVED',deletedAt:null},{id:'draft',calendarId:'w',hook:'Draft',postDate:new Date('2026-11-07'),platform:'INSTAGRAM',publishStatus:'NOT_SCHEDULED',approvalStatus:'PENDING',deletedAt:null}];
 const queued=[];const calls=[];
 const matches=(post,where={})=>(!where.calendarId||post.calendarId===where.calendarId)&&(!where.id||(typeof where.id==='string'?post.id===where.id:(!where.id.in||where.id.in.includes(post.id))&&(!where.id.notIn||!where.id.notIn.includes(post.id))&&(!where.id.equals||post.id===where.id.equals)))&&(!Object.hasOwn(where,'deletedAt')||post.deletedAt===where.deletedAt);
 const tx={$queryRaw:async()=>{calls.push('lock');return[];},socialCalendar:{findUnique:async()=>({managerId:'owner'}),update:async()=>{calls.push('reset-plan');}},calendarPost:{findMany:async({where})=>posts.filter(post=>matches(post,where)),findFirst:async({where})=>posts.find(post=>matches(post,where)),updateMany:async({where,data})=>{let count=0;for(const post of posts)if(matches(post,where)){Object.assign(post,data);count++;}return{count};},deleteMany:async({where})=>{const selected=posts.filter(post=>matches(post,where));for(const post of selected)posts.splice(posts.indexOf(post),1);return{count:selected.length};}},calendarPostAsset:{findMany:async({where})=>posts.filter(post=>matches(post,where.post)).map(post=>({fileKey:`calendars/w/${post.id}/media.jpg`,sizeBytes:1n}))},contentWorkspaceStorageReservation:{findMany:async()=>[]},calendarImport:{deleteMany:async()=>{}}};
 const db={$transaction:async fn=>fn(tx)};
 const {removeWorkspaceContent}=load('lib/workspaceDeletion.ts',{'@/lib/db':{db},'@/lib/publishing/editGuard':{},'@/lib/workspaceStorageCleanup':{...cleanup,queueWorkspaceStorageCleanup:async(_tx,_owner,_calendar,files)=>queued.push(...files.map(file=>file.fileKey))}});
 return{posts,queued,calls,remove:input=>removeWorkspaceContent({calendarId:'w',actorId:'owner',mode:'reset',...input})};
}
test('reset conflict identifies the exact post, platform, date and reason',async()=>{
 const f=fixture();await assert.rejects(f.remove(),error=>{assert.equal(error.blockingPosts.length,1);assert.equal(error.blockingPosts[0].id,'active');assert.equal(error.blockingPosts[0].title,'Active campaign');assert.equal(error.blockingPosts[0].platform,'FACEBOOK');assert.match(error.blockingPosts[0].reason,/publishing/);return true;});assert.equal(f.posts.length,2);assert.equal(f.queued.length,0);
});
test('confirmed removal hides active content but retains its status and required media',async()=>{
 const f=fixture();const result=await f.remove({removeBlocked:true});assert.equal(result.deletedCount,2);assert.equal(f.posts.length,1);assert.equal(f.posts[0].id,'active');assert.ok(f.posts[0].deletedAt instanceof Date);assert.equal(f.posts[0].publishStatus,'PUBLISHING');assert.deepEqual(f.queued,['calendars/w/draft/media.jpg']);assert.equal(f.calls[0],'lock');assert.ok(f.calls.includes('reset-plan'));
});
test('already removed attempts do not block another reset or lose their records',async()=>{
 const f=fixture();await f.remove({removeBlocked:true});await f.remove();assert.equal(f.posts.length,1);assert.equal(f.posts[0].id,'active');assert.equal(f.posts[0].publishStatus,'PUBLISHING');
});
test('retained media becomes removable only after a settled outcome',async()=>{
 const f=fixture();await f.remove({removeBlocked:true});f.posts[0].publishStatus='PUBLISHED';await f.remove({mode:'post',postId:'active',removeBlocked:true});assert.equal(f.posts.length,0);assert.ok(f.queued.includes('calendars/w/active/media.jpg'));
});
test('a teammate cannot override publishing protection',async()=>{
 const f=fixture();await assert.rejects(f.remove({mode:'post',postId:'active',removeBlocked:true,actorId:'teammate'}),/Only the workspace owner/);assert.equal(f.posts[0].deletedAt,null);
});
test('a worker observing deletion after its claim stops before contacting a provider',async()=>{
 const writes=[];let contacted=false;
 const {runPublishJob}=load('lib/publishing/worker.ts',{
 '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
 '@/lib/db':{db:{calendarPost:{updateMany:async args=>{writes.push(args);return{count:1};},findUniqueOrThrow:async()=>({id:'active',deletedAt:new Date(),assets:[]})}}},
 '@/lib/calendarPermissions':{canAccessCalendarById:async()=>true},
 '@/lib/instagramPublishing':{publishPostToInstagram:async()=>{contacted=true;}},
 '@/lib/tiktokPublishing':{},'@/lib/socialReporting':{},'@/lib/socialTokens':{},'./providers':{},
 './state':{PUBLISHING_PLATFORMS:['FACEBOOK'],statusWhere:()=>({publishStatus:'PUBLISHING'}),statusUpdate:(_platform,status)=>({publishStatus:status}),validatePublishContent:()=>assert.fail('must stop before validation')},
 });
 await runPublishJob('active','FACEBOOK',new Date());assert.equal(contacted,false);assert.ok(writes.some(write=>write.data.publishStatus==='NOT_SCHEDULED'));
});
