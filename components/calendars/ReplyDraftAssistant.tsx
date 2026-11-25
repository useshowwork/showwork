"use client";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  REPLY_TONES,
  type ReplyTone,
} from "@/lib/socialMessaging/replyProfile";

type Suggestion = {
  replyText: string;
  handoffReason: string | null;
  shouldReply: boolean;
  sourceMessageId: string;
};
export default function ReplyDraftAssistant({
  endpoint,
  conversationId,
  defaultTone,
  currentDraft,
  latestInboundId,
  onUseDraft,
  locked = false,
  freeTrial = false,
  engage = false,
}: {
  endpoint: string;
  conversationId: string;
  defaultTone: ReplyTone;
  currentDraft: string;
  latestInboundId?: string;
  onUseDraft: (text: string) => void;
  locked?: boolean;
  freeTrial?: boolean;
  engage?: boolean;
}) {
  const [tone, setTone] = useState(defaultTone);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");
  const [requiresUpgrade, setRequiresUpgrade] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    requestRef.current?.abort();
    setTone(defaultTone);
    setContext("");
    setSuggestion(null);
    setError("");
    setRequiresUpgrade(false);
    setBusy(false);
    return () => requestRef.current?.abort();
  }, [conversationId, defaultTone]);
  // A newer customer message invalidates a previously prepared response.
  useEffect(() => {
    requestRef.current?.abort();
    setSuggestion(null);
    setBusy(false);
  }, [latestInboundId]);

  async function generate() {
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    setRequiresUpgrade(false);
    setSuggestion(null);
    try {
      const response = await calendarMutationFetch(
        `${endpoint}/${encodeURIComponent(conversationId)}/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ tone, context, currentDraft }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        if (!controller.signal.aborted) setRequiresUpgrade(result.requiresUpgrade === true);
        throw new Error(result.error || "Could not prepare a reply.");
      }
      if (!controller.signal.aborted) setSuggestion(result);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Could not prepare a reply.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const stale =
    suggestion &&
    latestInboundId &&
    suggestion.sourceMessageId !== latestInboundId;
  return (
    <div className="mb-3 max-h-[45dvh] space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-[#E2E8F5] bg-[#F8FAFF] p-3">
      {locked && <WorkspaceFeatureNotice compact feature="aiInboxReplies" />}
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-[10px] font-semibold text-[#475467]">
          Reply tone
          <select
            value={tone}
            disabled={busy || locked}
            onChange={(event) => {
              setTone(event.target.value as ReplyTone);
              setSuggestion(null);
            }}
            className="mt-1 min-h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-2.5 text-xs text-[#344054]"
          >
            {REPLY_TONES.map((tone) => (
              <option key={tone.value} value={tone.value}>
                {tone.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || locked}
          onClick={() => void generate()}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-700 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {busy
            ? "Preparing…"
            : currentDraft.trim()
              ? "Improve draft"
              : "Draft reply"}
          {!busy && freeTrial && " · 1 credit"}
        </button>
      </div>
      <details>
        <summary className="cursor-pointer py-1 text-[10px] font-semibold text-[#667085]">
          Add context for this reply
        </summary>
        <label className="mt-1 block text-[10px] text-[#667085]">
          Facts or direction for this conversation only
          <textarea
            value={context}
            onChange={(event) => {
              setContext(event.target.value);
              setSuggestion(null);
            }}
            disabled={busy || locked}
            maxLength={2000}
            rows={2}
            placeholder="e.g. They asked about our studio package. Confirm that it includes 10 edited images; ask which date they prefer."
            className="mt-1 min-h-11 w-full resize-y rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs leading-5 text-[#344054] outline-none focus:border-blue-400"
          />
        </label>
      </details>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
          {requiresUpgrade && <>
            <a className="ml-2 font-semibold underline" href={engage ? "/dashboard/billing?product=engage" : "/dashboard/billing?product=content-workspace#content-workspace-plans"}>View plans</a>
            <button type="button" className="ml-2 underline" onClick={() => setError("")}>Keep working</button>
          </>}
        </p>
      )}
      {suggestion && (
        <div
          aria-live="polite"
          className="space-y-2 border-t border-[#E2E8F5] pt-2"
        >
          {suggestion.handoffReason && (
            <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-5 text-amber-800">
              <strong>Team review needed:</strong> {suggestion.handoffReason}
            </p>
          )}
          {suggestion.replyText && (
            <>
              <p className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[#344054]">
                {suggestion.replyText}
              </p>
              <button
                type="button"
                disabled={!!stale || locked}
                onClick={() => {
                  onUseDraft(suggestion.replyText);
                  setSuggestion(null);
                }}
                className="min-h-11 rounded-lg bg-[#1768E8] px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                Use draft
              </button>
            </>
          )}
          {stale && (
            <p className="text-[10px] text-amber-800">
              A newer customer message arrived. Prepare a fresh draft.
            </p>
          )}
        </div>
      )}
      <p className="text-[9px] leading-4 text-[#98A2B3]">
        Uses your saved playbook and conversation history. Review and edit
        before sending.
      </p>
    </div>
  );
}
