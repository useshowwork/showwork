"use client";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { putFileWithProgress } from "@/lib/uploadClient";
import { getFileContentType } from "@/lib/mediaFileTypes";
import { capturePortfolioPoster } from "@/lib/portfolioVideoPoster";
import type { UploadTaskContext } from "@/lib/workspaceUploadQueue";

type Receipt = {
  sessionId: string;
  fileKey: string;
  reservationId: string;
  partSize: number;
};
async function api(
  url: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const response = await calendarMutationFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(data.error || "Video upload unavailable. Retry to resume."),
      { status: response.status },
    );
  return data;
}
/** Metadata + sampled bytes catch accidental selection of a different local file without loading GB into memory. */
export async function workspaceVideoFingerprint(file: File) {
  const sample = 1024 * 1024;
  const bytes = await new Blob([
    JSON.stringify([file.name, file.size, file.lastModified]),
    file.slice(0, sample),
    file.slice(Math.max(sample, file.size - sample)),
  ]).arrayBuffer();
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* In-tab retry still works through task.step. */
  }
}
function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}
export async function transferWorkspaceVideo(
  calendarId: string,
  postId: string,
  file: File,
  task: UploadTaskContext,
  onLoaded: (bytes: number) => void,
) {
  const fingerprint = await task.step("video-fingerprint", () =>
    workspaceVideoFingerprint(file),
  );
  const key = `showwork-workspace-video:${calendarId}:${postId}:${fingerprint}`;
  const url = `/api/calendars/${calendarId}/posts/${postId}/video-upload`;
  const resumeKnownSession = Boolean(read(key));
  const identity = await task.step("video-identity", async () => {
    const existing = read(key);
    let id: string | undefined;
    try {
      const saved = existing ? JSON.parse(existing) : null;
      if (saved?.expiresAt > Date.now() && typeof saved.id === "string")
        id = saved.id;
    } catch {}
    id ??= crypto.randomUUID();
    write(
      key,
      JSON.stringify({ id, expiresAt: Date.now() + 8 * 60 * 60 * 1000 }),
    );
    return id;
  });
  // Register before starting: cancellation during a slow/lost start can still abort this identity.
  task.onCancel(async () => {
    try {
      await api(url, { action: "abort", sessionId: identity });
    } finally {
      remove(key);
    }
  });
  const receipt: Receipt = await task.step("video-prepare", async () => {
    // Recover a known receipt first, including a saved upload whose final acknowledgement was lost.
    if (resumeKnownSession) {
      try {
        const recovered = await api(
          url,
          { action: "status", sessionId: identity },
          task.signal,
        );
        return { sessionId: identity, ...recovered };
      } catch (error) {
        if (![404, 503].includes((error as { status?: number }).status ?? 0))
          throw error;
      }
    }
    return api(url, {
      action: "start",
      sessionId: identity,
      fingerprint,
      fileSize: file.size,
      contentType: getFileContentType(file),
    });
  });
  // Cancellation can race start; install again once the server has definitely created the session.
  task.onCancel(async () => {
    try {
      await api(url, { action: "abort", sessionId: identity });
    } finally {
      remove(key);
    }
  });
  if (task.signal.aborted)
    throw new DOMException("Upload paused", "AbortError");
  // Always reconcile against storage, including when a PUT succeeded but its response was lost.
  const status = await api(
    url,
    { action: "status", sessionId: identity },
    task.signal,
  );
  if (!status.assembled) {
    const count = Math.ceil(file.size / receipt.partSize);
    const done = new Set<number>(
      (status.parts as { partNumber: number }[]).map((p) => p.partNumber),
    );
    let loaded = (status.parts as { size: number }[]).reduce(
      (sum, p) => sum + p.size,
      0,
    );
    onLoaded(loaded);
    task.progress((loaded / file.size) * 100);
    const missing = Array.from({ length: count }, (_, i) => i + 1).filter(
      (n) => !done.has(n),
    );
    // Sign a small window at a time; one transferring chunk preserves the shared queue's network budget.
    for (let i = 0; i < missing.length; i += 3) {
      const window = missing.slice(i, i + 3);
      const { uploadUrls } = await api(
        url,
        { action: "sign", sessionId: identity, partNumbers: window },
        task.signal,
      );
      for (const n of window) {
        const chunk = file.slice(
          (n - 1) * receipt.partSize,
          Math.min(n * receipt.partSize, file.size),
        );
        await putFileWithProgress(uploadUrls[n], chunk, {
          signal: task.signal,
          onProgress: ({ loaded: partLoaded }) => {
            onLoaded(loaded + partLoaded);
            task.progress(((loaded + partLoaded) / file.size) * 100);
          },
        });
        loaded += chunk.size;
      }
    }
  }
  onLoaded(file.size);
  task.progress(100);
  return {
    ...receipt,
    finish: () => api(url, { action: "finish", sessionId: identity }),
    forget: () => remove(key),
  };
}

// A separate bounded preview queue never blocks registration or the main upload queue.
let previewChain = Promise.resolve();
export function saveWorkspaceVideoPreview(
  file: File,
  calendarId: string,
  postId: string,
  asset: { id: string; fileKey: string },
) {
  previewChain = previewChain
    .catch(() => {})
    .then(async () => {
      const poster = await capturePortfolioPoster(file);
      if (!poster) return;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(
            `/api/calendars/${calendarId}/posts/${postId}/assets/${asset.id}/poster`,
            {
              method: "POST",
              headers: {
                "Content-Type": "image/jpeg",
                "x-upload-file-key": asset.fileKey,
              },
              body: poster,
              signal: AbortSignal.timeout(30000),
            },
          );
          if (response.ok) {
            const data = await response.json();
            window.dispatchEvent(
              new CustomEvent("workspace-video-preview", {
                detail: {
                  calendarId,
                  postId,
                  assetId: asset.id,
                  posterUrl: data.posterUrl,
                },
              }),
            );
            return;
          }
          if (response.status < 500) return;
        } catch {
          /* Preview failure never repeats the original transfer. */
        }
      }
    });
}

/** Both workspace attachment entry points share the same reliable transfer/registration path. */
export async function uploadWorkspaceAsset<
  T extends { assets: { id: string; fileKey: string }[] },
>(
  calendarId: string,
  postId: string,
  file: File,
  task: UploadTaskContext,
  onLoaded: (bytes: number) => void,
  batch?: { id: string; record: (receipt: unknown) => void },
): Promise<T> {
  const { resumableWorkspaceVideo } =
    await import("@/lib/workspaceVideoConfig");
  const { cancelWorkspaceUpload } =
    await import("@/lib/workspaceUploadCancellation");
  const base = `/api/calendars/${calendarId}/posts/${postId}`;
  let receipt: { fileKey: string; reservationId: string },
    finish: (() => Promise<unknown>) | undefined,
    forget: (() => void) | undefined;
  if (resumableWorkspaceVideo(file)) {
    const transfer = await transferWorkspaceVideo(
      calendarId,
      postId,
      file,
      task,
      onLoaded,
    );
    receipt = transfer;
    finish = transfer.finish;
    forget = transfer.forget;
  } else {
    const prepared = await task.step("prepare", () =>
      api(`${base}/upload-presign`, {
        filename: file.name,
        contentType: getFileContentType(file),
        fileSize: file.size,
      }),
    );
    receipt = prepared;
    task.onCancel(() => cancelWorkspaceUpload(calendarId, prepared));
    await task.step("transfer", () =>
      putFileWithProgress(prepared.uploadUrl, file, {
        signal: task.signal,
        contentType: getFileContentType(file),
        onProgress: ({ loaded }) => {
          onLoaded(loaded);
          task.progress((loaded / file.size) * 100);
        },
      }),
    );
  }
  return task.finalize(`post:${postId}`, async () => {
    if (finish) await finish();
    const data = await api(`${base}/upload-complete`, {
      ...receipt,
      ...(batch ? { batchId: batch.id } : {}),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      fileSize: file.size,
      mediaType: getFileContentType(file).startsWith("video/")
        ? "VIDEO"
        : "PHOTO",
    });
    batch?.record(data.uploadNotice);
    const post = data.post as T;
    forget?.();
    const asset = post.assets?.find((a) => a.fileKey === receipt.fileKey);
    if (asset && getFileContentType(file).startsWith("video/"))
      saveWorkspaceVideoPreview(file, calendarId, postId, asset);
    return post;
  });
}
