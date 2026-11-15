import ShowworkLogo from "@/components/brand/ShowworkLogo";
import PlatformBrandIcon from "@/components/calendars/PlatformBrandIcon";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import styles from "@/components/engage/EngagePlan.module.css";
import EngageBillingActions from "@/components/engage/EngageBillingActions";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  MessagesSquare,
  ContactRound,
  BookOpenText,
  ArrowLeft,
} from "lucide-react";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canAccessContentWorkspace,
  isContentWorkspaceTrialActive,
  getContentWorkspaceUsage,
} from "@/lib/contentWorkspaceUsage";
import EngageStart from "@/components/engage/EngageStart";
import CalendarPaymentCallbackHandler from "@/components/calendars/CalendarPaymentCallbackHandler";

export default async function EngagePage({
  searchParams,
}: {
  searchParams: Promise<{
    billing?: string;
    subscriptionPayment?: string;
    cycle?: string;
  }>;
}) {
  const params = await searchParams;
  const creator = await getCurrentCreator();
  if (!creator) {
    const next = `/dashboard/engage${params.cycle ? `?cycle=${params.cycle === "ANNUAL" ? "ANNUAL" : "MONTHLY"}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const engage = creator.contentWorkspacePlan === "ENGAGE";
  const active = engage && canAccessContentWorkspace(creator);
  const trial =
    engage &&
    creator.contentWorkspaceBillingStatus === "TRIAL" &&
    isContentWorkspaceTrialActive(creator);
  const canStartTrial =
    !creator.contentWorkspaceTrialUsedAt &&
    creator.contentWorkspaceBillingStatus !== "ACTIVE" &&
    (!creator.contentWorkspacePlan || engage);
  const workspace = engage
    ? await db.socialCalendar.findFirst({
        where: { managerId: creator.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, clientName: true },
      })
    : null;
  if (active && workspace && !params.billing && !params.subscriptionPayment)
    redirect(`/dashboard/calendars/${workspace.id}?view=inbox`);
  const usage = engage ? await getContentWorkspaceUsage(creator) : null;
  const otherSubscription =
    !engage && creator.contentWorkspaceBillingStatus === "ACTIVE";
  const remaining = Math.max(
    0,
    Math.min(1000, 1000 - (usage?.aiGenerationsUsed ?? 0)),
  );
  const trialEnd = creator.contentWorkspaceTrialEndsAt?.toLocaleDateString(
    "en-NG",
    { day: "numeric", month: "short", year: "numeric" },
  );
  const home = workspace
    ? `/dashboard/calendars/${workspace.id}?view=inbox`
    : "/dashboard";
  const cycle = params.cycle === "ANNUAL" ? "ANNUAL" : "MONTHLY";
  const features = [
    {
      Icon: MessagesSquare,
      title: "Every conversation, together",
      description: "Facebook, Instagram and WhatsApp. One inbox for your team.",
    },
    {
      Icon: ContactRound,
      title: "Turn interest into opportunity",
      description: "Keep your leads, contact details and next steps connected.",
    },
    {
      Icon: BookOpenText,
      title: "Replies that know your business",
      description:
        "Give AI your products, policies and brand voice. Take over whenever you need.",
    },
  ];
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link
            href="/dashboard"
            className={styles.brand}
            aria-label="Showwork dashboard"
          >
            <ShowworkLogo width={136} />
            <span>Engage</span>
          </Link>
          <Link href={home} className={styles.back}>
            <ArrowLeft size={16} />
            {workspace ? "Back to conversations" : "Back to dashboard"}
          </Link>
        </header>
        <Suspense>
          <CalendarPaymentCallbackHandler />
        </Suspense>
        <div className={styles.pageHeading}>
          <p>
            Customer Messaging <span>/</span>{" "}
            {workspace ? "Plan & usage" : "Get started"}
          </p>
          <span className={styles.secure}>
            <Check size={14} />
            Your business. Your conversations.
          </span>
        </div>
        <div className={styles.layout}>
          <section className={styles.hero} aria-labelledby="engage-heading">
            <div className={styles.heroWatermark} aria-hidden="true">
              <ShowworkLogo mark tone="white" width={240} />
            </div>
            <p className={styles.eyebrow}>
              <span />
              THE CUSTOMER SIDE OF SHOWWORK
            </p>
            <h1 id="engage-heading">
              Good conversations.
              <br />
              <span>Better business.</span>
            </h1>
            <p className={styles.heroCopy}>
              A thoughtful home for your customer messages, AI replies and the
              opportunities that follow.
            </p>
            <div className={styles.platforms} aria-label="Supported channels">
              {["FACEBOOK", "INSTAGRAM", "WHATSAPP"].map((platform) => (
                <span key={platform}>
                  <PlatformBrandIcon platform={platform} size={19} />
                  {platform === "WHATSAPP"
                    ? "WhatsApp"
                    : platform === "FACEBOOK"
                      ? "Facebook"
                      : "Instagram"}
                </span>
              ))}
            </div>
            {workspace ? (
              <Link href={home} className={styles.heroAction}>
                Open conversations
                <ArrowUpRight size={18} />
              </Link>
            ) : (
              <p className={styles.heroFootnote}>
                3 days to make yourself at home. No card required.
              </p>
            )}
          </section>
          <section
            className={styles.benefits}
            aria-label="Included in Showwork Engage"
          >
            <div className={styles.benefitsHeading}>
              <span>MADE FOR YOUR BUSINESS</span>
              <span>Included in Engage</span>
            </div>
            {features.map(({ Icon, title, description }) => (
              <div key={title} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <Icon size={21} />
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </div>
            ))}
            <div className={styles.inclusions}>
              <span>
                <Check size={14} />1 business
              </span>
              <span>
                <Check size={14} />3 team members
              </span>
              <span>
                <Check size={14} />
                1,000 AI replies / month
              </span>
            </div>
          </section>
          <section className={styles.plan} aria-labelledby="engage-plan-title">
            <div className={styles.planTop}>
              <span className={styles.kicker}>
                {workspace ? "YOUR PLAN" : "YOUR NEXT CHAPTER"}
              </span>
              <span className={styles.status}>
                {trial
                  ? "Free trial"
                  : active
                    ? "Active"
                    : canStartTrial
                      ? "3 days free"
                      : "Showwork Engage"}
              </span>
            </div>
            <h2 id="engage-plan-title">
              {workspace
                ? "Showwork Engage"
                : canStartTrial
                  ? "Meet your new inbox."
                  : "One focused plan."}
            </h2>
            <p className={styles.planSubtitle}>
              {workspace
                ? workspace.clientName
                : canStartTrial
                  ? "Start your 3-day free trial. Make it yours."
                  : "Customer messaging, with everything in place."}
            </p>
            {trial && (
              <p className={styles.trialDate}>
                Your free trial ends <strong>{trialEnd}</strong>.
              </p>
            )}
            {workspace && active ? (
              <>
                <div className={styles.usage}>
                  <div className={styles.usageHeading}>
                    <span>
                      <Sparkles size={15} />
                      AI reply allowance
                    </span>
                    <span>This month</span>
                  </div>
                  <p className={styles.usageNumber}>
                    {remaining.toLocaleString()}
                    <span> / 1,000</span>
                  </p>
                  <div
                    role="meter"
                    aria-label="AI replies remaining"
                    aria-valuemin={0}
                    aria-valuemax={1000}
                    aria-valuenow={remaining}
                    className={styles.meter}
                  >
                    <span style={{ width: `${remaining / 10}%` }} />
                  </div>
                  <p className={styles.usageCaption}>
                    Replies remaining · Drafts and automatic replies share this
                    allowance.
                  </p>
                </div>
                {trial ? (
                  <div className={styles.billingSection}>
                    <div className={styles.billingHeading}>
                      <h3>Keep the conversations going.</h3>
                      <p>Choose how you’d like to continue after your trial.</p>
                    </div>
                    <EngageStart
                      active={false}
                      existingSubscription={false}
                      billingCycle={cycle}
                    />
                  </div>
                ) : (
                  <>
                    <p className={styles.currentPrice}>
                      {creator.contentWorkspaceBillingCycle === "ANNUAL"
                        ? "₦149,000"
                        : "₦14,900"}
                      <span>
                        {" "}
                        /{" "}
                        {creator.contentWorkspaceBillingCycle === "ANNUAL"
                          ? "year"
                          : "month"}
                      </span>
                    </p>
                    <EngageBillingActions />
                  </>
                )}
                <p className={styles.humanNote}>
                  Your team’s own replies don’t use the AI allowance.
                </p>
              </>
            ) : (
              <>
                <div className={styles.getStarted}>
                  <EngageStart
                    billingCycle={cycle}
                    canStartTrial={canStartTrial}
                    active={active}
                    existingSubscription={otherSubscription}
                  />
                </div>
                {canStartTrial && (
                  <p className={styles.afterTrial}>
                    After your trial, plans start at ₦14,900 / month. Subscribe
                    when you’re ready.
                  </p>
                )}
              </>
            )}
            <div className={styles.planFooter}>
              <ShowworkLogo mark width={19} />
              <span>One connected space. Powered by Showwork.</span>
            </div>
          </section>
        </div>
        <footer className={styles.footer}>
          <span>Showwork Engage · Customer Messaging</span>
          <Link href="/help/workspace">
            Need a hand?
            <ArrowUpRight size={13} />
          </Link>
        </footer>
      </div>
    </main>
  );
}
