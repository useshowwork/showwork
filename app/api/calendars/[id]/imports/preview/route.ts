import { NextRequest, NextResponse } from "next/server";
import { importAccess } from "@/lib/calendarImport/access";
import {
  extractImport,
  MAX_IMPORT_BYTES,
} from "@/lib/calendarImport/extraction";
import { suggestMapping } from "@/lib/calendarImport/mapping";
import { db } from "@/lib/db";
import { getCalendarFreeTrialOwner } from "@/lib/contentWorkspaceUsage";
import { trialPaidAiNotice } from "@/lib/contentWorkspaceEntitlements";
import { extractCalendarItems } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await importAccess(id);
  if (access.error) return access.error;
  if (Number(req.headers.get("content-length")) > MAX_IMPORT_BYTES + 65536)
    return NextResponse.json(
      { error: "Choose a file up to 3 MB." },
      { status: 413 },
    );
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string" || file.size > MAX_IMPORT_BYTES)
      return NextResponse.json(
        { error: "Choose a file up to 3 MB." },
        { status: 400 },
      );
    const extracted = await extractImport(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      async (text, filename) => {
        if (await getCalendarFreeTrialOwner(id)) throw new Error(trialPaidAiNotice.code);
        return extractCalendarItems(text, filename);
      },
    );
    const existing = await db.calendarPost.findMany({
      where: { calendarId: id },
      select: {
        id: true,
        postDate: true,
        platform: true,
        caption: true,
        contentIdea: true,
        hook: true,
        script: true,
        postType: true,
        category: true,
        cta: true,
        hashtags: true,
        taggedAccounts: true,
        linkUrl: true,
        customFields: { select: { label: true, value: true } },
      },
    });
    return NextResponse.json(
      {
        ...extracted,
        mapping: suggestMapping(extracted.items),
        existing,
        filename: file.name,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === trialPaidAiNotice.code) {
      return NextResponse.json({ ...trialPaidAiNotice, error: "Subscribe to import documents with AI. You can still import spreadsheets and tables during your trial." }, { status: 403 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to read this file.",
      },
      { status: 422 },
    );
  }
}
