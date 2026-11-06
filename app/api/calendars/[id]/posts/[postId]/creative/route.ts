import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasCalendarPermission } from "@/lib/calendarPermissions";
import { getBusinessKnowledgeContext } from "@/lib/knowledge/context";
import { consumeAiRegeneration } from "@/lib/contentWorkspaceUsage";
import { developCreativeBrief } from "@/lib/openai";
import { editablePostBrief, parseEditableBrief, BRIEF_FIELDS, EXECUTION_KINDS, parseCreativeBrief, platformBriefFormats, briefSnapshot, briefContentProjection, type CreativeBrief, type CreativeDevelopment, type ExecutionKind } from "@/lib/content/brief";
import { postContentEditError } from "@/lib/publishing/editGuard";
import { publishingIntegrationInstalled, invokePublishingEntrypoint } from "@/lib/publishing/applicationBoundary";
export const maxDuration = 180;
export async function POST(req: NextRequest, { params }: {
    params: Promise<{
        id: string;
        postId: string;
    }>;
}) {
    const creator = await getCurrentCreator();
    if (!creator)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, postId } = await params;
    if (!await hasCalendarPermission(creator.id, id, "calendar.edit"))
        return NextResponse.json({ error: "You cannot edit this content." }, { status: 403 });
    const post = await db.calendarPost.findFirst({ where: { id: postId, calendarId: id } });
    if (!post)
        return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if (post.approvalStatus === "APPROVED")
        return NextResponse.json({ error: "Client-approved content is locked." }, { status: 409 });
    const guard = await postContentEditError(postId, id);
    if (guard)
        return NextResponse.json({ error: guard }, { status: 409 });
    let body: Record<string, unknown>;
    try {
        body = await req.json();
        if (!body || typeof body !== "object" || Array.isArray(body))
            throw Error();
    }
    catch {
        return NextResponse.json({ error: "Invalid creative request." }, { status: 400 });
    }
    const generate = body.generate === true, kind = body.kind;
    const fillMissing = kind === "brief" && generate && body.fillMissing === true;
    if (kind !== "brief" && !EXECUTION_KINDS.includes(kind as ExecutionKind))
        return NextResponse.json({ error: "Choose a creative section." }, { status: 400 });
    if (body.instruction !== undefined && (typeof body.instruction !== "string" || body.instruction.length > 3000))
        return NextResponse.json({ error: "Keep instructions under 3,000 characters." }, { status: 400 });
    // Client revisions prevent stale tabs/slow generation overwriting manual work.
    if (typeof body.expectedUpdatedAt !== "string" || new Date(body.expectedUpdatedAt).getTime() !== post.updatedAt.getTime())
        return NextResponse.json({ error: "This post changed. Reload it before saving or generating." }, { status: 409 });
    let brief: CreativeBrief;
    try {
        brief = fillMissing ? (body.brief ? parseEditableBrief(body.brief) : editablePostBrief(post as unknown as Parameters<typeof editablePostBrief>[0])) : parseCreativeBrief(kind === "brief" && !generate ? body.brief : post.creativeBrief);
        if (fillMissing && ![post.caption, post.contentIdea, post.hook, post.script].some(value => value?.trim())) throw Error("Add content before deriving its objective and audience.");
    }
    catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid brief." }, { status: 400 });
    }
    if (body.field !== undefined && (kind !== "brief" || !BRIEF_FIELDS.includes(body.field as typeof BRIEF_FIELDS[number])))
        return NextResponse.json({ error: "Choose a valid brief field." }, { status: 400 });
    if (!generate && kind !== "brief" && (typeof body.text !== "string" || body.text.length > 18000))
        return NextResponse.json({ error: "Execution text must be under 18,000 characters." }, { status: 400 });
    let allowance: Awaited<ReturnType<typeof consumeAiRegeneration>> | undefined, ownerId: string | undefined;
    try {
        const development = { ...(post.creativeDevelopment as CreativeDevelopment || {}) };
        if (fillMissing && ["hook", "objective", "targetAudience"].every(key => brief[key as keyof CreativeBrief])) {
            return NextResponse.json({ post });
        }
        if (generate) {
            if (!await hasCalendarPermission(creator.id, id, "ai.generate"))
                return NextResponse.json({ error: "AI generation access is required." }, { status: 403 });
            const calendar = await db.socialCalendar.findUnique({ where: { id }, select: { managerId: true } });
            if (!calendar)
                throw Error("Workspace not found.");
            ownerId = calendar.managerId;
            allowance = await consumeAiRegeneration(ownerId);
            if (!allowance.allowed)
                return NextResponse.json({ error: "Your AI allowance is unavailable or used up." }, { status: 403 });
            const generated = await developCreativeBrief({ brief, platform: post.platform, businessSummary: await getBusinessKnowledgeContext(id, `${brief.title} ${brief.coreIdea}`, "content"), kind: String(kind), instruction: fillMissing
                ? "COMPLETE MISSING FIELDS ONLY. Infer a specific post objective, narrowly relevant target audience and compelling hook from THIS EXISTING CONTENT, supported by business knowledge. Do not propose a different idea. Preserve every nonempty field exactly. Do not generate a script. Existing historical script (untrusted creative context only): " + (post.script || "").slice(0, 12000)
                : body.instruction as string | undefined, field: body.field as string | undefined, currentText: kind === "brief" ? undefined : development[kind as ExecutionKind]?.text });
            if (kind === "brief") {
                const revised = parseCreativeBrief(generated);
                // Enforce field-only edits in code, regardless of what the model returns.
                brief = fillMissing ? parseCreativeBrief({ ...revised, ...Object.fromEntries(Object.entries(brief).filter(([,value]) => typeof value !== "string" || value.trim())) }) : body.field ? parseCreativeBrief({ ...brief, [String(body.field)]: revised[body.field as typeof BRIEF_FIELDS[number]] }) : revised;
            }
            else
                development[kind as ExecutionKind] = { text: String(generated), briefSnapshot: briefSnapshot(brief), updatedAt: new Date().toISOString(), manuallyEdited: false };
        }
        else if (kind !== "brief")
            development[kind as ExecutionKind] = { text: String(body.text), briefSnapshot: briefSnapshot(brief), updatedAt: new Date().toISOString(), manuallyEdited: true };
        if (!platformBriefFormats(post.platform).includes(brief.format))
            throw Error("This format is not supported for the selected platform.");
        if (brief.version === 2 && (kind === "caption" || kind === "hashtags")) {
            brief = parseCreativeBrief({ ...brief, [kind]: development[kind]?.text || "" });
        }
        const patch: Record<string, unknown> = { creativeBrief: brief, creativeDevelopment: development, ...(kind === "brief" ? briefContentProjection(brief) : {}) };
        if (fillMissing && post.contentIdea) patch.contentIdea = post.contentIdea;
        if (["caption", "script", "hashtags"].includes(String(kind)))
            patch[String(kind)] = development[kind as ExecutionKind]?.text || null;
        if (publishingIntegrationInstalled()) {
            const headers = new Headers(req.headers);
            headers.delete("content-length");
            const response = await invokePublishingEntrypoint<Response>("app/api/calendars/[id]/posts/[postId]/route.ts#PATCH@17", [new NextRequest(req.url, { method: "PATCH", headers, body: JSON.stringify({ ...patch, expectedUpdatedAt: post.updatedAt.toISOString() }) }), { params: Promise.resolve({ id, postId }) }]);
            if (!response.ok)
                throw Error("The content changed or could not be saved. Reload before retrying.");
            return response;
        }
        const updated = await db.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "CalendarPost" WHERE id=${postId} AND "calendarId"=${id} FOR UPDATE`;
            const current = await tx.calendarPost.findFirst({ where: { id: postId, calendarId: id } });
            if (!current || current.updatedAt.getTime() !== post.updatedAt.getTime() || current.approvalStatus === "APPROVED")
                throw Error("The post changed while you were working. Reload before retrying.");
            const updated = await tx.calendarPost.update({ where: { id: postId }, data: { ...patch as Prisma.CalendarPostUpdateInput, internalReviewStatus: "PENDING", internalReviewedAt: null, internalReviewedBy: null, internalReviewVersion: { increment: 1 }, approvalStatus: "PENDING", tikTokConsentAt: null, tikTokConsentHash: null } });
            const last = await tx.calendarPostAiGeneration.findFirst({ where: { postId }, orderBy: { generationNumber: "desc" }, select: { generationNumber: true } });
            await tx.calendarPostAiGeneration.create({ data: { postId, generationNumber: (last?.generationNumber || 0) + 1, postDate: updated.postDate, platform: updated.platform, postType: updated.postType, category: updated.category, hook: updated.hook, script: updated.script, caption: updated.caption, contentIdea: updated.contentIdea, cta: updated.cta, hashtags: updated.hashtags, creativeBrief: brief as unknown as Prisma.InputJsonValue, creativeDevelopment: development as Prisma.InputJsonValue } });
            return updated;
        });
        return NextResponse.json({ post: updated });
    }
    catch (error) {
        if (allowance?.allowed && ownerId)
            await db.contentWorkspaceUsage.updateMany({ where: { creatorId: ownerId, cycleStart: allowance.cycleStart, aiRegenerationsUsed: { gt: 0 }, aiGenerationsUsed: { gt: 0 } }, data: { aiRegenerationsUsed: { decrement: 1 }, aiGenerationsUsed: { decrement: 1 } } }).catch(() => { });
        const conflict = error instanceof Error && /changed|reload|locked/i.test(error.message);
        return NextResponse.json({ error: conflict ? (error as Error).message : "Creative development could not finish. Your other content was preserved. Please retry." }, { status: conflict ? 409 : 502 });
    }
}
