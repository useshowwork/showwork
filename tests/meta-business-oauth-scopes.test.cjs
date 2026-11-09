const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/load-typescript.cjs');

test('business discovery consent is explicitly enabled per app, with other scopes preserved',()=>{
 const keys=['FACEBOOK_APP_ID','FACEBOOK_APP_SECRET','INSTAGRAM_APP_ID','INSTAGRAM_APP_SECRET','INSTAGRAM_REQUEST_BUSINESS_MANAGEMENT_SCOPE','FACEBOOK_REQUEST_BUSINESS_MANAGEMENT_SCOPE'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {
  for(const key of keys.slice(0,4))process.env[key]='test-value';
  const mocks={'@/lib/publishing/applicationBoundary':{},'@/lib/publishing/executionContext':{publishingFetch:global.fetch}};
  const instagram=load('lib/instagram.ts',mocks);
  const facebook=load('lib/channelOAuth.ts',mocks);
  for(const ig of [undefined,'false','true']) for(const fb of [undefined,'false','true']) {
   for(const [key,value] of [['INSTAGRAM_REQUEST_BUSINESS_MANAGEMENT_SCOPE',ig],['FACEBOOK_REQUEST_BUSINESS_MANAGEMENT_SCOPE',fb]]) {
    if(value===undefined)delete process.env[key];else process.env[key]=value;
   }
   const options={redirectUri:'https://showwork.test/callback',state:'signed-state'};
   const igURL=new URL(instagram.buildInstagramAuthUrl(options));
   const fbURL=new URL(facebook.buildChannelAuthorizationUrl({...options,channel:'facebook'}));
   assert.equal(igURL.searchParams.get('scope').split(',').includes('business_management'),ig==='true');
   assert.equal(fbURL.searchParams.get('scope').split(',').includes('business_management'),fb==='true');
   for(const url of [igURL,fbURL]) {
    assert.equal(url.hostname,'www.facebook.com');assert.equal(url.searchParams.get('state'),'signed-state');assert.equal(url.searchParams.get('auth_type'),'rerequest');
    assert.ok(url.searchParams.get('scope').includes('pages_show_list'));assert.ok(!url.searchParams.get('scope').includes('ads_management'));assert.ok(!url.searchParams.get('scope').includes('ads_read'));
   }
   assert.ok(igURL.searchParams.get('scope').includes('instagram_basic'));assert.ok(fbURL.searchParams.get('scope').includes('pages_manage_posts'));
  }
 } finally {for(const [k,v]of Object.entries(original))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
