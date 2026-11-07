const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const mod = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('lib/socialMessaging/meta.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(mod.exports);
const { sendMetaInboxMessage, MetaMessagingWindowClosedError } = mod.exports;
const input = { connection: { platform: 'INSTAGRAM', status: 'CONNECTED', accessToken: 'test' }, instagramPageId: 'page', recipientId: 'recipient', text: 'Hello' };
test('closed Meta reply window yields an actionable typed error', async () => {
  global.fetch = async () => Response.json({ error: { code: 10, error_subcode: 2534022, message: 'Outside allowed window' } }, { status: 400 });
  await assert.rejects(sendMetaInboxMessage(input), error => {
    assert.ok(error instanceof MetaMessagingWindowClosedError);
    assert.equal(error.code, 'MESSAGING_WINDOW_CLOSED');
    assert.match(error.message, /after this person sends you another message/);
    return true;
  });
});
test('other permission errors retain Meta diagnostics', async () => {
  global.fetch = async () => Response.json({ error: { code: 10, message: 'Missing permission' } }, { status: 403 });
  await assert.rejects(sendMetaInboxMessage(input), error => {
    assert.ok(!(error instanceof MetaMessagingWindowClosedError));
    assert.match(error.message, /Missing permission.*code=10/);
    return true;
  });
});
test('confirmed sends return the provider message ID', async () => {
  global.fetch = async () => Response.json({ message_id: 'sent-message' });
  assert.equal(await sendMetaInboxMessage(input), 'sent-message');
});
test('Messenger team offers have Yes/No quick replies while Instagram retains a text fallback',async()=>{
 let body;global.fetch=async(_url,init)=>{body=JSON.parse(init.body);return Response.json({message_id:'offer'});};
 await sendMetaInboxMessage({...input,connection:{...input.connection,platform:'FACEBOOK',platformAccountId:'page'},offerHandoff:true});
 assert.deepEqual(body.message.quick_replies.map(item=>item.title),['Yes, connect me','No, keep helping']);
 await sendMetaInboxMessage({...input,offerHandoff:true});assert.equal(body.message.quick_replies,undefined);
});
test('outbound Meta payload preserves real paragraph breaks exactly',async()=>{
 let body;global.fetch=async(_url,init)=>{body=JSON.parse(init.body);return Response.json({message_id:'formatted'});};
 const text='The package includes ten edited photos.\n\nYou can pay through our official checkout link.\n\nWhich date would you prefer?';
 await sendMetaInboxMessage({...input,text});assert.equal(body.message.text,text);
});
