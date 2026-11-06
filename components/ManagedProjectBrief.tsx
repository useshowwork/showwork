"use client";
import { calendarMutationFetch as fetch } from "@/lib/publishing/clientRequests";

import { getFileContentType } from "@/lib/mediaFileTypes";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { putFileWithProgress } from "@/lib/uploadClient";

const COLOR = { blue: "#2478FF", gradient: "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)" };

interface BriefData {
  name: string;
  briefObjective: string | null;
  briefBackground: string | null;
  briefTargetAudience: string | null;
  briefCreativeDirection: string | null;
  briefDeliverables: string | null;
  briefBrandGuidelines: string | null;
  briefReferences: string | null;
  briefRequiredFormats: string | null;
  briefPlatforms: string | null;
  briefImportantNotes: string | null;
  briefDeadline: string | null;
  briefVisibleToClient: boolean;
}
interface AttachmentRow {
  id: string;
  filename: string | null;
  url: string;
  uploadedBy: { id: string; name: string | null; email: string };
}

const BRIEF_LABELS: { key: keyof BriefData; label: string }[] = [
  { key: "briefObjective", label: "Objective" },
  { key: "briefBackground", label: "Background / context" },
  { key: "briefTargetAudience", label: "Target audience" },
  { key: "briefCreativeDirection", label: "Creative direction" },
  { key: "briefDeliverables", label: "Deliverables" },
  { key: "briefBrandGuidelines", label: "Brand guidelines" },
  { key: "briefReferences", label: "References / inspiration" },
  { key: "briefRequiredFormats", label: "Required formats" },
  { key: "briefPlatforms", label: "Platforms" },
  { key: "briefImportantNotes", label: "Important notes" },
];

const textareaClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/25";

// Attachments — reference files/inspiration attached to the brief.
// Visible to everyone with access; only the owner can add or remove
// one, same boundary as editing the brief's text.
function BriefAttachments({ managedProjectId, isOwner }: { managedProjectId: string; isOwner: boolean }) {
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/managed-projects/${managedProjectId}/brief-attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data.attachments);
      }
    } finally {
      setLoading(false);
    }
  }, [managedProjectId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPercent(0);
    setError(null);
    try {
      const presignRes = await fetch(`/api/managed-projects/${managedProjectId}/brief-attachments/upload-presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: getFileContentType(file), fileSizeMb: file.size / (1024 * 1024) }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error ?? "Failed to start upload");

      await putFileWithProgress(presignData.uploadUrl, file, {
        contentType: getFileContentType(file),
        onProgress: ({ percent }) => setUploadPercent(percent),
      });

      const completeRes = await fetch(`/api/managed-projects/${managedProjectId}/brief-attachments/upload-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey: presignData.fileKey, filename: file.name }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error ?? "Failed to save upload");

      loadAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!window.confirm("Remove this attachment?")) return;
    const res = await fetch(`/api/managed-projects/${managedProjectId}/brief-attachments/${attachmentId}`, { method: "DELETE" });
    if (res.ok) loadAttachments();
  };

  if (loading) return null;

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="mb-3 text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
        Attachments {attachments.length > 0 && `(${attachments.length})`}
      </p>

      {attachments.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2" style={{ background: "var(--managed-soft, rgba(255,255,255,0.04))" }}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-xs font-medium underline" style={{ color: COLOR.blue }}>
                {a.filename || "View file"}
              </a>
              {isOwner && (
                <button onClick={() => removeAttachment(a.id)} className="flex-shrink-0 text-xs text-white/30 transition-colors hover:text-red-400">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {attachments.length === 0 && <p className="mb-3 text-xs text-white/30">No attachments yet.</p>}

      {isOwner && (
        <div>
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" id={`brief-attach-${managedProjectId}`} disabled={uploading} />
          <label
            htmlFor={`brief-attach-${managedProjectId}`}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold"
            style={{ color: COLOR.blue, opacity: uploading ? 0.5 : 1 }}
          >
              {uploading ? `Uploading ${uploadPercent}%` : "+ Add attachment"}
          </label>
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

// The brief, shown read-only to everyone with access, with an Edit
// toggle only rendered for the owner (isOwner is decided server-side
// by the page that renders this, never trusted from the client alone
// — the actual write is still owner-checked again in the PATCH route).
export default function ManagedProjectBrief({
  managedProjectId,
  brief,
  isOwner,
}: {
  managedProjectId: string;
  brief: BriefData;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(brief);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAnyBriefContent = BRIEF_LABELS.some(({ key }) => brief[key]) || brief.briefDeadline;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/managed-projects/${managedProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-2xl p-6" style={{ background: "var(--managed-surface, #1A1A1A)" }}>
        <p className="mb-5 text-sm font-semibold text-white">Editing brief</p>
        <div className="flex flex-col gap-5">
          {BRIEF_LABELS.map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
                {label} <span className="normal-case text-white/25">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={draft[key] as string ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                className={textareaClass}
              />
            </div>
          ))}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
              Deadline <span className="normal-case text-white/25">(optional)</span>
            </label>
            <input
              type="date"
              value={draft.briefDeadline ? draft.briefDeadline.slice(0, 10) : ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, briefDeadline: e.target.value || null }))}
              className={textareaClass}
              style={{ colorScheme: "var(--managed-color-scheme, dark)" }}
            />
          </div>
          <label className="flex items-center gap-2.5 text-sm text-white/70">
            <input
              type="checkbox"
              checked={draft.briefVisibleToClient}
              onChange={(e) => setDraft((prev) => ({ ...prev, briefVisibleToClient: e.target.checked }))}
              className="h-4 w-4"
            />
            Show this brief on the client portal
          </label>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: COLOR.gradient }}
          >
            {saving ? "Saving..." : "Save brief"}
          </button>
          <button
            onClick={() => {
              setDraft(brief);
              setEditing(false);
              setError(null);
            }}
            disabled={saving}
            className="text-sm font-semibold text-white/50 transition-colors hover:text-white"
          >
            Cancel
          </button>
        </div>

        <BriefAttachments managedProjectId={managedProjectId} isOwner={isOwner} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--managed-surface, #1A1A1A)" }}>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Creative brief</p>
        {isOwner && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold transition-colors"
            style={{ color: COLOR.blue }}
          >
            Edit
          </button>
        )}
      </div>

      {!hasAnyBriefContent ? (
        <p className="text-sm text-white/30">
          No brief written yet.{isOwner && " Click Edit to add one."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {BRIEF_LABELS.filter(({ key }) => brief[key]).map(({ key, label }) => (
            <div key={key}>
              <p className="text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
                {label}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{brief[key] as string}</p>
            </div>
          ))}
          {brief.briefDeadline && (
            <div>
              <p className="text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
                Deadline
              </p>
              <p className="mt-1 text-sm text-white/80">
                {new Date(brief.briefDeadline).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <p className="mt-5 text-xs text-white/30">
          {brief.briefVisibleToClient
            ? "Visible on the client portal."
            : "Not visible to the client yet."}
        </p>
      )}

      <BriefAttachments managedProjectId={managedProjectId} isOwner={isOwner} />
    </div>
  );
}
