import { notifyInternalReview } from "@/lib/calendarReviewNotifications";
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCreator } from '@/lib/auth';
import { hasCalendarPermission } from '@/lib/calendarPermissions';
import { db } from '@/lib/db';
import { internalReviewError, internalReviewInput } from '@/lib/calendarInternalReview';
import { publicUrlFor } from '@/lib/r2';
import { publishingIntegrationInstalled, invokePublishingEntrypoint } from '@/lib/publishing/applicationBoundary';

export async function POST(req: NextRequest, context: {params: Promise<{id: string; postId: string}>}) {
  if (publishingIntegrationInstalled()) return invokePublishingEntrypoint<NextResponse>('app/api/calendars/[id]/posts/[postId]/internal-review/route.ts#POST', [req, context]);
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({error:'Unauthorized'}, {status:401});
  const {id, postId} = await context.params;
  if (!await hasCalendarPermission(creator.id,id,'internal_review.manage')) return NextResponse.json({error:'You do not have permission for internal reviews.'},{status:403});

  try {
    const decision = internalReviewInput(await req.json());
    const post = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "CalendarPost" WHERE id=${postId} AND "calendarId"=${id} FOR UPDATE`;
      const current = await tx.calendarPost.findFirst({where:{id:postId,calendarId:id}});
      if (!current) throw new Error('Post not found');
      const error = internalReviewError(current, decision.status);
      if (error) throw new Error(error);
      if (current.internalReviewVersion !== decision.version) throw new Error('This post changed. Refresh and review the latest version.');
      // Confirm first inside this transaction: the content-change trigger resets
      // review state when isAiDraft changes. Approve only after that reset.
      if (current.isAiDraft && decision.status === "APPROVED") await tx.calendarPost.update({where:{id:postId},data:{isAiDraft:false}});
      return tx.calendarPost.update({where:{id:postId},data:{internalReviewStatus:decision.status ?? current.internalReviewStatus,internalReviewNote:decision.note,
        internalReviewedAt:decision.status === undefined ? current.internalReviewedAt : new Date(),internalReviewedBy:decision.status === undefined ? current.internalReviewedBy : creator.id,internalReviewVersion:{increment:1}},
        include:{assets:{orderBy:{displayOrder:'asc'}},videoComments:true,customFields:true}});
    });
    const notifications = await notifyInternalReview({calendarId:id,postId,version:post.internalReviewVersion,action:decision.status === undefined ? 'feedback' : decision.status==='APPROVED'?'approve':decision.status==='NEEDS_CHANGES'?'request_changes':'reopen',note:decision.note},async(sql,args)=>({rows:await db.$queryRawUnsafe<any[]>(sql,...args)}));
    return NextResponse.json({notifications,post:{...post,assets:post.assets.map(a=>({...a,sizeBytes:Number(a.sizeBytes),contentUrl:publicUrlFor(a.fileKey)}))}});
  } catch(error) {
    const message = error instanceof Error ? error.message : 'Unable to save internal review.';
    return NextResponse.json({error:message},{status:message==='Post not found'?404:message.startsWith('INVALID_')||message.includes('note is required')?400:409});
  }
}
