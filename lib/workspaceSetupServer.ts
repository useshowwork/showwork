import { brandPersonalityDocumentId, readBrandPersonality } from "@/lib/knowledge/brandPersonality";
import { db } from "@/lib/db";
import type { WorkspaceSetupState } from "@/lib/workspaceSetup";
export async function getWorkspaceSetup(calendarId: string): Promise<WorkspaceSetupState | null> {
  const calendar = await db.socialCalendar.findUnique({
    where: { id: calendarId },
    select: {
      setupVersion: true, publishingPreferenceSetAt: true, autoPublishEnabled: true, setupCompletedAt: true,
      instagramAccountId: true, instagramAccessToken: true, tikTokOpenId: true, tikTokAccessToken: true,
      facebookPageId: true, facebookAccessToken: true, linkedinAccessToken: true, xAccessToken: true,
      businessDocuments: { where: { id: brandPersonalityDocumentId(calendarId) }, select: { extractedText: true }, take: 1 },
      _count: { select: { businessDocuments: { where: { id: { not: brandPersonalityDocumentId(calendarId) } } }, posts: { where: { deletedAt: null } } } },
      socialConnections: { where: { status: "CONNECTED", platform: { in: ["INSTAGRAM", "TIKTOK", "FACEBOOK", "LINKEDIN", "X"] } }, select: { id: true }, take: 1 },
    },
  });
  if (!calendar) return null;
  return {
    enabled: calendar.setupVersion > 0,
    publishingChosen: !!calendar.publishingPreferenceSetAt,
    autoPublishEnabled: calendar.autoPublishEnabled,
    hasKnowledge: calendar._count.businessDocuments > 0,
    hasBrandVoice: !!readBrandPersonality(calendar.businessDocuments[0]?.extractedText),
    hasChannels: calendar.socialConnections.length > 0 || !!(
      (calendar.instagramAccountId && calendar.instagramAccessToken) ||
      (calendar.tikTokOpenId && calendar.tikTokAccessToken) ||
      (calendar.facebookPageId && calendar.facebookAccessToken) || calendar.linkedinAccessToken || calendar.xAccessToken),
    hasContent: calendar._count.posts > 0,
    complete: !!calendar.setupCompletedAt,
  };
}
