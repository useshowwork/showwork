"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Users } from "lucide-react";
import styles from "./PostReviewFlow.module.css";

type FeedbackMessage = { id: string; authorName: string; message: string; createdAt: string };
type FeedbackPage = { messages: FeedbackMessage[]; hasOlder: boolean };

function mergeMessages(current: FeedbackMessage[], incoming: FeedbackMessage[]) {
  const messages = new Map([...current, ...incoming].map(message => [message.id, message]));
  return [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export default function TeamFeedbackThread({ calendarId, postId, active, canSend }: {
  calendarId: string;
  postId: string;
  active: boolean;
  canSend: boolean;
}) {
  const endpoint = `/api/calendars/${encodeURIComponent(calendarId)}/posts/${encodeURIComponent(postId)}/team-feedback`;
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [hasOlder, setHasOlder] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const requestId = useRef<string | null>(null);
  const history = useRef<HTMLOListElement>(null);
  const followLatest = useRef(true);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sendError, setSendError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPage = useCallback(async (signal?: AbortSignal, before?: string) => {
    const response = await fetch(before ? `${endpoint}?before=${encodeURIComponent(before)}` : endpoint, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Couldn't load feedback.");
    return await response.json() as FeedbackPage;
  }, [endpoint]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let inProgress = false;
    async function refresh() {
      if (inProgress || document.hidden) return;
      inProgress = true;
      try {
        const page = await loadPage(controller.signal);
        if (controller.signal.aborted) return;
        setMessages(current => mergeMessages(current, page.messages));
        setHasOlder(current => current ?? page.hasOlder);
        setLoadError(false);
      } catch {
        if (!controller.signal.aborted) setLoadError(true);
      } finally {
        inProgress = false;
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, loadPage]);

  const latestId = messages.at(-1)?.id;
  useEffect(() => {
    if (active && followLatest.current && history.current) {
      history.current.scrollTop = history.current.scrollHeight;
    }
  }, [active, latestId]);

  async function loadOlder() {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    setLoadError(false);
    try {
      const page = await loadPage(undefined, messages[0].id);
      setMessages(current => mergeMessages(current, page.messages));
      setHasOlder(page.hasOlder);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function sendFeedback() {
    if (!draft.trim() || sending || !canSend) return;
    setSending(true);
    setSendError("");
    setNotice("");
    try {
      requestId.current ??= crypto.randomUUID();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft, requestId: requestId.current }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't send feedback.");
      followLatest.current = true;
      setMessages(current => mergeMessages(current, [result.message]));
      requestId.current = null;
      setDraft("");
      setNotice(result.notifications?.failed
        ? "Feedback saved. Some team emails could not be delivered."
        : "Feedback sent.");
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Couldn't send feedback.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={styles.feedbackCard} aria-labelledby="team-feedback-heading">
      <div className={styles.feedbackHeading}>
        <h3 id="team-feedback-heading"><Users size={16} aria-hidden="true" />Private team feedback</h3>
        <span>Team only</span>
      </div>
      <p>Share suggestions or ask for edits. Your team can reply here.</p>
      {hasOlder && (
        <button type="button" className={styles.feedbackButton} onClick={loadOlder} disabled={loadingOlder}>
          {loadingOlder ? "Loading…" : "Load earlier feedback"}
        </button>
      )}
      {messages.length > 0 ? (
        <ol
          ref={history}
          className={styles.feedbackMessages}
          aria-label="Feedback history"
          tabIndex={0}
          onScroll={event => {
            const list = event.currentTarget;
            followLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
          }}
        >
          {messages.map(message => (
            <li key={message.id} className={styles.feedbackMessage}>
              <div className={styles.feedbackByline}>
                <strong>{message.authorName}</strong>
                <time dateTime={message.createdAt}>
                  {new Date(message.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </div>
              <p>{message.message}</p>
            </li>
          ))}
        </ol>
      ) : hasOlder !== null && <p>No feedback yet.</p>}
      {loadError && <p role="status">Couldn't load feedback. The conversation will retry shortly.</p>}
      {canSend && (
        <form onSubmit={event => { event.preventDefault(); void sendFeedback(); }}>
          <textarea
            aria-label="Feedback or suggestion"
            value={draft}
            onChange={event => { requestId.current = null; setDraft(event.target.value); }}
            maxLength={4000}
            rows={2}
            disabled={sending}
            placeholder="Write feedback or a suggestion…"
          />
          <div className={styles.feedbackComposerActions}>
            <span>{draft.length.toLocaleString()} / 4,000</span>
            <button type="submit" className={styles.feedbackButton} disabled={sending || !draft.trim()}>
              {sending ? "Sending…" : "Send feedback"} <Send size={14} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
      {sendError && <p role="alert">{sendError}</p>}
    </section>
  );
}
