import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { canAccessCalendarById, hasCalendarPermission } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { buildCaption, publishingStatus, statusUpdate, statusWhere, validatePublishContent } from "@/lib/publishing/state";
import { authorizeTikTokPost } from "@/lib/tiktokAuthorization";

/* canonical-only-reader */
export async function GET(req: NextRequest, context: {params:Promise<{id:string;postId:string}>}) {
  if (!publishingIntegrationInstalled()) return NextResponse.json({protocol:'legacy'},{headers:{'Cache-Control':'no-store'}});
  return invokePublishingEntrypoint<Response>('app/api/calendars/[id]/posts/[postId]/publish/route.ts#GETcanonical', [req,context]);
}
/* end-canonical-only-reader */

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/posts/[postId]/publish/route.ts#POST@8",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, postId } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "publishing.manage")) || !(await canAccessCalendarById(id))) return NextResponse.json({ error: "You cannot publish in this workspace." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body || !["save", "schedule", "publish", "cancel", "retry"].includes(body.action)) return NextResponse.json({ error: "Choose a publishing action." }, { status: 400 });
  const post = await db.calendarPost.findFirst({ where: { id: postId, calendarId: id, deletedAt: null }, include: { assets: true } });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (post.platform === "TIKTOK") return authorizeTikTokPost(post, creator.id, body);
  if (!["schedule", "cancel", "retry"].includes(body.action)) return NextResponse.json({ error: "Unsupported publishing action." }, { status: 400 });
  const status = publishingStatus(post);
  if (["PUBLISHING", "PUBLISHED"].includes(status)) return NextResponse.json({ error: "This post is already publishing or published." }, { status: 409 });
  if (body.action === "cancel" && status !== "SCHEDULED") return NextResponse.json({ error: "This post is not scheduled." }, { status: 409 });
  if (body.action !== "cancel") {
    if (post.approvalStatus !== "APPROVED" || post.internalReviewStatus !== "APPROVED" || post.isAiDraft) return NextResponse.json({ error: "Internal and client approval are required before publishing." }, { status: 409 });
    if (status === "FAILED" && (body.action !== "retry" || body.confirmedNotPublished !== true)) return NextResponse.json({ error: "Check the platform first and confirm this post has not already published." }, { status: 409 });
    if (!await db.socialConnection.findFirst({ where: { calendarId: id, platform: post.platform, status: "CONNECTED" } })) return NextResponse.json({ error: "Connect this channel first." }, { status: 409 });
    try {
      validatePublishContent(post.platform, post.assets, buildCaption(post), post.postType, !post.creativeBrief || !!post.caption?.trim());
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid content" }, { status: 400 }); }
  }
  const updated = await db.calendarPost.updateMany({ where: { id: postId, deletedAt: null, updatedAt: post.updatedAt, ...statusWhere(post.platform, status), approvalStatus: post.approvalStatus }, data: {
    ...statusUpdate(post.platform, body.action === "cancel" ? "NOT_SCHEDULED" : "SCHEDULED"), publishWorkerStartedAt: null,
  } });
  if (!updated.count) return NextResponse.json({ error: "Post status changed. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
