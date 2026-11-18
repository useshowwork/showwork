"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Link2, PanelsTopLeft } from "lucide-react";
import CalendarPasswordDisplay from "./CalendarPasswordDisplay";
import styles from "./ClientSharingPanel.module.css";

export default function ClientSharingPanel({ calendarId, clientUrl, clientName, accessCode, canManage }: {
  calendarId: string;
  clientUrl: string;
  clientName: string;
  accessCode: string;
  canManage: boolean;
}) {
  const link = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState(accessCode);
  useEffect(() => setPassword(accessCode), [accessCode]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function copy(kind: "link" | "invitation") {
    setMessage("");
    setError("");
    const invitation = `Review ${clientName}’s content calendar\n${clientUrl}${password ? `\nPassword: ${password}` : ""}`;
    try {
      await navigator.clipboard.writeText(kind === "link" ? clientUrl : invitation);
      setMessage(kind === "link" ? "Link copied" : "Invitation copied");
    } catch {
      if (kind === "link") link.current?.focus();
      setError(kind === "link" ? "Select the link and copy it manually." : "Couldn’t copy the invitation. Copy the link and password separately.");
    }
  }

  return (
    <section className={styles.layout} aria-labelledby="client-sharing-heading">
      <header className={styles.header}>
        <span className={styles.headerIcon}><PanelsTopLeft size={21} aria-hidden="true" /></span>
        <h1 id="client-sharing-heading">Share with your client</h1>
      </header>
      <div className={styles.credentials}>
        <div className={styles.credential}>
          <label htmlFor="client-review-link" className={styles.label}><Link2 size={16} aria-hidden="true" /> Client link</label>
          <div className={styles.field}>
            <input ref={link} id="client-review-link" type="url" readOnly value={clientUrl} onFocus={(event) => event.currentTarget.select()} />
            <button type="button" onClick={() => void copy("link")} className={styles.copy} data-copied={message === "Link copied"}>
              {message === "Link copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {message === "Link copied" ? "Link copied" : "Copy link"}
            </button>
          </div>
        </div>
        <CalendarPasswordDisplay calendarId={calendarId} accessCode={password} canManage={canManage} onPasswordChange={(value) => {
          setPassword(value);
          setMessage("");
          setError("");
        }} />
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => void copy("invitation")}>
          {message === "Invitation copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {message === "Invitation copied" ? "Invitation copied" : "Copy invitation"}
        </button>
        <a href={clientUrl} target="_blank" rel="noopener noreferrer">Preview client page <ArrowUpRight size={16} aria-hidden="true" /></a>
      </div>
      <span role="status" className="sr-only">{message}</span>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
  );
}
