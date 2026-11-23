"use client";
import { readCalendarJson } from "@/lib/calendarReadRequests";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { useCallback, useEffect, useState } from "react";

export default function TikTokMessagingPanel({ calendarId }: { calendarId: string }) {
  const [access, setAccess] = useState<{ available: boolean; reason: string; businessId?: string; syncError?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const endpoint = `/api/calendars/${encodeURIComponent(calendarId)}/tiktok/messaging`;
  const load = useCallback(async (fresh = false) => {
    try {
      const response = await readCalendarJson(endpoint, fresh);
      const result = response.data;
      if (!response.ok) throw new Error(result.error || "Could not check TikTok messaging access.");
      setAccess(result);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not check messaging access."); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);
  async function sync() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await calendarMutationFetch(endpoint, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sync TikTok DMs.");
      setNotice(`Imported ${result.imported} messages. ${result.warnings?.join(" ") || ""}`);
      window.dispatchEvent(new CustomEvent("showwork-inbox-leads-updated"));
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not sync TikTok DMs."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
    <p className="text-xs font-semibold text-white">TikTok Business Messaging</p>
    <p className="text-[11px] leading-5 text-[#AAB4C3]">{access?.reason || "Checking messaging access…"}</p>
    {access?.businessId && <p className="break-all text-[10px] text-[#AAB4C3]">Messaging Business Account: {access.businessId}</p>}
    <p className="text-[11px] leading-5 text-[#AAB4C3]">Authorize the Business Account whose DMs you want to manage. Incoming enquiries become leads in Inbox. Enable AI replies in Inbox settings.</p>
    <a href={`${endpoint}/connect`} className="inline-flex rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#101828]">{access?.businessId ? "Reconnect Business Messaging" : "Connect Business Messaging"}</a>
    {access?.available && <button type="button" disabled={busy} onClick={() => void sync()} className="ml-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Syncing…" : "Import recent DMs"}</button>}
    <p className="text-[10px] leading-4 text-[#AAB4C3]">History import includes up to 20 messages per conversation and does not trigger AI replies. Live DMs arrive automatically.</p>
    {notice && <p role="status" className="text-[11px] text-emerald-300">{notice}</p>}
    {(error || access?.syncError) && <p role="alert" className="text-[11px] text-red-300">{error || access?.syncError}</p>}
  </div>;
}
