"use client";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
export default function LinkedInPagePicker({ calendarId }: { calendarId: string }) {
  const router = useRouter();
  const [pages, setPages] = useState<{ id: string; name: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [capabilities, setCapabilities] = useState<{ connected?: boolean; reconnectRequired?: boolean; accountType: string; publishing: boolean; analytics: boolean; messaging: boolean; messagingNote: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    calendarMutationFetch(`/api/calendars/${calendarId}/channels/linkedin/pages?capabilities=true`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not check LinkedIn access."); setCapabilities(data); }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not check LinkedIn access."); });
    return () => controller.abort();
  }, [calendarId]);
  async function request(pageId?: string) {
    setBusy(true); setError("");
    try {
      const response = await calendarMutationFetch(`/api/calendars/${calendarId}/channels/linkedin/pages`, pageId ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId }) } : { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "LinkedIn Pages could not load.");
      if (pageId) router.refresh(); else setPages(data.pages);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not connect this Page."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-2 rounded-xl border border-slate-700 p-3 text-xs text-slate-300">
    {capabilities && <p>{capabilities.accountType} · Publishing: {capabilities.publishing ? "authorized" : "reconnect required"} · Analytics: {capabilities.analytics ? "authorized" : "additional approval and reconnection required"}</p>}
    {capabilities && <p>{capabilities.messagingNote}</p>}
    {capabilities?.reconnectRequired && <a className="block font-semibold text-blue-300 underline" href={`/api/calendars/${calendarId}/channels/linkedin/connect`} target="_blank" rel="noopener noreferrer" title="Opens in a new tab">Reconnect LinkedIn</a>}
    {capabilities?.accountType === "Personal profile" && !capabilities.analytics && <a className="block text-blue-300 underline" href={`/api/calendars/${calendarId}/channels/linkedin/connect?analytics=true`} target="_blank" rel="noopener noreferrer" title="Opens in a new tab">Authorize analytics after LinkedIn approval</a>}
    <button type="button" disabled={busy || capabilities?.reconnectRequired} className="block text-blue-300 underline disabled:opacity-50" onClick={async () => {
      setBusy(true); setError("");
      try {
        const response = await calendarMutationFetch(`/api/calendars/${calendarId}/channels/linkedin/messaging`, { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Messaging setup failed.");
        router.refresh();
      } catch (err) { setError(err instanceof Error ? err.message : "Messaging setup failed."); }
      finally { setBusy(false); }
    }}>Set up Page messaging after approval</button>
    <p>Choose a company Page to publish and report on instead of your personal profile.</p>
    <a className="block text-blue-300 underline" href={`/api/calendars/${calendarId}/channels/linkedin/connect?pages=true`} target="_blank" rel="noopener noreferrer" title="Opens in a new tab">Authorize company Pages</a>
    <button type="button" disabled={busy || capabilities?.reconnectRequired} onClick={() => void request()} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">{busy ? "Loading…" : "Choose company Page"}</button>
    <button type="button" disabled={busy || capabilities?.reconnectRequired} onClick={() => void request("personal")} className="ml-2 text-blue-300 underline">Use personal profile</button>
    {pages?.map(page => <button type="button" disabled={busy || capabilities?.reconnectRequired} key={page.id} onClick={() => void request(page.id)} className="block w-full rounded bg-slate-800 p-2 text-left">Connect {page.name}</button>)}
    {pages?.length === 0 && <p>No administrator Pages were returned for this account.</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <p>Page features require LinkedIn Community Management access. Messaging is not enabled by connecting a Page.</p>
  </div>;
}
