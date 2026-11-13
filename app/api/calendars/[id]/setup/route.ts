import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { getWorkspaceSetup } from "@/lib/workspaceSetupServer";
import { workspaceSetupStep } from "@/lib/workspaceSetup";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { id } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "calendar.view"))) return NextResponse.json({ error: "You cannot access this workspace." }, { status: 403 });
  const state = await getWorkspaceSetup(id);
  return state ? NextResponse.json(state, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Workspace not found." }, { status: 404 });
}
export async function PATCH(request: NextRequest, { params }: Context) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { id } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "workspace.manage"))) return NextResponse.json({ error: "Ask the workspace owner to finish setup." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const state = await getWorkspaceSetup(id);
  if (!state) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  if (body?.action === "publishing" && typeof body.autoPublishEnabled === "boolean") {
    if (!(await hasCalendarPermission(creator.id, id, "publishing.manage"))) return NextResponse.json({ error: "You cannot change publishing settings." }, { status: 403 });
    await db.socialCalendar.update({ where: { id }, data: { autoPublishEnabled: body.autoPublishEnabled, publishingPreferenceSetAt: new Date() } });
  } else if (body?.action === "complete") {
    if (workspaceSetupStep(state) < 3) return NextResponse.json({ error: "Finish the setup steps before completing your review." }, { status: 409 });
    await db.socialCalendar.update({ where: { id }, data: { setupCompletedAt: new Date() } });
  } else return NextResponse.json({ error: "Choose a valid setup action." }, { status: 400 });
  return NextResponse.json(await getWorkspaceSetup(id));
}
