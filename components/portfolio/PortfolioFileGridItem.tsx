"use client";
import { calendarMutationFetch as fetch } from "@/lib/publishing/clientRequests";

import styles from "./PortfolioWorkStudio.module.css";
import { useState } from "react";
import { useRouter } from "next/navigation";

type MediaKind = "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";

function officeViewerUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

export default function PortfolioFileGridItem({
  mediaId,
  url,
  posterUrl,
  filename,
  type,
  sectionId,
  isCover,
}: {
  mediaId: string;
  url: string;
  posterUrl?: string | null;
  filename: string;
  type: MediaKind;
  sectionId: string;
  isCover: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingCover, setSettingCover] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/portfolio/media/${mediaId}`, { method: "DELETE" });
    router.refresh();
  };

  const handleSetCover = async () => {
    setSettingCover(true);
    await fetch(`/api/portfolio/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverMediaId: mediaId }),
    });
    router.refresh();
    setSettingCover(false);
  };

  const isDocLike = type === "PDF" || type === "DOCUMENT";

  return (
    <div className={`group relative overflow-hidden rounded-xl bg-white/5 ${isDocLike ? "aspect-[3/4]" : "aspect-square"}`}>
      {type === "VIDEO" ? (
        <video poster={posterUrl ?? undefined} src={url} controls playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : type === "PHOTO" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={filename} className="h-full w-full object-cover" />
      ) : type === "PDF" ? (
        <iframe src={`${url}#toolbar=0&navpanes=0&page=1`} title={filename} className="pointer-events-none h-full w-full border-0" />
      ) : (
        <iframe src={officeViewerUrl(url)} title={filename} className="pointer-events-none h-full w-full border-0 bg-white" />
      )}

      {isCover && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#F5C842">
            <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.8-4.6 6.6-.9L12 2.5Z" />
          </svg>
          <span className="text-[10px] font-medium text-white">Cover</span>
        </div>
      )}

      <div className={`${styles.mediaActions} pointer-events-none absolute inset-0 flex items-start justify-end gap-1.5 p-2 opacity-0 transition-opacity duration-300 group-hover:bg-black/30 group-hover:opacity-100 group-focus-within:bg-black/30 group-focus-within:opacity-100`}>
        {!isCover && (
          <button
            onClick={handleSetCover}
            disabled={settingCover}
            aria-label="Set as section cover"
            title="Set as section cover"
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/90 transition-transform hover:scale-105 disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="1.6">
              <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.8-4.6 6.6-.9L12 2.5Z" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <button
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete file"
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/90 transition-transform hover:scale-105"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 3h7M4 3V1.8h3V3M3 3v6.2h5V3" stroke="#080808" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {confirmDelete && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 text-center">
          <p className="text-xs text-white/80">Delete this file? This can&apos;t be undone.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={deleting} className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-md px-3 py-1.5 text-xs text-white/50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
