import { notifyCalendarWorkflow } from "@/lib/calendarWorkflowEmails";
import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed } from "@/lib/publishing/applicationBoundary";
import { canAccessCalendarById } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyViewerToken } from "@/lib/auth";

function cookieNameFor(calendarId: string) {
  return `calendar_viewer_${calendarId}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/social-calendar/[slug]/respond/route.ts#POST@10",Array.from(arguments)); } /* end-canonical-integration-boundary */

  const { slug } = await params;
  const calendar = await db.socialCalendar.findUnique({ where: { slug } });
  if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Confirms this specific visitor actually unlocked this specific
  // calendar with its real password — not just anyone who happens to
  // know the URL.
  const token = req.cookies.get(cookieNameFor(calendar.id))?.value;
  const viewer = token ? verifyViewerToken(token, calendar.id) : null;
  if (!viewer) {
    return NextResponse.json({ error: "Please unlock this calendar first" }, { status: 401 });
  }

  if (!(await canAccessCalendarById(calendar.id))) return NextResponse.json({ error: "This workspace is read-only. Ask the owner to subscribe or upgrade to resume approvals and feedback." }, { status: 403 });

  if (calendar.planStatus !== "AWAITING_APPROVAL") {
    return NextResponse.json({ error: "This plan isn't currently awaiting a response" }, { status: 400 });
  }

  const { action, note } = await req.json();

  if (action !== "approve" && action !== "request_changes") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const approved = action === "approve";
  const reviewedAt = new Date();
  const reviewNote = !approved && typeof note === "string" ? note.trim() || null : null;
  const result = await db.socialCalendar.updateMany({
    where: { id: calendar.id, planStatus: "AWAITING_APPROVAL" },
    data: {
      planStatus: approved ? "PLAN_APPROVED" : "PLAN_NEEDS_CHANGES",
      planApprovalNote: reviewNote,
      ...(approved ? { planApprovedAt: reviewedAt } : {}),
    },
  });
  if (!result.count) return NextResponse.json({ error: "This plan has already been reviewed" }, { status: 409 });
  await notifyCalendarWorkflow({
    kind: approved ? "client-approved" : "client-feedback", calendarId: calendar.id,
    key: `plan-${reviewedAt.toISOString()}`, note: reviewNote, actor: viewer.name || "Client",
  });
  const updated = await db.socialCalendar.findUniqueOrThrow({ where: { id: calendar.id } });
  return NextResponse.json({ calendar: updated });
}
