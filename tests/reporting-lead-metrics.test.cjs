const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/load-typescript.cjs');
const Metrics=load('components/calendars/ReportingLeadMetrics.tsx').default;
const render=leads=>renderToStaticMarkup(React.createElement(Metrics,{leads}));
test('lead analytics prominently show totals, hot opportunities and converted customers',()=>{
 const html=render({total:120,acquired:{value:6},hotCount:8,customers:4,hottest:[{name:'Private contact'}]});
 for(const label of ['New leads','Hot leads','Converted customers','Marked as customers during the selected period'])assert.ok(html.includes(label));
 for(const count of [6,8,4])assert.ok(html.includes(`<strong>${count}</strong>`));
 assert.doesNotMatch(html,/Private contact/);
});
test('real zero lead counts remain visible as zero',()=>{
 const html=render({total:0,acquired:{value:0},hotCount:0,customers:0});assert.equal((html.match(/<strong>0<\/strong>/g)||[]).length,3);assert.doesNotMatch(html,/NaN|undefined/);
});

test('untracked historical hot and conversion counts show an explanation instead of false zeroes',()=>{
 const html=render({total:20,acquired:{value:3},hotCount:null,customers:null,historyStartedAt:'2026-11-13T17:00:00Z',milestoneCountsAvailable:false});
 assert.equal((html.match(/<strong>—<\/strong>/g)||[]).length,2);assert.match(html,/Earlier stage-change dates are unavailable/);assert.match(html,/<strong>3<\/strong>/);
});

test('current customer fallback renders the real total rather than a dash and explains date limitations',()=>{
 const html=render({total:10,acquired:{value:2},hotCount:0,customers:1,milestoneBasis:'current',milestoneCountsAvailable:false});
 assert.match(html,/Current customers/);assert.match(html,/<strong>1<\/strong>/);assert.doesNotMatch(html,/<strong>—/);assert.match(html,/not filtered by date/);
});
test('partially tracked conversion totals remain visible with the tracking start explained',()=>{
 const html=render({total:10,acquired:{value:2},hotCount:1,customers:1,milestoneBasis:'tracked-period',historyStartedAt:'2026-11-03T12:00:00Z'});
 assert.match(html,/Converted customers/);assert.match(html,/Recorded conversions within this period/);assert.match(html,/Showing recorded hot-lead changes and conversions from/);assert.doesNotMatch(html,/<strong>—/);
});
