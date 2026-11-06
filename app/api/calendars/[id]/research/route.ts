import { after, NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission, canAccessCalendarById, calendarFeatureGate } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { executeBusinessResearch, queueBusinessResearch } from "@/lib/knowledge/research";
import { parseResearchPlan } from "@/lib/knowledge/researchPlan";
import { sourceFingerprint } from "@/lib/knowledge/retrieval";

export const runtime = "nodejs";
export const maxDuration = 180;
type Context = { params: Promise<{ id: string }> };
async function authorized(id: string, manage = false) {
  const creator = await getCurrentCreator();
  return !!creator && await hasCalendarPermission(creator.id, id, manage ? "knowledge.manage" : "knowledge.view");
}
export async function GET(_req: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!await authorized(id)) return NextResponse.json({ error: "Access denied." }, { status: 403 });
  const featureGate = await calendarFeatureGate(id, "randyStudio");
  if (featureGate) return featureGate;
  await db.businessResearchRun.updateMany({ where: { calendarId: id, status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: new Date(Date.now() - 15 * 60000) } }, data: { status: "FAILED", phase: "Research interrupted", error: "Research did not finish. Please start a new run.", completedAt: new Date() } });
  const [runs, sources, calendar] = await Promise.all([
    db.businessResearchRun.findMany({ where: { calendarId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.calendarBusinessDocument.findMany({ where: { calendarId: id }, select: { id: true, originalName: true, extractedText: true, websiteUrl: true } }),
    db.socialCalendar.findUnique({ where: { id }, select: { researchPlan: true } }),
  ]);
  return NextResponse.json({ plan: calendar?.researchPlan ?? null, runs, sourceHash: sourceFingerprint(sources), sourceCount: sources.filter(s => s.extractedText?.trim()).length }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!await authorized(id, true) || !await canAccessCalendarById(id)) return NextResponse.json({ error: "An active workspace and knowledge management permission are required." }, { status: 403 });
  const featureGate = await calendarFeatureGate(id, "randyStudio");
  if (featureGate) return featureGate;
  const body = await req.json().catch(() => null);
  if (typeof body?.focus !== "string" || body.focus.trim().length < 10 || body.focus.length > 1200) return NextResponse.json({ error: "Describe a research focus between 10 and 1,200 characters." }, { status: 400 });
  try {
    const run = await queueBusinessResearch(id, body.focus.trim());
    after(() => executeBusinessResearch(run.id));
    return NextResponse.json({ run }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start research.";
    const expected = /Please wait|Add business/.test(message);
    return NextResponse.json({ error: expected ? message : "Unable to start research. Please retry." }, { status: expected ? 409 : 500 });
  }
}
export async function PATCH(req: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!await authorized(id, true)) return NextResponse.json({ error: "Access denied." }, { status: 403 });
  const featureGate = await calendarFeatureGate(id, "randyStudio");
  if (featureGate) return featureGate;
  const body = await req.json().catch(() => null);
  if (body?.action === "savePlan") {
    try {
      const plan = parseResearchPlan(body.plan);
      await db.socialCalendar.update({ where: { id }, data: { researchPlan: plan } });
      return NextResponse.json({ ok: true });
    } catch { return NextResponse.json({ error: "Check the plan fields and excluded domains." }, { status: 400 }); }
  }
  if (body?.verdict !== undefined && (!["useful", "irrelevant", "incorrect"].includes(body.verdict) || typeof body.note !== "string" || body.note.length > 600)) return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
  if (typeof body?.runId !== "string" || typeof body?.findingId !== "string" || typeof body?.excluded !== "boolean") return NextResponse.json({ error: "Invalid finding update." }, { status: 400 });
  const updated = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "BusinessResearchRun" WHERE "id" = ${body.runId} AND "calendarId" = ${id} FOR UPDATE`;
    const run = await tx.businessResearchRun.findFirst({ where: { id: body.runId, calendarId: id, status: "SUCCEEDED" } });
    const result = run?.result as { findings?: { id: string }[] } | null;
    if (!run || !result?.findings?.some(f => f.id === body.findingId)) return false;
    const excluded = new Set(run.excludedFindingIds);
    if (body.excluded) excluded.add(body.findingId); else excluded.delete(body.findingId);
    await tx.businessResearchRun.update({ where: { id: run.id }, data: { excludedFindingIds: [...excluded], ...(body.verdict ? { findingFeedback: { ...((run.findingFeedback as Record<string, unknown>) ?? {}), [body.findingId]: { verdict: body.verdict, note: body.note.trim() } } } : {}) } });
    return true;
  });
  return NextResponse.json(updated ? { ok: true } : { error: "Finding not found." }, { status: updated ? 200 : 404 });
}
