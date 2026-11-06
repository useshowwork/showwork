const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {load}=require('./helpers/load-typescript.cjs');
const sections=[{id:'photos',name:'Photos',count:2,pending:1,revisions:1,approved:0},{id:'ungrouped',name:'Other files',count:1,pending:0,revisions:0,approved:1}];
function render(overrides={}){
 let state=0;const changes=[];const Studio=load('components/projects/DeliveryWorkStudio.tsx',{react:{...React,useState(initial){const index=state++;return[Object.hasOwn(overrides,index)?overrides[index]:initial,value=>changes.push({index,value})];}}}).default;
 const nodes=[];function visit(node){if(!node||typeof node!=='object')return;nodes.push(node);React.Children.forEach(node.props?.children,visit);}
 visit(Studio({sections,uploadAction:React.createElement('button',null,'Upload'),releasePanel:React.createElement('div',null,'Release settings'),children:sections.map(section=>React.createElement('div',{key:section.id,'data-delivery-section':section.id},section.name))}));return{nodes,changes};
}
test('delivery sections and ungrouped media remain mounted with only the selected one visible',()=>{
 const view=render();const panels=view.nodes.filter(node=>node.props['data-filter']);assert.equal(panels.length,2);assert.deepEqual(panels.filter(node=>!node.props.hidden).map(node=>node.props.id),['delivery-files-photos']);
 const other=render({0:'ungrouped'});assert.ok(other.nodes.some(node=>node.props.id==='delivery-files-ungrouped'&&!node.props.hidden));
});
test('status filters scope the file panels without dropping release or upload controls',()=>{
 const view=render({1:'NEEDS_REVISION'});assert.ok(view.nodes.filter(node=>node.props['data-filter']).every(node=>node.props['data-filter']==='NEEDS_REVISION'));assert.ok(view.nodes.some(node=>node.type==='details'));assert.ok(view.nodes.some(node=>node.type==='button'&&node.props.children==='Upload'));
});
test('section changes pause playback before selecting the next gallery',()=>{
 const view=render();const previous=global.document;let paused=0;global.document={getElementById:()=>({querySelectorAll:()=>[{pause(){paused++;}}]})};
 try{view.nodes.find(node=>node.type==='button'&&node.props['aria-controls']==='delivery-files-ungrouped').props.onClick();assert.equal(paused,1);assert.deepEqual(view.changes,[{index:0,value:'ungrouped'}]);}finally{global.document=previous;}
});
