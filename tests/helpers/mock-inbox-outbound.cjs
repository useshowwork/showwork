// Worker policy tests isolate external send tracking. Its real implementation is tested separately.
exports.outboundMock = db => ({
 reconcileStaleInboxSends:async()=>{},findInboxSend:async()=>null,
 sendDurableInboxReply:async input=>{
  if(input.takeover)await db.socialLeadConversation.update({where:{id:input.conversationId},data:{aiPausedAt:new Date()}});
  if(input.beforeSend&&!await input.beforeSend())return {state:'CANCELLED'};
  await input.send();
  if(db.$transaction)await db.$transaction(async()=>{});
  return {state:'SENT',messageId:'out'};
 },
});
