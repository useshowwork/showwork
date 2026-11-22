import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import homepageStyles from "@/app/HomePage.module.css";
import ConnectedInboxVisual from "@/components/landing/ConnectedInboxVisual";
import MarketingHeader from "@/components/landing/MarketingHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { getCurrentCreator } from "@/lib/auth";
import { CONTENT_WORKSPACE_PLANS, formatWorkspaceLimit, STORAGE_GB } from "@/lib/contentWorkspaceEntitlements";
import { productEntryHref } from "@/lib/productJourney";
import { pageMetadata } from "@/lib/seo";
import { MarketingReality, WorkspaceScreen } from "./BusinessShowcase";
import styles from "./BusinessLanding.module.css";

const agency = CONTENT_WORKSPACE_PLANS.UNLIMITED;
const description = "Give good people one place to plan campaigns, get approvals and follow through when customers respond.";
const action = "Get Started with Showwork";

export const metadata = pageMetadata({
  title: "Showwork for Business | Marketing Workspace Agency Plan",
  description,
  path: "/solutions/businesses",
});

const inclusions = [
  `${formatWorkspaceLimit(agency.activeWorkspaces)} active workspaces and ${formatWorkspaceLimit(agency.collaborators).toLowerCase()} collaborators`,
  `${STORAGE_GB.UNLIMITED} GB storage and ${agency.aiGenerations.toLocaleString("en-NG")} shared AI content generations per month`,
  "Business knowledge and Randy in AI Studio",
  "Content calendars, team and client approvals, and supported publishing",
  "Advanced analytics, reporting and AI recommendations",
  "WhatsApp, Instagram and Facebook inbox with lead management",
  "AI reply drafts and opt-in automatic replies",
  "Advanced permissions and priority support",
];

const questions = [
  ["Who can use Agency?", "In-house teams and businesses working with external partners can use Agency. Create a workspace for each brand or business unit and give teammates and partners role-based access."],
  ["When can AI reply automatically?", "Your team can review drafts or reply directly. Automatic replies are opt-in and apply to eligible messages within supported channels’ permissions and reply windows. Your team can take over."],
  ["Which channels can I publish to and report on?", "Publishing and available reporting data depend on the connected account, platform support and permissions."],
  ["How is the Agency plan billed?", "The displayed price is for monthly billing. Annual billing is also available in your account. AI content generations and regenerations draw from the shared allowance."],
];

export default async function Page() {
  const signedIn = Boolean(await getCurrentCreator());
  const href = productEntryHref("workspace", { plan: "UNLIMITED", signedIn });

  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skip}>Skip to content</a>
      <MarketingHeader currentPath="/solutions/businesses" isLoggedIn={signedIn} />
      <main id="main-content" data-marketing-motion>
        <section className={styles.hero} aria-labelledby="business-title">
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div className={styles.heroCopy} data-marketing-hero-copy>
              <h1 id="business-title">Your marketing team <em>needs more than talent.</em></h1>
              <p className={styles.lede}>{description}</p>
              <div className={styles.actions}><Link className={styles.primary} href={href}>{action}</Link></div>
            </div>
            <div className={styles.heroStage}>
              <div className={styles.heroPhoto} data-marketing-hero-visual>
                <Image src="/images/hero2.png" alt="Nigerian business leader working in a contemporary office" fill priority sizes="(max-width: 900px) 95vw, 52vw" />
              </div>
              <figure className={styles.heroScreen}>
                <WorkspaceScreen image="calendar" alt="Showwork content calendar populated with sample campaign posts" priority />
                <figcaption>Marketing Workspace · Sample data</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className={styles.reality} aria-labelledby="problem-title">
          <div className={styles.wrap}>
            <div className={styles.realityIntro}>
              <h2 id="problem-title">One late approval can stall a campaign.</h2>
              <p className={styles.lede}>When briefs, drafts and decisions live in different places, even a good team can miss the moment.</p>
            </div>
            <MarketingReality />
          </div>
        </section>

        <section className={styles.knowledgeSection} aria-labelledby="knowledge-title">
          <div className={`${styles.wrap} ${styles.reportingLayout}`}>
            <div>
              <h2 id="knowledge-title">When your marketer leaves, what stays?</h2>
              <p className={styles.lede}>Keep your offers, customer insights and brand voice in Showwork so the next person can pick up the work.</p>
            </div>
            <figure className={styles.reportingScreen} data-marketing-reveal>
              <WorkspaceScreen image="knowledge" alt="Showwork Business Knowledge with sample brand documents and source controls" />
              <figcaption>Business Knowledge · Sample data</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.inboxSection} aria-labelledby="inbox-title">
          <div className={`${styles.wrap} ${styles.inboxLayout}`}>
            <div>
              <h2 id="inbox-title">Your campaign gets enquiries. <em>Who answers?</em></h2>
              <p className={styles.lede}>Bring WhatsApp, Instagram and Facebook into one inbox with AI drafts and optional automatic replies for eligible messages.</p>
            </div>
            <div data-marketing-reveal><ConnectedInboxVisual /></div>
          </div>
        </section>

        <section id="how-it-works" className={styles.workflow} aria-labelledby="workflow-title">
          <div className={styles.wrap}>
            <h2 id="workflow-title">Five social pages. <em>One place to run them.</em></h2>
            <p className={styles.workflowIntro}>Plan content, collect approvals and publish to supported channels from the same workspace.</p>
            <figure className={styles.campaignScreens}>
              <div className={styles.browser}>
                <WorkspaceScreen image="calendar" alt="Showwork content calendar with sample posts across multiple channels" />
              </div>
              <div className={styles.browser}>
                <WorkspaceScreen image="publishing" alt="Showwork publishing status for a sample approved Facebook post" />
              </div>
              <figcaption>Content calendar and publishing · Sample data</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.reportingSection} aria-labelledby="reporting-title">
          <div className={`${styles.wrap} ${styles.reportingLayout}`}>
            <div>
              <h2 id="reporting-title">What’s worth spending on again?</h2>
              <p className={styles.lede}>Use available channel results to decide what to repeat, what to change and what to test next.</p>
            </div>
            <figure className={styles.reportingScreen} data-marketing-reveal>
              <WorkspaceScreen image="analytics" alt="Showwork reporting dashboard showing a sample content pipeline by channel and review stage" />
              <figcaption>Showwork reporting · Sample content pipeline</figcaption>
            </figure>
          </div>
        </section>

        <section id="pricing" className={styles.pricing} aria-labelledby="pricing-title">
          <div className={`${styles.wrap} ${styles.priceLayout}`}>
            <div>
              <h2 id="pricing-title">Give your next campaign a stronger start.</h2>
              <p className={styles.lede}>Bring your people, plans and customer conversations together with Showwork Agency.</p>
            </div>
            <article className={styles.priceCard} data-marketing-card>
              <h3>Showwork {agency.name}</h3>
              <p className={styles.price}>₦{agency.priceNgnMonthly.toLocaleString("en-NG")} <small>/ month</small></p>
              <ul>{inclusions.map(item => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul>
              <Link className={styles.primary} href={href}>{action}</Link>
            </article>
          </div>
          <aside className={styles.faq} aria-labelledby="buyer-questions">
            <div className={`${styles.wrap} ${styles.faqGrid}`}>
              <h2 id="buyer-questions">Plan questions</h2>
              <div>{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
            </div>
          </aside>
        </section>
      </main>
      <div className={homepageStyles.footerReveal}><SiteFooter homepage /></div>
    </div>
  );
}
