"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Bell, CalendarDays, CheckCheck, Headphones, MessageSquare, Plug, Upload } from "lucide-react";
import MobileDrawer from "@/components/navigation/MobileDrawer";
import styles from "./WorkspaceNotifications.module.css";

type Item = {
  id: string; kind: string; actor: string | null; title: string; description: string | null;
  createdAt: string; href: string; version: string;
};

const icons = {
  message: MessageSquare, handoff: Headphones, "team-feedback": MessageSquare,
  "client-feedback": MessageSquare, "team-approved": CheckCheck, "client-approved": CheckCheck,
  channel: Plug, uploaded: Upload, generated: CalendarDays, imported: CalendarDays,
};

export default function WorkspaceNotifications({ calendarId }: { calendarId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [storageKey, setStorageKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const unread = items.filter(item => !read.has(item.version)).length;

  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    async function refresh() {
      if (document.hidden || fetching) return;
      fetching = true;
      try {
        const response = await fetch(`/api/calendars/${encodeURIComponent(calendarId)}/notifications`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Notifications unavailable");
        const data: { items: Item[]; readScope: string } = await response.json();
        if (controller.signal.aborted) return;
        const key = `showwork:notifications:${data.readScope}:${calendarId}`;
        setStorageKey(key);
        setRead(current => {
          try { return new Set([...current, ...JSON.parse(localStorage.getItem(key) || "[]")]); } catch { return current; }
        });
        setItems(data.items);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        fetching = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, open ? 10000 : 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [calendarId, open]);

  function markRead(versions: string[]) {
    const updated = new Set([...read, ...versions]);
    setRead(updated);
    try { if (storageKey) localStorage.setItem(storageKey, JSON.stringify([...updated].slice(-240))); } catch { /* Session state still works. */ }
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)} aria-haspopup="dialog"
        aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <Bell size={15} aria-hidden="true" />
        <span className={styles.triggerLabel}>Notifications</span>
        {unread > 0 && <span className={styles.badge} aria-hidden="true">{unread}</span>}
      </button>
      <MobileDrawer placement="right" breakpoint={null} motion="fade" open={open} onClose={() => setOpen(false)} label="Notifications" className={styles.drawer}>
        <div className={styles.toolbar}>
          <span role="status">{unread ? `${unread} unread` : "Workspace activity"}</span>
          {unread > 0 && <button type="button" onClick={() => markRead(items.map(item => item.version))}>Mark all as read</button>}
        </div>
        {loading && <p className={styles.empty} role="status">Loading notifications…</p>}
        {failed && <p className={styles.empty} role="status">Notifications are temporarily unavailable. Checking again shortly.</p>}
        {!loading && !failed && !items.length && <div className={styles.empty}><Bell size={22} /><strong>You’re all caught up</strong><p>New workspace activity will appear here.</p></div>}
        {!!items.length && <ul className={styles.list}>
          {items.map(item => {
            const Icon = icons[item.kind as keyof typeof icons] ?? Bell;
            return (
              <li key={item.id}>
                <a href={item.href} className={styles.item} data-unread={!read.has(item.version)} onClick={() => markRead([item.version])}>
                  <span className={styles.icon} data-urgent={item.kind === "handoff"}><Icon size={17} aria-hidden="true" /></span>
                  <span className={styles.copy}>
                    <strong>{item.title}</strong>
                    {item.description && <span>{item.description}</span>}
                    <small>{item.actor && <>{item.actor} · </>}<time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></small>
                  </span>
                  <ArrowUpRight size={15} className={styles.arrow} aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>}
      </MobileDrawer>
    </>
  );
}
