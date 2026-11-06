"use client";

import { IMAGE_FILE_ACCEPT, VIDEO_FILE_ACCEPT, getFileContentType } from "@/lib/mediaFileTypes";

import workStyles from "./PortfolioWorkStudio.module.css";
import { Plus } from "lucide-react";
import UiSymbol from "@/components/ui/UiSymbol";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import UploadPatienceBanner from "@/components/UploadPatienceBanner";
import { savePortfolioVideoPoster } from "@/lib/portfolioVideoPoster";
import { detectLocalFileAspectRatio } from "@/lib/detectLocalFileAspectRatio";

type MediaType = "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";
type Step = "closed" | "type" | "details";

type UploadResult =
  | { ok: true }
  | { ok: false; error: string };

function uploadWithProgress(
  url: string,
  file: File | Blob,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url);
    xhr.setRequestHeader(
      "Content-Type",
      getFileContentType(file) || "application/octet-stream"
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during upload"));
    };

    xhr.send(file);
  });
}

function uploadPartWithProgress(
  url: string,
  chunk: Blob,
  onProgress: (loaded: number, total: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader("ETag") ?? "");
      } else {
        reject(new Error(`Chunk upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during chunk upload"));
    };

    xhr.send(chunk);
  });
}

function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function progressStorageKey(sectionName: string): string {
  return `showwork-portfolio-upload-progress:${sectionName
    .trim()
    .toLowerCase()}`;
}

function getCompletedFingerprints(
  sectionName: string
): Set<string> {
  try {
    const raw = localStorage.getItem(
      progressStorageKey(sectionName)
    );

    return new Set(
      raw ? (JSON.parse(raw) as string[]) : []
    );
  } catch {
    return new Set();
  }
}

function markFingerprintCompleted(
  sectionName: string,
  fingerprint: string
) {
  const key = progressStorageKey(sectionName);
  const current = getCompletedFingerprints(sectionName);

  current.add(fingerprint);

  try {
    localStorage.setItem(
      key,
      JSON.stringify([...current])
    );
  } catch {
    // Ignore localStorage failures.
  }
}

function clearProgress(sectionName: string) {
  try {
    localStorage.removeItem(
      progressStorageKey(sectionName)
    );
  } catch {
    // Ignore localStorage failures.
  }
}

interface MultipartProgress {
  fileKey: string;
  uploadId: string;
  completedParts: {
    partNumber: number;
    etag: string;
  }[];
}

function multipartStorageKey(
  sectionName: string,
  fingerprint: string
): string {
  return `showwork-portfolio-multipart:${sectionName
    .trim()
    .toLowerCase()}:${fingerprint}`;
}

function getMultipartProgress(
  sectionName: string,
  fingerprint: string
): MultipartProgress | null {
  try {
    const raw = localStorage.getItem(
      multipartStorageKey(sectionName, fingerprint)
    );

    return raw
      ? (JSON.parse(raw) as MultipartProgress)
      : null;
  } catch {
    return null;
  }
}

function saveMultipartProgress(
  sectionName: string,
  fingerprint: string,
  progress: MultipartProgress
) {
  try {
    localStorage.setItem(
      multipartStorageKey(sectionName, fingerprint),
      JSON.stringify(progress)
    );
  } catch {
    // Ignore localStorage failures.
  }
}

function clearMultipartProgress(
  sectionName: string,
  fingerprint: string
) {
  try {
    localStorage.removeItem(
      multipartStorageKey(sectionName, fingerprint)
    );
  } catch {
    // Ignore localStorage failures.
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

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function mediaTypeLabel(mediaType: MediaType | null) {
  switch (mediaType) {
    case "PHOTO":
      return "Images";
    case "VIDEO":
      return "Videos";
    case "DOCUMENT":
      return "Documents";
    case "PDF":
      return "PDFs";
    default:
      return "Files";
  }
}

function mediaTypeDescription(mediaType: MediaType | null) {
  switch (mediaType) {
    case "PHOTO":
      return "Photos, renders, mockups";
    case "VIDEO":
      return "Films, reels, showreels";
    case "DOCUMENT":
      return "Word documents";
    case "PDF":
      return "Case studies, decks";
    default:
      return "";
  }
}

function mediaTypeIcon(mediaType: MediaType | null) {
  switch (mediaType) {
    case "PHOTO":
      return "01";
    case "VIDEO":
      return "02";
    case "DOCUMENT":
      return "03";
    case "PDF":
      return "04";
    default:
      return "00";
  }
}

export default function PortfolioAddSection({
  hasSections,
  compact = false,
}: {
  hasSections: boolean;
  compact?: boolean;
}) {
  const router = useRouter();

  const [step, setStep] =
    useState<Step>("closed");

  const [mediaType, setMediaType] =
    useState<MediaType | null>(null);

  const [sectionName, setSectionName] =
    useState("");

  const [files, setFiles] =
    useState<File[]>([]);

  const [resumedCount, setResumedCount] =
    useState(0);

  const [status, setStatus] =
    useState<string | null>(null);

  const [chunkStatus, setChunkStatus] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [skippedFiles, setSkippedFiles] =
    useState<string[]>([]);

  const [uploading, setUploading] =
    useState(false);

  const posterFailures = useRef(0);
  const inputRef =
    useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("closed");
    setMediaType(null);
    setSectionName("");
    setFiles([]);
    setResumedCount(0);
    setStatus(null);
    setChunkStatus(null);
    setError(null);
    setSkippedFiles([]);
    setUploading(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const chooseType = (type: MediaType) => {
    setMediaType(type);
    setError(null);
    setSkippedFiles([]);
    setStep("details");
  };

  const handleFileSelection = (
    selectedFiles: File[]
  ) => {
    if (selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.length > 20) {
      const proceed = window.confirm(
        `You've selected ${selectedFiles.length} files. Uploading that many at once in one browser tab can occasionally crash on lower-memory devices — consider uploading in two smaller batches instead. Continue anyway?`
      );

      if (!proceed) {
        return;
      }
    }

    if (sectionName.trim()) {
      const completed =
        getCompletedFingerprints(sectionName);

      setResumedCount(
        selectedFiles.filter((file) =>
          completed.has(fileFingerprint(file))
        ).length
      );
    } else {
      setResumedCount(0);
    }

    setFiles(selectedFiles);
    setError(null);
    setSkippedFiles([]);
  };

  const handleSectionNameChange = (
    value: string
  ) => {
    setSectionName(value);

    if (files.length > 0 && value.trim()) {
      const completed =
        getCompletedFingerprints(value);

      setResumedCount(
        files.filter((file) =>
          completed.has(fileFingerprint(file))
        ).length
      );
    } else {
      setResumedCount(0);
    }
  };

  const uploadOneFileWithRetry = async (
    file: File,
    sectionId: string,
    onProgress: (
      percent: number
    ) => void
  ): Promise<UploadResult> => {
    for (
      let attempt = 0;
      attempt <= MAX_RETRIES_PER_FILE;
      attempt++
    ) {
      try {
        const presignRes = await fetch(
          "/api/portfolio/upload/presign",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              filename: file.name,
              contentType: getFileContentType(file),
              fileSizeMb:
                file.size / (1024 * 1024),
            }),
          }
        );

        const presignData =
          await presignRes.json();

        if (!presignRes.ok) {
          throw new Error(
            presignData.error ??
              "Failed to start upload"
          );
        }

        await uploadWithProgress(
          presignData.uploadUrl,
          file,
          (loaded, total) => {
            onProgress(
              Math.round(
                (loaded / total) * 100
              )
            );
          }
        );

        const aspectRatio =
          await detectLocalFileAspectRatio(
            file
          );

        const completeRes =
          await fetch(
            "/api/portfolio/upload/complete",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                fileKey:
                  presignData.fileKey,
                type: mediaType,
                sectionId,
                aspectRatio,
              }),
            }
          );

        if (!completeRes.ok) {
          throw new Error(
            "Failed to save file"
          );
        }

        const saved = await completeRes.json();
        if (mediaType === "VIDEO" && saved.media?.id) {
          const previewSaved = await savePortfolioVideoPoster(file, saved.media.id);
          if (!previewSaved) posterFailures.current += 1;
        }
        return { ok: true };
      } catch (err) {
        if (
          attempt ===
          MAX_RETRIES_PER_FILE
        ) {
          return {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : "Upload failed",
          };
        }

        await sleep(
          2000 * (attempt + 1)
        );
      }
    }

    return {
      ok: false,
      error: "Upload failed",
    };
  };

  const uploadLargeFileMultipart = async (
    file: File,
    sectionId: string
  ): Promise<UploadResult> => {
    const fingerprint =
      fileFingerprint(file);

    const chunkSizeBytes =
      CHUNK_SIZE_MB * 1024 * 1024;

    const totalChunks = Math.ceil(
      file.size / chunkSizeBytes
    );

    let progress =
      getMultipartProgress(
        sectionName,
        fingerprint
      );

    if (!progress) {
      const startRes =
        await fetch(
          "/api/portfolio/upload/multipart-start",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              filename: file.name,
              contentType: getFileContentType(file),
              fileSizeMb:
                file.size / (1024 * 1024),
            }),
          }
        );

      const startData =
        await startRes.json();

      if (!startRes.ok) {
        return {
          ok: false,
          error:
            startData.error ??
            "Failed to start large-file upload",
        };
      }

      progress = {
        fileKey: startData.fileKey,
        uploadId: startData.uploadId,
        completedParts: [],
      };

      saveMultipartProgress(
        sectionName,
        fingerprint,
        progress
      );
    }

    const completedPartNumbers =
      new Set(
        progress.completedParts.map(
          (part) => part.partNumber
        )
      );

    const remainingPartNumbers: number[] =
      [];

    for (
      let partNumber = 1;
      partNumber <= totalChunks;
      partNumber++
    ) {
      if (
        !completedPartNumbers.has(
          partNumber
        )
      ) {
        remainingPartNumbers.push(
          partNumber
        );
      }
    }

    let completedCount =
      totalChunks -
      remainingPartNumbers.length;

    let firstError: string | null =
      null;

    const uploadOneChunk = async (
      partNumber: number
    ): Promise<void> => {
      if (firstError) {
        return;
      }

      setChunkStatus(
        `${completedCount} of ${totalChunks} chunks done`
      );

      const start =
        (partNumber - 1) *
        chunkSizeBytes;

      const end = Math.min(
        start + chunkSizeBytes,
        file.size
      );

      const chunk = file.slice(
        start,
        end
      );

      let chunkSucceeded =
        false;

      let lastError =
        "Upload failed";

      for (
        let attempt = 0;
        attempt <=
        MAX_RETRIES_PER_CHUNK;
        attempt++
      ) {
        try {
          const signRes =
            await fetch(
              "/api/portfolio/upload/multipart-sign-part",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  fileKey:
                    progress!.fileKey,
                  uploadId:
                    progress!.uploadId,
                  partNumber,
                }),
              }
            );

          const signData =
            await signRes.json();

          if (!signRes.ok) {
            throw new Error(
              signData.error ??
                "Failed to sign chunk"
            );
          }

          const etag =
            await uploadPartWithProgress(
              signData.uploadUrl,
              chunk,
              (loaded, total) => {
                const percent =
                  Math.min(
                    100,
                    Math.round(
                      ((completedCount *
                        chunkSizeBytes +
                        loaded) /
                        file.size) *
                        100
                    )
                  );

                setChunkStatus(
                  `${percent}% uploaded`
                );
              }
            );

          progress!.completedParts.push({
            partNumber,
            etag,
          });

          saveMultipartProgress(
            sectionName,
            fingerprint,
            progress!
          );

          completedCount++;

          chunkSucceeded = true;
          break;
        } catch (err) {
          lastError =
            err instanceof Error
              ? err.message
              : "Upload failed";

          if (
            attempt <
            MAX_RETRIES_PER_CHUNK
          ) {
            await sleep(
              2000 * (attempt + 1)
            );
          }
        }
      }

      if (
        !chunkSucceeded &&
        !firstError
      ) {
        firstError =
          `${lastError} (chunk ${partNumber} of ${totalChunks})`;
      }
    };

    const queue = [
      ...remainingPartNumbers,
    ];

    const workers = Array.from(
      {
        length:
          CHUNK_CONCURRENCY,
      },
      async () => {
        while (
          queue.length > 0 &&
          !firstError
        ) {
          const partNumber =
            queue.shift();

          if (
            partNumber !== undefined
          ) {
            await uploadOneChunk(
              partNumber
            );
          }
        }
      }
    );

    await Promise.all(workers);

    if (firstError) {
      return {
        ok: false,
        error: firstError,
      };
    }

    const aspectRatio =
      await detectLocalFileAspectRatio(
        file
      );

    const completeRes =
      await fetch(
        "/api/portfolio/upload/multipart-complete",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            fileKey:
              progress.fileKey,
            uploadId:
              progress.uploadId,
            parts:
              progress.completedParts,
            type: mediaType,
            sectionId,
            aspectRatio,
          }),
        }
      );

    const completeData =
      await completeRes.json();

    if (!completeRes.ok) {
      return {
        ok: false,
        error:
          completeData.error ??
          "Failed to finalize large file",
      };
    }

    if (mediaType === "VIDEO" && completeData.media?.id) {
      const previewSaved = await savePortfolioVideoPoster(file, completeData.media.id);
      if (!previewSaved) posterFailures.current += 1;
    }
    clearMultipartProgress(
      sectionName,
      fingerprint
    );

    return { ok: true };
  };

  const handleUpload = async () => {
    if (!mediaType) {
      return;
    }

    if (!sectionName.trim()) {
      setError(
        "Give this section a name."
      );
      return;
    }

    if (files.length === 0) {
      setError(
        "Choose at least one file."
      );
      return;
    }

    setError(null);
    setSkippedFiles([]);
    setUploading(true);

    try {
      const sectionRes =
        await fetch(
          "/api/portfolio/sections",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: sectionName.trim(),
              mediaType,
            }),
          }
        );

      if (!sectionRes.ok) {
        const data =
          await sectionRes.json();

        throw new Error(
          data.error ??
            "Couldn't create section"
        );
      }

      const { section } =
        await sectionRes.json();

      const completed =
        getCompletedFingerprints(
          sectionName
        );

      const filesToUpload =
        files.filter(
          (file) =>
            !completed.has(
              fileFingerprint(file)
            )
        );

      const failedFiles: string[] =
        [];

      for (
        let i = 0;
        i < filesToUpload.length;
        i++
      ) {
        const file =
          filesToUpload[i];

        const isLarge =
          file.size >=
          MULTIPART_THRESHOLD_MB *
            1024 *
            1024;

        setStatus(
          `Uploading ${i + 1} of ${filesToUpload.length}${
            resumedCount > 0
              ? ` (${resumedCount} already done)`
              : ""
          }...`
        );

        setChunkStatus(null);

        const result = isLarge
          ? await uploadLargeFileMultipart(
              file,
              section.id
            )
          : await uploadOneFileWithRetry(
              file,
              section.id,
              (percent) => {
                setStatus(
                  `Uploading ${i + 1} of ${filesToUpload.length} — ${percent}% uploaded...`
                );
              }
            );

        if (result.ok) {
          markFingerprintCompleted(
            sectionName,
            fileFingerprint(file)
          );
        } else {
          failedFiles.push(
            `${file.name} (${result.error})`
          );
        }

        await sleep(
          INTER_FILE_PAUSE_MS
        );

        if (
          (i + 1) % BATCH_SIZE ===
            0 &&
          i + 1 <
            filesToUpload.length
        ) {
          setStatus(
            "Pausing briefly before the next batch..."
          );

          await sleep(
            INTER_BATCH_PAUSE_MS
          );
        }
      }

      if (failedFiles.length > 0) {
        setSkippedFiles(
          failedFiles
        );

        setStatus(null);

        setError(
          `${filesToUpload.length - failedFiles.length} of ${filesToUpload.length} uploaded. ${failedFiles.length} failed — re-select the same files to resume just those.`
        );

        setUploading(false);
        return;
      }

      clearProgress(sectionName);

      if (posterFailures.current > 0) {
        setStatus("Videos uploaded. Some previews could not be created; the videos remain available and can be backfilled later.");
        posterFailures.current = 0;
        setUploading(false);
        router.refresh();
        return;
      }
      setStatus("Done");

      router.refresh();

      setTimeout(
        reset,
        1200
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );

      setStatus(null);
    } finally {
      setUploading(false);
      setChunkStatus(null);

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          "";
      }
    }
  };

  if (step === "closed" && compact) {
    return <button type="button" className={workStyles.addButton} onClick={() => setStep("type")}><Plus size={16}/>{hasSections ? "Add section" : "Add your first section"}</button>;
  }

  if (step === "closed") {
    return hasSections ? (
      <button
        type="button"
        onClick={() =>
          setStep("type")
        }
        className="group relative flex w-full items-center justify-between overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white px-6 py-5 text-left shadow-[0_10px_40px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_20px_60px_rgba(36,120,255,0.09)]"
      >
        <div className="absolute inset-y-0 left-0 w-1 bg-[#2478FF]" />

        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#2478FF] transition group-hover:bg-[#2478FF] group-hover:text-white">
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10 3v14M3 10h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-950">
              Add something new
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Create another section for your portfolio.
            </p>
          </div>
        </div>

        <span className="hidden text-xs font-semibold text-[#2478FF] sm:block"><>{" Add section "}<UiSymbol name="right" />{" "}</></span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() =>
          setStep("type")
        }
        className="group relative flex w-full flex-col items-center overflow-hidden rounded-[2rem] border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center transition duration-300 hover:border-blue-300 hover:bg-blue-50/30"
      >
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_15px_35px_rgba(15,23,42,0.12)] transition duration-300 group-hover:bg-[#2478FF]">
          <svg
            width="21"
            height="21"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 3v14M3 10h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p className="relative mt-5 text-sm font-semibold text-slate-950">
          Add your first section
        </p>

        <p className="relative mt-2 max-w-md text-xs leading-5 text-slate-400">
          A section is whatever you're showcasing —
          Weddings, Brand Films, Case Studies, or
          anything else worth presenting.
        </p>

        <span className="relative mt-5 rounded-full bg-blue-50 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2478FF]">
          Start building
        </span>
      </button>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.07)]">
      <div className="h-1 bg-gradient-to-r from-[#2478FF] via-blue-400 to-[#F5C842]" />

      <div className="p-5 md:p-7">
        {step === "type" && (
          <div>
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2478FF]">
                  Step 01
                </p>

                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950">
                  What are you adding?
                </h3>

                <p className="mt-2 max-w-lg text-xs leading-5 text-slate-400">
                  Choose the type of work this section will
                  contain. You can create as many sections as
                  you need.
                </p>
              </div>

              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    type: "PHOTO" as const,
                    label: "Images",
                    description:
                      "Photos, renders, mockups",
                  },
                  {
                    type: "VIDEO" as const,
                    label: "Videos",
                    description:
                      "Films, reels, showreels",
                  },
                  {
                    type: "DOCUMENT" as const,
                    label: "Documents",
                    description:
                      "Word documents",
                  },
                  {
                    type: "PDF" as const,
                    label: "PDFs",
                    description:
                      "Case studies, decks",
                  },
                ]
              ).map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() =>
                    chooseType(
                      option.type
                    )
                  }
                  className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_15px_45px_rgba(36,120,255,0.08)]"
                >
                  <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-400/10 blur-2xl opacity-0 transition group-hover:opacity-100" />

                  <div className="relative flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[10px] font-bold text-slate-400 shadow-sm ring-1 ring-slate-100 transition group-hover:bg-[#2478FF] group-hover:text-white">
                      {mediaTypeIcon(
                        option.type
                      )}
                    </div>

                    <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#2478FF]"><UiSymbol name="right" /></span>
                  </div>

                  <div className="relative mt-7">
                    <p className="text-sm font-semibold text-slate-950">
                      {option.label}
                    </p>

                    <p className="mt-1.5 text-xs leading-5 text-slate-400">
                      {option.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "details" && (
          <div>
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2478FF]">
                  Step 02 · {mediaTypeLabel(mediaType)}
                </p>

                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950">
                  Build your section.
                </h3>

                <p className="mt-2 max-w-lg text-xs leading-5 text-slate-400">
                  Give the section a name, select the work
                  you want to showcase, and we'll handle the
                  upload.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setStep("type")
                }
                className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
              >
                Change type
              </button>
            </div>

            <div className="space-y-5">
              {/* Section name */}
              <div>
                <label
                  htmlFor="portfolio-section-name"
                  className="mb-2 block text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500"
                >
                  Section name
                </label>

                <input
                  id="portfolio-section-name"
                  type="text"
                  value={sectionName}
                  onChange={(event) =>
                    handleSectionNameChange(
                      event.target.value
                    )
                  }
                  placeholder={
                    mediaType === "VIDEO"
                      ? "e.g. Showreel"
                      : mediaType === "PHOTO"
                        ? "e.g. Recent Weddings"
                        : mediaType === "PDF"
                          ? "e.g. Case Studies"
                          : "e.g. Brand Projects"
                  }
                  disabled={uploading}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-[#2478FF] focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                  style={{
                    fontSize: "16px",
                  }}
                />

                <p className="mt-2 text-[11px] text-slate-400">
                  Think of this as a chapter in your portfolio.
                </p>
              </div>

              {/* File picker */}
              <div>
                <label
                  htmlFor="portfolio-builder-files"
                  className="group block cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-blue-300 hover:bg-blue-50/30"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#2478FF] shadow-sm ring-1 ring-slate-100 transition group-hover:bg-[#2478FF] group-hover:text-white">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M10 13V3M6 7l4-4 4 4M4 12.5v2A2.5 2.5 0 0 0 6.5 17h7a2.5 2.5 0 0 0 2.5-2.5v-2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    {files.length > 0
                      ? `${files.length} file${
                          files.length === 1
                            ? ""
                            : "s"
                        } selected`
                      : `Choose ${mediaTypeLabel(
                          mediaType
                        ).toLowerCase()}`}
                  </p>

                  <p className="mt-1.5 text-xs text-slate-400">
                    {files.length > 0
                      ? "Click to replace your selection"
                      : mediaTypeDescription(
                          mediaType
                        )}
                  </p>

                  {files.length === 0 && (
                    <span className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 shadow-sm ring-1 ring-slate-100">
                      Browse files
                    </span>
                  )}

                  <input
                    ref={inputRef}
                    id="portfolio-builder-files"
                    type="file"
                    multiple
                    accept={
                      mediaType === "VIDEO"
                        ? VIDEO_FILE_ACCEPT
                        : mediaType === "PHOTO"
                          ? IMAGE_FILE_ACCEPT
                          : mediaType === "PDF"
                            ? "application/pdf"
                            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    }
                    onChange={(event) =>
                      handleFileSelection(
                        Array.from(
                          event.target.files ??
                            []
                        )
                      )
                    }
                    className="hidden"
                    disabled={uploading}
                  />
                </label>

                {files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {files.slice(0, 6).map(
                      (file) => (
                        <span
                          key={fileFingerprint(
                            file
                          )}
                          className="max-w-full truncate rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-medium text-slate-500"
                        >
                          {file.name}
                        </span>
                      )
                    )}

                    {files.length > 6 && (
                      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-[#2478FF]">
                        +{files.length - 6} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Resume notice */}
              {files.length > 0 &&
                resumedCount > 0 && (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><UiSymbol name="check" /></div>

                    <div>
                      <p className="text-xs font-semibold text-emerald-800">
                        Upload can resume
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-emerald-700/70">
                        {resumedCount} file
                        {resumedCount === 1
                          ? ""
                          : "s"} already uploaded from
                        a previous attempt and will be skipped.
                      </p>
                    </div>
                  </div>
                )}

              {/* Upload status */}
              {uploading && (
                <div className="overflow-hidden rounded-3xl border border-blue-100 bg-blue-50/60 p-4">
                  <UploadPatienceBanner
                    active={uploading}
                  />

                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-semibold text-slate-700">
                        {status ??
                          "Preparing upload..."}
                      </p>

                      {chunkStatus && (
                        <p className="text-[10px] font-bold text-[#2478FF]">
                          {chunkStatus}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-[#2478FF]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                      !
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-red-800">
                        Upload needs attention
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-red-700/75">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Failed files */}
              {skippedFiles.length >
                0 && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-900">
                    Files that still need uploading
                  </p>

                  <div className="mt-3 space-y-1.5">
                    {skippedFiles.map(
                      (fileName) => (
                        <p
                          key={fileName}
                          className="truncate text-[11px] text-amber-800/70"
                        >
                          {fileName}
                        </p>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={
                    uploading ||
                    !sectionName.trim() ||
                    files.length === 0
                  }
                  className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition hover:bg-[#2478FF] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {uploading ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          strokeOpacity="0.25"
                          strokeWidth="2"
                        />

                        <path
                          d="M21 12a9 9 0 0 0-9-9"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>

                      {status ??
                        "Uploading..."}
                    </>
                  ) : skippedFiles.length >
                    0 ? (
                    <>
                      Retry remaining
                      <span><UiSymbol name="right" /></span>
                    </>
                  ) : (
                    <>
                      Save section
                      <span className="transition-transform group-hover:translate-x-0.5"><UiSymbol name="right" /></span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={reset}
                  disabled={uploading}
                  className="rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>

              <p className="text-center text-[10px] leading-5 text-slate-400">
                Keep this page open until your uploads finish.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
