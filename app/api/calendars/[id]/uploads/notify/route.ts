import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { uploadNoticeBatchId, verifiedUploadNoticePosts } from "@/lib/calendarUploadNotice";
import { notifyCalendarWorkflow } from "@/lib/calendarWorkflowEmails";
import { invokePublishingEntrypoint, publishingIntegrationInstalled } from "@/lib/publishing/applicationBoundary";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (publishingIntegrationInstalled()) return invokePublishingEntrypoint<Response>("app/api/calendars/[id]/uploads/notify/route.ts#POST", [request, context]);
  const { id } = await context.params;
  const actor = await getCurrentCreator();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasCalendarPermission(actor.id, id, "ADD_CONTENT")) return NextResponse.json({ error: "You cannot upload to this calendar." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const batchId = uploadNoticeBatchId(body?.batchId);
  const uploadPostIds = batchId && verifiedUploadNoticePosts(id, actor.id, batchId, body.receipts);
  if (!uploadPostIds) return NextResponse.json({ error: "Invalid upload receipts." }, { status: 400 });
  await notifyCalendarWorkflow({
    kind: "uploaded", calendarId: id, key: `${actor.id}-${batchId}`, actorId: actor.id, uploadPostIds, timeZone: body.timeZone,
  });
  return NextResponse.json({ ok: true });
}
