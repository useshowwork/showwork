const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-typescript.cjs');
const {formatInboxReply}=load('lib/socialMessaging/replyFormatting.ts');
const flatten=value=>value.replace(/\s+/g,' ').trim();
test('dense replies gain readable paragraphs without changing words, punctuation, prices or URLs',()=>{
 const original='Our portrait package is ₦50,000.00 and includes ten edited photographs delivered through your private gallery. You can choose your preferred date after reviewing the available options on our booking page. Please use https://payments.example.test/checkout?amount=50000.00 to make your deposit securely. Your reference is SW-2026-001 and the approved business account is 0123456789. Which date would you prefer?';
 const result=formatInboxReply(original);assert.match(result,/\n\n/);assert.equal(flatten(result),flatten(original));
 for(const value of ['₦50,000.00','https://payments.example.test/checkout?amount=50000.00','SW-2026-001','0123456789'])assert.ok(result.includes(value),value);
});
test('short answers, existing paragraphs, steps and bank-detail blocks stay intact',()=>{
 for(const value of ['Yes, we are open today.','Here are the details:\nBank: Example Bank\nAccount: 0123456789','1. Choose your package.\n2. Use the official checkout link.','Thanks for checking.\n\nWhich date would you prefer?'])assert.equal(formatInboxReply(value),value);
});
test('CRLF, extra spaces and excessive blank lines normalise without inventing punctuation',()=>{
 assert.equal(formatInboxReply('  Hello,  Ada.\r\n\r\n\r\nHow can I help?  '),'Hello, Ada.\n\nHow can I help?');
 const value=Array.from({length:80},(_,index)=>`word${index}`).join(' ');assert.match(formatInboxReply(value),/\n\n/);assert.equal(flatten(formatInboxReply(value)),value);
});
test('formatting is idempotent',()=>{
 const value=('This is an example sentence explaining the available options in a clear and friendly way. ').repeat(8);
 assert.equal(formatInboxReply(formatInboxReply(value)),formatInboxReply(value));
});
