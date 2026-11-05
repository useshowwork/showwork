"use client";
import channelStyles from "./ChannelsStudio.module.css";
import ChannelCapabilities from "./ChannelCapabilities";
import PlatformBrandIcon from "./PlatformBrandIcon";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  denied: "Instagram connection was cancelled.",
  no_linked_account: "No Instagram Business account is linked to your Facebook Page yet. Link one in your Facebook Page settings, then try again.",
  connection_failed: "Something went wrong connecting to Instagram. Please try again.",
  not_configured: "Instagram publishing isn't set up yet — contact support.",
  not_found: "That calendar couldn't be found.",
  missing_state: "Something went wrong — please try connecting again.",
};

export default function InstagramConnectionCard({
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
  const [justConnected, setJustConnected] = useState(false);

  useEffect(() => {
    const errorCode = searchParams.get("instagramError");
    const connected = searchParams.get("instagramConnected");
    if (errorCode) setError(ERROR_MESSAGES[errorCode] ?? "Something went wrong connecting to Instagram.");
    if (connected === "true") setJustConnected(true);
    if (errorCode || connected) {
      // Clean the URL so refreshing the page doesn't keep re-showing
      // the same success/error message.
      const url = new URL(window.location.href);
      url.searchParams.delete("instagramError");
      url.searchParams.delete("instagramConnected");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}/instagram/disconnect`, { method: "POST" });
      if (res.ok) {
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
            <div className={channelStyles.platformLogo}><PlatformBrandIcon platform="INSTAGRAM" size={25}/></div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-5 text-white">Instagram</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8295AF]">
                Professional account
              </p>
            </div>
          </div>

          {isConnected ? (<span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#398D78]">
              Connected
            </span>) : <span className={channelStyles.disconnected}>Not connected</span>}
        </div>

        {justConnected && (
          <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] text-[#398D78]">
            Instagram connected successfully.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-[11px] text-[#AE6760]">
            {error}
          </p>
        )}

        <ChannelCapabilities platform="instagram"/>
        {isConnected ? (
          <>
            <p className="mt-4 text-sm font-medium text-white">@{username}</p>
            <p className="mt-1 max-w-sm text-[11px] leading-5 text-[#71849E]">
              Internally and client-approved content can publish at its scheduled time when auto-publish and required permissions are enabled.
              {connectedAt && ` Connected ${new Date(connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`}
            </p>
          </>
        ) : (
          <p className="mt-4 max-w-sm text-[11px] leading-5 text-[#71849E]">
            Connect a linked Instagram professional account for content publishing. Analytics and messaging require their own permissions and setup.
          </p>
        )}
      </div>

      <div className="border-t border-[#E4EBF6] bg-[#F7FAFF] p-4 sm:p-5">
        {isManager && isConnected && !confirming && (
          <a href={`/api/calendars/${calendarId}/instagram/connect`} className="mb-3 flex justify-center rounded-xl border border-white/20 px-4 py-2.5 text-xs font-semibold text-white" target="_blank" rel="noopener noreferrer" title="Opens in a new tab">
            Reauthorize Instagram
          </a>
        )}
  {isManager ? (
    isConnected ? (
      confirming ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] text-[#71849E]">
            Disconnect @{username}? Already-published posts stay published.
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
          Disconnect Instagram
        </button>
      )
    ) : (
    <a
  href={`/api/calendars/${calendarId}/instagram/connect`}
  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5"
  style={{
    background:
      "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
  }}
 target="_blank" rel="noopener noreferrer" title="Opens in a new tab">
  Connect Instagram

        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-3.5 w-3.5 opacity-70"
          aria-hidden="true"
        >
          <path
            d="M14 5h5v5M19 5l-8 8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18 13v4.5A1.5 1.5 0 0 1 16.5 19h-10A1.5 1.5 0 0 1 5 17.5v-10A1.5 1.5 0 0 1 6.5 6H11"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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