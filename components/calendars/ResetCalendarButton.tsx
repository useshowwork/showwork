"use client";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type BlockedPost = { id: string; title: string; platform: string; postDate: string; reason: string };

export default function ResetCalendarButton({ calendarId, onReset }: { calendarId: string; onReset: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blockedPosts, setBlockedPosts] = useState<BlockedPost[]>([]);
  async function reset(removeBlocked = false) {
    if (busy || confirmation !== "RESET") return;
    setBusy(true);
    setError("");
    try {
      const response = await calendarMutationFetch(`/api/calendars/${calendarId}/reset`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation, removeBlocked }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBlockedPosts(Array.isArray(data.blockingPosts) ? data.blockingPosts : []);
        throw new Error(data.error || "Could not reset the calendar.");
      }
      onReset();
      dialog.current?.close();
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not reset the calendar."); }
    finally { setBusy(false); }
  }
  async function removePost(postId: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await calendarMutationFetch(`/api/calendars/${calendarId}/posts/${postId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE", removeBlocked: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove this post.");
      setBlockedPosts(posts => posts.filter(post => post.id !== postId));
      router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not remove this post."); }
    finally { setBusy(false); }
  }
  return <>
    <button data-content-toolbar-action="reset" type="button" onClick={() => { setConfirmation(""); setError(""); setBlockedPosts([]); dialog.current?.showModal(); }} className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Reset calendar</button>
    <dialog ref={dialog} aria-labelledby="reset-calendar-title" aria-describedby="reset-calendar-description" onCancel={(event) => { if (busy) event.preventDefault(); }} className="w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/50">
      <h2 id="reset-calendar-title" className="text-lg font-bold">Reset calendar and delete all content?</h2>
      <div id="reset-calendar-description" className="mt-3 space-y-3 text-sm text-slate-600">
        <p>This permanently clears content across <strong>all months</strong> in this workspace, including approved posts.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Deletes every planned post and AI draft, captions, scripts, custom fields, and attached photos and videos.</li>
          <li>Deletes post comments, feedback, approvals, AI version history, and calendar publishing records and their metrics.</li>
          <li>Clears import history and cancels scheduled posts that haven’t started publishing.</li>
          <li>Resets the calendar plan to Building and clears its approval.</li>
        </ul>
        <p>Your workspace settings, business knowledge, team, connected accounts, leads, and subscription stay in place. Posts already published on social platforms stay live.</p>
        <p>Shared files stay available where they are still used. Unused files are queued for removal after active upload links expire.</p>
        <p>Reset cannot stop publishing that has already started. You can remove the content while its publishing records are kept until the result is confirmed.</p>
        <p className="font-semibold text-red-700">This cannot be undone.</p>
      </div>
      <label className="mt-4 block text-sm font-medium">Type RESET to confirm
        <input autoComplete="off" value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {blockedPosts.length > 0 && <div className="mt-4 space-y-3"><p className="text-xs leading-5 text-slate-600">These posts are blocking the reset. Removing them hides them from your calendar. Publishing records and required files stay protected until any active attempt is resolved. Posts already live on social platforms stay live.</p><ul className="max-h-64 space-y-2 overflow-y-auto">{blockedPosts.map(post => <li key={post.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-blue-700">{post.platform} · {new Date(post.postDate).toLocaleDateString()}</p><p className="mt-1 text-sm font-medium text-slate-900">{post.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{post.reason}</p><div className="mt-3 flex flex-wrap gap-3"><a href={`/dashboard/calendars/${calendarId}?view=content&post=${encodeURIComponent(post.id)}`} className="text-xs font-semibold text-blue-700 underline underline-offset-4">Open post</a><button type="button" disabled={busy} onClick={() => void removePost(post.id)} className="text-xs font-semibold text-red-700 underline underline-offset-4 disabled:opacity-50">Delete from calendar</button></div></li>)}</ul><button type="button" disabled={busy || confirmation !== "RESET"} onClick={() => void reset(true)} className="min-h-11 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Removing…" : "Remove blocking posts and reset calendar"}</button></div>}
      <div className="mt-5 flex justify-end gap-3">
        <button autoFocus type="button" disabled={busy} onClick={() => dialog.current?.close()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
        <button type="button" disabled={busy || confirmation !== "RESET"} onClick={() => void reset()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Resetting…" : "Delete all content"}</button>
      </div>
    </dialog>
  </>;
}
