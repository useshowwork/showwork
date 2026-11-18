"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IDENTITY_IMAGE_ACCEPT, IDENTITY_IMAGE_MAX_BYTES, IDENTITY_IMAGE_MAX_PIXELS, IDENTITY_IMAGE_TYPES } from "@/lib/identityImageLimits";
import IdentityImage from "./IdentityImage";
import SquareImageCrop from "./SquareImageCrop";

export default function IdentityImageEditor({ endpoint, name, src, logo = false }: {
  endpoint: string;
  name: string;
  src?: string | null;
  logo?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const descriptionId = useId();
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [draft, setDraft] = useState<ImageBitmap | null>(null);
  useEffect(() => () => draft?.close(), [draft]);
  const [refreshing, refresh] = useTransition();
  const pending = saving || refreshing || opening;
  useEffect(() => {
    if (draft || pending || !restoreFocus.current) return;
    chooseButton.current?.focus({ preventScroll: true });
    restoreFocus.current = false;
  }, [draft, pending]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const label = logo ? "logo" : "photo";

  async function selectFile(file: File) {
    setError("");
    setStatus("");
    if (!IDENTITY_IMAGE_TYPES.includes(file.type) || file.size < 1) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > IDENTITY_IMAGE_MAX_BYTES) {
      setError("Images must be 2 MB or smaller.");
      return;
    }
    setOpening(true);
    try {
      const image = await createImageBitmap(file);
      if (image.width * image.height <= IDENTITY_IMAGE_MAX_PIXELS) {
        setDraft(image);
        return;
      }

      const maxPreviewEdge = 4096;
      const scale = maxPreviewEdge / Math.max(image.width, image.height);
      try {
        setDraft(await createImageBitmap(image, {
          resizeWidth: Math.max(1, Math.round(image.width * scale)),
          resizeHeight: Math.max(1, Math.round(image.height * scale)),
          resizeQuality: "high",
        }));
      } finally {
        image.close();
      }
    } catch {
      setError("This image couldn't be opened. Try another JPG, PNG or WebP.");
    } finally {
      setOpening(false);
    }
  }

  async function save(crop?: HTMLCanvasElement) {
    setError("");
    setStatus("");
    setSaving(true);
    try {
      const file = crop ? await new Promise<Blob>((resolve, reject) => {
        crop.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Couldn't create the crop. Try again.")), "image/webp", 0.94);
      }) : null;
      const response = await fetch(endpoint, file
        ? { method: "POST", headers: { "Content-Type": file.type }, body: file }
        : { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Couldn't save the ${label}. Try again.`);
      if (crop) restoreFocus.current = true;
      setDraft(null);
      setStatus(file ? `Your ${label} was updated.` : `Your ${label} was removed.`);
      refresh(() => router.refresh());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Upload failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-start gap-4">
        <IdentityImage name={name} src={src} logo={logo} className="!h-16 !w-16 !text-lg" />
        <div>
          <p className="text-sm font-semibold text-slate-900">{logo ? "Workspace logo" : "Profile photo"}</p>
          <p id={descriptionId} className="mt-1 text-sm text-slate-600">JPG, PNG or WebP · 2 MB maximum</p>
          <input ref={input} type="file" accept={IDENTITY_IMAGE_ACCEPT} hidden onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void selectFile(file);
          }} />
          {!draft && <div className="mt-3 flex flex-wrap items-center gap-2">
            <button ref={chooseButton} type="button" disabled={pending} aria-describedby={descriptionId} onClick={() => input.current?.click()}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
              {opening ? "Opening…" : pending ? "Saving…" : src ? `Change ${label}` : `Upload ${label}`}
            </button>
            {src && <button type="button" disabled={pending} onClick={() => void save()}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              Remove {label}
            </button>}
          </div>}
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
          <p role="status" className="mt-2 text-sm text-slate-600">{status}</p>
        </div>
      </div>
      {draft && <SquareImageCrop image={draft} logo={logo} pending={pending} onSave={(crop) => void save(crop)} onCancel={() => {
        restoreFocus.current = true;
        setDraft(null);
        setError("");
      }} />}
    </div>
  );
}
