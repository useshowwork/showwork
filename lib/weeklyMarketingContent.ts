import { createHash } from "node:crypto";

// Offset each recipient's rotation so everyone does not receive the same message.
// A stored success count advances it: no consecutive repeats or paid AI calls.
export function weeklyMarketingVariant(creatorId: string, sentCount: number): number {
  const offset = createHash("sha256").update(creatorId).digest().readUInt32BE(0) % 3;
  return (offset + sentCount) % 3;
}

export const WEEKLY_MARKETING_MESSAGES = [
  {
    subject: "A full content calendar. A clearer week.",
    headline: "Give your next week a head start.",
    body: "More clients shouldn’t mean more blank calendars. Add your business knowledge and brand voice, then generate a content calendar your team can refine together.",
    takeaway: "Your next step: choose a workspace and generate one week of content.",
    ctaLabel: "Plan my content calendar",
  },
  {
    subject: "Less chasing approvals. More moving forward.",
    headline: "Keep feedback with the work.",
    body: "A caption in one chat. A revision in another. Bring your content and feedback together in Marketing Workspace, review it with your team, then share it with your client for approval.",
    takeaway: "Your next step: open a post, review it with your team and send it for client approval.",
    ctaLabel: "Open Marketing Workspace",
  },
  {
    subject: "Make your next content plan an informed one.",
    headline: "See what deserves another post.",
    body: "Your team puts real work into every post. Use Analytics & Reporting in Marketing Workspace to see available channel results and recommendations, then use what you learn to shape your next calendar.",
    takeaway: "Your next step: connect a supported channel and explore your available results. Metrics depend on channel access.",
    ctaLabel: "Explore my workspaces",
  },
] as const;
