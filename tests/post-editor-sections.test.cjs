const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/load-typescript.cjs');
const Editor=load('components/calendars/CreativeBriefEditor.tsx').default;
const brief={version:2,format:'Carousel',title:'Campaign handoff',hook:'Start with clarity',objective:'Help the team agree on a direction',targetAudience:'Studio leads',caption:'Our audience-facing caption',creativeDirection:'A warm editorial concept',suggestedCta:'Learn more',hashtags:'#studio',coreIdea:'Clear handoffs',keyMessage:'Clarity matters',desiredResponse:'Discuss',brandConnection:'Our service',pillar:'Delivery'};
const render=guidedSection=>renderToStaticMarkup(React.createElement(Editor,{calendarId:'calendar',post:{id:'post',platform:'INSTAGRAM',creativeBrief:brief},guided:true,guidedSection,readOnly:true,onSaveReady:()=>{},onUpdated:()=>{}}));
test('Content keeps title, caption and hashtags together without mixing in strategy fields',()=>{
 const html=render('copy');
 for(const field of ['title','caption','hashtags'])assert.match(html,new RegExp(`id="post-${field}"`));
 assert.match(html,/Our audience-facing caption/);assert.match(html,/#studio/);
 assert.doesNotMatch(html,/id="post-objective"|id="post-creativeDirection"/);
});
test('Creative brief exposes strategy and direction without repeating audience-facing copy',()=>{
 const html=render('brief');
 for(const field of ['objective','targetAudience','creativeDirection'])assert.match(html,new RegExp(`id="post-${field}"`));
 assert.match(html,/A warm editorial concept/);
 assert.doesNotMatch(html,/id="post-caption"|id="post-hashtags"/);
 assert.equal((html.match(/<details[^>]*open=""/g)||[]).length,2);
});
test('existing guided editors retain all sections when no section filter is provided',()=>{
 const html=render(undefined);
 for(const field of ['title','caption','hashtags','objective','creativeDirection'])assert.match(html,new RegExp(`id="post-${field}"`));
});
