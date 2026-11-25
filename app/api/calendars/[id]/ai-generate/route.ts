import { trialAiCreditNotice, trialBulkGenerationNotice, trialContentDraftCost, WORKSPACE_TRIAL_MAX_DRAFTS, WORKSPACE_TRIAL_INSTRUCTION_LIMIT } from "@/lib/contentWorkspaceEntitlements";
import { getCalendarFreeTrialOwner, getTrialAiCreditsRemaining } from "@/lib/contentWorkspaceUsage";
import { generationCount } from "@/lib/content/schedule";
import { getWorkspaceSetup } from "@/lib/workspaceSetupServer";
import { canGenerateDuringSetup } from "@/lib/workspaceSetup";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { generationPreflight } from "@/lib/knowledge/generationPreflight";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { enqueueAiGeneration } from "@/lib/aiGenerationJobs";
import { publishingIntegrationInstalled, invokePublishingEntrypoint } from "@/lib/publishing/applicationBoundary";

export const maxDuration = 60;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const setupCreator = await getCurrentCreator();
  if (!setupCreator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const calendarId = (await context.params).id;
  if (!await hasCalendarPermission(setupCreator.id, calendarId, "ai.generate")) return NextResponse.json({ error: "You cannot generate content in this workspace." }, { status: 403 });
  const trialOwner = await getCalendarFreeTrialOwner(calendarId);
  if (trialOwner) {
    const body = await req.clone().json().catch(() => null);
    let cost = trialContentDraftCost(1);
    if (typeof body?.customInstructions === "string" && body.customInstructions.length > WORKSPACE_TRIAL_INSTRUCTION_LIMIT) {
      return NextResponse.json({ error: "Keep trial content instructions to 3,000 characters or fewer." }, { status: 400 });
    }
    if (body && Array.isArray(body.platforms) && typeof body.startDate === "string" && typeof body.endDate === "string") {
      try {
        const { drafts } = generationCount(body.startDate, body.endDate, body.postsPerWeek ?? 3, body.platforms, body.contentStrategy, body.contentGroups);
        if (drafts > WORKSPACE_TRIAL_MAX_DRAFTS) {
          return NextResponse.json(trialBulkGenerationNotice, { status: 403 });
        }
        cost = trialContentDraftCost(drafts);
      } catch { /* The generation handler validates the schedule. */ }
    }
    const remaining = await getTrialAiCreditsRemaining(trialOwner.id);
    if (remaining < cost) return NextResponse.json(trialAiCreditNotice(remaining), { status: 403 });
  } else {
    const prepared = await generationPreflight(req, calendarId);
    if (prepared instanceof NextResponse) return prepared;
    req = prepared;
  }

  const setup = await getWorkspaceSetup(calendarId);
  if (setup && !canGenerateDuringSetup(setup)) return NextResponse.json({ code: "WORKSPACE_SETUP_REQUIRED", error: "Add business knowledge before generating your first content. Brand voice and channel connections can be added later." }, { status: 409 });

  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { return await invokePublishingEntrypoint<never>("app/api/calendars/[id]/ai-generate/route.ts#POST@21",[req, context]); } /* end-canonical-integration-boundary */
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.NODE_ENV === "production") {
    const { id } = await context.params;
    return enqueueAiGeneration(req, id, creator.id);
  }
  // Local jobs start claimed atomically, so remote workers cannot execute old code for them.
  return enqueueAiGeneration(req, (await context.params).id, creator.id, true);
}
