const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');
const {mergeDraftSnapshots,draftTitle,reviewDraftBatch}=load('lib/content/draftReview.ts');
test('refresh updates existing draft fields rather than only appending new posts',()=>{
 const result=mergeDraftSnapshots([{id:'a',updatedAt:'2026-11-06',objective:''}],[{id:'a',updatedAt:'2026-11-07',objective:'Complete objective'},{id:'b',updatedAt:'2026-11-07',objective:'New draft'}]);assert.equal(result[0].objective,'Complete objective');assert.equal(result.length,2);
});
test('stale snapshots cannot restore locally reviewed posts or overwrite newer saves',()=>{
 const current=[{id:'a',updatedAt:'2026-11-07',caption:'Latest'}];const incoming=[{id:'a',updatedAt:'2026-11-06',caption:'Stale'},{id:'removed',caption:'Already reviewed'}];assert.deepEqual(mergeDraftSnapshots(current,incoming,new Set(['removed'])),current);
});
test('queue titles use content instead of the format fallback',()=>{assert.equal(draftTitle({creativeBrief:{title:'Reel'},postType:'Reel',caption:'Useful headline\nMore copy'}),'Useful headline');});
test('bulk review uses bounded concurrency and preserves successes on partial failure',async()=>{
 let active=0,max=0;const done=[];
 const errors=await reviewDraftBatch(['a','b','c','d','e','f'],async id=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,4));active--;if(id==='c')throw Error('Needs attention');},id=>done.push(id),3);
 assert.equal(max,3);assert.equal(done.length,5);assert.deepEqual(errors,[{id:'c',message:'Needs attention'}]);
});
test('explicit legacy completion validates partial edits without fabricating required fields',()=>{
 const {editablePostBrief,parseEditableBrief}=load('lib/content/brief.ts');const value=editablePostBrief({caption:'My edited copy',postType:'Reel'});assert.equal(parseEditableBrief(value).caption,'My edited copy');assert.equal(value.objective,'');assert.throws(()=>parseEditableBrief({...value,caption:'x'.repeat(5001)}));
});
const React=require('react');
test('closing or pressing Escape keeps saved drafts and sends no DELETE',()=>{
 let closed=0,requests=0;const originalFetch=global.fetch;global.fetch=async()=>requests++;
 try{
 const Component=load('components/calendars/AiDraftReviewModal.tsx',{'next/navigation':{useRouter:()=>({push(){},refresh(){}})},react:{...React,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:()=>{}}}).default;
 const tree=Component({calendarId:'calendar',onClose:()=>closed++});
 tree.props.onCancel({preventDefault(){}});assert.equal(closed,1);assert.equal(requests,0);
 tree.props.onClick({target:1,currentTarget:1});assert.equal(closed,2);assert.equal(requests,0);
 }finally{global.fetch=originalFetch;}
});
test('opening a legacy draft schedules no automatic AI generation',()=>{
 const effects=[];let requests=0;const originalFetch=global.fetch;global.fetch=async()=>requests++;
 try{
 const Editor=load('components/calendars/CreativeBriefEditor.tsx',{react:{...React,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useRef:value=>({current:value}),useEffect:fn=>effects.push(fn)}}).default;
 Editor({calendarId:'calendar',post:{id:'legacy',platform:'INSTAGRAM',caption:'Existing content'},onUpdated:()=>{}});
 for(const effect of effects)effect();assert.equal(requests,0);
 }finally{global.fetch=originalFetch;}
});
test('posts can be browsed directly without visiting strategy or creative direction',async()=>{
 let stateIndex=0,selected='a';let writes=0;const navigation=[];
 const rows=['a','b'].map(id=>({id,platform:'INSTAGRAM',postDate:'2026-11-11',postType:'Carousel',caption:'Copy '+id,hook:'Hook '+id,objective:'Goal',targetAudience:'Audience'}));
 const Component=load('components/calendars/AiDraftReviewModal.tsx',{
   react:{...React,useState:initial=>{const i=stateIndex++;return [i===0?'copy':i===1?rows:i===2?selected:typeof initial==='function'?initial():initial,next=>{if(i===2)selected=next;}];},useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:()=>{}},
   'next/navigation':{useRouter:()=>({push:path=>navigation.push(path),refresh(){}})},
   '@/lib/publishing/clientRequests':{calendarMutationFetch:async()=>{writes++;return Response.json({ok:true});}},
 });
 const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
 const find=(tree,label)=>{if(!tree||typeof tree!=='object')return null;if(tree.type==='button'&&text(tree.props.children).startsWith(label))return tree;for(const child of React.Children.toArray(tree.props?.children)){const result=find(child,label);if(result)return result;}return null;};
 const render=()=>{stateIndex=0;return Component.default({calendarId:'calendar',onClose(){}});};
 const originalWindow=global.window;global.window={dispatchEvent(){},confirm:()=>true};
 try{
   const next=find(render(),'Next post');assert.equal(next.props.disabled,false);assert.match(text(next),/Hook b/);next.props.onClick();assert.equal(selected,'b');assert.equal(writes,0);
   find(render(),'Previous post').props.onClick();assert.equal(selected,'a');assert.equal(writes,0);
   rows.splice(1);await find(render(),'Add post & open calendar').props.onClick();await new Promise(r=>setImmediate(r));
   assert.equal(writes,1);assert.deepEqual(navigation,['/dashboard/calendars/calendar?view=content']);
 }finally{global.window=originalWindow;}
});
