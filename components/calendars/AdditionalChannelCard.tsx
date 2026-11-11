"use client";
import { notifyReportingChannelChange } from "@/lib/reporting/channelChanges";
import channelStyles from "./ChannelsStudio.module.css";
import ChannelCapabilities from "./ChannelCapabilities";
import PlatformBrandIcon from "./PlatformBrandIcon";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import UiSymbol from "@/components/ui/UiSymbol";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export type AdditionalChannel = "facebook" | "linkedin" | "x";

const CHANNEL_META: Record<AdditionalChannel, { name: string; mark: string; color: string; accountType: string }> = {
  facebook: { name: "Facebook", mark: "f", color: "#1877F2", accountType: "Facebook Page" },
  linkedin: { name: "LinkedIn", mark: "in", color: "#0A66C2", accountType: "member profile or company Page" },
  x: { name: "X", mark: "𝕏", color: "#000000", accountType: "X account" },
};

const ERROR_MESSAGES: Record<string, string> = {
  coming_soon: "This channel is coming soon. New connections are not available yet.",
  denied: "The connection was cancelled.",
  not_configured: "This channel is not configured yet. Ask an administrator to finish its developer app setup.",
  not_found: "This workspace could not be found or you do not have permission to manage its channels.",
  missing_state: "The secure connection session expired. Please try connecting again.",
  no_page: "Meta returned no eligible Page for this authorization. Check your assigned Page access and select the client’s Page when reconnecting.",
  META_DISCOVERY_PERMISSION_MISSING: "Meta did not grant Page list access. Reconnect and allow the requested Page permissions.",
  META_DISCOVERY_INCOMPLETE: "Meta could not finish checking your assigned Pages. This does not mean you have no Pages. Check your asset assignment and reconnect.",
  META_TOKEN_INVALID: "Your Meta authorization expired or is invalid. Reconnect Facebook.",
  META_TOKEN_MISMATCH: "Meta returned authorization for a different app. Restart the connection and ask the administrator to check the Meta app configuration.",
  META_PAGE_ACCESS_FAILED: "Meta could not verify your Page access. Check the Page assignment and reconnect.",
  connection_failed: "The account could not be connected. Check the channel permissions and try again.",
};

export default function AdditionalChannelCard({
  channel,
  calendarId,
  accountName,
  connectedAt,
  isManager,
}: {
  channel: AdditionalChannel;
  calendarId: string;
  accountName: string | null;
  connectedAt: string | null;
  isManager: boolean;
}) {
  const searchParams = useSearchParams();
  const meta = CHANNEL_META[channel];
  const [connectedAccount, setConnectedAccount] = useState(accountName);
  const [connectedDate, setConnectedDate] = useState(connectedAt);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get(`${channel}Connected`);
    const errorCode = searchParams.get(`${channel}Error`);
    if (success === "true") setJustConnected(true);
    if (errorCode) setError(ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.connection_failed);
    if (success || errorCode) {
      const url = new URL(window.location.href);
      url.searchParams.delete(`${channel}Connected`);
      url.searchParams.delete(`${channel}Error`);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    // The callback is a full OAuth navigation; process its result once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      const response = await calendarMutationFetch(`/api/calendars/${calendarId}/channels/${channel}/disconnect`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Could not disconnect ${meta.name}.`);
      notifyReportingChannelChange(calendarId);
      setConnectedAccount(null);
      setConnectedDate(null);
      setConfirming(false);
      setJustConnected(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not disconnect ${meta.name}.`);
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = !!connectedAccount;
  const comingSoon = channel === "linkedin" || channel === "x";

  return (
    <section className={channelStyles.connectionCard}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={channelStyles.platformLogo}>
              <PlatformBrandIcon platform={channel.toUpperCase()} size={24}/>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-5 text-white">{meta.name}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8295AF]">
                {comingSoon ? "Coming soon" : `Connect a ${meta.accountType}`}
              </p>
            </div>
          </div>
          {isConnected ? (<span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#398D78]">
              Connected
            </span>) : <span className={channelStyles.disconnected}>{comingSoon ? "Coming soon" : "Not connected"}</span>}
        </div>

        {justConnected && (
          <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] text-[#398D78]">
            {meta.name} account connected successfully.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-[11px] leading-5 text-[#AE6760]">
            {error}
          </p>
        )}

        {!comingSoon && isConnected && isManager && <a href={`/api/calendars/${calendarId}/channels/${channel}/connect`} className="mt-3 inline-block text-xs text-[#397CC8] underline" target="_blank" rel="noopener noreferrer" title="Opens in a new tab">Refresh permissions</a>}
        {!comingSoon && <ChannelCapabilities platform={channel}/>}
        {isConnected ? (
          <>
            <p className="mt-4 truncate text-sm font-medium text-white">{channel === "x" ? "@" : ""}{connectedAccount}</p>
            <p className="mt-1 max-w-sm text-[11px] leading-5 text-[#71849E]">
              This {meta.accountType} is linked to the workspace.
              {connectedDate && ` Connected ${new Date(connectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`}
            </p>
          </>
        ) : (
          <p className="mt-4 max-w-sm text-[11px] leading-5 text-[#71849E]">
            {comingSoon ? `${meta.name} connections will be available soon.` : `Connect the ${meta.accountType} used for this client’s ${meta.name} content.`}
          </p>
        )}
      </div>

      <div className="border-t border-[#E4EBF6] bg-[#F7FAFF] p-4 sm:p-5">
        {comingSoon && !isConnected ? (
          <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500">Coming soon</button>
        ) : !isManager ? (
          <p className="text-[10px] leading-5 text-[#8295AF]">Channel-management permission is required to connect or disconnect accounts.</p>
        ) : isConnected ? (
          confirming ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] text-[#71849E]">Disconnect this {meta.accountType}?</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={disconnect} disabled={disconnecting} className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {disconnecting ? "Disconnecting..." : "Yes, disconnect"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={disconnecting} className="rounded-lg border border-[#DCE5F2] px-3 py-2 text-xs font-semibold text-[#71849E]">
                  Keep connected
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-[#DCE5F2] px-3 py-2 text-xs font-semibold text-[#71849E] transition hover:border-red-400/30 hover:text-[#AE6760]">
              Disconnect {meta.name}
            </button>
          )
        ) : (
          <a href={`/api/calendars/${calendarId}/channels/${channel}/connect`} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110" style={{ backgroundColor: meta.color }} target="_blank" rel="noopener noreferrer" title="Opens in a new tab">
            Connect {meta.name}<span aria-hidden="true"><><UiSymbol name="right" /></></span>
          </a>
        )}
      </div>
    </section>
  );
}
