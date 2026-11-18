import { CONTENT_WORKSPACE_PLANS, type ContentWorkspacePlan } from "@/lib/contentWorkspaceEntitlements";
import { TIERS, type PaidTier } from "@/lib/subscriptionTiers";

export function billingPaymentDescription({ type, contentWorkspacePlan, tier }: {
  type: string;
  contentWorkspacePlan: ContentWorkspacePlan | null;
  tier: string | null;
}) {
  if (contentWorkspacePlan) return CONTENT_WORKSPACE_PLANS[contentWorkspacePlan].name;
  if (type.startsWith("PORTFOLIO_")) return "Portfolio";
  if (type.startsWith("CALENDAR_") || type.startsWith("CONTENT_WORKSPACE_")) return "Marketing Workspace";
  if (type.startsWith("AI_ASSISTANT_")) return "AI Assistant";
  if (type.startsWith("SUBSCRIPTION_")) return TIERS[tier as PaidTier]?.name ? `Project Delivery · ${TIERS[tier as PaidTier].name}` : "Project Delivery";
  return "Project payment";
}
