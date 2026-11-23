import { recordWorkspaceNotice } from "@/lib/workspaceNotifications";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { notifyInternalReview } from "@/lib/calendarReviewNotifications";
import { db } from "@/lib/db";

type Context = { params: Promise<{ id: string; postId: string }> };

async function feedbackAccess(context: Context) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, postId } = await context.params;
  if (!await hasCalendarPermission(creator.id, id, "calendar.view")) {
    return NextResponse.json({ error: "You do not have access to this conversation." }, { status: 403 });
  }

  const post = await db.calendarPost.findFirst({
    where: { calendarId: id, id: postId },
    select: { id: true, internalReviewVersion: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return { creator, calendarId: id, post };
}

export async function GET(request: NextRequest, context: Context) {
  const access = await feedbackAccess(context);
  if (access instanceof NextResponse) return access;

  const before = request.nextUrl.searchParams.get("before");
  if (before && !await db.calendarPostTeamFeedback.findFirst({
    where: { id: before, postId: access.post.id },
    select: { id: true },
  })) return NextResponse.json({ error: "Feedback message not found." }, { status: 404 });

  const latest = await db.calendarPostTeamFeedback.findMany({
    where: { postId: access.post.id },
    select: { id: true, authorName: true, message: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    take: 51,
  });
  return NextResponse.json({ messages: latest.slice(0, 50).reverse(), hasOlder: latest.length > 50 });
}

export async function POST(request: NextRequest, context: Context) {
  const access = await feedbackAccess(context);
  if (access instanceof NextResponse) return access;
  const { creator, calendarId, post } = access;
  const canSend = await Promise.all([
    hasCalendarPermission(creator.id, calendarId, "internal_review.manage"),
    hasCalendarPermission(creator.id, calendarId, "calendar.edit"),
    hasCalendarPermission(creator.id, calendarId, "creatives.upload"),
  ]);
  if (!canSend.some(Boolean)) {
    return NextResponse.json({ error: "You do not have permission to send feedback." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4000) {
    return NextResponse.json({ error: "Enter feedback of 1 to 4,000 characters." }, { status: 400 });
  }

  if (typeof body.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestId)) {
    return NextResponse.json({ error: "Invalid feedback request." }, { status: 400 });
  }

  const id = createHash("sha256").update(JSON.stringify([post.id, creator.id, body.requestId])).digest("hex");
  await db.calendarPostTeamFeedback.createMany({
    data: { id, postId: post.id, authorName: creator.name?.trim() || creator.email, message },
    skipDuplicates: true,
  });
  const saved = await db.calendarPostTeamFeedback.findUniqueOrThrow({
    where: { id },
    select: { id: true, authorName: true, message: true, createdAt: true },
  });
  if (saved.message !== message) {
    return NextResponse.json({ error: "This feedback was already sent." }, { status: 409 });
  }

  await recordWorkspaceNotice({
    calendarId, postId: post.id, key: saved.id, kind: "team-feedback",
    title: "Team feedback sent", actor: saved.authorName,
  });
  const notifications = await notifyInternalReview({
    action: "team_feedback", calendarId, postId: post.id, note: null,
    version: post.internalReviewVersion, feedbackId: saved.id, actorEmail: creator.email,
  }, async (sql, args) => ({ rows: await db.$queryRawUnsafe<unknown[]>(sql, ...args) }));

  return NextResponse.json({ message: saved, notifications }, { status: 201 });
}
