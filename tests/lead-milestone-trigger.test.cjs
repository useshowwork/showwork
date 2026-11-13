const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('database trigger records real stage transitions, ignores repeated saves and does not invent historical events',{skip:!process.env.SHOWWORK_REVIEW_PGLITE_PATH},async()=>{
 const {PGlite}=require(process.env.SHOWWORK_REVIEW_PGLITE_PATH);const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE "CalendarLead"(id text PRIMARY KEY,temperature text NOT NULL,status text NOT NULL,notes text);
   INSERT INTO "CalendarLead" VALUES('historical','HOT','CUSTOMER',NULL);`);
  await db.exec(fs.readFileSync('prisma/migrations/20261113170000_lead_analytics_milestones/migration.sql','utf8'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "CalendarLeadMilestone"')).rows[0].n,0);
  await db.exec(`INSERT INTO "CalendarLead" VALUES('lead','WARM','NEW',NULL);
   UPDATE "CalendarLead" SET temperature='HOT' WHERE id='lead';
   UPDATE "CalendarLead" SET temperature='HOT',notes='Repeated save' WHERE id='lead';
   UPDATE "CalendarLead" SET status='CUSTOMER' WHERE id='lead';
   UPDATE "CalendarLead" SET status='CUSTOMER' WHERE id='lead';
   UPDATE "CalendarLead" SET status='LOST' WHERE id='lead';
   UPDATE "CalendarLead" SET status='NEW' WHERE id='lead';
   UPDATE "CalendarLead" SET status='CUSTOMER' WHERE id='lead';`);
  const rows=(await db.query(`SELECT kind,count(*)::int AS n FROM "CalendarLeadMilestone" WHERE "leadId"='lead' GROUP BY kind ORDER BY kind`)).rows;
  assert.deepEqual(rows,[{kind:'CUSTOMER',n:2},{kind:'HOT',n:2}]);
  assert.equal((await db.query(`SELECT count(DISTINCT "leadId")::int AS n FROM "CalendarLeadMilestone" WHERE kind='CUSTOMER'`)).rows[0].n,1);
  const started=(await db.query(`SELECT "startedAt" FROM "LeadAnalyticsTracking"`)).rows[0].startedAt;
  await db.exec(fs.readFileSync('prisma/migrations/20261113170000_lead_analytics_milestones/migration.sql','utf8'));
  assert.deepEqual((await db.query(`SELECT "startedAt" FROM "LeadAnalyticsTracking"`)).rows[0].startedAt,started);
 }finally{await db.close();}
});
