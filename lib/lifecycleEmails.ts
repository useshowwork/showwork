import { db } from "@/lib/db";
import { sendWeeklyMarketingWorkspaceEmail } from "@/lib/resend";
import { marketingUnsubscribeToken } from "@/lib/marketingEmailPreferences";
import { weeklyMarketingVariant } from "@/lib/weeklyMarketingContent";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Bound each invocation. Subsequent daily runs pick up remaining due recipients.
const BATCH_SIZE = 200;
const CONCURRENCY = 5;

/** Existing scheduler entrypoint, now exclusively a weekly workspace campaign.
 * One atomic reservation per recipient per rolling seven days prevents concurrent
 * cron calls, missed runs and uncertain delivery acknowledgements sending bursts.
 * A failed attempt waits seven days too: this campaign favors less email over retries.
 */
export async function runLifecycleEmailCheck() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - WEEK_MS);
  const cooldownFields = [
    "weeklyMarketingEmailLastAttemptAt", "weeklyMarketingEmailSentAt",
    "lifecycleSequenceStartedAt", "welcomeEmailSentAt", "portfolioInviteEmailSentAt",
    "projectManagementEmailSentAt", "creativoPromoEmailSentAt", "lastDeliveryReminderSentAt",
    "calendarTrial2DaysLeftEmailSentAt", "calendarTrialFollowUpEmailSentAt",
    "calendarTrialEndsTodayEmailSentAt", "calendarTrialEndedEmailSentAt",
  ];
  const eligible = {
    isDeactivated: false,
    marketingEmailsUnsubscribedAt: null,
    createdAt: { lte: cutoff },
    AND: cooldownFields.map(field => ({ OR: [{ [field]: null }, { [field]: { lte: cutoff } }] })),
  };
  const creators = await db.creator.findMany({
    where: eligible,
    select: { id: true, email: true, name: true, weeklyMarketingEmailCount: true },
    orderBy: { id: "asc" },
    take: BATCH_SIZE,
  });
  const summary = { processed: creators.length, weeklyMarketingSent: 0, skipped: 0, failed: 0 };
  for (let i = 0; i < creators.length; i += CONCURRENCY) {
    await Promise.all(creators.slice(i, i + CONCURRENCY).map(async creator => {
      try {
        // Validate configuration before claiming a recipient's weekly slot.
        const token = marketingUnsubscribeToken(creator.id, creator.email);
        const claimed = await db.creator.updateMany({
          where: { ...eligible, id: creator.id, email: creator.email },
          data: { weeklyMarketingEmailLastAttemptAt: now },
        });
        if (claimed.count !== 1) { summary.skipped++; return; }
        // Honor opt-outs/deactivation that arrived while this recipient was queued.
        const current = await db.creator.findUnique({
          where: { id: creator.id },
          select: { email: true, isDeactivated: true, marketingEmailsUnsubscribedAt: true },
        });
        if (!current || current.isDeactivated || current.marketingEmailsUnsubscribedAt || current.email !== creator.email) {
          summary.skipped++; return;
        }
        await sendWeeklyMarketingWorkspaceEmail({
          to: creator.email, name: creator.name,
          variant: weeklyMarketingVariant(creator.id, creator.weeklyMarketingEmailCount),
          unsubscribePath: `/api/email-preferences/marketing?creatorId=${encodeURIComponent(creator.id)}&token=${token}`,
        }, `weekly-workspace/${creator.id}/${now.toISOString()}`);
        await db.creator.update({
          where: { id: creator.id },
          data: { weeklyMarketingEmailSentAt: new Date(), weeklyMarketingEmailCount: { increment: 1 } },
        });
        summary.weeklyMarketingSent++;
      } catch {
        // Never log recipients, tokens, API keys or provider payloads.
        console.error("Weekly Marketing Workspace email failed", { creatorId: creator.id });
        summary.failed++;
      }
    }));
  }
  return summary;
}
