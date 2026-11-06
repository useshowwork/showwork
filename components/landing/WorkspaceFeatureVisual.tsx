"use client";

import { useState } from "react";
import { ArrowRight, BookOpenText, Check, FileText, Globe2, MessageCircle, Mic2, Sparkles, UsersRound } from "lucide-react";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import styles from "./WorkspaceFeatureVisual.module.css";

const sources = [
  { label: "Documents", icon: FileText, title: "The facts behind your brand.", detail: "Products, services and business information." },
  { label: "Website", icon: Globe2, title: "Your business, in context.", detail: "The information you share about what you do." },
  { label: "Brand voice", icon: Mic2, title: "A voice that feels like you.", detail: "Your personality, tone and communication style." },
];

export default function WorkspaceFeatureVisual({ kind, automatic = false }: { kind: number; automatic?: boolean }) {
  const [source, setSource] = useState(0);
  return <figure className={`${styles.canvas} ${kind === 3 ? styles.messageCanvas : ""}`} aria-label={`${["Business knowledge", "Content planning", "Team review", "Customer replies", "Marketing intelligence"][kind]} illustration`}>
    <figcaption className={styles.caption}><span>WORKSPACE IN MOTION</span><small>Illustrative example</small></figcaption>
    {kind === 0 && <div className={styles.knowledge}>
      <div className={styles.sourceStack} role="group" aria-label="Explore business context sources">{sources.map((item,index) => <button key={item.label} type="button" aria-pressed={source === index} onClick={() => setSource(index)}><item.icon size={18}/><span>{item.label}</span><span className={styles.sourceDot}/></button>)}</div>
      <svg className={styles.connections} viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">{["M390 65 C430 65 420 140 455 140", "M390 125 C420 125 420 140 455 140", "M390 185 C430 185 420 140 455 140"].map((path,index) => <path key={path} d={path} data-active={source === index}/>)}</svg>
      <div className={styles.brandCore} aria-live="polite" aria-atomic="true"><div className={styles.coreMark}><ShowworkLogo mark tone="white" width={34}/></div><span>YOUR BUSINESS CONTEXT</span><strong>{sources[source].title}</strong><p>{sources[source].detail}</p><div className={styles.coreSignal}><span/><span/><span/><span/><span/><span/><span/></div></div>
      <div className={styles.knowledgeOutputs}><span><Sparkles size={14}/>Content</span><span><BookOpenText size={14}/>Research</span><span><MessageCircle size={14}/>Replies</span></div>
    </div>}
    {kind === 1 && <div className={styles.planning}>
      <div className={styles.planLine}><span>YOUR NEXT CAMPAIGN</span><span>One clear view<ArrowRight size={13}/></span></div>
      <div className={styles.posters}>{["Tell your story", "Share the details", "Start a conversation"].map((label,index) => <div key={label} className={styles.poster} data-tone={index}><span className={styles.posterDay}>{["MON", "WED", "FRI"][index]}</span><div className={styles.posterArt}><ShowworkLogo mark width={20} tone={index === 1 ? "dark" : "white"} className={index === 1 ? styles.posterMarkDark : undefined}/><strong>{[<>Made for<br/>what’s next.</>,<>A closer<br/>look.</>,<>Let’s talk<br/>possibilities.</>][index]}</strong><span className={styles.posterArc}/></div><strong>{label}</strong><small><span/>{["Draft", "In review", "Approved"][index]}</small></div>)}</div>
      <div className={styles.planNote}><Check size={14}/>Your creative, copy and schedule. Together.</div>
    </div>}
    {kind === 2 && <div className={styles.team}>
      <div className={styles.reviewRoute}>{["Your team", "Your client", "Publishing"].map((label,index) => <div key={label} data-active={index === 1}><span>{index === 0 ? <UsersRound size={22}/> : index === 1 ? <MessageCircle size={22}/> : <Check size={22}/>}</span><strong>{label}</strong><small>{["Internal review", "Feedback & approval", "After approval"][index]}</small></div>)}</div>
      <div className={styles.reviewCard}><div><span className={styles.reviewIcon}><Check size={15}/></span><strong>Team review, complete.</strong></div><p>The next decision has a clear home.</p><span className={styles.reviewNext}>Ready for client review<ArrowRight size={14}/></span></div>
    </div>}
    {kind === 3 && <div className={styles.messaging}>
      <div className={styles.chatTop}><span className={styles.customerAvatar}><MessageCircle size={17}/></span><div><strong>A new enquiry</strong><small>Your business inbox</small></div><span className={styles.contextPill}><BookOpenText size={12}/>Business-aware</span></div>
      <div className={styles.incoming}><small>Customer</small><p>Can you tell me more about your services?</p></div>
      <div className={styles.response}><span><Sparkles size={14}/>{automatic ? "Automatic reply · example" : "AI-assisted draft"}</span><p>Happy to help. Here’s an overview of our services so you can find the right fit.</p><small><Check size={12}/>Based on your business knowledge</small></div>
      <div className={styles.chatControl}><span>{automatic ? "Enabled by you" : "Review before sending"}</span><strong>{automatic ? "Team takeover available" : "Your team stays in control"}<ArrowRight size={13}/></strong></div>
    </div>}
    {kind === 4 && <div className={styles.intelligence}>
      <div className={styles.insightContext}><span>START WITH THE EVIDENCE</span><h4>What’s worth<br/>trying next?</h4><div>{["Reach", "Engagement", "Content"].map(label => <span key={label}>{label}</span>)}</div></div>
      <div className={styles.insightBridge} aria-hidden="true"><ArrowRight size={24}/></div>
      <div className={styles.insightAction}><Sparkles size={24}/><span>AI RECOMMENDATIONS</span><strong>A clearer next move.</strong><p>Bring available results and business context into your next content plan.</p><span className={styles.actionLabel}>Review → Plan → Learn</span></div>
    </div>}
  </figure>;
}
