import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import MarketingHeader from "@/components/landing/MarketingHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { WorkflowShowcase, WorkspaceScreen, type WorkflowStep } from "../businesses/BusinessShowcase";
import { getCurrentCreator } from "@/lib/auth";
import { CONTENT_WORKSPACE_PLANS, CONTENT_WORKSPACE_TRIAL_DAYS, STORAGE_GB } from "@/lib/contentWorkspaceEntitlements";
import { productEntryHref } from "@/lib/productJourney";
import { pageMetadata } from "@/lib/seo";
import homepageStyles from "@/app/HomePage.module.css";
import styles from "../businesses/BusinessLanding.module.css";
import editorial from "./FreelancerLanding.module.css";

const path = "/solutions/social-media-managers";
const description = "Different clients. Different brands. One workspace for your content, approvals and reporting. Work smarter, deliver professionally and make room for what’s next.";
const recommendations = [
  { key: "CREATOR", audience: "For independent managers building their client roster." },
  { key: "GROWTH", audience: "For managers taking on more accounts and bringing in help." },
] as const;

export const metadata = pageMetadata({
  title: "Showwork for Freelancers & Social Media Managers",
  description,
  path,
});

const images = "/images/landing/freelancers";
const workspaceAlt = "Showwork’s workspace selector with five separate sample client workspaces";

const brands = [
  { image: "fashion", label: "Fashion", alt: "Nigerian fashion editorial in warm terracotta tones" },
  { image: "hospitality", label: "Food & Hospitality", alt: "A plated Nigerian restaurant dish with jollof rice and grilled chicken" },
  { image: "real-estate", label: "Real Estate", alt: "Contemporary Lagos apartment building with planted terraces" },
  { image: "beauty", label: "Beauty", alt: "Ivory skincare packaging in a green studio still life" },
  { image: "technology", label: "Technology", alt: "Graphite wireless earbuds on a cool studio background" },
];

const workflow: WorkflowStep[] = [
  { label: "Onboard", title: "Give every client their own space.", copy: "Create a separate workspace for each brand so you always start in the right place.", image: "workspaces", alt: workspaceAlt },
  { label: "Understand", title: "Get the brand context right.", copy: "Keep each client’s products, audience, goals and brand voice accessible.", image: "knowledge", alt: "Showwork business knowledge with sample brand documents" },
  { label: "Plan", title: "Plan around each client’s calendar.", copy: "Build out campaigns, prepare content and manage publishing schedules by brand.", image: "calendar", alt: "Showwork’s content calendar with sample campaign posts" },
  { label: "Approve", title: "Make the next decision clear.", copy: "Share posts for review and keep feedback and approval decisions with the work.", image: "review", alt: "Showwork’s review workflow showing a sample post ready for client approval" },
  { label: "Publish", title: "Manage publishing from Showwork.", copy: "Use supported connected accounts to manage publishing for approved posts.", image: "publishing", alt: "Showwork’s publishing panel for a sample approved post" },
  { label: "Report", title: "Show the work behind the results.", copy: "Review available performance data and share useful updates with your clients.", image: "analytics", alt: "Showwork’s reporting view showing the sample client’s content pipeline" },
];

const questions = [
  ["Can I manage multiple clients with Showwork?", "Yes. You can create dedicated workspaces for different clients, subject to your subscription's active workspace allowance."],
  ["Does each client have their own workspace?", "Yes. Each workspace keeps that client's business information, content planning and related marketing activities organised."],
  ["Can my clients review and approve content?", "Yes. Showwork supports client reviews, feedback and content approvals."],
  ["Can I share performance reports with clients?", "Showwork provides reporting capabilities using available data from supported connected platforms. Access and reporting features depend on your plan and platform permissions."],
  ["Can I upgrade as my business grows?", "Yes. You can move to a higher subscription plan when you need additional workspace capacity, team access or advanced capabilities."],
];

export default async function Page() {
  const signedIn = Boolean(await getCurrentCreator());
  const workspaceHref = productEntryHref("workspace", { signedIn });
  const workspaceAction = signedIn ? "Open Your Workspace" : "Start Your Workspace";

  return (
    <div className={`${styles.page} ${editorial.page}`}>
      <a href="#main-content" className={styles.skip}>Skip to content</a>
      <MarketingHeader currentPath={path} isLoggedIn={signedIn} />
      <main id="main-content" data-marketing-motion>
        <section className={editorial.hero} aria-labelledby="solution-title">
          <div className={`${styles.wrap} ${editorial.heroLayout}`}>
            <div className={editorial.heroCopy} data-marketing-hero-copy>
              <p className={styles.kicker}>Showwork for Freelancers & Social Media Managers</p>
              <h1 id="solution-title">Make Room for <em>More Clients.</em></h1>
              <p className={styles.lede}>{description}</p>
              <div className={styles.actions}>
                <Link className={styles.primary} href={workspaceHref}>{workspaceAction}</Link>
                <a className={styles.secondary} href="#how-it-works">See How It Works</a>
              </div>
            </div>
            <div className={editorial.heroVisual}>
              <div className={editorial.portrait} data-marketing-hero-visual>
                <Image src={`${images}/hero.webp`} alt="Nigerian freelance social media strategist working in a Lagos studio" fill priority sizes="(max-width: 900px) 95vw, 56vw" />
              </div>
              <figure className={editorial.heroWorkspace}>
                <WorkspaceScreen image="workspaces" alt={workspaceAlt} priority />
                <figcaption>Marketing workspaces · Sample clients</figcaption>
              </figure>
              <div className={editorial.heroBrands} aria-hidden="true">
                {brands.slice(0, 3).map(brand => (
                  <div key={brand.image}><Image src={`${images}/${brand.image}.webp`} alt="" width={360} height={340} sizes="(max-width: 720px) 24vw, 120px" /></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={editorial.worlds} aria-labelledby="challenge-title">
          <div className={styles.wrap}>
            <div className={editorial.sectionIntro}>
              <h2 id="challenge-title">Five Clients. Five Different Brands. <em>One You.</em></h2>
              <p className={styles.lede}>Different audiences, brand voices and expectations. Keeping up with every client shouldn’t mean starting from scratch every day.</p>
            </div>
            <div className={editorial.collage}>
              {brands.map(brand => (
                <figure key={brand.image} className={editorial.clientWorld} data-marketing-photo data-world={brand.image}>
                  <Image src={`${images}/${brand.image}.webp`} alt={brand.alt} fill sizes="(max-width: 720px) 49vw, (max-width: 1050px) 32vw, 420px" />
                  <figcaption>{brand.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className={styles.workflow} aria-labelledby="workflow-title">
          <div className={styles.wrap}>
            <h2 id="workflow-title">Everything Your Clients Need. <em>One Place to Work.</em></h2>
            <p className={editorial.workflowLead}>From understanding a brand to publishing content and sharing results, keep your marketing work connected.</p>
            <WorkflowShowcase steps={workflow} idPrefix="freelancer" />
          </div>
        </section>

        <section className={editorial.advantages} aria-labelledby="benefits-title">
          <div className={styles.wrap}>
            <h2 id="benefits-title">Less Busywork. <em>More Room to Create.</em></h2>
            <div className={editorial.advantageGrid}>
              <article className={editorial.capacity}>
                <Image src="/images/landing/4.webp" alt="Social media manager planning a campaign in Showwork at her desk" fill sizes="(max-width: 720px) 94vw, 53vw" />
                <div><h3>Make Space for Another Client.</h3><p>Build a repeatable workflow so taking on another brand doesn’t mean starting from scratch.</p></div>
              </article>
              <article className={editorial.brandContext}>
                <h3>Every Brand, Understood.</h3><p>Keep the details people depend on, from a client’s brand voice to their next campaign, organised and easy to find.</p>
              </article>
              <article className={editorial.approval}>
                <h3>Less Chasing. More Doing.</h3><p>Give clients a clear place to review work, leave feedback and approve content.</p>
                <details>
                  <summary>See the approval screen</summary>
                  <WorkspaceScreen image="review" alt={workflow[3].alt} />
                </details>
              </article>
              <article className={editorial.reporting}>
                <div><h3>Reports Without the Scramble.</h3><p>Keep available performance information together so you can spend more time understanding what the numbers mean.</p></div>
                <WorkspaceScreen image="analytics" alt={workflow[5].alt} />
              </article>
            </div>
          </div>
        </section>

        <section className={editorial.experience} aria-labelledby="experience-title">
          <div className={styles.wrap}>
            <div className={editorial.sectionIntro}>
              <h2 id="experience-title">Make Every Client Feel Like <em>Your Biggest Client.</em></h2>
              <p className={styles.lede}>Give your clients a more organised experience, from content reviews to performance updates.</p>
            </div>
            <div className={editorial.experienceScene}>
              <div className={editorial.experiencePhoto} data-marketing-photo>
                <Image src={`${images}/client-review.webp`} alt="A Nigerian freelancer and client reviewing a printed content plan together" fill sizes="(max-width: 720px) 94vw, 61vw" />
              </div>
              <figure className={editorial.reviewScreen}>
                <WorkspaceScreen image="review" alt={workflow[3].alt} />
                <figcaption>Showwork review workflow · Sample post</figcaption>
              </figure>
            </div>
            <ol className={editorial.clientJourney}>
              <li><h3>Prepare the content.</h3><p>The freelancer gathers the creative and captions inside the right client workspace.</p></li>
              <li><h3>Give the client a clear review.</h3><p>The client can see the proposed post, leave feedback and approve it.</p></li>
              <li><h3>Keep everyone informed.</h3><p>Decisions stay with the work, and available results can guide the next campaign.</p></li>
            </ol>
          </div>
        </section>

        <section id="pricing" className={styles.pricing} aria-labelledby="pricing-title">
          <div className={styles.wrap}>
            <div className={editorial.planIntro}>
              <h2 id="pricing-title">Find the right plan for <em>your client roster.</em></h2>
              <p className={styles.lede}>Both plans include brand knowledge, content calendars, client approvals, supported publishing, basic analytics and AI-assisted content creation.</p>
            </div>
            <div className={editorial.planGrid}>
              {recommendations.map(({ key, audience }) => {
                const plan = CONTENT_WORKSPACE_PLANS[key];
                const features = [
                  `Up to ${plan.activeWorkspaces} active client workspaces`,
                  `Up to ${plan.collaborators} collaborator slots`,
                  `${STORAGE_GB[key]} GB storage`,
                  `${plan.aiGenerations.toLocaleString("en-NG")} shared AI generations per month`,
                  ...(key === "GROWTH" ? ["Randy in AI Studio for research and content planning"] : []),
                ];
                return (
                  <article key={key} className={`${styles.priceCard} ${editorial.recommendedPlan}`} data-plan={key} data-marketing-card>
                    <h3>{plan.name} Plan</h3>
                    <p className={styles.terms}>{audience}</p>
                    <p className={styles.price}>₦{plan.priceNgnMonthly.toLocaleString("en-NG")} <small>/ month</small></p>
                    <ul>{features.map(feature => <li key={feature}><Check size={17} aria-hidden="true" />{feature}</li>)}</ul>
                    <Link className={styles.primary} href={productEntryHref("workspace", { plan: key, signedIn })}>Choose {plan.name}</Link>
                  </article>
                );
              })}
            </div>
            {!signedIn && (
              <p className={editorial.planTrial}>
                <Link href={workspaceHref}>Start a {CONTENT_WORKSPACE_TRIAL_DAYS}-day free trial</Link> if your account is eligible. No card required.
              </p>
            )}
          </div>
        </section>

        <section className={styles.faq} aria-labelledby="buyer-questions">
          <div className={`${styles.wrap} ${styles.faqGrid}`}>
            <h2 id="buyer-questions">Frequently Asked Questions</h2>
            <div>{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
          </div>
        </section>

        <section className={`${styles.closing} ${editorial.closing}`} aria-labelledby="next-step">
          <div className={styles.wrap}>
            <ShowworkLogo mark tone="white" width={220} className={styles.brandMark} />
            <h2 id="next-step">You’re Building a Business. Work Like It.</h2>
            <p>Give every client the attention they deserve, without losing control of everything else.</p>
            <Link className={styles.primary} href={workspaceHref}>Get Started with Showwork</Link>
          </div>
        </section>
      </main>
      <div className={homepageStyles.footerReveal}><SiteFooter homepage /></div>
    </div>
  );
}
