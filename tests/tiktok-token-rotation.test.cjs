const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
function fixture({expiredRefresh=false}={}){
 const row={currentVersion:1,state:'CONNECTED',status:'CONNECTED',providerAccountId:'account',connectionId:'connection',refreshToken:'old',accessTokenExpiresAt:new Date(0),refreshTokenExpiresAt:new Date(Date.now()+(expiredRefresh?-1000:15552000000))};
 const writes=[],keys=[];let busy=false,calls=0;
 const database={transaction:async fn=>fn({query:async(sql,values)=>{
  if(sql.startsWith('SELECT b.'))return {rows:[{...row}]};
  if(sql.includes(' AS live '))return {rows:[{live:true,token:'lease'}]};
  if(sql.startsWith('SELECT * FROM "PublishingAccountBinding"'))return {rows:[{currentVersion:1,state:'CONNECTED'}]};
  if(sql.startsWith('UPDATE "SocialConnection" s SET')){assert.equal(values[5],row.refreshToken);row.accessTokenExpiresAt=values[2];writes.push([sql,values]);return {rows:[{id:'connection'}]};}
  if(sql.startsWith('UPDATE "SocialConnection" SET "refreshToken"='))row.refreshToken=values[1];
  if(sql.startsWith('UPDATE'))writes.push([sql,values]);
  if(sql.startsWith('DELETE'))busy=false;
  return {rows:[]};
 }})};
 const service=load('lib/publishing/tokenRefreshFence.ts').createFencedTokenRefresh({database,validation:{lockForPolicyChange:async()=>{}},coordination:{reserveRefresh:async key=>{keys.push(key);if(busy)throw Error('TOKEN_REFRESH_BUSY');busy=true;return 'lease';}},refresh:async input=>{
  calls++;assert.equal(input.refreshToken,row.refreshToken);await new Promise(resolve=>setImmediate(resolve));
  return {accountId:'account',accessToken:'access-'+calls,refreshToken:'rotated-'+calls,expiresAt:new Date(Date.now()+7200000),refreshTokenExpiresAt:new Date(Date.now()+15552000000),scopes:'video.publish'};
 }});
 const target={platform:'TIKTOK',accountBindingId:'workspace-one',accountVersion:1,providerAccountId:'account',connectionId:'connection'};
 return {service,target,row,writes,keys,calls:()=>calls};
}
test('two workspaces cannot refresh the same TikTok grant concurrently; stale callers reuse refreshed access',async()=>{
 const f=fixture();const first=f.service.refresh(f.target);
 await assert.rejects(f.service.refresh({...f.target,accountBindingId:'workspace-two'}),/TOKEN_REFRESH_BUSY/);
 await first;await f.service.refresh({...f.target,accountBindingId:'workspace-two'});
 assert.equal(f.calls(),1);assert.ok(f.keys.every(key=>key==='refresh:TIKTOK:account'));assert.equal(f.row.refreshToken,'rotated-1');
 const calendar=f.writes.find(([sql])=>sql.startsWith('UPDATE "SocialCalendar"'));
 assert.equal(calendar[1][3],'rotated-1');assert.equal(calendar[1][4],'old');
 const shared=f.writes.find(([sql])=>sql.includes("WHERE platform='TIKTOK'"));assert.equal(shared[1][6],'old');
 f.row.accessTokenExpiresAt=new Date(0);await f.service.refresh(f.target);assert.equal(f.calls(),2);assert.equal(f.row.refreshToken,'rotated-2');
});
test('expired TikTok refresh token requests reconnect without calling provider',async()=>{
 const f=fixture({expiredRefresh:true});await assert.rejects(f.service.refresh(f.target),/Reconnect TikTok/);assert.equal(f.calls(),0);
});
test('OAuth accepts two-hour access and 180-day refresh lifetimes and rejects nonpositive lifetimes',async()=>{
 const previous={TIKTOK_CLIENT_KEY:process.env.TIKTOK_CLIENT_KEY,TIKTOK_CLIENT_SECRET:process.env.TIKTOK_CLIENT_SECRET};
 process.env.TIKTOK_CLIENT_KEY='test';process.env.TIKTOK_CLIENT_SECRET='test';
 let lifetime=7200;
 const api=load('lib/tiktok.ts',{'@/lib/publishing/applicationBoundary':{},'@/lib/publishing/executionContext':{publishingFetch:async()=>Response.json({open_id:'account',access_token:'access',refresh_token:'new',expires_in:lifetime,refresh_expires_in:15552000,scope:'video.publish'})}});
 try{const response=await api.refreshTikTokAccessToken('old');assert.equal(response.expires_in,7200);assert.equal(response.refresh_expires_in,15552000);lifetime=0;await assert.rejects(api.refreshTikTokAccessToken('old'),/incomplete connection/);}finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
