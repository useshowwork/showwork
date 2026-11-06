"use client";

import { useState } from "react";
import { ArrowRight, BookOpenText, Check, MessageCircle, Sparkles, UsersRound } from "lucide-react";
import PlatformBrandIcon from "@/components/calendars/PlatformBrandIcon";
import styles from "./ConnectedInboxVisual.module.css";

const channels = [
  { name: "WhatsApp", platform: "WHATSAPP", question: "Can you tell me about your services?", preview: "A question about your services", answer: "Happy to help. Tell me what you’re looking for, and I’ll guide you to the right service." },
  { name: "Instagram", platform: "INSTAGRAM", question: "I saw your campaign. How do I get started?", preview: "An enquiry from your campaign", answer: "Thanks for reaching out. What would you like help with? I can explain our services and the next steps." },
  { name: "Facebook", platform: "FACEBOOK", question: "Can someone help me choose the right option?", preview: "A customer needs guidance", answer: "Of course. Share a little about what you need, and I’ll help you find the right fit." },
];

export default function ConnectedInboxVisual() {
  const [selected, setSelected] = useState(0);
  const channel = channels[selected];
  return <figure className={styles.visual} aria-label="WhatsApp, Instagram and Facebook enquiries connected to one Showwork inbox with AI replies">
    <div className={styles.channelStrip}>{channels.map(item => <span key={item.platform}><PlatformBrandIcon platform={item.platform} size={27}/><strong>{item.name}</strong></span>)}</div>
    <svg className={styles.channelLinks} viewBox="0 0 600 54" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M100 0 V12 Q100 25 120 25 H280 Q300 25 300 44 M300 0 V44 M500 0 V12 Q500 25 480 25 H320 Q300 25 300 44"/><path className={styles.linkArrow} d="m294 39 6 7 6-7"/></svg>
    <div className={styles.inbox}>
      <div className={styles.inboxHeader}><span className={styles.inboxIcon}><MessageCircle size={20}/></span><div><strong>Your business inbox</strong><small>Three channels. One team.</small></div><span className={styles.aiBadge}><Sparkles size={12}/>AI replies</span></div>
      <div className={styles.inboxBody}>
        <div className={styles.threads} role="group" aria-label="Explore enquiries by channel">{channels.map((item,index) => <button key={item.platform} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}><PlatformBrandIcon platform={item.platform} size={18}/><span><strong>{item.name}</strong><small>{item.preview}</small></span><span className={styles.threadDot}/></button>)}</div>
        <div className={styles.conversation} aria-live="polite" aria-atomic="true"><div className={styles.conversationHeader}><PlatformBrandIcon platform={channel.platform} size={15}/><span>{channel.name} enquiry</span><small>Example</small></div><div className={styles.question}>{channel.question}</div><div className={styles.answer}><span><Sparkles size={13}/>Automatic reply · example</span><p>{channel.answer}</p><small><BookOpenText size={11}/>Using your business knowledge</small></div><span className={styles.sent}><Check size={12}/>A conversation kept moving.</span></div>
      </div>
      <div className={styles.takeover}><UsersRound size={16}/><span>AI responds. Your team can take over.</span><ArrowRight size={15}/></div>
    </div>
    <figcaption>Connected-inbox illustration · Select a channel to explore.</figcaption>
  </figure>;
}
