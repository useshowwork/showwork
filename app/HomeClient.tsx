"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BookOpenText, CalendarDays, ChartNoAxesCombined, ChevronDown, ChevronRight, FileCheck2, MessageCircle, Send, UsersRound } from "lucide-react";
import BookDemoModal from "@/components/landing/BookDemoModal";
import PricingSection from "@/components/landing/PricingSection";
import MarketingHeader from "@/components/landing/MarketingHeader";
import { productPages } from "@/lib/productPages";
import { solutionNavigation } from "@/lib/solutionNavigation";
import SiteFooter from "@/components/landing/SiteFooter";
import SectionTransition from "@/components/landing/SectionTransition";
import { productEntryHref } from "@/lib/productJourney";
import { CONTENT_WORKSPACE_PLANS, CONTENT_WORKSPACE_TRIAL_DAYS } from "@/lib/contentWorkspaceEntitlements";
import styles from "./HomePage.module.css";

const audienceRoutes = new Map(solutionNavigation.map(solution => [solution.homeSection, solution.href]));

const audiences = [
  { section: "businesses", label: "Businesses", title: "You're Investing in Marketing. Is It Working?", copy: "Your team is busy, but are you seeing results? Keep your people, campaigns, customer conversations and performance connected.", action: "Explore Showwork for Businesses", photo: "/images/landing/9.webp", alt: "Business owner and marketing team in a Nigerian office" },
  { section: "agencies", label: "Marketing Agencies", title: "More Clients Shouldn't Mean More Chaos.", copy: "Different brands, endless approvals and growing teams. Keep every client's marketing organised without losing control of delivery.", action: "Explore Showwork for Agencies", photo: "/images/landing/6.webp", alt: "Nigerian agency team reviewing campaign materials" },
  { section: "managers", label: "Social Media Managers", title: "Your Next Client Shouldn't Overwhelm You.", copy: "Too many brands, deadlines and client revisions? Plan content, manage approvals and publish without the constant back-and-forth.", action: "Explore Showwork for Social Media Managers", photo: "/images/landing/freelancers/hero.webp", alt: "Nigerian social media manager at her desk" },
  { section: "retailers", label: "Small Businesses & Retailers", title: "You're Busy Selling. Who's Answering Your Customers?", copy: "Running promotions while enquiries pile up? Let Showwork help you respond, manage conversations and keep potential customers engaged.", action: "Explore Showwork for Small Businesses", photo: "/images/landing/retail-owner.webp", alt: "Lagos shop owner helping customers at her counter" },
] as const;

const problems = [
  { title: "Knowledge gets lost.", copy: "Brand details leave with the people who know them.", icon: BookOpenText },
  { title: "Work gets delayed.", copy: "The work is ready. The approval is buried in a chat.", icon: FileCheck2 },
  { title: "Customers get missed.", copy: "Enquiries keep coming while your team is busy.", icon: MessageCircle },
];

const features = [
  { label: "Business Knowledge", icon: BookOpenText, copy: "Keep brand details close, even when the team changes.", screen: "knowledge", width: 1200, height: 690, alt: "Showwork Business Knowledge with sample brand documents" },
  { label: "Content Planning", icon: CalendarDays, copy: "Plan each campaign in the calendar. Use Randy in AI Studio from Growth to research ideas.", screen: "calendar", width: 1200, height: 760, alt: "Showwork content calendar with sample posts across channels" },
  { label: "Approvals", icon: UsersRound, copy: "Keep feedback and decisions with the post they belong to.", screen: "review", width: 1200, height: 650, alt: "Showwork team review showing a post ready for client approval" },
  { label: "Publishing", icon: Send, copy: "Publish approved posts on supported channels and see what went live.", screen: "publishing", width: 1200, height: 650, alt: "Showwork publishing status for an approved Facebook post" },
  { label: "Reporting", icon: ChartNoAxesCombined, copy: "Use available results to decide what to repeat next. Advanced reporting and AI recommendations start at Studio.", screen: "analytics", width: 1180, height: 541, alt: "Showwork reporting screen with a sample content pipeline" },
];

const faqs = [
  { question: "Can Showwork reply when our team is away?", answer: "Engage and the Agency plan offer opt-in automatic replies for eligible enquiries. Teams can take over. Supported accounts, permissions and reply windows apply." },
  { question: "Which AI features are included?", answer: `Creator includes content generation. Randy starts at Growth (₦${CONTENT_WORKSPACE_PLANS.GROWTH.priceNgnMonthly.toLocaleString("en-NG")}/month). AI recommendations and inbox drafts start at Studio. Agency adds opt-in automatic replies.` },
  { question: "Does Showwork offer a free trial?", answer: `Eligible accounts can try Engage or Marketing Workspace for ${CONTENT_WORKSPACE_TRIAL_DAYS} days without a card. Marketing Workspace trials include Agency features.` },
  { question: "Do I need Marketing Workspace to deliver projects?", answer: "No. Project Delivery and Portfolio work independently of Marketing Workspace." },
];

const secondaryProducts = [
  { product: productPages.delivery, image: "delivery", height: 640, alt: "Showwork Project Delivery overview with file approvals and a sample client link" },
  { product: productPages.portfolio, image: "portfolio", height: 710, alt: "A sample creative portfolio displayed using Showwork Portfolio" },
];

function Intro({ eyebrow, title, children, id }: { eyebrow?: string; title: ReactNode; children?: ReactNode; id?: string }) {
  return <div className={styles.intro}>{eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}<h2 id={id}>{title}</h2>{children && <p>{children}</p>}</div>;
}

export default function HomeClient({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [demoOpen, setDemoOpen] = useState(false);
  const [feature, setFeature] = useState(0);
  const [verticalFeatures, setVerticalFeatures] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const startHref = productEntryHref("workspace", { signedIn: isLoggedIn });
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) setActiveSection(entry.target.id); }); }, { rootMargin: "-15% 0px -60% 0px" });
    ["workspace", "solutions", "pricing", "resources", "company"].forEach(id => { const el = document.getElementById(id); if (el) sections.observe(el); });
    return () => sections.disconnect();
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 901px)");
    const sync = () => setVerticalFeatures(query.matches);
    sync(); query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number, count: number, select: (index: number) => void, prefix: string) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + count - 1) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault(); select(next); document.getElementById(`${prefix}-${next}`)?.focus();
  }
  const current = features[feature];
  const demo = () => setDemoOpen(true);
  return <div className={styles.home}>
    <a href="#main-content" className={styles.skipLink}>Skip to content</a>
    <MarketingHeader isLoggedIn={isLoggedIn} activeSection={activeSection} onBookDemo={demo} />
    <main id="main-content" data-marketing-motion>
      <div className={styles.inboxSequence}>
      <div className={`${styles.scrollScene} ${styles.inboxBackdrop}`}>
      <section className={`${styles.hero} ${styles.sceneBackdrop}`} aria-labelledby="home-heading" data-marketing-hero-in-place>
        <picture className={styles.heroPicture} data-marketing-hero-visual><source media="(max-width: 760px)" srcSet="/images/landing/1mobile.webp"/><img src="/images/landing/1.webp" alt="Nigerian marketing professionals sharing ideas around a table in a bright office" width={1672} height={941} fetchPriority="high" loading="eager"/></picture>
        <div className={styles.heroInner}><div className={styles.heroCopy} data-marketing-hero-copy><span className={styles.eyebrow}>THE INTELLIGENT MARKETING WORKSPACE</span><h1 id="home-heading">Great marketing takes more than <br/><em>great people.</em></h1><p>Your business knowledge, content, team, customer conversations and results. Finally, working together.</p><div className={styles.actions}><Link href={startHref} className={styles.primary}>{isLoggedIn ? "Open your workspaces" : "Get Started with Showwork"}<ArrowUpRight size={18}/></Link><a href="#how-it-works" className={styles.secondary}>See How It Works<ArrowRight size={17}/></a></div><small>For teams, freelancers and small businesses.</small></div></div>
      </section>

      <SectionTransition variant="opening" className={styles.openingBand}>
        <section className={`${styles.section} ${styles.problem}`} aria-labelledby="problem-heading">
          <div className={`${styles.container} ${styles.problemCompact}`}>
            <Intro title="Good Teams Struggle With Bad Workflows." id="problem-heading">Great ideas get lost between scattered briefs, delayed approvals, missed messages and disconnected tools.</Intro>
            <dl className={`${styles.problemList} ${styles.problemMoments}`}>
              {problems.map(({ title, copy, icon: Icon }) => (
                <div key={title}><dt><Icon size={19} aria-hidden="true" />{title}</dt><dd>{copy}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        <section id="workspace" className={`${styles.section} ${styles.workspace}`} aria-labelledby="workspace-heading">
          <div className={styles.container}>
            <div id="how-it-works" className={styles.workspaceIntro}>
              <Intro eyebrow="MARKETING WORKSPACE" title="Everything Behind Great Marketing. Connected." id="workspace-heading">From understanding your brand to publishing content and measuring results, keep your marketing work together.</Intro>
            </div>
            <div className={styles.productExplorer}>
              <div className={styles.explorerRail}>
                <div role="tablist" aria-label="Explore the Marketing Workspace workflow" aria-orientation={verticalFeatures ? "vertical" : "horizontal"} className={styles.explorerTabs}>
                  {features.map((item,index) => (
                    <button key={item.label} id={`feature-${index}`} type="button" role="tab" aria-selected={feature === index}
                      aria-controls="feature-panel" tabIndex={feature === index ? 0 : -1} onClick={() => setFeature(index)}
                      onKeyDown={event => moveTab(event,index,features.length,setFeature,"feature")}>
                      <span className={styles.explorerIcon}><item.icon size={19} aria-hidden="true" /></span>
                      <strong>{item.label}</strong><ChevronRight size={15} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
              <div id="feature-panel" role="tabpanel" aria-labelledby={`feature-${feature}`} tabIndex={0} className={styles.explorerPanel}>
                <figure className={`${styles.explorerVisual} ${styles.productCapture}`} key={current.screen} data-marketing-swap>
                  <a href={`/images/landing/business/${current.screen}.webp`} target="_blank" rel="noopener"
                    aria-label={`View full-size ${current.label} screenshot (opens in a new tab)`}>
                    <Image src={`/images/landing/business/${current.screen}.webp`} alt={current.alt} width={current.width} height={current.height} sizes="(max-width: 900px) 92vw, 62vw" />
                  </a>
                  <figcaption>Showwork Marketing Workspace · Sample data</figcaption>
                </figure>
                <p className={styles.featureEvidence}>{current.copy}</p>
                <div className={styles.explorerSummary}><Link href={productPages.workspace.href} className={styles.explorerAction}>Explore Marketing Workspace<ArrowUpRight size={17}/></Link></div>
              </div>
            </div>
          </div>
        </section>
      </SectionTransition>
      </div>

      <SectionTransition variant="replies" className={styles.inboxBand}>
        <div className={styles.scrollScene}>
          <section id="customer-replies" className={`${styles.section} ${styles.replySolution} ${styles.sceneBackdrop}`} aria-labelledby="reply-heading">
            <div className={`${styles.container} ${styles.replyLayout}`}>
              <div>
                <Intro eyebrow="SHOWWORK ENGAGE" title="Your Next Customer Shouldn’t Have to Wait." id="reply-heading">Campaigns bring enquiries. Showwork helps your team manage conversations and respond with AI assistance when available.</Intro>
                <div className={styles.actions}><Link href={productPages.engage.href} className={styles.primary}>Explore AI Inbox<ArrowUpRight size={17}/></Link></div>
                <details className={styles.replyTerms}><summary>How AI replies work</summary><p>Connect supported WhatsApp, Instagram and Facebook accounts. Automatic replies are opt-in for eligible messages, with account permissions and reply windows. Your team can take over.</p></details>
              </div>
              <figure className={styles.productCapture} data-marketing-reveal>
                <Image src="/images/landing/product/inbox.webp" alt="Showwork inbox with sample WhatsApp, Instagram and Facebook enquiries and an AI-assisted reply" width={1200} height={750} sizes="(max-width: 760px) 92vw, 48vw" />
                <figcaption>Showwork AI Inbox · Sample conversations</figcaption>
              </figure>
            </div>
          </section>

          <section id="solutions" className={`${styles.section} ${styles.solutions}`} aria-labelledby="solutions-heading">
            <div className={styles.container}>
              <div className={styles.wideIntro}>
                <Intro title="Find Showwork for the way you work." id="solutions-heading" />
              </div>
              <div className={styles.audienceGrid}>
                {audiences.map(audience => (
                    <article key={audience.section} id={audience.section} data-audience={audience.section} data-marketing-card>
                      <div className={styles.audiencePhoto}>
                        <Image src={audience.photo} alt={audience.alt} fill
                          sizes={audience.section === "businesses" ? "(max-width: 760px) 92vw, 50vw" : "(max-width: 760px) 30vw, 16vw"} />
                      </div>
                      <div className={styles.audienceCopy}>
                        <span className={styles.audienceLabel}>{audience.label}</span>
                        <h3>{audience.title}</h3><p>{audience.copy}</p>
                        <Link href={audienceRoutes.get(audience.section)!} className={styles.textLink}>{audience.action}<ArrowUpRight size={18} /></Link>
                      </div>
                    </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </SectionTransition>
      </div>

      <section id="tools" className={`${styles.section} ${styles.delivery}`} aria-labelledby="delivery-heading">
        <div className={styles.container}>
          <div className={styles.wideIntro}><Intro title="Great Creative Work Deserves Better Delivery." id="delivery-heading">Present your work professionally, share projects with clients and build a portfolio that reflects your talent.</Intro></div>
          <div className={styles.creativeProducts}>
            {secondaryProducts.map(({product, image, alt, height}) => (
              <div key={product.href}>
                <figure className={styles.productCapture} data-marketing-reveal>
                  <Image src={`/images/landing/product/${image}.webp`} alt={alt} width={1200} height={height} sizes="(max-width: 760px) 92vw, 46vw" />
                  <figcaption>{product.name} · Sample data</figcaption>
                </figure>
                <Link href={product.href} className={styles.textLink}>Explore {product.name}<ArrowUpRight size={17}/></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.pricing}><PricingSection compact signedIn={isLoggedIn} heading="The Right Workspace for Your Next Stage." intro="Start with what you need today. Grow with Showwork as your work and team expand." /></div>
      <section id="resources" className={`${styles.section} ${styles.faqSection}`} aria-labelledby="questions-heading"><div className={`${styles.container} ${styles.faqLayout}`}><div><Intro eyebrow="A LITTLE CLARITY" title={<>Good questions.<br/>Clear answers.</>} id="questions-heading"/><Link href="/help/workspace" className={styles.textLink}>Explore help & guides<ArrowUpRight size={17}/></Link></div><div id="questions" className={styles.faqList}>{faqs.map(item => <details key={item.question}><summary>{item.question}<ChevronDown size={18}/></summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
    <div className={styles.scrollScene}>
      <section id="company" data-marketing-motion className={`${styles.finalSection} ${styles.finalTeam} ${styles.sceneBackdrop}`} aria-labelledby="start-heading"><div className={styles.finalCopy}><h2 id="start-heading">Your Best Work Deserves<br/><em>a Better Way.</em></h2><p>Bring your ideas, people and marketing together. Make room for what comes next.</p><div className={styles.actions}><Link href={startHref} className={styles.primary}>{isLoggedIn ? "Open your workspaces" : "Get Started with Showwork"}<ArrowUpRight size={18}/></Link></div></div><div className={styles.teamPhoto} data-marketing-reveal><Image src="/images/landing/9.webp" alt="A Nigerian marketing team standing together in their office" fill sizes="(max-width: 760px) 100vw, 55vw"/></div></section>
    <SectionTransition variant="footer" className={styles.footerReveal}><SiteFooter homepage/></SectionTransition>
    </div>
    <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)}/>
  </div>;
}
