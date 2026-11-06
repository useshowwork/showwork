const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {load}=require('./helpers/load-typescript.cjs');
function editor(){
 const updates=[];let refreshes=0;
 const Form=load('components/portfolio/PortfolioDetailsForm.tsx',{
  react:{...React,useState(initial){let value=typeof initial==='function'?initial():initial;if(typeof value==='string'&&value.startsWith('{"companyName"'))value='previously-saved';return[value,next=>updates.push(next)];}},
  'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},
 }).default;
 const tree=Form({companyName:'Studio',bannerCandidates:[],bioSkills:[]});
 const nodes=[];function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,visit);}visit(tree);
 return {nodes,updates,refreshes:()=>refreshes,save:()=>nodes.find(node=>node.type==='button'&&node.props.className==='saveButton').props.onClick()};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('identity editor exposes four accessible sections and only Basics is initially visible',()=>{
 const {nodes}=editor();const tabs=nodes.filter(node=>node.props.role==='tab');assert.equal(tabs.length,4);assert.equal(tabs.filter(node=>node.props['aria-selected']).length,1);
 const panels=nodes.filter(node=>node.props.role==='tabpanel');assert.equal(panels.length,4);assert.deepEqual(panels.filter(node=>!node.props.hidden).map(node=>node.props.id),['identity-panel-basics']);
 for(const tab of tabs)assert.ok(panels.some(panel=>panel.props.id===tab.props['aria-controls']));
});
test('failed saves keep edits and show the server error without refreshing or marking saved',async()=>{
 const original=global.fetch;global.fetch=async()=>Response.json({error:'Storage unavailable'},{status:503});
 try{const form=editor();form.save();await flush();assert.ok(form.updates.includes('Storage unavailable'));assert.equal(form.refreshes(),0);assert.ok(!form.updates.some(value=>typeof value==='string'&&value.startsWith('{"companyName"')));assert.equal(form.updates.at(-1),false);}finally{global.fetch=original;}
});
test('successful saves persist identity and media fields before marking saved',async()=>{
 const original=global.fetch;let sent;
 global.fetch=async(url,options)=>{assert.equal(url,'/api/portfolio');assert.equal(options.method,'PATCH');sent=JSON.parse(options.body);return Response.json({ok:true});};
 try{const form=editor();form.save();await flush();assert.equal(sent.companyName,'Studio');assert.ok(Object.hasOwn(sent,'heroBannerMobileUrl'));assert.ok(Object.hasOwn(sent,'bioPhotoUrl'));assert.ok(Object.hasOwn(sent,'youtubeUrl'));assert.equal(form.refreshes(),1);assert.ok(form.updates.some(value=>typeof value==='string'&&value.startsWith('{"companyName"')));}finally{global.fetch=original;}
});
