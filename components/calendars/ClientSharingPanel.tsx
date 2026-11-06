"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy, Link2, LockKeyhole, PanelsTopLeft } from "lucide-react";
import CalendarPasswordDisplay from "./CalendarPasswordDisplay";
import styles from "./ClientSharingPanel.module.css";

export default function ClientSharingPanel({calendarId, clientUrl, clientName, accessCode, canManage}: {calendarId:string;clientUrl:string;clientName:string;accessCode:string;canManage:boolean}) {
  const [copied,setCopied] = useState<"link" | "invite" | null>(null);
  const [error,setError] = useState("");
  async function copy(kind:"link"|"invite") {
    setError("");
    try { await navigator.clipboard.writeText(kind === "link" ? clientUrl : `Hi! Your ${clientName} content calendar is ready to review.\n\n${clientUrl}${accessCode ? `\n\nPassword: ${accessCode}` : ""}\n\nOpen the link to review your planned content and share feedback.`);setCopied(kind);setTimeout(() => setCopied(current => current === kind ? null : current),2500); }
    catch {setError("Couldn’t copy. Select the link below and copy it manually.");}
  }
  return <div className={styles.layout}>
    <section className={styles.share} aria-labelledby="client-link-heading"><div className={styles.icon}><Link2 size={21}/></div><h2 id="client-link-heading">Your client’s review link</h2><p>One place to review content, leave feedback and approve posts.</p>
      <label className={styles.label} htmlFor="client-review-link">Client page link</label><div className={styles.linkField}><input id="client-review-link" readOnly value={clientUrl} onFocus={event => event.currentTarget.select()}/><button type="button" onClick={() => void copy("link")} aria-label="Copy client page link">{copied === "link" ? <Check size={17}/> : <Copy size={17}/>}</button></div>
      <div className={styles.actions}><button type="button" className={styles.primary} onClick={() => void copy("invite")}>{copied === "invite" ? <Check size={16}/> : <Copy size={16}/>} {copied === "invite" ? "Invitation copied" : "Copy invitation"}</button><a href={clientUrl} target="_blank" rel="noopener noreferrer">Preview client page <ArrowUpRight size={16}/></a></div>
      <p className={styles.helper}>Copy invitation includes the link{accessCode ? " and password" : ""}, ready to send.</p><span role="status" className={styles.feedback}>{copied === "link" ? "Link copied" : copied === "invite" ? "Invitation copied. Paste it into your message to the client." : ""}</span>{error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.boundary}><PanelsTopLeft size={18}/><div><strong>Made for your client</strong><span>Share this review page, rather than your team’s workspace link.</span></div></div>
    </section>
    <section className={styles.access} aria-labelledby="client-password-heading"><div className={styles.icon}><LockKeyhole size={21}/></div><h2 id="client-password-heading">Client page password</h2><p>Share it with the people reviewing this workspace.</p><div className={styles.password} data-password-display><CalendarPasswordDisplay calendarId={calendarId} accessCode={accessCode} canManage={canManage}/></div><p className={styles.helper}>This password is for the client page, not your Showwork account.</p></section>
  </div>;
}
