"use client";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { X, CalendarDays } from "lucide-react";
import styles from "./CalendarDashboard.module.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CalendarPeopleManager from "./CalendarPeopleManager";

function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

interface CalendarCardProps {
  id: string;
  clientName: string;
  planStatus: string;
  postCount: number;
  createdAt: string;
  globalIndex: number;

  // Number of collaborators currently attached to this workspace.
  // The owner is added separately when displaying the total.
  collaboratorCount: number;
}

export default function CalendarCard({
  id,
  clientName,
  postCount,
  collaboratorCount,
}: CalendarCardProps) {
  const router = useRouter();

  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirming) return;
    const dialog = deleteDialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [confirming]);



  const href = `/dashboard/calendars/${id}`;

  // The workspace owner is not stored in the collaborators relation,
  // so total people = owner + collaborators.
  const totalMembers = 1 + collaboratorCount;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const res = await calendarMutationFetch(`/api/calendars/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));

        setError(data.error ?? "Failed to delete — try again.");

        setDeleting(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <>
      <article className={styles.card}>
        <Link href={href} className={styles.cardLink} aria-label={`Open ${clientName}`} />
        <div className={styles.cover}>
          <div className={styles.coverTop}>
            <span className={styles.monogram} aria-hidden="true">{clientName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "CW"}</span>
          </div>
          <h3 className={styles.cardTitle} title={clientName}>{clientName}</h3>
          <p className={styles.cardSubtitle}>Marketing workspace</p>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardMeta}>
            <span className={styles.postCount}><CalendarDays size={15} aria-hidden="true" />{postCount} {postCount === 1 ? "post" : "posts"}</span>
          </div>
          <div className={styles.cardFooter}>
            <div className="relative z-30 -ml-2"><CalendarPeopleManager compact calendarId={id} calendarName={clientName} totalMembers={totalMembers} /></div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => { setError(null); setConfirming(true); }} aria-label={`Delete ${clientName}'s workspace`} className="relative z-20 flex h-11 w-11 items-center justify-center rounded-lg text-[#7890AE] hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1768E8]"><TrashIcon className="h-4 w-4" /></button>
              <span className={styles.open}>Open workspace <ArrowRightIcon /></span>
            </div>
          </div>
        </div>
      </article>

      {/* ===========================================================
          DELETE CONFIRMATION
          =========================================================== */}
      {confirming && (
        <dialog
          ref={deleteDialogRef}
          aria-labelledby={`delete-title-${id}`}
          onCancel={(event) => {
            event.preventDefault();
            if (!deleting) setConfirming(false);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !deleting)
              setConfirming(false);
          }}
          className="m-auto w-[calc(100%-32px)] max-w-md rounded-2xl border border-[#EAECF0] bg-white p-0 text-[#101828] shadow-xl backdrop:bg-[#101828]/55 backdrop:backdrop-blur-sm"
        >
          <div className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FEF3F2] text-[#D92D20]">
                <TrashIcon className="h-5 w-5" />
              </div>

              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                aria-label="Close delete confirmation"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#475467] transition-colors hover:bg-[#F2F4F7] hover:text-[#344054] disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <h3
              id={`delete-title-${id}`}
              className="mt-6 text-xl font-semibold tracking-[-0.03em] text-[#101828]"
            >
              Delete this workspace?
            </h3>

            <p className="mt-2.5 text-sm leading-6 text-[#475467]">
              This permanently deletes{" "}
              <span className="font-semibold text-[#344054]">{clientName}</span>
              ’s calendar, planned posts and uploaded media. Your client will
              lose access immediately. This cannot be undone.
            </p>

            <p className="mt-2 text-xs leading-5 text-[#667085]">Shared files stay where they are still used. Unused files are queued for removal after active upload links expire.</p>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-2xl border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-xs leading-5 text-[#B42318]"
              >
                {error}
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm font-semibold text-[#344054] transition-colors hover:bg-[#F6F8FB] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-[#D92D20] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#B42318] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete workspace"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
