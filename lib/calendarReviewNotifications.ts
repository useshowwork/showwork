import { effectiveTeamPermissions } from '@/lib/calendarTeamPolicy';
import type { NativeApplicationContext } from '@/lib/publishing/nativeApplicationContext';

export type ReviewNotice = {calendarId:string;postId:string;version:number;action:string;note:string|null};
type Recipient = {email:string;owner:boolean;role:string;permissions:string[];customPermissions:boolean};
export function workflowRecipients(rows: Recipient[]) {
 return [...new Set(rows.filter(row => row.owner || effectiveTeamPermissions(row.role,row.permissions,row.customPermissions)
  .some(permission=>['internal_review.manage','calendar.edit','creatives.upload','delivery.manage','publishing.manage','workspace.manage'].includes(permission)))
  .map(row=>row.email.trim().toLowerCase()).filter(Boolean))];
}
export async function notifyInternalReview(
 event:ReviewNotice,
 query:(sql:string,args:unknown[])=>Promise<{rows:any[]}>,
 transport?:NativeApplicationContext['notify'],
) {
 try {
  const rows = (await query(`SELECT c.email, true AS owner, 'OWNER' AS role, ARRAY[]::text[] AS permissions, false AS "customPermissions"
    FROM "SocialCalendar" w JOIN "Creator" c ON c.id=w."managerId" WHERE w.id=$1 AND c."isDeactivated"=false
    UNION ALL SELECT c.email, false AS owner, m.role::text, m.permissions, m."customPermissions"
    FROM "CalendarCollaborator" m JOIN "Creator" c ON c.id=m."creatorId" WHERE m."calendarId"=$1 AND c."isDeactivated"=false`,[event.calendarId])).rows;
  const recipients = [...new Set(rows.map(row => String(row.email ?? "").trim().toLowerCase()).filter(Boolean))];
  const feedbackRecipients = new Set(workflowRecipients(rows));
  const { sendInternalReviewEmail } = await import("@/lib/resend");
  const results=await Promise.allSettled(recipients.map(async to=>{
   // The same review version and recipient use the same provider idempotency key.
   for(let attempt=0;attempt<3;attempt++) {
    try {await sendInternalReviewEmail({...event,to,note:feedbackRecipients.has(to) ? event.note : null},transport);return;}
    catch(error) {if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));}
   }
  }));
  const failed=results.filter(result=>result.status==='rejected').length;
  if(failed)console.warn('[Internal review email] delivery incomplete',{failed,total:recipients.length});
  return {sent:recipients.length-failed,failed};
 } catch {console.warn('[Internal review email] notification unavailable');return {sent:0,failed:1};}
}
