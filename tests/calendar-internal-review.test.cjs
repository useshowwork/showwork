const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {load}=require('./helpers/load-typescript.cjs');
const {internalReviewInput,internalReviewError,withoutInternalReview}=load('lib/calendarInternalReview.ts');
test('review decisions validate action, version and private feedback',()=>{
 assert.deepEqual(internalReviewInput({action:'approve',version:2}),{status:'APPROVED',version:2,note:null});
 for(const input of [{action:'publish',version:0},{action:'approve',version:-1},{action:'approve'},{action:'request_changes',version:0,note:' '},{action:'approve',version:0,note:{}}])assert.throws(()=>internalReviewInput(input));
 assert.equal(internalReviewInput({action:'request_changes',version:0,note:' Fix caption '}).note,'Fix caption');
 assert.equal(internalReviewError({approvalStatus:'APPROVED'},'PENDING'),'Client-approved content is locked.');
 assert.equal(internalReviewError({approvalStatus:'PENDING',isAiDraft:true},'APPROVED'),null);
 assert(internalReviewError({approvalStatus:'PENDING',isAiDraft:true},'NEEDS_CHANGES'));
 assert(internalReviewError({approvalStatus:'PENDING',isAiDraft:true},undefined));
 assert(internalReviewError({approvalStatus:'PENDING',publishStatus:'SCHEDULED'},'APPROVED'));
});
test('client responses strip internal notes and reviewer metadata',()=>{
 assert.deepEqual(withoutInternalReview({id:'p',approvalStatus:'PENDING',internalReviewStatus:'APPROVED',internalReviewNote:'private',internalReviewedAt:'now',internalReviewedBy:'owner',internalReviewVersion:2}),{id:'p',approvalStatus:'PENDING'});
});
test('internal review API rejects unauthenticated and unauthorized callers before mutation',async()=>{
 for(const [creator,allowed,status] of [[null,false,401],[{id:'outsider'},false,403]]){
  const {POST}=load('app/api/calendars/[id]/posts/[postId]/internal-review/route.ts',{
   '@/lib/auth':{getCurrentCreator:async()=>creator},'@/lib/calendarPermissions':{hasCalendarPermission:async()=>allowed},
   '@/lib/db':{db:{$transaction:()=>assert.fail('Unauthorized mutation')}},'@/lib/r2':{publicUrlFor:()=>''},
   '@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
  });
  const res=await POST(new Request('http://localhost/review',{method:'POST'}),{params:Promise.resolve({id:'workspace',postId:'post'})});assert.equal(res.status,status);
 }
});
test('PostgreSQL migration enforces visibility lifecycle and stale-review protection', {skip:!process.env.SHOWWORK_REVIEW_PGLITE_PATH},async()=>{
 const {PGlite}=require(process.env.SHOWWORK_REVIEW_PGLITE_PATH);const db=new PGlite();
 try{
 await db.exec(`CREATE TYPE "InternalReviewStatus" AS ENUM ('PENDING','APPROVED','NEEDS_CHANGES');
 CREATE TABLE "CalendarPost" (id TEXT PRIMARY KEY,"calendarId" TEXT, "postDate" TIMESTAMP,platform TEXT,"postType" TEXT,category TEXT,caption TEXT,hook TEXT,script TEXT,"contentIdea" TEXT,cta TEXT,hashtags TEXT,"taggedAccounts" TEXT,"linkUrl" TEXT,"isAiDraft" BOOLEAN DEFAULT false,"approvalStatus" TEXT DEFAULT 'PENDING',"approvalNote" TEXT,"reviewedAt" TIMESTAMP,"publishStatus" TEXT DEFAULT 'NOT_SCHEDULED',"instagramPublishStatus" TEXT DEFAULT 'NOT_SCHEDULED',"tikTokPublishStatus" TEXT DEFAULT 'NOT_SCHEDULED',"updatedAt" TIMESTAMP);
 CREATE TABLE "CalendarPostAsset"(id TEXT PRIMARY KEY,"postId" TEXT REFERENCES "CalendarPost"(id) ON DELETE CASCADE,"fileKey" TEXT);
 CREATE TABLE "CalendarPostCustomField"(id TEXT PRIMARY KEY,"postId" TEXT REFERENCES "CalendarPost"(id) ON DELETE CASCADE,value TEXT);
 INSERT INTO "CalendarPost"(id,"approvalStatus") VALUES('old-approved','APPROVED'),('old-pending','PENDING');
 INSERT INTO "CalendarPost"(id,"instagramPublishStatus") VALUES('old-scheduled','SCHEDULED');`);
 await db.exec(fs.readFileSync('prisma/migrations/20261024090000_calendar_internal_review/migration.sql','utf8'));
 const row=async id=>(await db.query('SELECT * FROM "CalendarPost" WHERE id=$1',[id])).rows[0];
 assert.equal((await row('old-approved')).internalReviewStatus,'APPROVED');assert.equal((await row('old-scheduled')).internalReviewStatus,'APPROVED');assert.equal((await row('old-pending')).internalReviewStatus,'PENDING');
 await db.exec(`INSERT INTO "CalendarPost"(id,caption) VALUES('new','First draft')`);
 assert.equal((await row('new')).internalReviewStatus,'PENDING');
 await assert.rejects(db.exec(`UPDATE "CalendarPost" SET "approvalStatus"='APPROVED' WHERE id='new'`),/INTERNAL_REVIEW_REQUIRED/);
 await assert.rejects(db.exec(`UPDATE "CalendarPost" SET "publishStatus"='SCHEDULED' WHERE id='new'`),/INTERNAL_REVIEW_REQUIRED/);
 await db.exec(`UPDATE "CalendarPost" SET "internalReviewStatus"='APPROVED',"internalReviewNote"='Private feedback' WHERE id='new'`);
 assert.equal((await db.query(`SELECT id FROM "CalendarPost" WHERE id='new' AND "internalReviewStatus"='APPROVED' AND NOT "isAiDraft"`)).rows.length,1);
 await db.exec(`UPDATE "CalendarPost" SET caption='Revised draft' WHERE id='new'`);
 assert.equal((await row('new')).internalReviewStatus,'PENDING');assert.equal((await row('new')).internalReviewNote,null);
 assert.equal((await db.query(`UPDATE "CalendarPost" SET "internalReviewStatus"='APPROVED' WHERE id='new' AND "internalReviewVersion"=0 RETURNING id`)).rows.length,0);
 for(const sql of [`INSERT INTO "CalendarPostAsset" VALUES('a','new','key')`,`UPDATE "CalendarPostAsset" SET "fileKey"='changed' WHERE id='a'`,`DELETE FROM "CalendarPostAsset" WHERE id='a'`,`INSERT INTO "CalendarPostCustomField" VALUES('f','new','details')`]){
  await db.exec(`UPDATE "CalendarPost" SET "internalReviewStatus"='APPROVED' WHERE id='new'`);await db.exec(sql);assert.equal((await row('new')).internalReviewStatus,'PENDING');
 }
 await db.exec(`UPDATE "CalendarPost" SET "internalReviewStatus"='APPROVED',"approvalStatus"='APPROVED' WHERE id='new'`);
 await assert.rejects(db.exec(`UPDATE "CalendarPost" SET caption='Changed after approval' WHERE id='new'`),/APPROVED_CONTENT_LOCKED/);
 await assert.rejects(db.exec(`INSERT INTO "CalendarPostAsset" VALUES('blocked','new','key')`),/APPROVED_CONTENT_LOCKED/);
 await db.exec(`UPDATE "CalendarPost" SET "publishStatus"='SCHEDULED' WHERE id='new'`);
 assert.equal((await row('new')).publishStatus,'SCHEDULED');
 // Exercise the canonical action against the same migration, with only identity policy stubbed.
 await db.exec(`CREATE TABLE "PublishingApplicationOperation"("operationId" TEXT PRIMARY KEY,actor TEXT,"requestHash" TEXT,result JSONB);
 CREATE TABLE "PublishingResourceTombstone"("resourceType" TEXT,"resourceId" TEXT);
 CREATE TABLE "PublishingJob"("postId" TEXT,phase TEXT);
 INSERT INTO "CalendarPost"(id,"calendarId",caption) VALUES('canonical','workspace','Ready for internal review');`);
 const {createCanonicalApplicationActions}=load('lib/publishing/applicationActions.ts',{'./validationAdapters':{
  createPublishingValidationAdapters:()=>({lockForPolicyChange:async()=>{},validateWorkspacePermission:async(_tx,input)=>{assert.equal(input.permission,'internal_review.manage');if(input.actor!=='owner')throw Error('WORKSPACE_PERMISSION_DENIED');}})
 }});
 const actions=createCanonicalApplicationActions({database:{transaction:fn=>db.transaction(tx=>fn(tx))},policy:{}});
 const request={operationId:'internal-1',actor:'owner',calendarId:'workspace',postId:'canonical',body:{action:'approve',version:0,note:'Team-only'}};
 await actions.internalReview(request);
 assert.equal((await row('canonical')).internalReviewStatus,'APPROVED');
 assert.equal((await row('canonical')).internalReviewedBy,'owner');
 await actions.internalReview(request); // Replay does not increment the version twice.
 assert.equal((await row('canonical')).internalReviewVersion,1);
 await assert.rejects(actions.internalReview({...request,operationId:'stale',body:{action:'reopen',version:0}}),/post changed/);
 await assert.rejects(actions.internalReview({...request,operationId:'wrong-workspace',calendarId:'other'}),/POST_MISSING/);
 await assert.rejects(actions.internalReview({...request,operationId:'outsider',actor:'outsider'}),/PERMISSION_DENIED/);

 }finally{await db.close();}
});
test('direct client review and comment URLs cannot expose unapproved posts',async()=>{
 for(const route of ['review','video-comments']){
  const {POST}=load(`app/api/social-calendar/[slug]/posts/[postId]/${route}/route.ts`,{
   '@/lib/auth':{verifyViewerToken:()=>({name:'Client',email:'client@example.test'})},
   '@/lib/calendarPermissions':{canAccessCalendarById:async()=>true},
   '@/lib/db':{db:{socialCalendar:{findUnique:async()=>({id:'workspace'})},calendarPost:{findUnique:async()=>({id:'post',calendarId:'workspace',internalReviewStatus:'PENDING',isAiDraft:false})},calendarPostVideoComment:{create:()=>assert.fail('Hidden post comment')}}},
   '@/lib/resend':{},'@/lib/r2':{},'@/lib/publishing/applicationBoundary':{publishingIntegrationInstalled:()=>false},
  });
  const res=await POST({cookies:{get:()=>({value:'test'})},json:()=>assert.fail('Hidden post action')},{params:Promise.resolve({slug:'workspace',postId:'post'})});
  assert.equal(res.status,404);assert.deepEqual(await res.json(),{error:'Post not found'});
 }
});
