import { retryDatabaseRead } from "@/lib/databaseAvailability";
import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { generateCalendarDrafts } from "@/lib/calendarAiGeneration";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function enqueueAiGeneration(req: NextRequest, calendarId: string, creatorId: string, local = false) {
  if (!(await hasCalendarPermission(creatorId, calendarId, "ai.generate"))) {
    return NextResponse.json({ error: "You don't have permission to generate content on this calendar" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch {
    return NextResponse.json({ error: "The generation request must contain valid JSON." }, { status: 400 });
  }
  const operationId = req.headers.get("idempotency-key") || randomUUID();
  const localExecution = local && process.env.NODE_ENV !== "production";
  const id = digest(JSON.stringify(localExecution ? ["local-brief-v2", creatorId, calendarId, operationId] : [creatorId, calendarId, operationId]));
  if (localExecution) {
    // Never expose a PENDING local row to an older shared-database VPS worker.
    const inserted = await db.aiGenerationJob.createMany({
      data: [{ id, creatorId, calendarId, request: JSON.parse(JSON.stringify(body)), status: "RUNNING" }],
      skipDuplicates: true,
    });
    const localJob = await db.aiGenerationJob.findUnique({ where: { id } });
    if (!localJob) return NextResponse.json({ error: "Could not create the local generation job." }, { status: 503 });
    if (inserted.count) void executeClaimedJob(localJob).catch(() => console.error("LOCAL_AI_JOB_FAILED", { jobId: id }));
    return NextResponse.json({ jobId: id, status: localJob.status }, { status: 202 });
  }
  const job = await db.aiGenerationJob.upsert({
    where: { id }, update: {},
    create: { id, creatorId, calendarId, request: JSON.parse(JSON.stringify(body)) },
  });
  // The VPS worker claims pending rows directly. The web app never runs the
  // model call in production and needs no VPS URL or public worker endpoint.
  return NextResponse.json({ jobId: id, status: job.status }, { status: 202 });
}

export async function runAiGenerationJob(jobId: string) {
  const job = await db.aiGenerationJob.findUnique({ where: { id: jobId } });
  if (!job) return false;
  // Concurrent VPS processes may see the same row. Only one may consume
  // usage and create drafts. Never replay an interrupted model call.
  const claimed = await db.aiGenerationJob.updateMany({ where: { id: jobId, status: "PENDING" }, data: { status: "RUNNING" } });
  if (!claimed.count) return true;
  return executeClaimedJob(job);
}

async function executeClaimedJob(job: { id: string; creatorId: string; calendarId: string; request: unknown }) {
  const jobId = job.id;
  try {
    const creator = await db.creator.findUnique({ where: { id: job.creatorId }, select: { id: true } });
    const response = creator
      ? await generateCalendarDrafts(new NextRequest("http://localhost/api/ai-generation", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job.request),
      }), { params: Promise.resolve({ id: job.calendarId }) }, creator, jobId)
      : NextResponse.json({ error: "Account no longer available." }, { status: 401 });
    const result = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid generation result");
    await retryDatabaseRead(() => db.aiGenerationJob.update({ where: { id: jobId }, data: {
      status: response.ok ? "COMPLETED" : "FAILED", httpStatus: response.status, result,
    } }));
  } catch (error) {
    console.error("AI_JOB_FAILED", { jobId });
    await retryDatabaseRead(() => db.aiGenerationJob.update({ where: { id: jobId }, data: {
      status: "FAILED", httpStatus: 500,
      result: { error: "AI generation could not finish. Check your drafts before trying again." },
    } }));
  }
  return true;
}
