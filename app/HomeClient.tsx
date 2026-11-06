"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowRight, ArrowUpRight, BookOpenText, CalendarDays, Check, CheckCheck, ChevronDown, FileCheck2, FolderOpen, ImageIcon, Menu, ShieldCheck, Sparkles, UsersRound, X } from "lucide-react";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import PlatformBrandIcon from "@/components/calendars/PlatformBrandIcon";
import BookDemoModal from "@/components/landing/BookDemoModal";
import PricingSection from "@/components/landing/PricingSection";
import SiteFooter from "@/components/landing/SiteFooter";
import { CONTENT_WORKSPACE_PLANS } from "@/lib/contentWorkspaceEntitlements";
import dashboard from "@/public/images/dashboard.webp";
import styles from "./HomePage.module.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jakarta" });
const workflow = [
  { title: "Plan content", label: "One calendar. A clearer week.", description: "Keep ideas, copy and creative together, with a schedule everyone can follow.", icon: CalendarDays },
  { title: "Review together", label: "Feedback with a clear next step.", description: "Your team reviews first. Then clients open their link to leave feedback or approve.", icon: UsersRound },
  { title: "Publish with control", label: "Ready when your content is.", description: "Choose automatic or manual publishing on supported channels. Required approvals always come first.", icon: CheckCheck },
] as const;
const faqs = [
  { question: "What is Marketing Workspace?", answer: "A workspace for each client’s business knowledge, brand voice, content calendar, approvals and connected channels. Higher plans add tools for research, conversations, leads and performance insights." },
  { question: "How does the free trial work?", answer: "New eligible accounts get a seven-day Marketing Workspace trial with Agency feature access. You can explore the tools before choosing your paid plan. No payment card is required to start the trial." },
  { question: "Will AI publish content without my approval?", answer: "Generating content creates drafts for review. Publishing requires internal and client approvals, a connected eligible account, and the platform’s required settings. You choose whether automatic publishing is enabled." },
  { question: "Which plan includes Randy?", answer: `Randy in AI Studio is included from Growth at ₦${CONTENT_WORKSPACE_PLANS.GROWTH.priceNgnMonthly.toLocaleString("en-NG")}/month. Creator includes AI content generation, business knowledge and brand voice. Existing Agency trial access includes Randy.` },
  { question: "Can I use Project Delivery or Portfolio separately?", answer: "Yes. Project Delivery is for sharing client files, collecting feedback and managing handovers. Portfolio is for showcasing your work. You can choose the tool that fits what you need today." },
];

export default function HomeClient({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [demoOpen, setDemoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const startHref = isLoggedIn ? "/dashboard/calendars" : "/signup?next=/dashboard/calendars";
  const startLabel = isLoggedIn ? "Open your workspaces" : "Start your free trial";
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); document.getElementById("home-menu-toggle")?.focus(); } };
    const resize = () => { if (window.innerWidth >= 900) setMenuOpen(false); };
    document.addEventListener("keydown", close); window.addEventListener("resize", resize);
    return () => { document.removeEventListener("keydown", close); window.removeEventListener("resize", resize); };
  }, [menuOpen]);
  return <div className={`${jakarta.variable} ${styles.home}`}>
    <a className={styles.skipLink} href="#main-content">Skip to content</a>
    <header className={styles.navbar}>
      <div className={styles.navInner}>
        <Link href="/" aria-label="Showwork home" className={styles.brand}><ShowworkLogo width={117}/></Link>
        <nav className={styles.desktopNav} aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#tools">Our tools</a><a href="#pricing">Pricing</a><a href="#questions">Questions</a></nav>
        <div className={styles.navActions}><Link className={styles.login} href={isLoggedIn ? "/dashboard" : "/login"}>{isLoggedIn ? "Dashboard" : "Log in"}</Link><Link className={styles.navCta} href={startHref}>{isLoggedIn ? "Open workspace" : "Get started"}<ArrowUpRight size={15}/></Link><button id="home-menu-toggle" type="button" className={styles.menuToggle} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="home-mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button></div>
      </div>
      {menuOpen && <nav id="home-mobile-menu" className={styles.mobileNav} aria-label="Mobile navigation">{[["How it works", "#how-it-works"], ["Our tools", "#tools"], ["Pricing", "#pricing"], ["Questions", "#questions"]].map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<ArrowUpRight size={15}/></a>)}<Link href={isLoggedIn ? "/dashboard" : "/login"} onClick={() => setMenuOpen(false)}>{isLoggedIn ? "Dashboard" : "Log in"}<ArrowRight size={15}/></Link></nav>}
    </header>

    <main id="main-content">
      <section className={styles.hero} aria-labelledby="home-heading">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><span/>MARKETING WORKSPACE</span>
            <h1 id="home-heading">Your clients.<br/>Your content.<br/><span>One clear workspace.</span></h1>
            <p>Plan content with AI, get client approvals, and publish on supported channels. Keep every client’s work moving in one place.</p>
            <div className={styles.heroActions}><Link className={styles.primary} href={startHref}>{startLabel}<ArrowUpRight size={18}/></Link><button type="button" className={styles.secondary} onClick={() => setDemoOpen(true)}>Book a demo<ArrowRight size={17}/></button></div>
            <p className={styles.trialNote}>{isLoggedIn ? "Pick up where your team left off." : "7 days to explore. No card required."}</p>
            <div className={styles.heroBenefits}><span><Check size={14}/>Your brand voice</span><span><Check size={14}/>Client approvals</span><span><Check size={14}/>Publishing controls</span></div>
          </div>
          <figure className={styles.heroVisual}>
            <div className={styles.visualTop}><span><span/>A LITTLE MORE ORGANIZED</span><span>Marketing Workspace</span></div>
            <Image src={dashboard} alt="Illustrative Showwork content calendar with planned posts across social channels" priority sizes="(max-width: 899px) 100vw, 58vw" className={styles.productImage}/>
            <figcaption><CalendarDays size={15}/><span>A clearer view of the work ahead.</span><span className={styles.exampleLabel}>Product illustration</span></figcaption>
          </figure>
        </div>
        <div className={styles.audience}><p>For the people behind the marketing.</p><div><span><UsersRound size={15}/>Social media managers</span><span><FolderOpen size={15}/>Agencies</span><span><Sparkles size={15}/>Growing businesses</span></div></div>
      </section>

      <section id="how-it-works" className={styles.workflowSection} aria-labelledby="workflow-heading">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><div><span className={styles.eyebrow}>LESS CHASING. MORE CREATING.</span><h2 id="workflow-heading">From the first idea<br/>to the final approval.</h2></div><p>One connected workflow for your team and your clients. Everyone knows what comes next.</p></div>
          <div className={styles.workflowLayout}>
            <div className={styles.workflowChoices} role="group" aria-label="Explore the content workflow">{workflow.map((step, index) => <button key={step.title} type="button" aria-pressed={activeStep === index} aria-controls="workflow-example" onClick={() => setActiveStep(index)}><span className={styles.stepNumber}>0{index + 1}</span><span><strong>{step.title}</strong><small>{step.description}</small></span><ArrowUpRight size={17}/></button>)}</div>
            <div id="workflow-example" className={styles.workflowExample} aria-live="polite"><div className={styles.exampleHeader}><span><ShowworkLogo mark width={20}/>Marketing Workspace</span><small>Example workflow</small></div>
              {activeStep === 0 ? <div className={styles.calendarExample}><div className={styles.mockHeading}><span>Your content calendar</span><span>This week</span></div><div className={styles.mockDays}>{["MON", "TUE", "WED"].map((day,index) => <div key={day}><span>{day}</span><article><div className={styles.mockArt} data-tone={index}><span>{index === 0 ? "MEET THE BRAND" : index === 1 ? "A CLOSER LOOK" : "MADE FOR YOU"}</span></div><p>{["Introduce your story", "Share your process", "Answer a client question"][index]}</p><small><span/>{index === 1 ? "Ready for review" : "Planned"}</small></article></div>)}</div></div>
                : activeStep === 1 ? <div className={styles.reviewExample}><span className={styles.reviewBadge}><FileCheck2 size={15}/>Client review</span><h3>A place for feedback.<br/>A clear way forward.</h3><div className={styles.mockComment}><span>JL</span><div><strong>Client feedback</strong><p>Love the direction. Can we shorten the opening line?</p></div></div><div className={styles.mockApproval}><CheckCheck size={18}/><div><strong>Feedback stays with the post</strong><p>Your team can update it and request another review.</p></div></div></div>
                : <div className={styles.publishExample}><span className={styles.reviewBadge}><ShieldCheck size={15}/>You choose how to publish</span><h3>Approved first.<br/>Published with care.</h3><div className={styles.publishRow}><span><Check size={15}/>Internal review</span><strong>Approved</strong></div><div className={styles.publishRow}><span><Check size={15}/>Client review</span><strong>Approved</strong></div><div className={styles.publishRow}><span><CalendarDays size={15}/>Publishing</span><strong>At the scheduled time</strong></div><p>Supported channels, account permissions and platform-specific settings apply.</p></div>}
              <div className={styles.exampleFooter}><span>{workflow[activeStep].label}</span><span>0{activeStep + 1} / 03</span></div>
            </div>
          </div>
          <div className={styles.channels}><p>Bring your channels into the workflow.</p><div>{["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "X", "WHATSAPP"].map(platform => <span key={platform}><PlatformBrandIcon platform={platform} size={19}/><span>{({INSTAGRAM:"Instagram",FACEBOOK:"Facebook",TIKTOK:"TikTok",LINKEDIN:"LinkedIn",X:"X",WHATSAPP:"WhatsApp"} as Record<string,string>)[platform]}</span></span>)}</div><small>Publishing, messaging and analytics support varies by channel and plan.</small></div>
        </div>
      </section>

      <section className={styles.randySection} aria-labelledby="randy-heading"><div className={`${styles.container} ${styles.randyLayout}`}><div className={styles.randyCopy}><span className={styles.eyebrow}>MEET RANDY IN AI STUDIO</span><h2 id="randy-heading">Good ideas start<br/>with your business.</h2><p>Add your business knowledge and define your brand voice. Randy helps you explore ideas, research opportunities, and shape a stronger content brief.</p><span className={styles.planPill}>Included from Growth · ₦{CONTENT_WORKSPACE_PLANS.GROWTH.priceNgnMonthly.toLocaleString("en-NG")}/month</span><a className={styles.textLink} href="#pricing">Find your plan<ArrowRight size={17}/></a></div><div className={styles.randyExample}><div className={styles.randyIdentity}><Image src="/images/randy/avatar.webp" alt="" width={44} height={44}/><div><strong>Randy</strong><span>Your business thinking partner</span></div><span className={styles.exampleLabel}>Example chat</span></div><p className={styles.userMessage}>Let’s create content that sounds more like us.</p><div className={styles.assistantMessage}><Sparkles size={17}/><div><p>Let’s build on your brand voice. What would you like your audience to understand or feel this week?</p><span><BookOpenText size={13}/>Business knowledge & brand voice</span></div></div><div className={styles.randyNote}><ShieldCheck size={14}/>Research and knowledge updates need your confirmation.</div></div></div></section>

      <section id="tools" className={styles.toolsSection} aria-labelledby="tools-heading"><div className={styles.container}><div className={styles.sectionIntro}><div><span className={styles.eyebrow}>CHOOSE YOUR NEXT STEP</span><h2 id="tools-heading">The right tool<br/>for the work you do.</h2></div><p>Manage ongoing marketing, deliver a client project, or give your work a home.</p></div><div className={styles.toolsGrid}><Link className={styles.flagshipTool} href={startHref}><div className={styles.toolTop}><CalendarDays size={23}/><span>OUR FLAGSHIP</span><ArrowUpRight size={21}/></div><div><h3>Marketing Workspace</h3><p>For social media managers, businesses & agencies.</p><span>Plan. Approve. Publish.</span></div><div className={styles.toolBottom}>Start your workspace<ArrowRight size={18}/></div></Link><Link className={styles.toolCard} href="/delivery"><FolderOpen size={23}/><h3>Project Delivery</h3><p>For videographers and creatives delivering client work.</p><div className={styles.toolBottom}>Explore delivery<ArrowUpRight size={18}/></div></Link><Link className={styles.toolCard} href="/portfolio"><ImageIcon size={23}/><h3>Portfolio</h3><p>For creatives ready to show what they can do.</p><div className={styles.toolBottom}>Explore portfolios<ArrowUpRight size={18}/></div></Link></div></div></section>

      <div className={styles.pricing}><PricingSection compact/></div>
      <section id="questions" className={styles.faqSection} aria-labelledby="questions-heading"><div className={`${styles.container} ${styles.faqLayout}`}><div><span className={styles.eyebrow}>A LITTLE CLARITY</span><h2 id="questions-heading">Good questions.<br/>Clear answers.</h2><p>Need help choosing?<br/><button type="button" onClick={() => setDemoOpen(true)}>Let’s talk<ArrowUpRight size={15}/></button></p></div><div className={styles.faqList}>{faqs.map(item => <details key={item.question}><summary>{item.question}<ChevronDown size={17}/></summary><p>{item.answer}</p></details>)}</div></div></section>
      <section className={styles.finalSection} aria-labelledby="start-heading"><div className={styles.container}><span className={styles.finalEyebrow}>A LITTLE MORE ROOM TO CREATE</span><h2 id="start-heading">Make space for<br/>your next great idea.</h2><p>Your clients. Your team. Your work, together.</p><Link href={startHref} className={styles.primary}>{startLabel}<ArrowUpRight size={18}/></Link><span className={styles.finalNote}>{isLoggedIn ? "Your workspace is ready when you are." : "Start your 7-day trial. No card required."}</span></div></section>
    </main>
    <SiteFooter homepage/>
    <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)}/>
  </div>;
}
