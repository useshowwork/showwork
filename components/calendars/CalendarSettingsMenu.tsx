"use client";
import ResetCalendarButton from "@/components/calendars/ResetCalendarButton";
import headerStyles from "./WorkspaceHeader.module.css";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { useState } from "react";
import { useRouter } from "next/navigation";

function SettingsIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13.5a7.8 7.8 0 0 0 0-3l1.4-1.1-1.8-3.1-1.7.7a7.7 7.7 0 0 0-2.6-1.5L14.5 4h-3.6l-.2 1.5a7.7 7.7 0 0 0-2.6 1.5l-1.7-.7-1.8 3.1L6 10.5a7.8 7.8 0 0 0 0 3l-1.4 1.1 1.8 3.1 1.7-.7a7.7 7.7 0 0 0 2.6 1.5l.2 1.5h3.6l.2-1.5a7.7 7.7 0 0 0 2.6-1.5l1.7.7 1.8-3.1-1.4-1.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        d="m6 6 12 12M18 6 6 18"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function CalendarSettingsMenu({
  calendarId,
  clientName,
  userRole,
  isManager,
  onBrand = false,
}: {
  calendarId: string;
  clientName: string;
  userRole: "VIEW_ONLY" | "ADD_CONTENT" | "EDIT_CALENDAR";
  isManager: boolean;
  onBrand?: boolean;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(clientName);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit = userRole === "EDIT_CALENDAR";

  if (!canEdit) return null;

  const closeMenu = () => {
    if (savingName || deleting) return;

    setOpen(false);
    setRenaming(false);
    setConfirmingDelete(false);
    setConfirmText("");
    setNameError(null);
    setDeleteError(null);
  };

  const saveName = async () => {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      setNameError("Name can't be empty");
      return;
    }

    setSavingName(true);
    setNameError(null);

    try {
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_details",
          clientName: trimmedName,
        }),
      });

      if (res.ok) {
        setRenaming(false);
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setNameError(data.error ?? "Failed to save");
      }
    } catch {
      setNameError("Something went wrong. Please try again.");
    } finally {
      setSavingName(false);
    }
  };

  const deleteCalendar = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/dashboard/calendars");
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? "Failed to delete calendar");
        setDeleting(false);
      }
    } catch {
      setDeleteError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Workspace settings"
        aria-expanded={open}
        className={onBrand ? `${headerStyles.settingsTrigger} ${open ? headerStyles.settingsOpen : ""}` : `flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[11px] font-semibold transition-all duration-150 ${
          open
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        }`}
      >
        <SettingsIcon className="h-4 w-4" /><span className="sr-only sm:hidden">Workspace settings</span>
        <span className="hidden sm:inline">Settings</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close workspace settings"
            className="fixed inset-0 z-40 cursor-default"
            onClick={closeMenu}
          />

          <div
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-[20px] border border-[#E4E7EC] bg-white p-1.5 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
            role="dialog"
            aria-label="Workspace settings"
          >
            {!renaming && !confirmingDelete && (
              <>
                <div className="border-b border-[#EEF0F3] px-3.5 pb-3 pt-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
                    Workspace settings
                  </p>

                  <p className="mt-1 truncate text-sm font-semibold text-[#101828]">
                    {clientName}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(true);
                      setNameError(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#F7F9FC]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF5FF] text-[#1768E8]">
                      <EditIcon className="h-4 w-4" />
                    </span>

                    <span>
                      <span className="block text-[12px] font-semibold text-[#101828]">
                        Rename workspace
                      </span>

                      <span className="mt-0.5 block text-[10px] text-[#98A2B3]">
                        Update the name and public calendar link
                      </span>
                    </span>
                  </button>

                  {isManager && <div className="border-t border-[#EEF0F3] px-3 py-3"><ResetCalendarButton calendarId={calendarId} onReset={() => { window.dispatchEvent(new CustomEvent("showwork-calendar-reset", { detail: { calendarId } })); closeMenu(); }} /></div>}
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingDelete(true);
                        setDeleteError(null);
                        setConfirmText("");
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#FFF5F5]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF3F2] text-[#D92D20]">
                        <TrashIcon className="h-4 w-4" />
                      </span>

                      <span>
                        <span className="block text-[12px] font-semibold text-[#D92D20]">
                          Delete workspace
                        </span>

                        <span className="mt-0.5 block text-[10px] text-[#98A2B3]">
                          Permanently remove this workspace
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}

            {renaming && (
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
                      Workspace settings
                    </p>

                    <h3 className="mt-1 text-sm font-semibold text-[#101828]">
                      Rename workspace
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRenaming(false)}
                    disabled={savingName}
                    aria-label="Close rename form"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#98A2B3] transition-colors hover:bg-[#F3F5F8] hover:text-[#344054]"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>

                <label className="mt-5 block text-[10px] font-semibold text-[#667085]">
                  Client name
                </label>

                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  className="mt-1.5 w-full rounded-xl border border-[#D9DEE7] bg-[#F9FAFB] px-3 py-2.5 text-[16px] text-[#101828] outline-none transition-colors focus:border-[#1768E8] focus:bg-white focus:ring-4 focus:ring-[#1768E8]/10"
                />

                <p className="mt-2 text-[11px] leading-5 text-[#667085]">This updates the client-facing name and calendar URL. Share the new link after renaming.</p>

                {nameError && (
                  <p className="mt-2 text-[11px] text-[#D92D20]">
                    {nameError}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveName}
                    disabled={savingName}
                    className="rounded-xl bg-[#1768E8] px-4 py-2.5 text-[11px] font-semibold text-white shadow-[0_7px_18px_rgba(23,104,232,0.18)] transition-all hover:bg-[#125CCF] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingName ? "Saving..." : "Save changes"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenaming(false)}
                    disabled={savingName}
                    className="rounded-xl px-3 py-2.5 text-[11px] font-semibold text-[#667085] transition-colors hover:bg-[#F5F6F8] hover:text-[#344054]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {confirmingDelete && (
              <div className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF3F2] text-[#D92D20]">
                    <TrashIcon className="h-4 w-4" />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                      setConfirmText("");
                    }}
                    disabled={deleting}
                    aria-label="Close delete confirmation"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#98A2B3] transition-colors hover:bg-[#F3F5F8] hover:text-[#344054]"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>

                <h3 className="mt-4 text-sm font-semibold text-[#101828]">
                  Delete workspace?
                </h3>

                <p className="mt-2 text-[11px] leading-5 text-[#667085]">
                  This permanently deletes{" "}
                  <span className="font-semibold text-[#344054]">
                    {clientName}
                  </span>
                  &apos;s calendar, every planned post and all uploaded
                  content. Shared files stay where they are still used. Unused files are queued for removal after active upload links expire. This cannot be undone.
                </p>

                <label className="mt-4 block text-[10px] font-semibold text-[#667085]">
                  Type{" "}
                  <span className="text-[#101828]">{clientName}</span> to
                  confirm
                </label>

                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#F3B5B0] bg-[#FFF9F8] px-3 py-2.5 text-[16px] text-[#101828] outline-none focus:border-[#D92D20] focus:ring-4 focus:ring-[#D92D20]/10"
                />

                {deleteError && (
                  <p className="mt-2 text-[11px] text-[#D92D20]">
                    {deleteError}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={deleteCalendar}
                    disabled={deleting || confirmText !== clientName}
                    className="rounded-xl bg-[#D92D20] px-4 py-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#B42318] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deleting ? "Deleting..." : "Delete permanently"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                      setConfirmText("");
                    }}
                    disabled={deleting}
                    className="rounded-xl px-3 py-2.5 text-[11px] font-semibold text-[#667085] transition-colors hover:bg-[#F5F6F8] hover:text-[#344054]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}