const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {load}=require('./helpers/load-typescript.cjs');
const items=[{id:'pending',clientName:'Alex',clientRole:'Founder',quote:'Excellent work.',rating:5,isApproved:false},{id:'published',clientName:'Sam',clientRole:null,quote:'Would recommend.',rating:null,isApproved:true}];
function render(overrides={}){
 let state=0,refreshes=0;const changes=[];
 const Manager=load('components/portfolio/PortfolioTestimonialsManager.tsx',{
  react:{...React,useRef:()=>({current:null}),useState(initial){const index=state++;return[Object.hasOwn(overrides,index)?overrides[index]:initial,value=>changes.push({index,value})];}},
  'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},
 }).default;
 const nodes=[];function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,visit);}visit(Manager({testimonials:items,collectionUrl:'/testimonial/studio'}));return{nodes,changes,refreshes:()=>refreshes};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('pending reviews are shown first; filters distinguish published feedback',()=>{
 const initial=render();assert.equal(initial.nodes.filter(node=>node.type==='article').length,1);assert.ok(initial.nodes.some(node=>node.type==='h4'&&node.props.children==='Alex'));
 const published=render({0:'published'});assert.ok(published.nodes.some(node=>node.type==='h4'&&node.props.children==='Sam'));assert.ok(!published.nodes.some(node=>node.type==='h4'&&node.props.children==='Alex'));
 assert.equal(render({0:'all'}).nodes.filter(node=>node.type==='article').length,2);
});
test('publishing uses approval endpoint and refreshes only after successful response',async()=>{
 const previous=global.fetch;let payload;
 global.fetch=async(url,options)=>{assert.equal(url,'/api/portfolio/testimonials/pending/approval');payload=JSON.parse(options.body);return Response.json({ok:true});};
 try{const view=render();view.nodes.find(node=>node.type==='button'&&node.props.className==='primary'&&node.props.children.at(-1)==='Publish').props.onClick();await flush();assert.deepEqual(payload,{isApproved:true});assert.equal(view.refreshes(),1);}finally{global.fetch=previous;}
});
test('failed approval reports error without claiming the testimonial was published',async()=>{
 const previous=global.fetch;global.fetch=async()=>Response.json({error:'Please reconnect'},{status:403});
 try{const view=render();view.nodes.find(node=>node.type==='button'&&node.props.className==='primary'&&node.props.children.at(-1)==='Publish').props.onClick();await flush();assert.equal(view.refreshes(),0);assert.ok(view.changes.some(change=>change.index===9&&change.value==='Please reconnect'));assert.ok(!view.changes.some(change=>change.index===10&&change.value.includes('published')));}finally{global.fetch=previous;}
});
test('removing a testimonial asks for confirmation before sending a request',()=>{
 const view=render();view.nodes.find(node=>node.type==='button'&&node.props['aria-label']==='Remove testimonial from Alex').props.onClick();assert.deepEqual(view.changes,[{index:8,value:'pending'}]);
 const confirmed=render({8:'pending'});assert.ok(confirmed.nodes.some(node=>node.props['aria-label']==='Confirm testimonial removal'));
});
