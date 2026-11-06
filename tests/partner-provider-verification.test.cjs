const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');
test('bank verification traverses provider pages and uses the resolved account holder',async()=>{
 const urls=[];const old=process.env.PAYSTACK_SECRET_KEY;process.env.PAYSTACK_SECRET_KEY='test-key';
 try {
 const api=load('lib/paystack.ts',{'./publishing/nativeApplicationContext':{nativeBillingFetch:async(url)=>{urls.push(url);const parsed=new URL(url);const data=parsed.pathname==='/bank/resolve'?{account_number:'0123456789',account_name:'REAL ACCOUNT HOLDER'}:parsed.searchParams.has('next')?[{code:'002',name:'Bank B',active:true}]:[{code:'001',name:'Bank A',active:true}];return{ok:true,json:async()=>({status:true,data,meta:parsed.pathname==='/bank'&&!parsed.searchParams.has('next')?{next:'next-page'}:{next:null}})};}}});
 const verified=await api.resolveNigerianAccount('002','0123456789');assert.equal(verified.accountName,'REAL ACCOUNT HOLDER');assert.equal(verified.bankName,'Bank B');assert.equal(urls.length,3);assert.ok(urls[1].includes('next=next-page'));
 }finally{if(old===undefined)delete process.env.PAYSTACK_SECRET_KEY;else process.env.PAYSTACK_SECRET_KEY=old;}
});
test('a provider response for another account number is rejected',async()=>{
 const old=process.env.PAYSTACK_SECRET_KEY;process.env.PAYSTACK_SECRET_KEY='test-key';try{
 const api=load('lib/paystack.ts',{'./publishing/nativeApplicationContext':{nativeBillingFetch:async url=>({ok:true,json:async()=>({status:true,data:url.includes('/bank/resolve')?{account_number:'wrong',account_name:'NAME'}:[{name:'Bank',code:'001'}],meta:{next:null}})})}});
 await assert.rejects(api.resolveNigerianAccount('001','0123456789'),/Could not verify/);
 }finally{if(old===undefined)delete process.env.PAYSTACK_SECRET_KEY;else process.env.PAYSTACK_SECRET_KEY=old;}
});
