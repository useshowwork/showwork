import { Gift, ArrowUpRight, ChevronDown } from "lucide-react";
import styles from "./BillingBenefits.module.css";
import SubscriptionCheckoutButton from "@/components/billing/SubscriptionCheckoutButton";
import Link from "next/link";
import { db } from "@/lib/db";
import { billingPriceQuotes } from "@/lib/billingOffers";
import { workspaceComplimentaryPlan, type ComplimentaryAccount } from "@/lib/complimentaryAccess";
import { TIERS, type PaidTier } from "@/lib/subscriptionTiers";
import { CONTENT_WORKSPACE_PLANS, type ContentWorkspacePlan } from "@/lib/contentWorkspaceEntitlements";
const money = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const date = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" });
type BenefitCreator = ComplimentaryAccount & { id: string; deliveryOfferSubscriptionId?: string | null; workspaceOfferSubscriptionId?: string | null; subscriptionActive?: boolean; contentWorkspaceBillingStatus?: string; contentWorkspacePlan?: string | null };
export default async function BillingBenefits({ creator, showManageLink = true }: { creator: BenefitCreator; showManageLink?: boolean }) {
  // This optional dashboard section must not crash the account dashboard
  // while a development process or database is still on the previous schema.
  if (!db.billingOfferSubscription) {
    console.warn("Billing benefits unavailable: regenerate Prisma and restart the development server.");
    return null;
  }
  const now = new Date();
  let result;
  try {
    result = await Promise.all([
    db.billingOfferSubscription.findMany({ where: { creatorId: creator.id, OR: [
      { status: "COMPLIMENTARY", discountEndsAt: { gt: now }, offer: { revokedAt: null, recipients: { some: { creatorId: creator.id, revokedAt: null } } } },
      { id: { in: [creator.deliveryOfferSubscriptionId, creator.workspaceOfferSubscriptionId].filter((id): id is string => !!id) }, activatedAt: { not: null } },
    ] }, orderBy: { createdAt: "desc" } }),
    billingPriceQuotes(creator.id),
    ]);
  } catch (error) {
    if (["P2021", "P2022"].includes((error as { code?: string }).code ?? "")) {
      console.warn("Billing benefits unavailable: apply the billing-offers database migration.");
      return null;
    }
    throw error;
  }
  const [subscriptions, quotes] = result;
  const active = subscriptions.filter(s => s.status === "COMPLIMENTARY" || (s.product === "DELIVERY" ? creator.subscriptionActive : creator.contentWorkspaceBillingStatus === "ACTIVE"));
  const available = Object.entries(quotes);
  const legacyWorkspace = creator.isComped && (!creator.compedUntil || creator.compedUntil > now);
  if (!active.length && !available.length && !legacyWorkspace) return null;
  return <details data-billing-card className={styles.section}>
    <summary className={styles.header}>
      <span className={styles.icon}><Gift size={18} aria-hidden="true" /></span>
      <span className={styles.title}>Discounts &amp; access benefits</span>
      <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
    </summary>
    <div className={styles.body}>
    {showManageLink && <div className="mb-3 flex justify-end"><Link href="/dashboard/billing" className={styles.manage}>Manage billing <ArrowUpRight size={14} aria-hidden="true" /></Link></div>}
    <div className={styles.benefits}>
      {active.map(s => {
        const name = s.product === "DELIVERY" ? TIERS[s.plan as PaidTier]?.name : CONTENT_WORKSPACE_PLANS[s.plan as ContentWorkspacePlan]?.name;
        const free = s.status === "COMPLIMENTARY";
        const expired = s.discountEndsAt && s.discountEndsAt <= now;
        return <article key={s.id} className={styles.benefit}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[#101828]">{s.product === "DELIVERY" ? "Project Delivery" : "Marketing Workspace"} · {name}</p><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${expired ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-[var(--brand-blue-dark,#0052FF)]"}`}>{free ? "Complimentary" : expired ? "Standard price restored" : `${s.percent}% discount activated`}</span></div><p className="mt-2 text-xs text-[#667085]">{s.title}</p>
          <p className="mt-3 text-lg font-semibold text-[#175CD3]">{free ? "Free access" : `${money(expired ? s.standardPriceNgn : s.discountedPriceNgn)}/${s.billingCycle === "ANNUAL" ? "year" : "month"}`}</p>
          {!free && !expired && <p className="mt-1 text-xs text-[#667085]">Save {money(s.standardPriceNgn - s.discountedPriceNgn)} per discounted payment. Standard price: {money(s.standardPriceNgn)}.</p>}
          <p className="mt-3 text-xs leading-5 text-[#475467]">{free ? `Included until ${s.discountEndsAt ? date(s.discountEndsAt) : "the grant ends"}. Your paid plan or free/read-only limits apply afterwards.` : expired ? "Your promotion has ended. Future renewals use the standard price agreed at checkout." : `Benefit period ends ${s.discountEndsAt ? date(s.discountEndsAt) : "after activation"}. ${s.restoredAt ? `The next renewal is ${money(s.standardPriceNgn)}.` : `Then renews at ${money(s.standardPriceNgn)} per ${s.billingCycle === "ANNUAL" ? "year" : "month"}.`}`}</p>
          {free && (s.product === "DELIVERY" ? creator.subscriptionActive : creator.contentWorkspaceBillingStatus === "ACTIVE") && <p className="mt-2 text-xs leading-5 text-slate-700">Your paid subscription is still active. Complimentary access does not stop its renewal charges; manage cancellation in billing.</p>}
        </article>;
      })}
      {legacyWorkspace && <article className={styles.benefit}><p className="text-sm font-semibold">Marketing Workspace · {CONTENT_WORKSPACE_PLANS[workspaceComplimentaryPlan(creator)!].name}</p><p className="mt-3 text-lg font-semibold text-[#175CD3]">Complimentary access</p><p className="mt-2 text-xs text-[#667085]">{creator.compedUntil ? `Included until ${date(creator.compedUntil)}.` : "Existing admin-granted access, with no end date."}</p></article>}
    </div>
    {available.length > 0 && <section className={styles.offers}><h3 className="text-sm font-medium text-[var(--brand-blue-dark,#0052FF)]">Offers available on your next checkout</h3><p className="mt-2 text-xs leading-5 text-[#667085]">Activate through checkout. Your current subscription keeps its agreed price. Offers never stack; switching plans does not restart an activated offer.</p><ul className="mt-4 grid gap-3 sm:grid-cols-2">{available.map(([key,q]) => {
      const [product,plan,cycle] = key.split(":");
      const name = product === "DELIVERY" ? TIERS[plan as PaidTier].name : CONTENT_WORKSPACE_PLANS[plan as ContentWorkspacePlan].name;
      return <li key={key} className={styles.offer}><p className="font-semibold">{product === "DELIVERY" ? "Delivery" : "Workspace"} · {name} · {cycle === "ANNUAL" ? "Annual" : "Monthly"}</p><p>{q.percent}% off: <span className="mr-1 text-[#98A2B3] line-through">{money(q.standardPriceNgn)}</span><strong>{money(q.priceNgn)}</strong> for {q.remainingCycles} payment(s), then {money(q.standardPriceNgn)}.</p><p className="text-[#667085]">{q.title} · {q.months}-month offer</p><div className="mt-3">{product === "DELIVERY" || creator.contentWorkspaceBillingStatus !== "ACTIVE" || creator.contentWorkspacePlan === plan ? <SubscriptionCheckoutButton product={product as "DELIVERY" | "CONTENT_WORKSPACE"} plan={plan} cycle={cycle as "MONTHLY" | "ANNUAL"} label="Review & activate offer" /> : <Link className="font-semibold text-[#2478FF]" href="/dashboard/billing?product=content-workspace">Switch plan to use this offer →</Link>}</div></li>;
    })}</ul></section>}
    </div>
  </details>;
}
