import { visibleChannelLead } from "@/lib/socialMessaging/visibility";
import { calendarFeatureGate } from "@/lib/calendarPermissions";
import { NextRequest, NextResponse } from "next/server";
import type { CalendarLeadPipelineStatus, CalendarLeadTemperature } from "@prisma/client";
import { getCurrentCreator } from "@/lib/auth";
import { canAccessCalendarById, hasCalendarPermission } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { cleanOptionalString, LEAD_PIPELINE_STATUSES, LEAD_TEMPERATURES, normalizedEmail } from "@/lib/calendarLeads";

async function authorization(calendarId: string, creatorId: string, write = false) {
  if (!(await hasCalendarPermission(creatorId, calendarId, write ? "leads.manage" : "leads.view"))) return 404;
  return 200; // Existing lead data remains readable after trial expiry or downgrade.
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: calendarId } = await params;
  const access = await authorization(calendarId, creator.id);
  if (access !== 200) return NextResponse.json({ error: access === 404 ? "Not found." : "This workspace isn’t active." }, { status: access });
  if (!db.calendarLead) return NextResponse.json({ error: "The running server has an outdated Prisma Client. Run `npx prisma generate` and restart the app." }, { status: 503 });
  const search = req.nextUrl.searchParams.get("q")?.trim();
  const status = req.nextUrl.searchParams.get("status")?.toUpperCase();
  const temperature = req.nextUrl.searchParams.get("temperature")?.toUpperCase();
  if (status && !LEAD_PIPELINE_STATUSES.includes(status as CalendarLeadPipelineStatus)) return NextResponse.json({ error: "Choose a valid lead status." }, { status: 400 });
  if (temperature && !LEAD_TEMPERATURES.includes(temperature as CalendarLeadTemperature)) return NextResponse.json({ error: "Choose a valid lead temperature." }, { status: 400 });
  try {
    const leads = await db.calendarLead.findMany({
      where: {
        calendarId,
        AND: [visibleChannelLead],
        ...(status ? { status: status as CalendarLeadPipelineStatus } : {}),
        ...(temperature ? { temperature: temperature as CalendarLeadTemperature } : {}),
        ...(search ? { OR: [
          { name: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
        ] } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 5000,
      include: { socialConversation: { select: { platform: true, participantName: true, participantUsername: true, participantPlatformId: true } } },
    });
    return NextResponse.json({ leads: leads.map((lead) => {
      const conversation = lead.socialConversation;
      const username = lead.username || conversation?.participantUsername || null;
      const genericNames = ["social contact", "facebook contact", "facebook user", "instagram contact", "instagram account", "instagram user", conversation?.participantPlatformId?.toLowerCase()];
      const leadNameIsGeneric = genericNames.includes(lead.name.trim().toLowerCase());
      const name = leadNameIsGeneric
        ? conversation?.participantName || username || `${conversation?.platform === "INSTAGRAM" ? "Instagram" : conversation?.platform === "FACEBOOK" ? "Facebook" : "Social"} contact`
        : lead.name;
      return {
        ...lead,
        name,
        username,
        socialUserId: conversation?.participantPlatformId || null,
        socialPlatform: conversation?.platform || null,
      };
    }) }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Could not load calendar leads:", error);
    return NextResponse.json({ error: "Could not load leads." }, { status: 500 });
  }
}

type LeadInput = { name?: unknown; username?: unknown; email?: unknown; phone?: unknown; company?: unknown; temperature?: unknown; status?: unknown; notes?: unknown };
function validateLead(input: LeadInput) {
  const name = cleanOptionalString(input.name, 160);
  const username = cleanOptionalString(input.username, 160);
  const email = cleanOptionalString(input.email, 254);
  const phone = cleanOptionalString(input.phone, 60);
  const company = cleanOptionalString(input.company, 160);
  const notes = cleanOptionalString(input.notes, 5000);
  if (typeof name !== "string") return { error: "Each lead needs a name." };
  if (username === undefined || email === undefined || phone === undefined || company === undefined || notes === undefined) return { error: "Contact fields must be text." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: `Enter a valid email address for ${name}.` };
  const temperature = input.temperature === undefined ? "WARM" : String(input.temperature).toUpperCase();
  const status = input.status === undefined ? "NEW" : String(input.status).toUpperCase();
  if (!LEAD_TEMPERATURES.includes(temperature as CalendarLeadTemperature)) return { error: `Choose cold, warm, or hot for ${name}.` };
  if (!LEAD_PIPELINE_STATUSES.includes(status as CalendarLeadPipelineStatus)) return { error: `Choose a valid pipeline status for ${name}.` };
  return { data: { name, username, email: normalizedEmail(email), phone, company, notes, temperature: temperature as CalendarLeadTemperature, status: status as CalendarLeadPipelineStatus } };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: calendarId } = await params;
  const access = await authorization(calendarId, creator.id, true);
  if (access !== 200) return NextResponse.json({ error: access === 404 ? "Not found." : "This workspace isn’t active." }, { status: access });
  const featureLock = await calendarFeatureGate(calendarId, "leadManagement");
  if (featureLock) return featureLock;
  if (!db.calendarLead) return NextResponse.json({ error: "The running server has an outdated Prisma Client. Run `npx prisma generate` and restart the app." }, { status: 503 });
  const body = await req.json().catch(() => null) as { leads?: unknown; source?: unknown } | null;
  if (!body || (body.leads !== undefined && !Array.isArray(body.leads))) return NextResponse.json({ error: "Provide a lead or a leads array." }, { status: 400 });
  const inputs = body.leads === undefined ? [body] : body.leads;
  if (!inputs.length || inputs.length > 500) return NextResponse.json({ error: "Import between 1 and 500 leads at a time." }, { status: 400 });
  const validated = inputs.map((input) => validateLead(input as LeadInput));
  const invalidIndex = validated.findIndex((result) => !result.data);
  if (invalidIndex >= 0) return NextResponse.json({ error: `Row ${invalidIndex + 1}: ${validated[invalidIndex].error}` }, { status: 400 });
  const data = validated.map((result) => result.data!);
  const source = body.source === "IMPORT" ? "IMPORT" : "MANUAL";
  const emails = [...new Set(data.map((lead) => lead.email).filter((email): email is string => Boolean(email)))];
  const existingRows = emails.length ? await db.calendarLead.findMany({ where: { calendarId, email: { in: emails } }, select: { email: true } }) : [];
  const existingEmails = new Set(existingRows.map((lead) => lead.email));
  const seenEmails = new Set<string>();
  const create = data.filter((lead) => {
    if (!lead.email) return true;
    if (existingEmails.has(lead.email) || seenEmails.has(lead.email)) return false;
    seenEmails.add(lead.email); return true;
  });
  const inserted = create.length
    ? await db.calendarLead.createMany({ data: create.map((lead) => ({ ...lead, calendarId, source })), skipDuplicates: true })
    : { count: 0 };
  return NextResponse.json({ created: inserted.count, skipped: data.length - inserted.count }, { status: 201 });
}
