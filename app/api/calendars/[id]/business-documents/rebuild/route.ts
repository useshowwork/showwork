import { getCalendarFreeTrialOwner } from "@/lib/contentWorkspaceUsage";
import { trialPaidAiNotice } from "@/lib/contentWorkspaceEntitlements";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission, canAccessCalendarById } from "@/lib/calendarPermissions";
import { rebuildBusinessKnowledge } from "@/lib/knowledge/context";
export const maxDuration = 180;
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creator = await getCurrentCreator();
  if (!creator || !await hasCalendarPermission(creator.id, id, "knowledge.manage") || !await canAccessCalendarById(id)) return NextResponse.json({ error: "Access denied." }, { status: 403 });
  try {
    if (await getCalendarFreeTrialOwner(id)) return NextResponse.json(trialPaidAiNotice, { status: 403 });
    const { summary, updatedAt } = await rebuildBusinessKnowledge(id);
    return NextResponse.json({ businessSummary: summary, summaryUpdatedAt: updatedAt?.toISOString() ?? null });
  } catch {
    return NextResponse.json({ error: "Could not rebuild the summary. Your source documents are still available for replies. Please retry." }, { status: 502 });
  }
}
