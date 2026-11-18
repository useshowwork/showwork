"use client";

import { useRef } from "react";
import { Pencil, X } from "lucide-react";
import IdentityImage from "./IdentityImage";
import IdentityImageEditor from "./IdentityImageEditor";

export default function WorkspaceLogo({ name, src, editableWorkspaceId, className }: {
  name: string;
  src?: string | null;
  editableWorkspaceId?: string;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = <IdentityImage name={name} src={src} logo className={className} />;
  if (!editableWorkspaceId) return image;

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label="Edit workspace logo"
        title="Edit workspace logo"
        className="relative inline-grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
        {image}
        <span className="absolute bottom-0 right-0 grid h-4 w-4 place-items-center rounded-full bg-blue-700 text-white" aria-hidden="true"><Pencil size={9} /></span>
      </button>
      <dialog ref={dialog} aria-label="Edit workspace logo" className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border-0 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-base font-semibold">{name}</h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close logo editor" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>
        <IdentityImageEditor endpoint={`/api/calendars/${encodeURIComponent(editableWorkspaceId)}/logo`} name={name} src={src} logo />
      </dialog>
    </>
  );
}
