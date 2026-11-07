const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');
const {handoffChoice,shouldOfferTeam,withTeamOffer}=load('lib/socialMessaging/handoffConsent.ts');
const current={offeredAt:new Date(),offerMessageId:'offer',latestOutboundId:'offer'};
test('yes/no is only consent when it answers a current tracked offer',()=>{
 assert.equal(handoffChoice('Yes, connect me',current),'yes');assert.equal(handoffChoice('No, keep helping',current),'no');
 assert.equal(handoffChoice('Yes',{}),null);assert.equal(handoffChoice('Yes',{...current,latestOutboundId:'different-question'}),null);
 assert.equal(handoffChoice('Yes',{...current,offeredAt:new Date(Date.now()-25*3600000)}),null);
 assert.equal(handoffChoice('Yes, the package is fine',current),null);
});
test('offer after several replies or uncertainty, without nagging after a refusal or pending offer',()=>{
 assert.equal(shouldOfferTeam({aiReplyCount:1,needsHelp:false}),false);
 assert.equal(shouldOfferTeam({aiReplyCount:3,needsHelp:false}),true);
 assert.equal(shouldOfferTeam({aiReplyCount:1,needsHelp:true}),true);
 assert.equal(shouldOfferTeam({aiReplyCount:10,needsHelp:true,declinedAt:new Date()}),false);
 assert.equal(shouldOfferTeam({aiReplyCount:10,needsHelp:true,offeredAt:new Date()}),false);
 assert.match(withTeamOffer('Helpful answer.'),/Yes, connect me/);assert.match(withTeamOffer('Helpful answer.'),/No, keep helping/);
});
