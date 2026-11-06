"use client";
import { deliveryPartUrl, pauseDeliveryUploads, resumeDeliveryUploads, deliveryRetryable, reconcileDeliveryParts, deliveryMediaType, uploadDeliverySingle, putDeliveryFile, putDeliveryPart, uploadQueue, saveDeliveryPreview, completeDeliveryUpload } from "@/lib/deliveryUploadClient";
import { calendarMutationFetch as fetch } from "@/lib/publishing/clientRequests";

import { IMAGE_FILE_ACCEPT, VIDEO_FILE_ACCEPT, getFileContentType } from "@/lib/mediaFileTypes";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import UploadPatienceBanner from "@/components/UploadPatienceBanner";
import AddSubSection from "@/components/AddSubSection";

type MediaType = "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";

function uploadWithProgress(url: string, file: File | Blob, onProgress: (loaded: number, total: number) => void): Promise<void> {
  return putDeliveryFile(url, file, onProgress).then(() => undefined);
}

// Same as uploadWithProgress, but reads an optional ETag for debugging.
// Finalization reads the authoritative ETags from R2 on the server.
function uploadPartWithProgress(url: string, chunk: Blob, onProgress: (loaded: number, total: number) => void): Promise<string> {
  return putDeliveryPart(url, chunk, onProgress).then(result => result.etag || "");
}

// ── Resumable progress — same pattern as AddMoreFilesButton and the
// new-project page: a fingerprint stands in for "this is probably the
// same file" across a crash, since browsers give JS no way to hold a
// real File reference across one. Scoped to this specific existing
// section rather than a whole project, since that's this component's
// actual unit of work. ──
function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
function progressStorageKey(sectionId: string): string {
  return `showwork-section-upload-progress:${sectionId}`;
}
function getCompletedFingerprints(sectionId: string): Set<string> {
  try {
    const raw = localStorage.getItem(progressStorageKey(sectionId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function markFingerprintCompleted(sectionId: string, fingerprint: string) {
  const key = progressStorageKey(sectionId);
  const current = getCompletedFingerprints(sectionId);
  current.add(fingerprint);
  try {
    localStorage.setItem(key, JSON.stringify([...current]));
  } catch {
    // ignore — resuming just won't work this time
  }
}
function clearProgress(sectionId: string) {
  try {
    localStorage.removeItem(progressStorageKey(sectionId));
  } catch {
    // ignore
  }
}

interface MultipartProgress {
  fileKey: string;
  uploadId: string;
  chunkSizeMb?: number;
  completedParts: { partNumber: number; etag: string }[];
}
function multipartStorageKey(sectionId: string, fingerprint: string): string {
  return `showwork-section-multipart:${sectionId}:${fingerprint}`;
}
function getMultipartProgress(sectionId: string, fingerprint: string): MultipartProgress | null {
  try {
    const raw = localStorage.getItem(multipartStorageKey(sectionId, fingerprint));
    return raw ? (JSON.parse(raw) as MultipartProgress) : null;
  } catch {
    return null;
  }
}
function saveMultipartProgress(sectionId: string, fingerprint: string, progress: MultipartProgress) {
  try {
    localStorage.setItem(multipartStorageKey(sectionId, fingerprint), JSON.stringify(progress));
  } catch {
    // ignore
  }
}
function clearMultipartProgress(sectionId: string, fingerprint: string) {
  try {
    localStorage.removeItem(multipartStorageKey(sectionId, fingerprint));
  } catch {
    // ignore
  }
}

const MULTIPART_THRESHOLD_MB = 100;
const CHUNK_SIZE_MB = 16;
const CHUNK_CONCURRENCY = 2;
const BATCH_SIZE = 3;
const INTER_FILE_PAUSE_MS = 0;
const INTER_BATCH_PAUSE_MS = 0;
const MAX_RETRIES_PER_FILE = 2;
const MAX_RETRIES_PER_CHUNK = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function acceptFor(mediaType: MediaType): string {
  if (mediaType === "VIDEO") return VIDEO_FILE_ACCEPT;
  if (mediaType === "PHOTO") return IMAGE_FILE_ACCEPT;
  if (mediaType === "PDF") return "application/pdf";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export default function SectionHeader({
  projectId,
  sectionId,
  name,
  mediaType,
  fileCount,
  uploadSessionsRemaining,
}: {
  projectId: string;
  sectionId: string;
  name: string;
  mediaType: MediaType;
  fileCount: number;
  uploadSessionsRemaining: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [chunkStatus, setChunkStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    if (!value.trim() || value.trim() === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    setSaving(true);
    await fetch(`/api/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value.trim() }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  };

   // ── Small/normal files — single PUT, with retry, now with real
  //    progress reported back via the same chunkStatus line the
  //    multipart path already displays ──
  const uploadOneFileWithRetry = async (file: File): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      await uploadDeliverySingle({file, projectId, sectionId, type: deliveryMediaType(file, mediaType), onProgress: (loaded,total) => setUploadStatus(`${Math.round(loaded / total * 100)}% uploaded`)});
      return {ok:true};
    } catch (error) { return {ok:false,error:error instanceof Error ? error.message : "Upload failed"}; }
  };

  // ── Large files — chunked multipart, 2 chunks concurrently, with
  //    per-chunk resume ──
  const uploadLargeFileMultipart = async (file: File): Promise<{ ok: true } | { ok: false; error: string }> => {
    const fingerprint = fileFingerprint(file);


    let progress = getMultipartProgress(sectionId, fingerprint);
    const chunkSizeBytes = (progress ? progress.chunkSizeMb ?? 200 : CHUNK_SIZE_MB) * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSizeBytes);

    if (!progress) {
      const startRes = await fetch("/api/upload/multipart/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: getFileContentType(file),
          fileSizeMb: file.size / (1024 * 1024),
        }),
      });
      if (!startRes.ok) {
        const data = await startRes.json();
        return { ok: false, error: data.error ?? "Failed to start large-file upload" };
      }
      const { uploadId, fileKey } = await startRes.json();
      progress = { fileKey, uploadId, completedParts: [], chunkSizeMb: CHUNK_SIZE_MB };
      saveMultipartProgress(sectionId, fingerprint, progress);
    }

  try { await reconcileDeliveryParts(projectId, progress, totalChunks); }
  catch (error) { if ((error as {code?:string}).code === "UPLOAD_SESSION_EXPIRED") clearMultipartProgress(sectionId, fingerprint); throw error; }
    const completedPartNumbers = new Set(progress.completedParts.map((p) => p.partNumber));
    const remainingPartNumbers: number[] = [];
    for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
      if (!completedPartNumbers.has(partNumber)) remainingPartNumbers.push(partNumber);
    }

    let completedCount = totalChunks - remainingPartNumbers.length;
    let totalLoadedBytes = completedPartNumbers.size * chunkSizeBytes;
    const perChunkLastReported = new Map<number, number>();
    const reportChunkProgress = (partNumber: number, loaded: number) => {
      const last = perChunkLastReported.get(partNumber) ?? 0;
      totalLoadedBytes += loaded - last;
      perChunkLastReported.set(partNumber, loaded);
      const percent = Math.min(100, Math.round((totalLoadedBytes / file.size) * 100));
      setChunkStatus(`${percent}% uploaded`);
    };
    let firstError: string | null = null;

    const uploadOneChunk = async (partNumber: number): Promise<void> => {
      if (firstError) return;

      const start = (partNumber - 1) * chunkSizeBytes;
      const end = Math.min(start + chunkSizeBytes, file.size);
      const chunk = file.slice(start, end);

      let chunkSucceeded = false;
      let lastError = "Upload failed";

      for (let attempt = 0; attempt <= MAX_RETRIES_PER_CHUNK; attempt++) {
        try {
          const uploadUrl = await deliveryPartUrl(projectId, progress!.fileKey, progress!.uploadId, partNumber, totalChunks);

          const etag = await uploadPartWithProgress(uploadUrl, chunk, (loaded) => reportChunkProgress(partNumber, loaded));

          progress!.completedParts.push({ partNumber, etag });
          saveMultipartProgress(sectionId, fingerprint, progress!);
          completedCount++;

          chunkSucceeded = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Upload failed";
          if (!deliveryRetryable(err)) break;
        if (attempt < MAX_RETRIES_PER_CHUNK) await sleep(2000 * (attempt + 1));
        }
      }
      if (!chunkSucceeded && !firstError) {
        firstError = `${lastError} (chunk ${partNumber} of ${totalChunks})`;
      }
    };

    const queue = [...remainingPartNumbers];
    const workers = Array.from({ length: CHUNK_CONCURRENCY }, async () => {
      while (queue.length > 0 && !firstError) {
        const partNumber = queue.shift();
        if (partNumber !== undefined) await uploadOneChunk(partNumber);
      }
    });
    await Promise.all(workers);

    if (firstError) {
      return { ok: false, error: firstError };
    }

    const completeRes = await completeDeliveryUpload("/api/upload/multipart/complete", {
        projectId,
        fileKey: progress.fileKey,
        uploadId: progress.uploadId,
        parts: progress.completedParts,
        type: mediaType,
        sectionId,
      });
    if (!completeRes.ok) {
      const data = await completeRes.json();
      return { ok: false, error: data.error ?? "Failed to finalize large file" };
    }

    const completed = await completeRes.json();
    await saveDeliveryPreview(file, completed.media.id, progress.fileKey);
    clearMultipartProgress(sectionId, fingerprint);
    return { ok: true };
  };

  // Adds files directly into this already-existing section — no need
  // to re-choose a type or re-name anything, since both are already
  // fixed for this section. Still uses one of the same 3 total
  // add-more-files sessions as creating a brand-new section would.
  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    if (selectedFiles.length > 20) {
      const proceed = window.confirm(
        `You've selected ${selectedFiles.length} files. Uploading that many at once in one browser tab can occasionally crash on lower-memory devices — consider uploading in two smaller batches instead. Continue anyway?`
      );
      if (!proceed) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setUploadError(null);
    resumeDeliveryUploads();
    setUploading(true);

    try {
      const batchRes = await fetch(`/api/projects/${projectId}/add-files-batch`, { method: "POST" });
      if (!batchRes.ok) {
        const data = await batchRes.json();
        throw new Error(data.error ?? "Couldn't start this upload session");
      }

      const completed = getCompletedFingerprints(sectionId);
      const filesToUpload = selectedFiles.filter((f) => !completed.has(fileFingerprint(f)));
      const failedFiles: string[] = [];

      await uploadQueue(filesToUpload.map((file,index) => ({file,index})), async ({file,index:i}) => {
        const isLarge = file.size >= MULTIPART_THRESHOLD_MB * 1024 * 1024;

        setUploadStatus(`Uploading ${i + 1} of ${filesToUpload.length}...`);
        setChunkStatus("0% uploaded");

        const result = isLarge ? await uploadLargeFileMultipart(file) : await uploadOneFileWithRetry(file);

        if (result.ok) {
          markFingerprintCompleted(sectionId, fileFingerprint(file));
        } else {
          failedFiles.push(`${file.name} (${result.error})`);
        }

      });

      if (failedFiles.length > 0) {
        setUploadError(
          `${filesToUpload.length - failedFiles.length} of ${filesToUpload.length} uploaded. ${failedFiles.length} failed — re-select the same files to resume just those.`
        );
        setUploadStatus(null);
        setChunkStatus(null);
        return;
      }

      clearProgress(sectionId);
      setUploadStatus("Done");
      router.refresh();
      setTimeout(() => setUploadStatus(null), 1200);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Something went wrong");
      setUploadStatus(null);
      setChunkStatus(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteSection = async () => {
    setDeleting(true);
    const res = await fetch(`/api/sections/${sectionId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (editing) {
    return (
      <div data-delivery-section-header="true" className="mb-4 flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          style={{ fontSize: "16px" }}
          className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-sm font-semibold text-white outline-none"
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ background: "#F5C842", color: "#0A0A0A" }}
        >
          {saving ? "..." : "Save"}
        </button>
        <button onClick={() => { setEditing(false); setValue(name); }} className="text-xs text-white/40 underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div data-delivery-section-header="true" className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold uppercase text-white/40" style={{ letterSpacing: "0.05em" }}>
          {name} ({fileCount})
        </h2>
        <button
          onClick={() => setEditing(true)}
          aria-label="Rename section"
          className="text-xs text-white/30 underline hover:text-white/60"
        >
          Rename
        </button>

        <span className="text-white/15">·</span>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptFor(mediaType)}
          onChange={handleAddFiles}
          className="hidden"
          id={`add-to-section-${sectionId}`}
        />
               {uploadSessionsRemaining > 0 ? (
          <label
            htmlFor={`add-to-section-${sectionId}`}
            className="cursor-pointer text-xs font-semibold underline"
            style={{ color: "#F5C842" }}
          >
            {uploading ? (chunkStatus ?? uploadStatus ?? "Uploading...") : "+ Add files"}
          </label>
        ) : (
          <span className="text-xs text-white/20">Add-more limit reached</span>
        )}

        <span className="text-white/15">·</span>

        {confirmingDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-white/50">
              Permanently delete this section and every file inside it? This can&apos;t be undone.
            </span>
            <button
              onClick={handleDeleteSection}
              disabled={deleting}
              className="rounded-md bg-red-500 px-2 py-1 font-semibold text-white disabled:opacity-50"
            >
              {deleting ? "..." : "Confirm"}
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-white/40 underline">
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-xs text-red-400/70 underline hover:text-red-400"
          >
            Delete section
          </button>
        )}
      </div>

      <div className="mt-3">
        <AddSubSection projectId={projectId} sectionId={sectionId} mediaType={mediaType} />
      </div>

           {uploading && (
        <div className="mt-2">
          <UploadPatienceBanner onPause={pauseDeliveryUploads} active={uploading} />
          {chunkStatus && <p className="mt-1.5 text-xs font-semibold" style={{ color: "#F5C842" }}>{chunkStatus}</p>}
        </div>
      )}
      {uploadError && <p className="mt-1.5 text-xs text-red-400">{uploadError}</p>}
    </div>
  );
}
