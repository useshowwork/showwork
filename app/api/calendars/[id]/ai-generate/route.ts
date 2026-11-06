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
  const prepared = await generationPreflight(req, (await context.params).id);
  if (prepared instanceof NextResponse) return prepared;
  req = prepared;
  const setupCreator = await getCurrentCreator();
  if (!setupCreator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const calendarId = (await context.params).id;
  if (!await hasCalendarPermission(setupCreator.id, calendarId, "ai.generate")) return NextResponse.json({ error: "You cannot generate content in this workspace." }, { status: 403 });
  const setup = await getWorkspaceSetup(calendarId);
  if (setup && !canGenerateDuringSetup(setup)) return NextResponse.json({ code: "WORKSPACE_SETUP_REQUIRED", error: "Choose your publishing preference, add business knowledge, set your brand voice, and connect a channel before generating your first content." }, { status: 409 });

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
