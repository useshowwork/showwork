"use client";
import { useEffect, useState } from "react";
import { CalendarClock, PauseCircle } from "lucide-react";

export default function AutoPublishToggle({ calendarId, canManage, compact = false }: { calendarId: string; canManage: boolean; compact?: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setEnabled(null); setError("");
    void fetch(`/api/calendars/${calendarId}/publishing-settings`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load publishing settings.");
        if (!controller.signal.aborted) setEnabled(result.autoPublishEnabled);
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [calendarId, reload]);
  async function toggle() {
    if (enabled === null || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/calendars/${calendarId}/publishing-settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autoPublishEnabled: !enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save publishing settings.");
      setEnabled(result.autoPublishEnabled);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save publishing settings."); }
    finally { setBusy(false); }
  }
  if (compact) return <div className="relative flex flex-wrap items-center gap-2 text-xs" aria-label="Automatic publishing">
    <span id={`auto-publish-${calendarId}`} className="font-medium" title="Automatically publish approved posts on supported connected channels. Team and client approvals still apply.">Auto-publish</span>
    <button type="button" role="switch" aria-checked={enabled === true} aria-labelledby={`auto-publish-${calendarId}`} aria-busy={busy} disabled={!canManage || enabled === null || busy} onClick={() => void toggle()} title={!canManage ? "You need publishing permission to change this setting." : "Change automatic publishing"} className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-blue-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "left-1 translate-x-4" : "left-1"}`}/></button>
    <span className="min-w-5 text-[10px] opacity-70" aria-live="polite">{busy ? "Saving…" : enabled === null ? "…" : enabled ? "On" : "Off"}</span>
    {error && <p role="alert" className="basis-full text-xs text-red-600">{error} <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>Retry</button></p>}
  </div>;
  const Icon = enabled === false ? PauseCircle : CalendarClock;
  return <section className={`mb-5 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 ${compact ? "" : "shadow-sm"}`} aria-label="Automatic publishing">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 gap-3">
        <span className="rounded-xl bg-blue-50 p-2 text-blue-600"><Icon size={20} aria-hidden="true" /></span>
        <div><p id={`auto-publish-${calendarId}`} className="text-sm font-semibold">Auto-publish approved posts</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{enabled === null ? "Loading publishing settings…" : enabled
            ? "On · New client approvals are queued for their calendar time on connected channels."
            : "Off · Client approval only. Scheduled posts are paused until you turn this back on."}</p>
        </div>
      </div>
      <button type="button" role="switch" aria-checked={enabled === true} aria-labelledby={`auto-publish-${calendarId}`}
        disabled={!canManage || enabled === null || busy} onClick={() => void toggle()}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "left-1 translate-x-5" : "left-1"}`} />
      </button>
    </div>
    <details open={!compact}><summary className="mt-3 cursor-pointer text-xs text-slate-500">How publishing works</summary><p className="mt-2 text-xs leading-5 text-slate-500">TikTok also needs each post’s visibility settings and publishing consent. Deliveries already started may finish. Turning this on does not queue posts approved while it was off.</p></details>
    {busy && <p role="status" className="mt-2 text-xs text-blue-600">Saving…</p>}
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error} <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>Reload</button></p>}
  </section>;
}
