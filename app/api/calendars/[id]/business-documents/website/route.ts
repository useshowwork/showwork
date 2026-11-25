import { rebuildBusinessKnowledge } from "@/lib/knowledge/context";
import { complimentaryAccessSelect } from "@/lib/complimentaryAccess";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { canAccessContentWorkspace } from "@/lib/contentWorkspaceUsage";
import { extractWebsiteKnowledge } from "@/lib/websiteKnowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await hasCalendarPermission(creator.id, id, "knowledge.manage"))) {
    return NextResponse.json({ error: "You don't have permission to add business knowledge to this calendar." }, { status: 403 });
  }

  const calendar = await db.socialCalendar.findUnique({
    where: { id },
    select: {
      id: true,
      managerId: true,
      clientName: true,
      aiBusinessSummary: true,
      businessDocuments: { where: { websiteUrl: { not: null } }, select: { id: true } },
    },
  });
  if (!calendar) return NextResponse.json({ error: "Calendar not found." }, { status: 404 });

  const owner = await db.creator.findUnique({
    where: { id: calendar.managerId },
    select: {
      contentWorkspacePlan: true,
      contentWorkspaceBillingStatus: true,
      contentWorkspaceTrialEndsAt: true,
      ...complimentaryAccessSelect, isComped: true,
      compedUntil: true,
    },
  });
  if (!owner || !canAccessContentWorkspace(owner)) {
    return NextResponse.json({ error: "Your Marketing Workspace subscription isn't active yet." }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { url?: unknown; documentId?: unknown } | null;
  const refresh = body?.documentId !== undefined;
  if (refresh ? typeof body.documentId !== "string" || !body.documentId.trim() || body.documentId.length > 100
      : typeof body?.url !== "string" || !body.url.trim() || body.url.trim().length > 2048) {
    return NextResponse.json({ error: refresh ? "Choose a saved website source." : "Enter a website address up to 2,048 characters long." }, { status: 400 });
  }

  try {
    const saved = refresh ? await db.calendarBusinessDocument.findFirst({
      where: { id: body!.documentId as string, calendarId: id, websiteUrl: { not: null } },
    }) : null;
    if (refresh && !saved?.websiteUrl) return NextResponse.json({ error: "Website source not found." }, { status: 404 });

    const website = await extractWebsiteKnowledge(saved?.websiteUrl ?? body!.url as string);
    const refreshedAt = new Date();
    const websiteUrlHash = createHash("sha256").update(website.url).digest("hex");
    const existing = saved ?? await db.calendarBusinessDocument.findFirst({
      where: { calendarId: id, websiteUrlHash },
    });
    if (!existing && calendar.businessDocuments.length >= 10) {
      return NextResponse.json({ error: "You can add up to 10 website sources to one workspace." }, { status: 409 });
    }

    const changed = !existing || existing.extractedText !== website.text;
    const updatedSource = {
      originalName: changed ? `Website — ${website.name}` : existing.originalName,
      extractedText: website.text,
      websiteRefreshedAt: refreshedAt,
    };
    if (existing) {
      const result = await db.calendarBusinessDocument.updateMany({
        where: { id: existing.id, calendarId: id, websiteRefreshedAt: existing.websiteRefreshedAt },
        data: updatedSource,
      });
      if (!result.count) return NextResponse.json({ error: "This source changed during refresh. Try again." }, { status: 409 });
    }
    const document = existing ? { ...existing, ...updatedSource } : await db.calendarBusinessDocument.create({
      data: { ...updatedSource, calendarId: id, fileKey: null, websiteUrl: website.url, websiteUrlHash, sizeBytes: 0 },
    });
    const source = {
      id: document.id,
      originalName: document.originalName,
      websiteUrl: document.websiteUrl,
      createdAt: document.createdAt.toISOString(),
      websiteRefreshedAt: refreshedAt.toISOString(),
    };
    if (!changed) return NextResponse.json({ document: source, changed, pagesRead: website.pageCount });

    try {
      const { summary, updatedAt: summaryUpdatedAt } = await rebuildBusinessKnowledge(id);
      return NextResponse.json({
        document: source,
        changed,
        businessSummary: summary,
        summaryUpdatedAt: summaryUpdatedAt?.toISOString() ?? null,
        summaryUpdated: true,
        pagesRead: website.pageCount,
      });
    } catch (error) {
      console.error(`Failed to fold website knowledge into AI summary for calendar ${id}:`, error);
      return NextResponse.json({
        document: source,
        changed,
        summaryUpdated: false,
        pagesRead: website.pageCount,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that website.";
    const status = /too large|not publicly accessible|does not resolve|ports|valid website|https:\/\//i.test(message) ? 400 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
