"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings, X } from "lucide-react";
import WorkspaceTeamPanel from "@/components/calendars/WorkspaceTeamPanel";

export default function EngageSettings({
  calendarId,
  canManageTeam,
  isOwner,
}: {
  calendarId: string;
  canManageTeam: boolean;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
      >
        <Settings size={17} />
        Settings
      </button>
      <dialog
        ref={dialog}
        aria-label="Engage settings"
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-4xl overflow-auto rounded-2xl border-0 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
      >
        {open && (
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Engage settings</h2>
              <button
                autoFocus
                type="button"
                aria-label="Close settings"
                onClick={close}
                className="rounded-full border p-2"
              >
                <X size={20} />
              </button>
            </div>
            {isOwner && (
              <Link
                href="/dashboard/billing?product=engage"
                className="mb-5 inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Subscription & AI replies →
              </Link>
            )}
            {canManageTeam ? (
              <>
                <p className="mb-4 text-sm text-slate-500">
                  Your plan includes you and two teammates.
                </p>
                <WorkspaceTeamPanel engage calendarId={calendarId} />
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Ask your business owner to manage your subscription and team.
              </p>
            )}
          </section>
        )}
      </dialog>
    </>
  );
}
