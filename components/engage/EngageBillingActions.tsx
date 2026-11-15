"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

export default function EngageBillingActions() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const response = await calendarMutationFetch(
        "/api/calendars/cancel-subscription",
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Cancellation failed. Please try again.");
      dialog.current?.close();
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm">
      <Link
        href="/dashboard/billing?product=content-workspace#content-workspace-plans"
        className="font-medium text-blue-700 underline underline-offset-4"
      >
        Explore Marketing Workspace
      </Link>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="text-slate-500 underline underline-offset-4"
      >
        Cancel subscription
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="engage-cancel-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl border-0 p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
      >
        <h2 id="engage-cancel-title" className="text-xl font-semibold">
          Cancel Showwork Engage?
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your subscription and AI replies stop immediately. Existing
          conversations, leads, and business knowledge are preserved. You can
          subscribe again later.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => dialog.current?.close()}
            className="flex-1 rounded-xl border px-3 py-3 text-sm font-semibold"
          >
            Keep subscription
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={cancel}
            className="flex-1 rounded-xl bg-red-600 px-3 py-3 text-sm font-semibold text-white"
          >
            {busy ? "Cancelling…" : "Cancel subscription"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
