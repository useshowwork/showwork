"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpenText, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, ChevronRight, Menu, MessageCircle, Sparkles, UsersRound, X } from "lucide-react";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import BookDemoModal from "@/components/landing/BookDemoModal";
import PricingSection from "@/components/landing/PricingSection";
import SiteFooter from "@/components/landing/SiteFooter";
import ConnectedInboxVisual from "@/components/landing/ConnectedInboxVisual";
import WorkspaceFeatureVisual from "@/components/landing/WorkspaceFeatureVisual";
import SectionTransition from "@/components/landing/SectionTransition";
import { productEntryHref } from "@/lib/productJourney";
import { CONTENT_WORKSPACE_PLANS } from "@/lib/contentWorkspaceEntitlements";
import styles from "./HomePage.module.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jakarta" });
const features = [
  { label: "Business knowledge", icon: BookOpenText, hint: "Give AI your context", title: "Your business, understood.", copy: "Add your documents, website and brand voice. Give your team and AI the same starting point.", detail: "Business knowledge & brand voice on all plans." },
  { label: "Content planning", icon: CalendarDays, hint: "Make room for ideas", title: "From ideas to execution.", copy: "Create AI-assisted drafts in your brand voice. Keep copy, creative and dates together.", detail: "Review and approvals come before publishing on supported channels." },
  { label: "Team workflows", icon: UsersRound, hint: "Move decisions forward", title: "Everyone knows what comes next.", copy: "Review as a team. Share with your client. Keep feedback and approvals with the post.", detail: "Collaborator limits and role permissions depend on your plan." },
  { label: "Customer messaging", icon: MessageCircle, hint: "Keep enquiries moving", title: "Conversations deserve context.", copy: "Bring WhatsApp, Instagram and Facebook enquiries together. Let AI respond with business context, with your team able to take over.", detail: "Inbox & AI drafting from Studio. Automatic replies: Agency · opt-in. Messaging permissions and reply windows apply." },
  { label: "Marketing intelligence", icon: ChartNoAxesCombined, hint: "Find your next move", title: "Know what to try next.", copy: "Review performance. Get AI recommendations grounded in your results. Use them to shape your next content plan.", detail: "Basic analytics on all plans. Advanced reporting & AI recommendations from Studio. Randy research from Growth." },
];
const stages = [
  { title: "Understand", copy: "Add business knowledge, define your brand voice and choose your publishing preference." },
  { title: "Prepare", copy: "Connect your channels and turn campaign goals into content drafts for your calendar." },
  { title: "Review", copy: "Bring your team and client into feedback, decisions and approvals before publishing." },
  { title: "Execute", copy: "Publish approved work on supported channels. Manage eligible customer conversations from your inbox." },
  { title: "Learn", copy: "Review available performance, consider recommendations and use what you learn to shape the next plan." },
];
const faqs = [
  { question: "Can Showwork reply when our team is away?", answer: "Yes. The Agency plan includes opt-in automated replies for eligible customer enquiries, using your business knowledge. Your team can take over when needed. Supported channels, account permissions and platform messaging windows apply." },
  { question: "What is Showwork?", answer: "Showwork builds more connected systems for marketing operations and professional creative work. Its products include Marketing Workspace and Project Delivery, with Portfolio available for showcasing your work." },
  { question: "Is Marketing Workspace the same as Project Delivery?", answer: "Marketing Workspace supports ongoing marketing operations. Project Delivery helps creative professionals present files, collect feedback and approvals, and manage final handovers. You can use either product independently." },
  { question: "Can Showwork replace my marketing team?", answer: "Showwork supports the people doing the work. Your team keeps responsibility for professional judgment, creativity and decisions. Generating content creates drafts for review, and you choose whether automatic publishing or eligible automatic replies are enabled." },
  { question: "Which AI features are included?", answer: `AI content generation is included from Creator. Randy in AI Studio is included from Growth at ₦${CONTENT_WORKSPACE_PLANS.GROWTH.priceNgnMonthly.toLocaleString("en-NG")}/month. AI performance recommendations and reply drafting start at Studio. Agency adds opt-in automatic replies. AI allowances, connected accounts and platform permissions apply.` },
  { question: "Does Showwork offer a free trial?", answer: "New eligible accounts receive a seven-day Marketing Workspace trial with Agency feature access. No payment card is required to start. Choose a paid plan to continue with its included features and limits." },
];

function Intro({ eyebrow, title, children, id }: { eyebrow: string; title: ReactNode; children?: ReactNode; id?: string }) {
  return <div className={styles.intro}><span className={styles.eyebrow}>{eyebrow}</span><h2 id={id}>{title}</h2>{children && <p>{children}</p>}</div>;
}

export default function HomeClient({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [demoOpen, setDemoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feature, setFeature] = useState(0);
  const [verticalFeatures, setVerticalFeatures] = useState(false);
  const [stage, setStage] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const startHref = productEntryHref("workspace", { signedIn: isLoggedIn });
  const deliveryHref = productEntryHref("delivery", { signedIn: isLoggedIn });
  const portfolioHref = productEntryHref("portfolio", { signedIn: isLoggedIn });
  const teamPlanHref = productEntryHref("workspace", { plan: "UNLIMITED", signedIn: isLoggedIn });
  const startLabel = isLoggedIn ? "Open your workspaces" : "Start your free trial";
  useEffect(() => {
    const closeMenus = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const open = header.current?.querySelector<HTMLDetailsElement>("details[open]");
      if (open) { open.open = false; open.querySelector("summary")?.focus(); }
      if (menuOpen) { setMenuOpen(false); document.getElementById("home-menu-toggle")?.focus(); }
    };
    const outside = (event: MouseEvent) => { if (!header.current?.contains(event.target as Node)) { header.current?.querySelectorAll("details[open]").forEach(el => el.removeAttribute("open")); setMenuOpen(false); } };
    const resize = () => { if (window.innerWidth >= 1000) setMenuOpen(false); };
    document.addEventListener("keydown", closeMenus); document.addEventListener("click", outside); window.addEventListener("resize", resize);
    return () => { document.removeEventListener("keydown", closeMenus); document.removeEventListener("click", outside); window.removeEventListener("resize", resize); };
  }, [menuOpen]);
  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === "undefined") return;
    root.current.dataset.motion = "ready";
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add(styles.revealed); reveal.unobserve(entry.target); } }), { threshold: .08 });
    root.current.querySelectorAll("[data-reveal]").forEach(el => reveal.observe(el));
    const sections = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) setActiveSection(entry.target.id); }); }, { rootMargin: "-15% 0px -60% 0px" });
    ["workspace", "solutions", "pricing", "resources", "company"].forEach(id => { const el = document.getElementById(id); if (el) sections.observe(el); });
    return () => { reveal.disconnect(); sections.disconnect(); if (root.current) delete root.current.dataset.motion; };
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 901px)");
    const sync = () => setVerticalFeatures(query.matches);
    sync(); query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  function closeNavigation() { setMenuOpen(false); header.current?.querySelectorAll("details[open]").forEach(el => el.removeAttribute("open")); }
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
  const demo = () => { closeNavigation(); setDemoOpen(true); };
  return <div ref={root} className={`${jakarta.variable} ${styles.home}`}>
    <a href="#main-content" className={styles.skipLink}>Skip to content</a>
    <header data-home-header ref={header} className={styles.header}>
      <div className={styles.navInner}>
        <Link href="/" aria-label="Showwork home"><ShowworkLogo width={124}/></Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          <details className={styles.dropdown}><summary aria-current={activeSection === "workspace" ? "location" : undefined}>Products<ChevronDown size={14}/></summary><div><a href="#workspace" onClick={closeNavigation}><strong>Marketing Workspace</strong><small>Our flagship · connected marketing operations</small></a><Link href="/delivery"><strong>Project Delivery</strong><small>Files, feedback and professional handovers</small></Link><Link href="/portfolio"><strong>Portfolio</strong><small>A home for your creative work</small></Link></div></details>
          <details className={styles.dropdown}><summary aria-current={activeSection === "solutions" ? "location" : undefined}>Solutions<ChevronDown size={14}/></summary><div>{[["Businesses & teams", "businesses"], ["Marketing agencies", "agencies"], ["Social media managers", "managers"], ["Customer enquiries", "customer-replies"]].map(([label,id]) => <a key={id} href={`#${id}`} onClick={closeNavigation}>{label}<ArrowUpRight size={15}/></a>)}</div></details>
          <a href="#pricing" aria-current={activeSection === "pricing" ? "location" : undefined}>Pricing</a>
          <details className={styles.dropdown}><summary aria-current={activeSection === "resources" ? "location" : undefined}>Resources<ChevronDown size={14}/></summary><div><Link href="/help/workspace">Help & guides<ArrowUpRight size={15}/></Link><Link href="/blog">The Showwork blog<ArrowUpRight size={15}/></Link><a href="#how-it-works" onClick={closeNavigation}>How it works<ArrowUpRight size={15}/></a></div></details>
          <a href="#company" aria-current={activeSection === "company" ? "location" : undefined}>Company</a>
        </nav>
        <div className={styles.navActions}><Link className={`${styles.login} ${isLoggedIn ? styles.dashboardButton : ""}`} href={isLoggedIn ? "/dashboard" : "/login"}>{isLoggedIn ? "Dashboard" : "Log in"}</Link><button className={styles.navCta} type="button" onClick={demo}>Book a demo<ArrowUpRight size={16}/></button><button id="home-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="home-mobile-menu" aria-label={menuOpen ? "Close navigation" : "Open navigation"} className={styles.menuToggle} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={23}/> : <Menu size={23}/>}</button></div>
      </div>
      {menuOpen && <nav id="home-mobile-menu" aria-label="Mobile navigation" className={styles.mobileNav}><a href="#workspace" onClick={closeNavigation}>Marketing Workspace<ArrowUpRight size={17}/></a><Link href="/delivery">Project Delivery<ArrowUpRight size={17}/></Link><a href="#solutions" onClick={closeNavigation}>Solutions<ArrowUpRight size={17}/></a><a href="#pricing" onClick={closeNavigation}>Pricing<ArrowUpRight size={17}/></a><Link href="/help/workspace">Resources & guides<ArrowUpRight size={17}/></Link><a href="#company" onClick={closeNavigation}>Company<ArrowUpRight size={17}/></a><Link className={isLoggedIn ? styles.dashboardButton : undefined} href={isLoggedIn ? "/dashboard" : "/login"}>{isLoggedIn ? "Dashboard" : "Log in"}<ArrowUpRight size={17}/></Link><button type="button" onClick={demo}>Book a demo<ArrowRight size={17}/></button></nav>}
    </header>
    <main id="main-content">
      <div className={styles.inboxSequence}>
      <div className={`${styles.scrollScene} ${styles.inboxBackdrop}`}>
      <section className={`${styles.hero} ${styles.sceneBackdrop}`} aria-labelledby="home-heading">
        <picture className={styles.heroPicture}><source media="(max-width: 760px)" srcSet="/images/landing/1mobile.webp"/><img src="/images/landing/1.webp" alt="Nigerian marketing professionals sharing ideas around a table in a bright office" width={1672} height={941} fetchPriority="high" loading="eager"/></picture>
        <div className={styles.heroInner}><div className={styles.heroCopy}><span className={styles.eyebrow}>THE INTELLIGENT MARKETING WORKSPACE</span><h1 id="home-heading">Great marketing needs more than great ideas.<br/><em>It needs a system.</em></h1><p>One workspace for your team’s knowledge, content, approvals, customer conversations and results.</p><div className={styles.actions}><Link href={startHref} className={styles.primary}>Explore Marketing Workspace<ArrowUpRight size={18}/></Link><button type="button" className={styles.secondary} onClick={demo}>Book a demo<ArrowRight size={17}/></button></div><small>For business teams, agencies and social media managers.</small></div></div>
      </section>

      <SectionTransition variant="opening"><section className={`${styles.section} ${styles.problem}`} aria-labelledby="problem-heading"><div className={`${styles.container} ${styles.problemCompact}`} data-reveal><Intro eyebrow="LESS CHASING. CLEARER WORK." title={<>Good people.<br/>Disconnected work.</>} id="problem-heading"/><div><dl className={styles.problemList}><div><dt>Context gets lost.</dt><dd>Brand information lives across documents and chats.</dd></div><div><dt>Approvals hold things up.</dt><dd>Feedback moves. The work waits.</dd></div><div><dt>Enquiries go unanswered.</dt><dd>Your team clocks off. A potential customer is still waiting.</dd></div></dl><p className={styles.problemAnswer}>Give the work a shared home. Keep your team moving.</p></div></div></section>

      <section id="workspace" className={`${styles.section} ${styles.workspace}`} aria-labelledby="workspace-heading"><div className={styles.container}><div className={`${styles.workspaceIntro} ${styles.workspacePhotoIntro}`} data-reveal><Intro eyebrow="INTRODUCING MARKETING WORKSPACE" title={<>One workspace.<br/>A clearer way to run marketing.</>} id="workspace-heading">Shared context. Clear approvals. A next step everyone can see.</Intro><div className={styles.workspacePhoto}><Image src="/images/landing/4.webp" alt="A marketing professional using Showwork at her desk" fill sizes="(max-width: 760px) 100vw, 35vw"/></div></div><div className={styles.productExplorer}><div className={styles.explorerRail}><span className={styles.explorerGuide}>CHOOSE A FEATURE TO EXPLORE</span><div role="tablist" aria-label="Explore Marketing Workspace features" aria-orientation={verticalFeatures ? "vertical" : "horizontal"} className={styles.explorerTabs}>{features.map((item,index) => <button key={item.label} id={`feature-${index}`} type="button" role="tab" aria-selected={feature === index} aria-controls="feature-panel" tabIndex={feature === index ? 0 : -1} onClick={() => setFeature(index)} onKeyDown={event => moveTab(event,index,features.length,setFeature,"feature")}><span className={styles.explorerIcon}><item.icon size={19}/></span><span><strong>{item.label}</strong><small>{item.hint}</small></span><ChevronRight size={15}/></button>)}</div></div><div id="feature-panel" role="tabpanel" aria-labelledby={`feature-${feature}`} tabIndex={0} className={styles.explorerPanel}><div className={styles.explorerStory}><h3>{current.title}</h3><p>{current.copy}</p></div><div className={styles.explorerVisual}><WorkspaceFeatureVisual key={feature} kind={feature}/></div><div className={styles.explorerSummary}><Link href={feature === 3 ? teamPlanHref : startHref} className={styles.explorerAction}>{feature === 3 ? `Explore ${CONTENT_WORKSPACE_PLANS.UNLIMITED.name}` : "Explore workspace"}<ArrowUpRight size={17}/></Link></div><p className={styles.explorerAccess}>{current.detail}</p></div></div><div className={styles.workspaceExtras}><div><Sparkles size={23}/><div><h3>Meet Randy, your research partner.</h3><p>Explore market questions and campaign ideas. Research and knowledge updates need your confirmation.</p><span>Included from Growth · ₦{CONTENT_WORKSPACE_PLANS.GROWTH.priceNgnMonthly.toLocaleString("en-NG")}/month</span></div></div><div><BookOpenText size={23}/><div><h3>Learn from the work you publish.</h3><p>Turn results into your next content plan. Available metrics depend on the channel, permissions and synced history.</p><span>Advanced reporting & AI recommendations from Studio</span></div></div></div></div></section>
      </SectionTransition>
      </div>

      <SectionTransition variant="replies">
      <div className={styles.scrollScene}>
      <section id="customer-replies" className={`${styles.section} ${styles.replySolution} ${styles.sceneBackdrop}`} aria-labelledby="reply-heading"><div className={`${styles.container} ${styles.replyLayout}`}><div><Intro eyebrow="ONE INBOX. MORE OPPORTUNITY." title={<>Your next customer<br/>shouldn’t have to wait.</>} id="reply-heading">Bring WhatsApp, Instagram and Facebook messages into one inbox. Let business-aware AI respond when your team is away.</Intro><ul className={styles.replyBenefits}><li><Check size={16}/>Three channels. One place for your team.</li><li><Check size={16}/>AI replies with context. People take over when needed.</li></ul><div className={styles.actions}><Link href={teamPlanHref} className={styles.primary}>Get started with Agency<ArrowUpRight size={17}/></Link><button type="button" className={styles.secondary} onClick={demo}>Book a demo<ArrowRight size={17}/></button></div><small className={styles.replyTerms}>Agency · ₦{CONTENT_WORKSPACE_PLANS.UNLIMITED.priceNgnMonthly.toLocaleString("en-NG")}/month. Automatic replies are opt-in. Channel permissions and reply windows apply.</small></div><ConnectedInboxVisual/></div></section>

      <SectionTransition variant="process"><section id="how-it-works" className={`${styles.section} ${styles.workflow} ${styles.flowSection}`} aria-labelledby="workflow-heading"><div className={`${styles.container} ${styles.flowLayout}`}><div className={styles.flowIntro}><Intro eyebrow="HOW THE WORK MOVES" title={<>From shared context<br/>to the next decision.</>} id="workflow-heading">A connected process your whole team can follow.</Intro><span className={styles.flowHint}>Choose a step to explore<ArrowDown size={16}/></span></div><ol className={styles.flowTimeline} aria-label="The five-stage marketing workflow">{stages.map((item,index) => <li key={item.title} data-active={stage === index} data-reached={index < stage}><button id={`stage-${index}`} type="button" aria-expanded={stage === index} aria-controls={`stage-panel-${index}`} onClick={() => setStage(stage === index ? -1 : index)} onKeyDown={event => { let next: number; if(event.key === "ArrowDown") next = (index + 1) % stages.length; else if(event.key === "ArrowUp") next = (index + stages.length - 1) % stages.length; else if(event.key === "Home") next = 0; else if(event.key === "End") next = stages.length - 1; else return; event.preventDefault();setStage(next);document.getElementById(`stage-${next}`)?.focus(); }}><span className={styles.flowNumber}>0{index+1}</span><span className={styles.flowLabel}><strong>{item.title}</strong><small>{["Give your team the context.", "Turn goals into a plan.", "Bring the right people in.", "Move approved work forward.", "Make the next plan more informed."][index]}</small></span><ChevronDown size={18}/></button><div id={`stage-panel-${index}`} role="region" aria-labelledby={`stage-${index}`} className={styles.flowDetail} aria-hidden={stage !== index}><div><p>{item.copy}</p></div></div></li>)}</ol></div></section>

      <section id="solutions" className={`${styles.section} ${styles.solutions}`} aria-labelledby="solutions-heading"><div className={styles.container}><div className={styles.wideIntro} data-reveal><Intro eyebrow="BUILT FOR THE PEOPLE BEHIND MARKETING" title="Built around your team." id="solutions-heading">Choose the way you work. We’ll help you find your starting point.</Intro></div><div className={styles.audienceGrid}><article id="businesses"><span className={styles.eyebrow}>BUSINESSES & IN-HOUSE TEAMS</span><h3>Keep your team aligned.</h3><p>Shared brand knowledge. Clear reviews. Better visibility.</p><button type="button" className={styles.textLink} onClick={demo}>Explore Business Solutions<ArrowUpRight size={18}/></button></article><article id="agencies"><span className={styles.eyebrow}>MARKETING AGENCIES</span><h3>Keep every client organised.</h3><p>Separate brands. Consistent workflows. Easier approvals.</p><button type="button" className={styles.textLink} onClick={demo}>Explore Agency Solutions<ArrowUpRight size={18}/></button></article><article id="managers"><span className={styles.eyebrow}>SOCIAL MEDIA MANAGERS</span><h3>Keep the work moving.</h3><p>Plan content, get feedback and publish from one workspace.</p><Link href={startHref} className={styles.textLink}>Explore Marketing Workspace<ArrowUpRight size={18}/></Link></article></div></div></section>
      </SectionTransition>
      </div>

      </SectionTransition>
      </div>

      <section id="tools" className={`${styles.section} ${styles.delivery}`} aria-labelledby="delivery-heading"><div className={`${styles.container} ${styles.deliveryCompact}`} data-reveal><div><Intro eyebrow="FOR CREATIVE PROFESSIONALS" title={<>Great work.<br/>A better handover.</>} id="delivery-heading">Project Delivery brings files, client feedback and final downloads together.</Intro><Link href={deliveryHref} className={styles.textLink}>Explore Project Delivery<ArrowUpRight size={18}/></Link><p className={styles.portfolioLink}>Need a home for your work? <Link href={portfolioHref}>Explore Portfolio<ArrowUpRight size={15}/></Link></p></div><div className={styles.deliveryPhoto}><Image src="/images/landing/7.webp" alt="A creative professional presenting finished work to a client on a tablet" fill sizes="(max-width: 760px) 100vw, 55vw"/></div></div></section>

      <div className={styles.pricing}><PricingSection compact/></div>
      <section id="resources" className={`${styles.section} ${styles.faqSection}`} aria-labelledby="questions-heading"><div className={`${styles.container} ${styles.faqLayout}`}><div><Intro eyebrow="A LITTLE CLARITY" title={<>Good questions.<br/>Clear answers.</>} id="questions-heading"/><Link href="/help/workspace" className={styles.textLink}>Explore help & guides<ArrowUpRight size={17}/></Link></div><div id="questions" className={styles.faqList}>{faqs.map(item => <details key={item.question}><summary>{item.question}<ChevronDown size={18}/></summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
    <div className={styles.scrollScene}>
      <section id="company" className={`${styles.finalSection} ${styles.finalTeam} ${styles.sceneBackdrop}`} aria-labelledby="start-heading"><div className={styles.finalCopy}><span className={styles.eyebrow}>MAKE ROOM FOR BETTER WORK</span><h2 id="start-heading">Your team has work to do.<br/><em>Give it a better system.</em></h2><p>Start with your business knowledge. Bring your team into the work.</p><div className={styles.actions}><Link href={startHref} className={styles.primary}>Explore Marketing Workspace<ArrowUpRight size={18}/></Link><button type="button" onClick={demo} className={styles.secondary}>Book a demo<ArrowRight size={17}/></button></div><Link href={startHref} className={styles.trialLink}>{startLabel}<ArrowRight size={15}/></Link><small>{isLoggedIn ? "Pick up where your team left off." : "7 days to explore. No card required."}</small></div><div className={styles.teamPhoto}><Image src="/images/landing/9.webp" alt="A Nigerian marketing team standing together in their office" fill sizes="(max-width: 760px) 100vw, 55vw"/></div></section>
    <SectionTransition variant="footer" className={styles.footerReveal}><SiteFooter homepage/></SectionTransition>
    </div>
    <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)}/>
  </div>;
}
