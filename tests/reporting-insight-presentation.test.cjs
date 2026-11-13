const {test}=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/load-typescript.cjs');
const {legacyStrategy,strategy}=require('./fixtures/monthly-strategy.cjs');
const Component=load('components/calendars/ReportingInsights.tsx').default;
const props=(value,extra={})=>({insights:[{id:'one',title:value.title,strategy:value,recommendation:'Brief'}],total:1,analyzing:false,loading:false,canAnalyze:true,canApply:true,access:true,client:false,onAnalyze(){},onApply(){},objective:'',onObjective(){},...extra});
test('long saved recommendations and rationale render completely, with evidence collapsed',()=>{
 const value=legacyStrategy();value.direction='A complete recommendation. '.repeat(35)+'THE FULL RECOMMENDATION ENDS HERE.';value.rationale='The complete reason. '.repeat(20)+'THE REASON ENDS HERE.';value.diagnosis='A challenge. '.repeat(30)+'CHALLENGE ENDS HERE.';
 const html=renderToStaticMarkup(React.createElement(Component,props(value)));
 for(const ending of ['THE FULL RECOMMENDATION ENDS HERE.','THE REASON ENDS HERE.','CHALLENGE ENDS HERE.'])assert.ok(html.includes(ending));
 assert.doesNotMatch(html,/…/);assert.match(html,/<details class="strategyEvidence">/);assert.doesNotMatch(html,/<details[^>]*open/);
 assert.equal((html.match(/<input/g)||[]).length,1);assert.equal((html.match(/Generate next calendar/g)||[]).length,1);
 assert.doesNotMatch(html,/Weekly plan|Channel execution|Campaign context and answers/);
});
test('changed goal explains why calendar application is unavailable',()=>{
 const html=renderToStaticMarkup(React.createElement(Component,props(strategy(),{goalChanged:true,canApply:false})));
 assert.match(html,/Your goal changed. Refresh the strategy above before using it./);
 assert.match(html,/<button[^>]*disabled=""[^>]*>Generate next calendar/);
});
test('shared report shows full insight and evidence without generation controls or goal input',()=>{
 const html=renderToStaticMarkup(React.createElement(Component,props(strategy(),{client:true})));
 assert.doesNotMatch(html,/Generate next calendar|<input/);assert.match(html,/The recommended move/);assert.match(html,/See what shaped this strategy/);
});
