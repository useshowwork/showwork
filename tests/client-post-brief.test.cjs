const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/load-typescript.cjs');
const {clientPostBrief}=load('lib/clientPostBrief.ts');
const {withoutInternalReview}=load('lib/calendarInternalReview.ts');
const brief={version:2,format:'Static graphic',title:'Launch story',caption:'Audience copy',creativeDirection:'Warm editorial photography',objective:'Build awareness',targetAudience:'Small studio owners',keyMessage:'A clearer handoff',reviewWarnings:['Private review warning'],internalNote:'Private note'};
test('client projection retains incomplete brief fields and drops internal warnings and unknown fields',()=>{
 const result=clientPostBrief(brief);
 assert.equal(result.creativeDirection,brief.creativeDirection);assert.equal(result.targetAudience,brief.targetAudience);assert.equal(result.hook,'');
 assert.equal(result.reviewWarnings,undefined);assert.equal(result.internalNote,undefined);
 for(const value of [null,[],{},'invalid'])assert.equal(clientPostBrief(value),null);
 const response=withoutInternalReview({id:'post',internalReviewNote:'Private team note',internalReviewedBy:'manager',creativeBrief:brief});
 assert.doesNotMatch(JSON.stringify(response),/Private|internalReviewedBy/);
 assert.equal(response.creativeBrief.objective,brief.objective);
});
function render(section='content',creativeBrief=clientPostBrief(brief)) {
 const View=load('components/calendars/ClientCalendarView.tsx',{
  'next/navigation':{useRouter:()=>({refresh(){}})},
  react:{...React,useState:initial=>React.useState(initial==='content'?section:initial)},
 }).default;
 return renderToStaticMarkup(React.createElement(View,{slug:'calendar',clientName:'Client',planStatus:'PLAN_APPROVED',initialPostId:'post',posts:[{id:'post',postDate:'2026-11-13T10:00:00Z',platform:'X',postType:'Text',approvalStatus:'PENDING',caption:'Audience copy',creativeBrief,assets:[],videoComments:[],customFields:[]}]}));
}
test('client review offers accessible content, creative direction and strategy buttons',()=>{
 const html=render();
 assert.equal((html.match(/role="tab"/g)||[]).length,3);
 for(const name of ['content','creative','strategy'])assert.match(html,new RegExp(`id="client-post-tab-${name}"`));
 assert.match(html,/role="tabpanel" aria-labelledby="client-post-tab-content"/);
 assert.match(html,/Post title/);assert.match(html,/Launch story/);assert.match(html,/Caption/);
 assert.doesNotMatch(html,/Private review warning/);
});
test('creative section shows shared direction without editing controls',()=>{
 const html=render('creative');
 assert.match(html,/Warm editorial photography/);assert.match(html,/client-post-tab-creative/);
 assert.doesNotMatch(html,/>Save changes<|Improve with AI/);
});
test('strategy section shows objective and audience without inventing missing context',()=>{
 const html=render('strategy');assert.match(html,/Build awareness/);assert.match(html,/Small studio owners/);assert.match(html,/A clearer handoff/);
 const empty=render('strategy',null);assert.match(empty,/hasn’t added strategy details yet/);
});
