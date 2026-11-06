"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useProjectDashboardTheme } from "@/components/projects/ProjectDashboardTheme";
import projectThemeStyles from "@/components/projects/ProjectDashboardTheme.module.css";
import { useRouter } from "next/navigation";

/**
 * A delete icon that sits on each project card. The whole card is
 * itself a clickable Link, so the confirmation modal is rendered via a
 * portal straight into document.body — not as a nested child of that
 * Link — so it's structurally impossible for the modal to interfere
 * with the card's own navigation or any global click-based UI.
 */
export default function DeleteProjectButton({
  projectId,
  clientName,
}: {
  projectId: string;
  clientName: string;
}) {
  const router = useRouter();
  const projectTheme = useProjectDashboardTheme();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // document.body doesn't exist during server rendering — only portal
  // once actually mounted in the browser.
  useEffect(() => setMounted(true), []);

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setError(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError("Failed to delete this project. Please try again.");
      setDeleting(false);
    }
  };

  const modal = (
    <div
      onClick={closeModal}
      data-project-theme={projectTheme?.theme}
      className={`${projectTheme ? projectThemeStyles.theme : ""} fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-6`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: projectTheme ? "var(--pd-surface)" : "#1A1A1A" }}
      >
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(239,68,68,0.15)" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 6.5v4M10 13.5h.01M8.6 2.9L1.8 15a1.5 1.5 0 0 0 1.3 2.2h13.8a1.5 1.5 0 0 0 1.3-2.2L11.4 2.9a1.5 1.5 0 0 0-2.8 0Z"
              stroke="#F87171"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="mb-1.5 text-lg font-bold" style={{ color: "var(--pd-text, white)" }}>Delete &ldquo;{clientName}&rdquo;?</h3>
        <p className="mb-5 text-sm" style={{ color: "var(--pd-subtle, rgba(255,255,255,.5))" }}>
          This permanently deletes this project, every file in it, and all client feedback. This can&apos;t be undone.
        </p>
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Yes, delete permanently"}
          </button>
          <button
            onClick={closeModal}
            className="rounded-lg px-4 py-2.5 text-sm transition-colors" style={{ color: "var(--pd-muted, rgba(255,255,255,.5))" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={openModal}
        aria-label={`Delete ${clientName}`}
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[var(--pd-subtle,rgba(255,255,255,.5))] transition-colors hover:bg-red-500/20 hover:text-red-400"
        style={{ background: projectTheme ? "var(--pd-soft)" : "rgba(0,0,0,0.4)" }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 3h8M4.5 3V1.8h3V3M3.5 3v7.2h5V3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && mounted && createPortal(modal, document.body)}
    </>
  );
}