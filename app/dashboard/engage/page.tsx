import { getContentWorkspacePlan, hasBundledEngageAccess } from "@/lib/contentWorkspacePolicy";
import AccountAvatarLink from "@/components/identity/AccountAvatarLink";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import PlatformBrandIcon from "@/components/calendars/PlatformBrandIcon";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CreditCard } from "lucide-react";
import styles from "@/components/engage/EngagePlan.module.css";
import navStyles from "@/components/calendars/CalendarDashboard.module.css";
import HelpLink from "@/components/help/HelpLink";
import EngageBillingActions from "@/components/engage/EngageBillingActions";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  MessagesSquare,
  ContactRound,
  BookOpenText,
} from "lucide-react";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isContentWorkspaceTrialActive,
  getContentWorkspaceUsage,
} from "@/lib/contentWorkspaceUsage";
import { CONTENT_WORKSPACE_PLANS, ENGAGE_TRIAL_AI_REPLY_LIMIT } from "@/lib/contentWorkspaceEntitlements";
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
  if (hasBundledEngageAccess(creator) && params.subscriptionPayment !== "callback") {
    const plan = getContentWorkspacePlan(creator)!;
    const limit = CONTENT_WORKSPACE_PLANS[plan].activeWorkspaces;
    const workspaces = await db.socialCalendar.findMany({
      where: { managerId: creator.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, clientName: true },
      ...(limit < Number.MAX_SAFE_INTEGER ? { take: limit } : {}),
    });
    const inboxHref = (id: string) => `/dashboard/calendars/${encodeURIComponent(id)}?view=inbox`;
    if (workspaces.length === 1) redirect(inboxHref(workspaces[0].id));

    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <nav aria-label="Engage navigation" className={navStyles.nav}>
            <Link href="/dashboard" className={navStyles.homeLink}><ArrowLeft size={16} /> All tools</Link>
            <AccountAvatarLink name={creator.name || creator.email} src={creator.avatarUrl} />
          </nav>
          <section className="mx-auto max-w-2xl px-4 py-12">
            <h1 className="text-3xl font-semibold">Showwork Engage</h1>
            <p className="mt-2 text-slate-600">Your {CONTENT_WORKSPACE_PLANS[plan].name} plan includes Engage. Choose the workspace whose conversations you want to open.</p>
            {workspaces.length ? (
              <ul className="mt-6 grid gap-3">
                {workspaces.map(workspace => <li key={workspace.id}>
                  <Link href={inboxHref(workspace.id)} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3 font-medium text-slate-900 hover:border-blue-400">
                    <span>{workspace.clientName}</span><ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>)}
              </ul>
            ) : <Link href="/dashboard/calendars" className="mt-6 inline-flex rounded-xl bg-[#155FC7] px-4 py-3 font-medium text-white">Set up your first workspace</Link>}
          </section>
        </div>
      </main>
    );
  }

  const engage = creator.contentWorkspacePlan === "ENGAGE";
  const trial =
    engage &&
    creator.contentWorkspaceBillingStatus === "TRIAL" &&
    isContentWorkspaceTrialActive(creator);
  const active = engage && (creator.contentWorkspaceBillingStatus === "ACTIVE" || trial);
  const trialAvailable =
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
  const canStartTrial = trialAvailable && !active && !workspace;
  const usage = active && workspace ? await getContentWorkspaceUsage(creator) : null;
  const otherSubscription =
    !engage && creator.contentWorkspaceBillingStatus === "ACTIVE";
  const replyLimit = usage?.aiGenerationLimit ?? 0;
  const remaining = usage?.aiGenerationsRemaining ?? 0;
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
        <nav aria-label="Engage navigation" className={navStyles.nav}>
          <Link href="/dashboard" className={navStyles.homeLink}>
            <ShowworkLogo width={96} />
            <span className={navStyles.allTools}>
              <ArrowLeft size={14} aria-hidden="true" />
              Go back to all tools
            </span>
          </Link>
          <div className={`${navStyles.navActions} ${styles.navActions}`}>
            <AccountAvatarLink name={creator.name || creator.email} src={creator.avatarUrl} />
            <HelpLink className={navStyles.helpLink} />
            {active && workspace && (
              <Link href={home} className={navStyles.billingLink}>
                Go to conversations
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            <Link href={`/dashboard/billing?product=engage&cycle=${cycle}`} className={navStyles.billingLink}>
              <CreditCard aria-hidden="true" className="hidden h-4 w-4 shrink-0 sm:block" />
              Billing
            </Link>
          </div>
        </nav>
        <Suspense>
          <CalendarPaymentCallbackHandler />
        </Suspense>
        <div className={styles.content}>
          <header className={styles.intro}>
            <h1>Chat with your customers.</h1>
            <p>Manage Facebook, Instagram and WhatsApp conversations from one inbox.</p>
          </header>
          <section className={styles.plan} aria-labelledby="engage-plan-title">
            <div className={styles.planHeading}>
              <span className={styles.planIcon}>
                <MessagesSquare size={22} aria-hidden="true" />
              </span>
              <div>
                <h2 id="engage-plan-title">Showwork Engage</h2>
                <p className={styles.subtitle}>{workspace?.clientName ?? "Customer messaging"}</p>
              </div>
            </div>

            <div className={styles.planActions}>
              {active && workspace ? (
                <>
                  <p className={styles.status}>
                    {trial ? (
                      <>Your free trial ends <strong>{trialEnd}</strong>. Subscribe to keep access after your trial.</>
                    ) : (
                      <>Subscription active · {creator.contentWorkspaceBillingCycle === "ANNUAL" ? "₦149,000 / year" : "₦14,900 / month"}</>
                    )}
                  </p>
                  <Link href={home} className={styles.primary}>
                    Go to conversations <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <div className={styles.usage}>
                    <p><strong>{remaining.toLocaleString()} / {replyLimit.toLocaleString()}</strong> AI replies remaining {trial ? "in your trial" : "this month"}</p>
                    <meter aria-label="AI replies remaining" min={0} max={replyLimit} value={remaining} />
                    <p>Drafts and automatic replies share this allowance. Manual replies don’t count toward it.</p>
                  </div>
                  {trial ? (
                    <details className={styles.disclosure} open={remaining === 0}>
                      <summary>{remaining === 0 ? "Subscribe to continue using AI replies" : "Subscribe to Engage"} <ChevronDown size={16} aria-hidden="true" /></summary>
                      <div className={styles.disclosureBody}>
                        <EngageStart active={false} existingSubscription={false} billingCycle={cycle} />
                      </div>
                    </details>
                  ) : <EngageBillingActions />}
                </>
              ) : (
                <>
                  {otherSubscription ? (
                    <Link href="/dashboard/calendars" className={styles.primary}>
                      Go to Marketing Workspace <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  ) : (
                    <p className={styles.status} data-required={!active && !canStartTrial}>
                      {active
                        ? "Create your business to open your inbox."
                        : canStartTrial
                          ? `Start with a 3-day free trial and ${ENGAGE_TRIAL_AI_REPLY_LIMIT} AI replies total. Subscribe to keep access after the trial.`
                          : "Subscription required. Choose a billing cycle and subscribe to access conversations."}
                    </p>
                  )}
                  <EngageStart
                    billingCycle={cycle}
                    canStartTrial={canStartTrial}
                    active={active}
                    existingSubscription={otherSubscription}
                  />
                </>
              )}
            </div>
          </section>
          <details className={`${styles.disclosure} ${styles.benefits}`}>
            <summary>What’s included in Engage <ChevronDown size={16} aria-hidden="true" /></summary>
            <div className={styles.disclosureBody}>
              <div className={styles.platforms} aria-label="Supported channels">
                {[
                  ["FACEBOOK", "Facebook"],
                  ["INSTAGRAM", "Instagram"],
                  ["WHATSAPP", "WhatsApp"],
                ].map(([platform, label]) => (
                  <span key={platform}>
                    <PlatformBrandIcon platform={platform} size={16} />
                    {label}
                  </span>
                ))}
              </div>
              <ul className={styles.features}>
                {features.map(({ Icon, title, description }) => (
                  <li key={title}>
                    <Icon size={18} aria-hidden="true" />
                    <div><strong>{title}</strong><p>{description}</p></div>
                  </li>
                ))}
              </ul>
              <ul className={styles.inclusions}>
                {["1 business", "3 team members", "1,000 AI replies / month with a subscription"].map(label => (
                  <li key={label}><Check size={14} aria-hidden="true" />{label}</li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}
