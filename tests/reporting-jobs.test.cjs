const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');
function matches(row,where){
  return Object.entries(where).every(([key,value])=>{
    if(key==='OR')return value.some(v=>matches(row,v));
    if(key==='AND')return value.every(v=>matches(row,v));
    if(key==='connection')return true;
    if(value && typeof value==='object' && !(value instanceof Date)){
      if(value.in)return value.in.includes(row[key]);
      if(value.lte)return row[key]!=null && row[key]<=value.lte;
      if(value.lt)return row[key]!=null && row[key]<value.lt;
    }
    return row[key]===value;
  });
}
function fixture({active=true,connections=[{id:'ig',lastSyncAt:null,lastSyncAttemptAt:null}],provider=async()=>({status:'SYNCED'})}={}){
 const rows=new Map(),calls=[];
 const model={
   upsert:async({where,create})=>{if(!rows.has(where.connectionId))rows.set(where.connectionId,{...create,id:where.connectionId,status:'PENDING',attempts:0,nextAttemptAt:new Date(),leaseUntil:null});return rows.get(where.connectionId);},
   updateMany:async({where,data})=>{let count=0;for(const row of rows.values())if(matches(row,where)){count++;for(const [k,v]of Object.entries(data))row[k]=v?.increment?row[k]+v.increment:v;}return{count};},
   count:async({where})=>[...rows.values()].filter(r=>matches(r,where)).length,
   findFirst:async({where})=>{const row=[...rows.values()].find(r=>matches(r,where));return row?{...row}:null;},
 };
 const api=load('lib/reporting/jobs.ts',{'@/lib/db':{db:{socialConnection:{findMany:async args=>{calls.push(args);return connections;}},reportingSyncJob:model}},'@/lib/calendarPermissions':{canAccessCalendarById:async()=>active},'./sync':{syncReportingConnection:async id=>{calls.push(id);return provider(id);}}});
 return {api,rows,calls};
}
test('concurrent tabs enqueue exactly one durable job per account, including LinkedIn and X',async()=>{
 const f=fixture();await Promise.all(Array.from({length:8},()=>f.api.enqueueReportingSync('calendar')));assert.equal(f.rows.size,1);assert.equal(f.rows.get('ig').status,'PENDING');
 assert.ok(f.calls[0].where.platform.in.includes('LINKEDIN'));assert.ok(f.calls[0].where.platform.in.includes('X'));assert.ok(!f.calls[0].where.platform.in.includes('YOUTUBE'));
});
test('fresh observations and recent failures are cooled down; inactive workspaces enqueue nothing',async()=>{
 for(const connections of [[{id:'ig',lastSyncAt:new Date(),lastSyncAttemptAt:null}],[{id:'ig',lastSyncAt:null,lastSyncAttemptAt:new Date()}]]){
 const f=fixture({connections});assert.equal((await f.api.enqueueReportingSync('calendar')).queued,false);assert.equal(f.rows.size,0);}
 const f=fixture({active:false});await f.api.enqueueReportingSync('calendar');assert.equal(f.rows.size,0);assert.equal(f.calls.length,0);
});
test('atomic claim permits only one provider request under simultaneous worker execution',async()=>{
 let release;const blocked=new Promise(r=>release=r);const f=fixture({provider:async()=>{await blocked;return{status:'SYNCED'};}});
 await f.api.enqueueReportingSync('calendar');const first=f.api.runNextReportingJob();await new Promise(r=>setImmediate(r));
 assert.equal(await f.api.runNextReportingJob(),false);release();await first;
 assert.equal(f.calls.filter(c=>c==='ig').length,1);assert.equal(f.rows.get('ig').status,'COMPLETE');
});
test('provider failures retain durable work with bounded retry/backoff and no immediate replay',async()=>{
 const f=fixture({provider:async()=>({status:'FAILED'})});await f.api.enqueueReportingSync('calendar');await f.api.runNextReportingJob();
 const job=f.rows.get('ig');assert.equal(job.status,'PENDING');assert.equal(job.attempts,1);assert.ok(job.nextAttemptAt>new Date());assert.equal(await f.api.runNextReportingJob(),false);
 for(let i=0;i<2;i++){job.nextAttemptAt=new Date(0);await f.api.runNextReportingJob();}
 assert.equal(job.status,'FAILED');assert.equal(job.attempts,3);assert.equal(job.leaseToken,null);
});
test('expired process leases recover safely, and repeated crashes stop after the retry limit',async()=>{
 const f=fixture();await f.api.enqueueReportingSync('calendar');const job=f.rows.get('ig');Object.assign(job,{status:'RUNNING',leaseUntil:new Date(0),leaseToken:'old',attempts:1});
 await f.api.runNextReportingJob();assert.equal(job.status,'COMPLETE');assert.equal(job.attempts,2);
 Object.assign(job,{status:'RUNNING',leaseUntil:new Date(0),leaseToken:'old',attempts:3});
 await f.api.runNextReportingJob();assert.equal(job.status,'FAILED');assert.equal(f.calls.filter(c=>c==='ig').length,1);
});
test('the provider entrypoint rechecks disconnected and inactive accounts before IO',async()=>{
 for(const [status,active] of [['DISCONNECTED',true],['CONNECTED',false]]){
  let reads=0;
  const api=load('lib/reporting/sync.ts',{'@/lib/db':{db:{socialConnection:{findUnique:async()=>({id:'ig',calendarId:'c',status,platform:'INSTAGRAM',publishedPosts:[]})}}},'@/lib/calendarPermissions':{canAccessCalendarById:async()=>active},'@/lib/reporting/adapters':{getSocialReportingAdapter:()=>({fetchAccountMetrics:async()=>{reads++;}})},'@/lib/socialReporting':{utcSnapshotDate:()=>new Date()}});
  assert.equal((await api.syncReportingConnection('ig')).status,'SKIPPED');assert.equal(reads,0);
 }
});
test('scheduled scans rotate inactive workspaces without claiming they were synced',async()=>{
 let checked;
 const api=load('lib/reporting/jobs.ts',{'@/lib/db':{db:{socialConnection:{findMany:async args=>{assert.equal(args.take,100);assert.ok(args.where.AND.some(c=>JSON.stringify(c).includes('lastReportingCheckAt')));return[{id:'inactive',calendarId:'expired'}];},updateMany:async args=>{checked=args;return{count:1};}}}},'@/lib/calendarPermissions':{canAccessCalendarById:async()=>false}});
 assert.equal(await api.scheduleReportingSync(),0);assert.ok(checked.data.lastReportingCheckAt instanceof Date);assert.equal(checked.data.lastSyncAttemptAt,undefined);assert.equal(checked.data.lastSyncAt,undefined);
});
