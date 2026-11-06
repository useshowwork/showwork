"use client";
import { calendarMutationFetch as fetch } from "@/lib/publishing/clientRequests";

import { IMAGE_FILE_ACCEPT, VIDEO_FILE_ACCEPT, getFileContentType } from "@/lib/mediaFileTypes";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import UploadPatienceBanner from "@/components/UploadPatienceBanner";
import { detectLocalFileAspectRatio } from "@/lib/detectLocalFileAspectRatio";

type MediaType = "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";

function uploadWithProgress(url: string, file: File | Blob, onProgress: (loaded: number, total: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", getFileContentType(file) || "application/octet-stream");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded, e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
function uploadPartWithProgress(url: string, chunk: Blob, onProgress: (loaded: number, total: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded, e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader("ETag") ?? "");
      } else {
        reject(new Error(`Chunk upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during chunk upload"));
    xhr.send(chunk);
  });
}

function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
function progressStorageKey(sectionId: string): string {
  return `showwork-portfolio-section-progress:${sectionId}`;
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
    // ignore
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
  completedParts: { partNumber: number; etag: string }[];
}
function multipartStorageKey(sectionId: string, fingerprint: string): string {
  return `showwork-portfolio-section-multipart:${sectionId}:${fingerprint}`;
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
const CHUNK_SIZE_MB = 200;
const CHUNK_CONCURRENCY = 3;
const BATCH_SIZE = 3;
const INTER_FILE_PAUSE_MS = 150;
const INTER_BATCH_PAUSE_MS = 3000;
const MAX_RETRIES_PER_FILE = 2;
const MAX_RETRIES_PER_CHUNK = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function acceptFor(mediaType: MediaType): string {
  if (mediaType === "VIDEO") return VIDEO_FILE_ACCEPT;
  if (mediaType === "PHOTO") return IMAGE_FILE_ACCEPT;
  if (mediaType === "PDF") return "application/pdf";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export default function PortfolioSectionHeader({
  sectionId,
  name,
  mediaType,
  fileCount,
}: {
  sectionId: string;
  name: string;
  mediaType: MediaType;
  fileCount: number;
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
    if (!value.trim() || value.trim() === name) { setEditing(false); setValue(name); return; }
    setSaving(true);
    await fetch(`/api/portfolio/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value.trim() }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  };

   const uploadOneFileWithRetry = async (
    file: File,
    onProgress: (percent: number) => void
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_FILE; attempt++) {
      try {
        const presignRes = await fetch("/api/portfolio/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: getFileContentType(file), fileSizeMb: file.size / (1024 * 1024) }),
        });
        const presignData = await presignRes.json();
        if (!presignRes.ok) throw new Error(presignData.error ?? "presign failed");

              await uploadWithProgress(presignData.uploadUrl, file, (loaded, total) => {
          onProgress(Math.round((loaded / total) * 100));
        });

        const aspectRatio = await detectLocalFileAspectRatio(file);

        const completeRes = await fetch("/api/portfolio/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileKey: presignData.fileKey, type: mediaType, sectionId, aspectRatio }),
        });
        if (!completeRes.ok) throw new Error("Failed to save file");

        return { ok: true };
      } catch (err) {
        if (attempt === MAX_RETRIES_PER_FILE) {
          return { ok: false, error: err instanceof Error ? err.message : "Upload failed" };
        }
        await sleep(2000 * (attempt + 1));
      }
    }
    return { ok: false, error: "Upload failed" };
  };

  const uploadLargeFileMultipart = async (file: File): Promise<{ ok: true } | { ok: false; error: string }> => {
    const fingerprint = fileFingerprint(file);
    const chunkSizeBytes = CHUNK_SIZE_MB * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSizeBytes);

    let progress = getMultipartProgress(sectionId, fingerprint);
    if (!progress) {
      const startRes = await fetch("/api/portfolio/upload/multipart-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: getFileContentType(file), fileSizeMb: file.size / (1024 * 1024) }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) return { ok: false, error: startData.error ?? "Failed to start large-file upload" };
      progress = { fileKey: startData.fileKey, uploadId: startData.uploadId, completedParts: [] };
      saveMultipartProgress(sectionId, fingerprint, progress);
    }

    const completedPartNumbers = new Set(progress.completedParts.map((p) => p.partNumber));
    const remainingPartNumbers: number[] = [];
    for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
      if (!completedPartNumbers.has(partNumber)) remainingPartNumbers.push(partNumber);
    }

    let completedCount = totalChunks - remainingPartNumbers.length;
    let firstError: string | null = null;

    const uploadOneChunk = async (partNumber: number): Promise<void> => {
      if (firstError) return;
      setChunkStatus(`${completedCount} of ${totalChunks} chunks done`);

      const start = (partNumber - 1) * chunkSizeBytes;
      const end = Math.min(start + chunkSizeBytes, file.size);
      const chunk = file.slice(start, end);

      let chunkSucceeded = false;
      let lastError = "Upload failed";

      for (let attempt = 0; attempt <= MAX_RETRIES_PER_CHUNK; attempt++) {
        try {
          const signRes = await fetch("/api/portfolio/upload/multipart-sign-part", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileKey: progress!.fileKey, uploadId: progress!.uploadId, partNumber }),
          });
          const signData = await signRes.json();
          if (!signRes.ok) throw new Error(signData.error ?? "Failed to sign chunk");

                   const etag = await uploadPartWithProgress(signData.uploadUrl, chunk, (loaded) => {
            const percent = Math.min(100, Math.round(((completedCount * chunkSizeBytes + loaded) / file.size) * 100));
            setChunkStatus(`${percent}% uploaded`);
          });

          progress!.completedParts.push({ partNumber, etag });
          saveMultipartProgress(sectionId, fingerprint, progress!);
          completedCount++;

          chunkSucceeded = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Upload failed";
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

    if (firstError) return { ok: false, error: firstError };

        const aspectRatio = await detectLocalFileAspectRatio(file);

    const completeRes = await fetch("/api/portfolio/upload/multipart-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileKey: progress.fileKey,
        uploadId: progress.uploadId,
        parts: progress.completedParts,
        type: mediaType,
        sectionId,
        aspectRatio,
      }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) return { ok: false, error: completeData.error ?? "Failed to finalize large file" };

    clearMultipartProgress(sectionId, fingerprint);
    return { ok: true };
  };

  // No session cap here at all — portfolio uploads are unlimited by
  // design, unlike the project delivery flow's 3-batch limit.
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
    setUploading(true);

    try {
      const completed = getCompletedFingerprints(sectionId);
      const filesToUpload = selectedFiles.filter((f) => !completed.has(fileFingerprint(f)));
      const failedFiles: string[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const isLarge = file.size >= MULTIPART_THRESHOLD_MB * 1024 * 1024;

        setUploadStatus(`Uploading ${i + 1} of ${filesToUpload.length}...`);
        setChunkStatus("0% uploaded");

               const result = isLarge
          ? await uploadLargeFileMultipart(file)
          : await uploadOneFileWithRetry(file, (percent) =>
              setUploadStatus(`Uploading ${i + 1} of ${filesToUpload.length} — ${percent}% uploaded...`)
            );

        if (result.ok) {
          markFingerprintCompleted(sectionId, fileFingerprint(file));
        } else {
          failedFiles.push(`${file.name} (${result.error})`);
        }

        await sleep(INTER_FILE_PAUSE_MS);

        if ((i + 1) % BATCH_SIZE === 0 && i + 1 < filesToUpload.length) {
          setUploadStatus("Pausing briefly before the next batch...");
          await sleep(INTER_BATCH_PAUSE_MS);
        }
      }

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
    const res = await fetch(`/api/portfolio/sections/${sectionId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else { setDeleting(false); setConfirmingDelete(false); }
  };

  if (editing) {
    return (
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            style={{ fontSize: "16px" }}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-[#2478FF] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-[#2478FF] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setValue(name); }}
              className="rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-[10px] font-bold uppercase text-white">
              {mediaType === "PHOTO" ? "IMG" : mediaType === "VIDEO" ? "VID" : mediaType === "PDF" ? "PDF" : "DOC"}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold tracking-[-0.01em] text-slate-950">
                  {name}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                  {fileCount} {fileCount === 1 ? "file" : "files"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {mediaType === "PHOTO" ? "Images and visual work" : mediaType === "VIDEO" ? "Films and showreels" : mediaType === "PDF" ? "PDF documents" : "Word documents"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Rename
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptFor(mediaType)}
              onChange={handleAddFiles}
              className="hidden"
              disabled={uploading}
              id={`portfolio-add-${sectionId}`}
            />

            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl bg-[#2478FF] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              {uploading ? (chunkStatus ?? uploadStatus ?? "Uploading…") : "+ Add files"}
            </button>

            {confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-2">
                <span className="text-[11px] font-medium text-red-600">
                  Delete this section and its files?
                </span>
                <button
                  onClick={handleDeleteSection}
                  disabled={deleting}
                  className="rounded-lg bg-red-500 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-950"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {uploading && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
            <UploadPatienceBanner active={uploading} />
            {chunkStatus && (
              <p className="mt-2 text-xs font-semibold text-[#2478FF]">
                {chunkStatus}
              </p>
            )}
          </div>
        )}

        {uploadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600">
            {uploadError}
          </div>
        )}
      </div>
    </div>
  );
}
