import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import homepageStyles from "@/app/HomePage.module.css";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import MarketingHeader from "@/components/landing/MarketingHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { getCurrentCreator } from "@/lib/auth";
import { CONTENT_WORKSPACE_PLANS, STORAGE_GB } from "@/lib/contentWorkspaceEntitlements";
import { productEntryHref } from "@/lib/productJourney";
import { pageMetadata } from "@/lib/seo";
import { MarketingReality, WorkflowShowcase, WorkspaceScreen, type WorkflowStep } from "../businesses/BusinessShowcase";
import styles from "../businesses/BusinessLanding.module.css";

const path = "/solutions/marketing-agencies";
const studio = CONTENT_WORKSPACE_PLANS.STUDIO;
const description = "Bring your clients, teams, approvals and marketing activities into one connected workspace. Build a more organised agency, deliver consistently and make room for your next stage of growth.";
const action = "Build Your Agency Workspace";

export const metadata = pageMetadata({
  title: "Showwork for Marketing Agencies | Marketing Workspace Studio Plan",
  description,
  path,
});

const workflow: WorkflowStep[] = [
  { label: "Onboard", title: "Give every client their own space.", copy: "Create a dedicated workspace for each brand, keeping its marketing activities separate and organised.", image: "workspaces", alt: "Showwork’s workspace selector with separate sample client workspaces" },
  { label: "Brand knowledge", title: "Keep every brand’s knowledge accessible.", copy: "Store client products, services, audiences, brand voice, guidelines and marketing goals where your team can find them.", image: "knowledge", alt: "Showwork Business Knowledge with sample brand documents" },
  { label: "Plan", title: "Plan with everyone on the same page.", copy: "Organise upcoming content, campaigns and publishing schedules so your team knows what’s next.", image: "calendar", alt: "Showwork content calendar with sample posts scheduled across channels" },
  { label: "Team access", title: "Bring your team into the work.", copy: "Give account managers, strategists and creatives access to the information and activities relevant to their responsibilities.", image: "workspaces", alt: "Showwork workspace cards showing membership counts for sample client accounts" },
  { label: "Client approvals", title: "Make client approvals more professional.", copy: "Present content for review, collect feedback and keep approval decisions connected to the work.", image: "review", alt: "Showwork review workflow showing a sample post ready for client approval" },
  { label: "Publish", title: "Publish from your workspace.", copy: "Manage approved content publishing through supported connected social platforms.", image: "publishing", alt: "Showwork publishing status for a sample approved post" },
  { label: "Report", title: "Make performance easier to understand.", copy: "Access available marketing analytics and share relevant performance information with your clients.", image: "analytics", alt: "Showwork reporting view with a sample client’s content pipeline" },
];

const benefits = [
  ["Take On More Clients Without Starting From Scratch", "Build repeatable workflows that make onboarding and managing additional accounts more consistent."],
  ["Your Agency’s Knowledge Shouldn’t Leave With an Employee", "Keep important client information and marketing context within your agency, even as team members change."],
  ["Make Every Client Feel Well Managed", "Give clients a clearer experience through organised reviews, feedback and performance reporting."],
  ["Know What’s Happening Across Your Accounts", "See ongoing work, pending approvals and upcoming activity without being involved in every conversation."],
  ["Spend Less Time Coordinating. More Time Delivering.", "Bring people, information and workflows together so your team can give more attention to client work."],
];

const inclusions = [
  `Up to ${studio.activeWorkspaces} active client workspaces`,
  `Up to ${studio.collaborators} collaborator slots`,
  "Shared client business knowledge",
  "Content planning and marketing calendars",
  "Team collaboration and client approvals",
  "Publishing to supported social platforms",
  "Advanced analytics and performance recommendations",
  "Social Inbox and lead management on supported channels",
  "AI-assisted content and reply drafting",
  `${STORAGE_GB.STUDIO} GB storage`,
  `${studio.aiGenerations.toLocaleString("en-NG")} shared AI content generations per month`,
];

const questions = [
  ["Can Showwork support multiple client accounts?", `Yes. Create a separate workspace for each client. Studio supports up to ${studio.activeWorkspaces} active workspaces.`],
  ["Can my team collaborate inside Showwork?", "Yes. Invite collaborators, set role-based permissions and share planning, review and publishing workflows."],
  ["Can clients review and approve content?", "Yes. Clients can review proposed content, provide feedback and approve work through supported review workflows."],
  ["Can we manage publishing and reporting?", "Yes, for eligible connected platforms. Available publishing and reporting features depend on the platform, permissions and account access."],
  ["Can our agency upgrade as we grow?", "Yes. You can move to a higher Marketing Workspace tier when you need more capacity or capabilities."],
];

export default async function Page() {
  const signedIn = Boolean(await getCurrentCreator());
  const href = productEntryHref("workspace", { plan: "STUDIO", signedIn });

  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skip}>Skip to content</a>
      <MarketingHeader currentPath={path} isLoggedIn={signedIn} />

      <main id="main-content" data-marketing-motion>
        <section className={styles.hero} aria-labelledby="agency-title">
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div className={styles.heroCopy} data-marketing-hero-copy>
              <p className={styles.kicker}>Showwork for Marketing Agencies</p>
              <h1 id="agency-title">Your agency is growing. <em>Your operations should keep up.</em></h1>
              <p className={styles.lede}>{description}</p>
              <div className={styles.actions}>
                <Link className={styles.primary} href={href}>{action}</Link>
                <a className={styles.secondary} href="#how-it-works">See How Showwork Works</a>
              </div>
            </div>
            <div className={styles.heroStage}>
              <div className={styles.heroPhoto} data-marketing-hero-visual>
                <Image src="/images/landing/6.webp" alt="Nigerian agency team reviewing campaign materials in a creative studio" fill priority sizes="(max-width: 900px) 95vw, 52vw" />
              </div>
              <figure className={styles.heroScreen}>
                <WorkspaceScreen image="workspaces" alt={workflow[0].alt} priority />
                <figcaption>Marketing workspaces · Sample client accounts</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className={styles.reality} aria-labelledby="challenge-title">
          <div className={styles.wrap}>
            <div className={styles.realityIntro}>
              <h2 id="challenge-title">More clients shouldn’t mean more chaos.</h2>
              <p className={styles.lede}>Every new client brings new deadlines and decisions. When brand knowledge lives in someone’s head and approvals live in WhatsApp, growth gets harder to manage.</p>
            </div>
            <MarketingReality />
          </div>
        </section>

        <section id="how-it-works" className={`${styles.workflow} [--workflow-columns:7]`} aria-labelledby="workflow-title">
          <div className={styles.wrap}>
            <h2 id="workflow-title">From client onboarding to reporting. <em>All connected.</em></h2>
            <p className={styles.workflowIntro}>One workspace for the work behind every client account.</p>
            <WorkflowShowcase steps={workflow} idPrefix="agency" />
            <div className={`${styles.actions} mt-6`}><Link className={styles.primary} href={href}>{action}</Link></div>
          </div>
        </section>

        <section className={styles.knowledgeSection} aria-labelledby="benefits-title">
          <div className={`${styles.wrap} ${styles.reportingLayout}`}>
            <div>
              <h2 id="benefits-title">A better-run agency is built behind the scenes.</h2>
              <dl className="mt-6 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
                {benefits.map(([title, copy]) => (
                  <div key={title} className="py-3">
                    <dt className="font-semibold">{title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{copy}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <figure className={styles.reportingScreen} data-marketing-reveal>
              <WorkspaceScreen image="knowledge" alt={workflow[1].alt} />
              <figcaption>Business Knowledge · Sample client documents</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.reportingSection} aria-labelledby="experience-title">
          <div className={`${styles.wrap} ${styles.reportingLayout}`}>
            <div>
              <h2 id="experience-title">One agency. Multiple clients. <em>Everyone aligned.</em></h2>
              <p className={styles.lede}>Imagine eight brands with eight schedules. Account managers have the right briefs, strategists plan content, creatives add assets and clients review what’s ready.</p>
              <p className={`${styles.lede} font-semibold`}>Your team knows what’s next. Your clients stay involved. You know where the work stands.</p>
            </div>
            <figure className={styles.reportingScreen} data-marketing-reveal>
              <WorkspaceScreen image="review" alt={workflow[4].alt} />
              <figcaption>Client review workflow · Sample post</figcaption>
            </figure>
          </div>
        </section>

        <section id="pricing" className={styles.pricing} aria-labelledby="pricing-title">
          <div className={`${styles.wrap} ${styles.priceLayout}`}>
            <div>
              <h2 id="pricing-title">Build the agency you’re ready to become.</h2>
              <p className={styles.lede}>A connected marketing workspace for growing agencies that want to manage client accounts, coordinate their teams and deliver a more professional service.</p>
            </div>
            <article className={styles.priceCard} data-marketing-card>
              <h3>Marketing Workspace · {studio.name} Plan</h3>
              <p className={styles.price}>₦{studio.priceNgnMonthly.toLocaleString("en-NG")} <small>/ month</small></p>
              <ul>{inclusions.map(item => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul>
              <Link className={styles.primary} href={href}>Get Started with Showwork</Link>
              <p className={styles.terms}>Billed monthly. Annual billing is also available in your account.</p>
            </article>
          </div>
          <aside className={styles.faq} aria-labelledby="agency-questions">
            <div className={`${styles.wrap} ${styles.faqGrid}`}>
              <h2 id="agency-questions">Frequently asked questions</h2>
              <div>{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
            </div>
          </aside>
        </section>

        <section className={styles.closing} aria-labelledby="next-step">
          <div className={styles.wrap}>
            <ShowworkLogo mark tone="white" width={220} className={styles.brandMark} />
            <h2 id="next-step">Your next stage of growth needs a better way to work.</h2>
            <p>Give your team clearer processes and a consistent way to deliver for every client.</p>
            <Link className={styles.primary} href={href}>Start Your Agency Workspace</Link>
          </div>
        </section>
      </main>
      <div className={homepageStyles.footerReveal}><SiteFooter homepage /></div>
    </div>
  );
}
