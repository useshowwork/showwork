const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/load-typescript.cjs');
const Preview=load('components/calendars/InstagramPreview.tsx').default;
const base={id:'post',postDate:'2026-11-13T11:00:00Z',platform:'INSTAGRAM',postType:'Static graphic',caption:'A caption should never impersonate uploaded media',hashtags:'',approvalStatus:'PENDING',assets:[]};
const render=post=>renderToStaticMarkup(React.createElement(Preview,{clientName:'Brand',posts:[post]}));
test('unuploaded media is explicitly identified rather than displaying the caption as a graphic',()=>{
 const html=render(base);assert.match(html,/Awaiting creative/);assert.match(html,/No image or video uploaded/);assert.doesNotMatch(html,/A caption should never impersonate uploaded media/);
 assert.match(html,/Your profile, before you publish/);
});
test('uploaded images and video posters remain visible in the profile grid',()=>{
 const photo=render({...base,assets:[{id:'asset',mediaType:'PHOTO',contentUrl:'https://example.com/graphic.png'}]});
 assert.match(photo,/src="https:\/\/example.com\/graphic.png"/);assert.doesNotMatch(photo,/Awaiting creative/);
 const video=render({...base,assets:[{id:'video',mediaType:'VIDEO',contentUrl:'https://example.com/video.mp4',posterUrl:'https://example.com/poster.jpg'}]});
 assert.match(video,/poster="https:\/\/example.com\/poster.jpg"/);assert.match(video,/src="https:\/\/example.com\/video.mp4"/);
});
