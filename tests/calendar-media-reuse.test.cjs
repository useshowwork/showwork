const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('lib/calendarMediaReuse.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(mod.exports);
const { mediaDestinationLocked, sameDayMediaDestinations, reusePostMedia } = mod.exports;
const asset = (id) => ({id, fileKey:id, mediaType:'PHOTO', contentUrl:`https://example.com/${id}`});
const post = (id, extra={}) => ({id,postDate:'2026-11-15T11:00:00Z',approvalStatus:'PENDING',caption:'Original copy',assets:[], ...extra});
const source = post('source', { assets:[asset('graphic'),asset('second')] });
function harness(destination, fail) {
  const calls=[], updates=[];
  let current = structuredClone(destination);
  return {calls, updates, async request(url, init) {
    calls.push({url,...init});
    if (fail?.(url,init)) return Response.json({error:'Rejected'}, {status:409});
    if(init.method === 'POST') {
      const body=JSON.parse(init.body);
      current={...current, assets:[...current.assets,asset(body.fileKey)]};
      return Response.json({post:current});
    }
    current={...current,assets:current.assets.filter(a=>!url.endsWith(`/${a.id}`))};
    return Response.json({ok:true});
  }, onUpdated(updated) {updates.push(updated);} };
}
const apply = (destination, h, extra={}) => reusePostMedia({calendarId:'workspace', source, destination, fileKeys:['graphic'],replace:false,canReplace:false, ...h, ...extra});
test('same-day destinations exclude source, other dates and unconfirmed drafts, and sort by time',()=>{
  const early=post('early',{postDate:'2026-11-15T09:00:00Z'}), late=post('late',{postDate:'2026-11-15T19:00:00Z'});
  assert.deepEqual(sameDayMediaDestinations(source,[late,source,post('draft',{isAiDraft:true}),post('tomorrow',{postDate:'2026-11-16T11:00:00Z'}),early]).map(p=>p.id),['early','late']);
});
test('approved and all platform publishing states are locked',()=>{
  assert.equal(mediaDestinationLocked(post('p')),false);
  assert.equal(mediaDestinationLocked(post('p',{approvalStatus:'APPROVED'})),true);
  for(const key of ['publishStatus','instagramPublishStatus','tikTokPublishStatus']) for(const status of ['SCHEDULED','PUBLISHING','PUBLISHED']) assert.equal(mediaDestinationLocked(post('p',{[key]:status})),true);
});
test('reuses file reference, preserves copy and existing media, and skips duplicate retry',async()=>{
  const dest=post('dest',{assets:[asset('old')]}); const h=harness(dest);
  const updated=await apply(dest,h);
  assert.equal(h.calls.length,1);
  assert.deepEqual(JSON.parse(h.calls[0].body),{sourcePostId:'source',fileKey:'graphic'});
  assert.equal(updated.caption,'Original copy');
  assert.deepEqual(updated.assets.map(a=>a.fileKey),['old','graphic']);
  await apply(updated,h);
  assert.equal(h.calls.length,1);
});
test('replacement attaches every selected file before removing old media',async()=>{
  const dest=post('dest',{assets:[asset('old')]}); const h=harness(dest);
  const result=await apply(dest,h,{fileKeys:['graphic','second'],replace:true,canReplace:true});
  assert.deepEqual(h.calls.map(c=>c.method),['POST','POST','DELETE']);
  assert.deepEqual(result.assets.map(a=>a.fileKey),['graphic','second']);
});
test('partial attachment failure keeps original files and reports already saved progress',async()=>{
  const dest=post('dest',{assets:[asset('old')]}); const h=harness(dest,(_,init)=>init.body?.includes('second'));
  await assert.rejects(apply(dest,h,{fileKeys:['graphic','second'],replace:true,canReplace:true}),/Rejected/);
  assert.deepEqual(h.calls.map(c=>c.method),['POST','POST']);
  assert.deepEqual(h.updates[0].assets.map(a=>a.fileKey),['old','graphic']);
});
test('locked posts, missing source files and unauthorized replacements make no requests',async()=>{
  for(const [dest,extra] of [[post('locked',{approvalStatus:'APPROVED'}),{}],[post('dest'),{fileKeys:[]}],[post('dest'),{fileKeys:['missing']}],[post('dest'),{replace:true}]]) {
    const h=harness(dest); await assert.rejects(apply(dest,h,extra)); assert.equal(h.calls.length,0);
  }
});
test('failed removal preserves newly attached media and can be retried without reattaching',async()=>{
 const dest=post('dest',{assets:[asset('old')]}); const h=harness(dest,(_,init)=>init.method==='DELETE');
 await assert.rejects(apply(dest,h,{replace:true,canReplace:true}),/Rejected/);
 assert.deepEqual(h.updates[0].assets.map(a=>a.fileKey),['old','graphic']);
 const retry=harness(h.updates[0]);
 await apply(h.updates[0],retry,{replace:true,canReplace:true});
 assert.deepEqual(retry.calls.map(c=>c.method),['DELETE']);
});
