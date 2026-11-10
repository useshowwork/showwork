import { visibleChannelLead } from "@/lib/socialMessaging/visibility";
import { calendarFeatureGate } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import type { CalendarLeadPipelineStatus, CalendarLeadTemperature } from "@prisma/client";
import { getCurrentCreator } from "@/lib/auth";
import { canAccessCalendarById, hasCalendarPermission } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { cleanOptionalString, LEAD_PIPELINE_STATUSES, LEAD_TEMPERATURES, pipelineToSocialStatus } from "@/lib/calendarLeads";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; leadId: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: calendarId, leadId } = await params;
  if (!(await hasCalendarPermission(creator.id, calendarId, "leads.manage"))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await canAccessCalendarById(calendarId))) return NextResponse.json({ error: "This workspace isn’t active." }, { status: 403 });
  const featureLock = await calendarFeatureGate(calendarId, "leadManagement");
  if (featureLock) return featureLock;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid lead details." }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const field of ["name", "username", "email", "phone", "company", "notes"] as const) {
    if (!(field in body)) continue;
    const value = cleanOptionalString(body[field], field === "notes" ? 5000 : field === "email" ? 254 : field === "phone" ? 60 : 160);
    if (value === undefined) return NextResponse.json({ error: `${field} must be text.` }, { status: 400 });
    if (field === "name" && !value) return NextResponse.json({ error: "A lead name is required." }, { status: 400 });
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    data[field] = field === "email" && value ? value.toLowerCase() : value;
  }
  if ("temperature" in body) {
    const temperature = String(body.temperature).toUpperCase();
    if (!LEAD_TEMPERATURES.includes(temperature as CalendarLeadTemperature)) return NextResponse.json({ error: "Choose cold, warm, or hot." }, { status: 400 });
    data.temperature = temperature;
  }
  if ("status" in body) {
    const status = String(body.status).toUpperCase();
    if (!LEAD_PIPELINE_STATUSES.includes(status as CalendarLeadPipelineStatus)) return NextResponse.json({ error: "Choose a valid pipeline status." }, { status: 400 });
    data.status = status;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "No lead changes were provided." }, { status: 400 });
  try {
    const lead = await db.calendarLead.findFirst({ where: { id: leadId, calendarId, AND: [visibleChannelLead] }, select: { id: true, socialConversationId: true } });
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    const updated = await db.calendarLead.update({ where: { id: leadId }, data });
    if (lead.socialConversationId) {
      const conversationData: Record<string, unknown> = {};
      if (typeof data.name === "string") conversationData.participantName = data.name;
      if (typeof data.username === "string" || data.username === null) conversationData.participantUsername = data.username;
      if (typeof data.status === "string") conversationData.leadStatus = pipelineToSocialStatus(data.status as CalendarLeadPipelineStatus);
      if (Object.keys(conversationData).length) await db.socialLeadConversation.update({ where: { id: lead.socialConversationId }, data: conversationData });
    }
    return NextResponse.json({ lead: updated });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "A lead with this email already exists." }, { status: 409 });
    return NextResponse.json({ error: "Could not update this lead." }, { status: 500 });
  }
}
