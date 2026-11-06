import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";
import { CONTENT_WORKSPACE_PLANS, workspaceFeatureUpgradeMessage, type ContentWorkspacePlan, type ContentWorkspaceFeature } from "@/lib/contentWorkspaceEntitlements";

export default function WorkspaceFeatureNotice({ feature, trial = false, paidPlan, trialEndsAt, compact = false, message }: { feature?: ContentWorkspaceFeature; trial?: boolean; paidPlan?: ContentWorkspacePlan | null; trialEndsAt?: Date | null; compact?: boolean; message?: string }) {
  if (trial && paidPlan === "UNLIMITED") return null;
  const endDate = trialEndsAt?.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
  const trialMessage = paidPlan
    ? `${CONTENT_WORKSPACE_PLANS[paidPlan].name} subscription active · You also keep full Agency feature access${endDate ? ` until ${endDate}` : " for the remainder of your original trial"}. Your paid plan continues afterward. AI automatic replies remain opt-in.`
    : `Agency trial access · All premium features are available${endDate ? ` until ${endDate}` : " during your 7-day trial"}. AI automatic replies stay off unless you turn them on. Your selected plan applies after the trial.`;
  if (trial) return <details className="mb-3 text-xs text-[#637c9c]"><summary className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 font-medium text-blue-800"><Sparkles size={13} aria-hidden="true"/>Agency trial{endDate ? ` · Until ${endDate}` : " · Active"}<span aria-hidden="true">⌄</span></summary><p className="mt-2 max-w-2xl leading-6">{trialMessage}</p></details>;
  if (compact && !trial) return (
    <p role="status" className="my-2 text-xs leading-5 text-[#667085]">
      {message ?? (feature ? workspaceFeatureUpgradeMessage(feature).replace(" Your existing data is preserved.", "") : "Subscribe or upgrade to resume editing. Your saved work stays available.")}{" "}
      <Link href="/dashboard/billing?product=content-workspace#content-workspace-plans" className="font-semibold text-[#1768E8] underline underline-offset-2">View plans</Link>
    </p>
  );
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <div className="flex items-start gap-2">
        {trial ? <Sparkles aria-hidden="true" size={18} className="mt-0.5 shrink-0" /> : <LockKeyhole aria-hidden="true" size={18} className="mt-0.5 shrink-0" />}
        <p>{trial ? trialMessage : feature ? workspaceFeatureUpgradeMessage(feature) : "This workspace is outside your active plan access or workspace allowance. Your work is preserved and available to review. Subscribe or upgrade to resume editing and publishing."}</p>
      </div>
      {!trial && <Link href="/dashboard/billing?product=content-workspace#content-workspace-plans" className="shrink-0 rounded-lg bg-[#1768E8] px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{feature ? "Upgrade plan" : "Choose a plan"}</Link>}
    </div>
  );
}
