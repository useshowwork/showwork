const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/load-typescript.cjs');

test('removing the deployed Engage cap preserves accounts and permits connections without a count cap',{skip:!process.env.SHOWWORK_REVIEW_PGLITE_PATH},async()=>{
 const {PGlite}=require(process.env.SHOWWORK_REVIEW_PGLITE_PATH);
 const db=new PGlite();
 try{
  await db.exec(`CREATE TYPE "ContentWorkspacePlan" AS ENUM ('CREATOR','GROWTH','STUDIO','UNLIMITED');
   CREATE TABLE "Creator"(id text PRIMARY KEY,"contentWorkspacePlan" "ContentWorkspacePlan");
   CREATE TABLE "SocialCalendar"(id text PRIMARY KEY,"managerId" text REFERENCES "Creator");
   CREATE TABLE "SocialConnection"(id text PRIMARY KEY,"calendarId" text REFERENCES "SocialCalendar",platform text,"platformAccountId" text,status text);`);
  await db.exec(fs.readFileSync('prisma/migrations/20261114100000_showwork_engage/migration.sql','utf8'));
  await db.exec(`INSERT INTO "Creator" VALUES('engage','ENGAGE'); INSERT INTO "SocialCalendar" VALUES('business','engage');
   INSERT INTO "SocialConnection" VALUES('a','business','INSTAGRAM','instagram','CONNECTED'),('b','business','WHATSAPP','whatsapp','CONNECTED');`);
  const migration=fs.readFileSync('prisma/migrations/20261114170000_remove_engage_connection_limit/migration.sql','utf8');
  await db.exec(migration);
  for(const [id,platform] of [['fb1','FACEBOOK'],['fb2','FACEBOOK'],['ig2','INSTAGRAM'],['wa2','WHATSAPP']]) await db.query(`INSERT INTO "SocialConnection" VALUES($1,'business',$2,$1,'CONNECTED')`,[id,platform]);
  assert.equal((await db.query('SELECT count(*)::int n FROM "SocialConnection"')).rows[0].n,6);
  await db.exec(`UPDATE "SocialConnection" SET status='NEEDS_REAUTH' WHERE id='a'; UPDATE "SocialConnection" SET status='CONNECTED' WHERE id='a';`);
  await db.exec(migration);
  assert.equal((await db.query('SELECT count(*)::int n FROM "SocialConnection"')).rows[0].n,6);
 }finally{await db.close();}
});

test('channel guidance never displays a slot limit or disconnect instruction',()=>{
 const Channels=load('components/calendars/ChannelsWorkspace.tsx').default;
 for(const count of [0,1,2,6]){
  const html=renderToStaticMarkup(React.createElement(Channels,{engage:true,connectedAccounts:count,children:null}));
  assert.doesNotMatch(html,/of 2|Disconnect an account|slots/);
  assert.match(html,count===0?/Connect your accounts below/:/Connect more accounts/);
 }
});
