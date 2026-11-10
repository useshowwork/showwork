"use client";
import { notifyReportingChannelChange } from "@/lib/reporting/channelChanges";
import channelStyles from "./ChannelsStudio.module.css";
import ChannelCapabilities from "./ChannelCapabilities";
import PlatformBrandIcon from "./PlatformBrandIcon";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import TikTokMessagingPanel from "./TikTokMessagingPanel";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  publishing_required: "Connect TikTok publishing before connecting Business Messaging.",
  messaging_not_configured: "Configure the approved TikTok Business Messaging app on the server before connecting.",
  messaging_connection_failed: "TikTok Business Messaging could not connect. Check approval and authorize all messaging permissions.",
  messaging_webhook_failed: "Business authorization succeeded, but the messaging webhook could not be enabled. Reconnect after checking the app approval and HTTPS callback.",
  messaging_account_changed: "Authorize the Business Account already linked to this channel so existing conversations stay with the correct account.",
  denied: "TikTok connection was cancelled.",
  connection_failed: "Something went wrong connecting to TikTok. Please try again.",
  not_configured: "TikTok publishing isn't set up yet — contact support.",
  not_found: "That calendar couldn't be found.",
  missing_state: "Something went wrong — please try connecting again.",
};

export default function TikTokConnectionCard({
  calendarId,
  username,
  connectedAt,
  isManager,
}: {
  calendarId: string;
  username: string | null;
  connectedAt: string | null;
  isManager: boolean;
}) {
    const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingConnected, setMessagingConnected] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [analyticsAccess, setAnalyticsAccess] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isManager || !username) return;
    const controller = new AbortController();
    setAnalyticsAccess(null);
    void fetch(`/api/calendars/${calendarId}/tiktok/analytics-access`, { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) return; const data = await response.json(); if (!controller.signal.aborted) setAnalyticsAccess(data.analyticsGranted === true); })
      .catch(() => {});
    return () => controller.abort();
  }, [calendarId, isManager, username]);

  useEffect(() => {
    const errorCode = searchParams.get("tiktokError");
    const connected = searchParams.get("tiktokConnected");
    const messaging = searchParams.get("tiktokMessagingConnected");
    if (messaging === "true") setMessagingConnected(true);
    if (errorCode) setError(ERROR_MESSAGES[errorCode] ?? "Something went wrong connecting to TikTok.");
    if (connected === "true") setJustConnected(true);
    if (errorCode || connected || messaging) {
      const url = new URL(window.location.href);
      url.searchParams.delete("tiktokError");
      url.searchParams.delete("tiktokConnected");
      url.searchParams.delete("tiktokMessagingConnected");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}/tiktok/disconnect`, { method: "POST" });
      if (res.ok) {
        notifyReportingChannelChange(calendarId);
        router.refresh();
        setConfirming(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to disconnect — try again");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = !!username;

  return (
    <div className={channelStyles.connectionCard}>
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={channelStyles.platformLogo}><PlatformBrandIcon platform="TIKTOK" size={25}/></div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-5 text-white">TikTok</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8295AF]">
                Content & business tools
              </p>
            </div>
          </div>

          {isConnected ? (<span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#398D78]">
              Connected
            </span>) : <span className={channelStyles.disconnected}>Not connected</span>}
        </div>

        {messagingConnected && <p role="status" className="mt-4 text-xs text-[#398D78]">TikTok Business Messaging connected. Manage DMs, leads and AI replies in Inbox.</p>}
        {justConnected && (
          <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] text-[#398D78]">
            TikTok connected successfully.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-[11px] text-[#AE6760]">
            {error}
          </p>
        )}

        <ChannelCapabilities platform="tiktok"/>
        {isConnected ? (
          <>
            <p className="mt-4 text-sm font-medium text-white">{username}</p>
            <p className="mt-1 max-w-sm text-[11px] leading-5 text-[#71849E]">
              After client approval, review TikTok settings and authorize each post to publish at its scheduled time.
              {connectedAt && ` Connected ${new Date(connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`}
            </p>

          </>
        ) : (
          <p className="mt-4 max-w-sm text-[11px] leading-5 text-[#71849E]">
            Connect this calendar to a client&apos;s TikTok account — once connected, review the settings and authorize each approved TikTok post for scheduled publishing.
          </p>
        )}
        {isManager && isConnected && <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold text-white">TikTok analytics</p>
          <p className="mt-1 text-[11px] leading-5 text-[#71849E]">{analyticsAccess === true
            ? "Analytics permissions granted. Open Analytics & Reporting, select TikTok, and sync data to retrieve current statistics."
            : analyticsAccess === false
              ? "Reconnect this account and grant profile statistics and video access to enable analytics. Publishing stays connected."
              : "Reconnect to grant or renew analytics access. Publishing stays connected."}</p>
          <a href={`/api/calendars/${calendarId}/tiktok/connect`} className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900" target="_blank" rel="noopener noreferrer" title="Opens in a new tab">Reconnect TikTok</a>
        </div>}
        {isManager && isConnected && <TikTokMessagingPanel calendarId={calendarId} />}
      </div>

      <div className="border-t border-[#E4EBF6] bg-[#F7FAFF] p-4 sm:p-5">
  {isManager ? (
    isConnected ? (
      confirming ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] text-[#71849E]">
            Disconnect this TikTok account? Already-published posts stay published.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Yes, disconnect"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-white/40 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="w-full rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-2.5 text-xs font-semibold text-[#AE6760] transition-colors hover:bg-red-400/10"
        >
          Disconnect TikTok
        </button>
      )
    ) : (
      <a
        href={`/api/calendars/${calendarId}/tiktok/connect`}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5"
       target="_blank" rel="noopener noreferrer" title="Opens in a new tab">
        Connect TikTok
      </a>
    )
  ) : (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-center text-[11px] font-medium text-[#8295AF]">
      {isConnected
        ? "Connected — channel-management permission is required."
        : "Channel-management permission is required to connect this account."}
    </div>
  )}
</div>
    </div>
  );
}