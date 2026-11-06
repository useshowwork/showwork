"use client";

import styles from "./projects/ManagedTasks.module.css";
import { CalendarDays, CheckCircle2, ChevronDown, Circle, Clock3, Files, ListTodo, Loader2, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { getFileContentType } from "@/lib/mediaFileTypes";

import { useState, useEffect, useCallback, useRef } from "react";
import UploadPatienceBanner from "@/components/UploadPatienceBanner";
import AddTaskSubSection from "@/components/AddTaskSubSection";

const COLOR = { blue: "#2478FF", gradient: "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)" };

const STATUS_LABELS: Record<string, string> = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" };
const REVIEW_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "rgba(245,200,66,0.15)", text: "#F5C842", label: "Awaiting your review" },
  APPROVED: { bg: "rgba(34,197,94,0.15)", text: "var(--managed-success, #4ade80)", label: "Approved" },
  NEEDS_CHANGES: { bg: "rgba(239,68,68,0.15)", text: "#EF4444", label: "Needs changes" },
};

interface TaskAssetRow {
  id: string;
  filename: string | null;
  url: string;
  internalReviewStatus: "PENDING" | "APPROVED" | "NEEDS_CHANGES";
  internalReviewNote: string | null;
  promotedToMediaId: string | null;
  uploadedByCreatorId: string;
  folderId: string | null;
}
interface TaskFolderRow {
  id: string;
  name: string;
}
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  assignedTo: { id: string; name: string | null; email: string; avatarUrl: string | null };
  createdBy: { id: string; name: string | null; email: string };
  linkedAssets: TaskAssetRow[];
  folders: TaskFolderRow[];
}
interface AssigneeOption {
  id: string;
  name: string | null;
  email: string;
}

// ── Upload helpers — real progress via XHR. Multipart ETags are
// resolved by the server from R2 during finalization. ──
function uploadWithProgress(url: string, file: File | Blob, onProgress: (loaded: number, total: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", getFileContentType(file) || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
function uploadPartWithProgress(url: string, chunk: Blob, onProgress: (loaded: number, total: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
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

// Resumable chunk-level progress for a task upload — keyed by taskId
// + a fingerprint of the specific file, since browsers give JS no way
// to hold a real File reference across a crash or reload.
function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
interface TaskMultipartProgress {
  fileKey: string;
  uploadId: string;
  completedParts: { partNumber: number; etag: string }[];
}
function taskMultipartKey(taskId: string, fingerprint: string): string {
  return `showwork-task-multipart:${taskId}:${fingerprint}`;
}
function getTaskMultipartProgress(taskId: string, fingerprint: string): TaskMultipartProgress | null {
  try {
    const raw = localStorage.getItem(taskMultipartKey(taskId, fingerprint));
    return raw ? (JSON.parse(raw) as TaskMultipartProgress) : null;
  } catch {
    return null;
  }
}
function saveTaskMultipartProgress(taskId: string, fingerprint: string, progress: TaskMultipartProgress) {
  try {
    localStorage.setItem(taskMultipartKey(taskId, fingerprint), JSON.stringify(progress));
  } catch {
    // ignore — resuming just won't work this time
  }
}
function clearTaskMultipartProgress(taskId: string, fingerprint: string) {
  try {
    localStorage.removeItem(taskMultipartKey(taskId, fingerprint));
  } catch {
    // ignore
  }
}

const TASK_MULTIPART_THRESHOLD_MB = 100;
const TASK_CHUNK_SIZE_MB = 200;
const TASK_CHUNK_CONCURRENCY = 3;
const TASK_MAX_RETRIES = 2;
const TASK_MAX_RETRIES_PER_CHUNK = 3;
const taskSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One task's upload control plus its list of attached files — each
// with the owner's internal review state shown and, for the owner
// only, the approve/request-changes buttons.
function TaskAssets({
  taskId,
  assets,
  folders,
  canUpload,
  isOwner,
  onChanged,
}: {
  taskId: string;
  assets: TaskAssetRow[];
  folders: TaskFolderRow[];
  canUpload: boolean;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [chunkStatus, setChunkStatus] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const detectType = (file: File): string => {
    if (getFileContentType(file).startsWith("video/")) return "VIDEO";
    if (getFileContentType(file) === "application/pdf") return "PDF";
    if (getFileContentType(file).startsWith("image/")) return "PHOTO";
    return "DOCUMENT";
  };

  // ── Small files — single PUT, with retry ──
  const uploadSmallFile = async (file: File, type: string): Promise<void> => {
    for (let attempt = 0; attempt <= TASK_MAX_RETRIES; attempt++) {
      try {
        const presignRes = await fetch(`/api/managed-projects/tasks/${taskId}/upload-presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: getFileContentType(file), fileSizeMb: file.size / (1024 * 1024) }),
        });
        const presignData = await presignRes.json();
        if (!presignRes.ok) throw new Error(presignData.error ?? "Failed to start upload");

        await uploadWithProgress(presignData.uploadUrl, file, (loaded, total) => {
          setChunkStatus(`${Math.round((loaded / total) * 100)}% uploaded`);
        });

        const completeRes = await fetch(`/api/managed-projects/tasks/${taskId}/upload-complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileKey: presignData.fileKey, filename: file.name, type }),
        });
        const completeData = await completeRes.json();
        if (!completeRes.ok) throw new Error(completeData.error ?? "Failed to save upload");
        return;
      } catch (err) {
        if (attempt === TASK_MAX_RETRIES) throw err;
        await taskSleep(2000 * (attempt + 1));
      }
    }
  };

  // ── Large files — chunked multipart, 2 chunks concurrently, with
  //    per-chunk resume ──
  const uploadLargeFile = async (file: File, type: string): Promise<void> => {
    const fingerprint = fileFingerprint(file);
    const chunkSizeBytes = TASK_CHUNK_SIZE_MB * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSizeBytes);

    let progress = getTaskMultipartProgress(taskId, fingerprint);
    if (!progress) {
      const startRes = await fetch(`/api/managed-projects/tasks/${taskId}/upload-multipart-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: getFileContentType(file), fileSizeMb: file.size / (1024 * 1024) }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error ?? "Failed to start large-file upload");
      progress = { fileKey: startData.fileKey, uploadId: startData.uploadId, completedParts: [] };
      saveTaskMultipartProgress(taskId, fingerprint, progress);
    }

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

      for (let attempt = 0; attempt <= TASK_MAX_RETRIES_PER_CHUNK; attempt++) {
        try {
          const signRes = await fetch(`/api/managed-projects/tasks/${taskId}/upload-multipart-sign-part`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileKey: progress!.fileKey, uploadId: progress!.uploadId, partNumber }),
          });
          const signData = await signRes.json();
          if (!signRes.ok) throw new Error(signData.error ?? "Failed to sign chunk");

          const etag = await uploadPartWithProgress(signData.uploadUrl, chunk, (loaded) => reportChunkProgress(partNumber, loaded));

          progress!.completedParts.push({ partNumber, etag });
          saveTaskMultipartProgress(taskId, fingerprint, progress!);
          completedCount++;

          chunkSucceeded = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Upload failed";
          if (attempt < TASK_MAX_RETRIES_PER_CHUNK) await taskSleep(2000 * (attempt + 1));
        }
      }
      if (!chunkSucceeded && !firstError) {
        firstError = `${lastError} (chunk ${partNumber} of ${totalChunks})`;
      }
    };

    const queue = [...remainingPartNumbers];
    const workers = Array.from({ length: TASK_CHUNK_CONCURRENCY }, async () => {
      while (queue.length > 0 && !firstError) {
        const partNumber = queue.shift();
        if (partNumber !== undefined) await uploadOneChunk(partNumber);
      }
    });
    await Promise.all(workers);

    if (firstError) throw new Error(firstError);

    const completeRes = await fetch(`/api/managed-projects/tasks/${taskId}/upload-multipart-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileKey: progress.fileKey,
        uploadId: progress.uploadId,
        parts: progress.completedParts,
        filename: file.name,
        type,
      }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) throw new Error(completeData.error ?? "Failed to finalize large file");

    clearTaskMultipartProgress(taskId, fingerprint);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setChunkStatus("0% uploaded");
    try {
      const type = detectType(file);
      const isLarge = file.size >= TASK_MULTIPART_THRESHOLD_MB * 1024 * 1024;

      if (isLarge) {
        await uploadLargeFile(file, type);
      } else {
        await uploadSmallFile(file, type);
      }

      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setChunkStatus(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submitReview = async (assetId: string, status: "APPROVED" | "NEEDS_CHANGES") => {
    await fetch(`/api/managed-projects/task-assets/${assetId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: status === "NEEDS_CHANGES" ? reviewNote : undefined }),
    });
    setReviewingId(null);
    setReviewNote("");
    onChanged();
  };

  // One asset's full row — pulled out as its own function rather than
  // inlined twice, since it needs to render identically whether it's
  // sitting in the ungrouped list or inside a named sub-section below.
  const renderAssetRow = (asset: TaskAssetRow) => {
    const review = REVIEW_COLORS[asset.internalReviewStatus];
    return (
      <div key={asset.id} className="rounded-md p-2.5" style={{ background: "var(--managed-soft, rgba(255,255,255,0.03))" }}>
        <div className="flex items-center justify-between gap-2">
          <a href={asset.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-xs font-medium underline" style={{ color: COLOR.blue }}>
            {asset.filename || "View file"}
          </a>
          <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: review.bg, color: review.text }}>
            {asset.promotedToMediaId ? "Published" : review.label}
          </span>
        </div>
        {asset.internalReviewNote && (
          <p className="mt-1.5 text-xs italic text-white/50">&ldquo;{asset.internalReviewNote}&rdquo;</p>
        )}
        {isOwner && asset.internalReviewStatus === "PENDING" && !asset.promotedToMediaId && (
          <div className="mt-2">
            {reviewingId === asset.id ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="What needs to change?"
                  rows={2}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
                />
                <div className="flex gap-2">
                  <button onClick={() => submitReview(asset.id, "NEEDS_CHANGES")} className="rounded-md px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>
                    Send request
                  </button>
                  <button onClick={() => setReviewingId(null)} className="text-[11px] text-white/40 hover:text-white">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => submitReview(asset.id, "APPROVED")} className="rounded-md px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(34,197,94,0.15)", color: "var(--managed-success, #4ade80)" }}>
                  Approve
                </button>
                <button onClick={() => setReviewingId(asset.id)} className="rounded-md px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>
                  Request changes
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Direct uploads first (no sub-section), each named sub-section
  // shown after — same ordering and visual treatment as sections and
  // sub-sections on the delivery side.
  const ungroupedAssets = assets.filter((a) => !a.folderId);

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      {ungroupedAssets.length > 0 && (
        <div className="flex flex-col gap-2">
          {ungroupedAssets.map(renderAssetRow)}
        </div>
      )}

      {folders.map((folder) => {
        const folderAssets = assets.filter((a) => a.folderId === folder.id);
        if (folderAssets.length === 0) return null;
        return (
          <div
            key={folder.id}
            className="mt-4 border-l-2 pl-3"
            style={{ borderColor: "rgba(36,120,255,0.25)" }}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase text-white/40" style={{ letterSpacing: "0.06em" }}>
              {folder.name}
            </p>
            <div className="flex flex-col gap-2">
              {folderAssets.map(renderAssetRow)}
            </div>
          </div>
        );
      })}

      {canUpload && (
        <div className="mt-2">
          {uploading && <UploadPatienceBanner active={uploading} />}
          {chunkStatus && <p className="mb-1.5 mt-1.5 text-[11px] text-white/40">{chunkStatus}</p>}
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" id={`file-${taskId}`} disabled={uploading} />
          <label
            htmlFor={`file-${taskId}`}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold"
            style={{ color: COLOR.blue, opacity: uploading ? 0.5 : 1 }}
          >
            {uploading ? "Uploading..." : "+ Upload file"}
          </label>
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

          <div className="mt-2.5">
            <AddTaskSubSection taskId={taskId} onChanged={onChanged} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManagedProjectTasks({
  managedProjectId,
  isOwner,
  currentCreatorId,
  assigneeOptions,
}: {
  managedProjectId: string;
  isOwner: boolean;
  currentCreatorId: string;
  assigneeOptions: AssigneeOption[];
}) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToCreatorId, setAssignedToCreatorId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'TODO' | 'IN_PROGRESS' | 'DONE' | 'mine'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/managed-projects/${managedProjectId}/tasks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'We couldn’t load the tasks. Please try again.');
      setTasks(data.tasks); setActionError('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'We couldn’t load the tasks. Please try again.');
    } finally { setLoading(false); }
  }, [managedProjectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignedToCreatorId) {
      setFormError("Choose who this is assigned to");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/managed-projects/${managedProjectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, assignedToCreatorId, priority, dueDate: dueDate || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create task");
      setTitle("");
      setDescription("");
      setAssignedToCreatorId("");
      setPriority("MEDIUM");
      setDueDate("");
      setShowForm(false);
      setNotice("Task created. Your team can start working on it.");
      void loadTasks();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (taskId: string, status: TaskRow['status']) => {
    if (busyId) return;
    setBusyId(taskId); setActionError(''); setNotice('');
    try {
      const res = await fetch(`/api/managed-projects/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw Error(data.error || 'We couldn’t update this task. Please try again.'); }
      setTasks(current => current.map(task => task.id === taskId ? { ...task, status } : task));
      setNotice(`Task moved to ${STATUS_LABELS[status].toLowerCase()}.`);
    } catch(error) { setActionError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusyId(null); }
  };
  const deleteTask = async (taskId: string) => {
    if (busyId || !window.confirm('Delete this task and its linked work? This cannot be undone.')) return;
    setBusyId(taskId); setActionError(''); setNotice('');
    try {
      const res = await fetch(`/api/managed-projects/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw Error(data.error || 'We couldn’t remove this task. Please try again.'); }
      setTasks(current => current.filter(task => task.id !== taskId)); setNotice('Task removed.');
    } catch(error) { setActionError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusyId(null); }
  };
  const doneCount = tasks.filter(task => task.status === 'DONE').length;
  const progressPercent = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0;
  const visible = tasks.filter(task => (filter === 'all' || (filter === 'mine' ? task.assignedTo.id === currentCreatorId : task.status === filter)) && `${task.title} ${task.description || ''} ${task.assignedTo.name || ''} ${task.assignedTo.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  const filters = [
    { id:'all' as const, label:'All tasks', count:tasks.length },
    { id:'TODO' as const, label:'To do', count:tasks.filter(task=>task.status==='TODO').length },
    { id:'IN_PROGRESS' as const, label:'In progress', count:tasks.filter(task=>task.status==='IN_PROGRESS').length },
    { id:'DONE' as const, label:'Done', count:doneCount },
    { id:'mine' as const, label:'Assigned to me', count:tasks.filter(task=>task.assignedTo.id===currentCreatorId).length },
  ];
  return <div data-managed-task-studio="true" className={styles.studio}>
    <div className={styles.toolbar}><div><h3>Your task list</h3><p>{tasks.length ? `${doneCount} of ${tasks.length} tasks complete` : 'Break the project into clear, assigned pieces of work.'}</p></div>{isOwner&&<button type="button" className={styles.primary} aria-expanded={showForm} aria-controls="managed-new-task" disabled={creating} onClick={()=>{setShowForm(value=>!value);setFormError(null);}}>{showForm?<X size={15}/>:<Plus size={15}/>}{showForm?'Close form':'New task'}</button>}</div>
    {tasks.length>0&&<div className={styles.completion}><div role="progressbar" aria-label="Tasks completed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><span style={{width:`${progressPercent}%`}}/></div><span>{progressPercent}% complete</span></div>}
    {showForm&&isOwner&&<form id="managed-new-task" onSubmit={createTask} className={styles.form}><div className={styles.formHeading}><h4>Create a task</h4><p>Give it a clear name, assign someone, and set the priority.</p></div><fieldset disabled={creating}>
      <label>Task name<input autoFocus required value={title} onChange={event=>setTitle(event.target.value)} placeholder="e.g. Brand film — first cut"/><small>This becomes the section name on the client’s delivery when published.</small></label>
      <label>Description <span>Optional</span><textarea rows={3} value={description} onChange={event=>setDescription(event.target.value)} placeholder="What needs to be done? Add context or acceptance criteria."/></label>
      <div className={styles.formGrid}><label>Assign to<select required value={assignedToCreatorId} onChange={event=>setAssignedToCreatorId(event.target.value)}><option value="">Choose a person</option>{assigneeOptions.map(person=><option key={person.id} value={person.id}>{person.id===currentCreatorId?'Me':person.name||person.email}</option>)}</select></label><label>Priority<select value={priority} onChange={event=>setPriority(event.target.value)}>{['LOW','MEDIUM','HIGH','URGENT'].map(value=><option key={value} value={value}>{value[0]+value.slice(1).toLowerCase()}</option>)}</select></label><label>Due date <span>Optional</span><input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)}/></label></div>
      {formError&&<p role="alert" className={styles.error}>{formError}</p>}
      <div className={styles.formActions}><button type="submit" className={styles.primary}>{creating?<Loader2 size={15} className={styles.spinner}/>:<Plus size={15}/>}{creating?'Creating…':'Create task'}</button><button type="button" className={styles.secondary} onClick={()=>setShowForm(false)}>Cancel</button></div>
    </fieldset></form>}
    {actionError&&<div role="alert" className={styles.error}>{actionError}{!tasks.length&&<button type="button" onClick={()=>void loadTasks()}>Try again</button>}</div>}
    {notice&&<p role="status" className={styles.notice}><CheckCircle2 size={15}/>{notice}</p>}
    <div className={styles.listTools}><div className={styles.filters} role="group" aria-label="Filter tasks">{filters.map(tab=><button key={tab.id} type="button" aria-pressed={filter===tab.id} onClick={()=>setFilter(tab.id)}>{tab.label}<span>{tab.count}</span></button>)}</div><label className={styles.search}><Search size={15}/><span className="sr-only">Search tasks by name or assignee</span><input type="search" placeholder="Find a task or person" value={query} onChange={event=>setQuery(event.target.value)}/></label></div>
    {loading&&!tasks.length?<div role="status" className={styles.empty}><Loader2 size={23} className={styles.spinner}/><p>Loading your tasks…</p></div>:actionError&&!tasks.length?null:!visible.length?<div className={styles.empty}><span><ListTodo size={29}/></span><h4>{tasks.length?'No tasks match this view.':'Give the next step a name.'}</h4><p>{tasks.length?'Try another filter or search term.':isOwner?'Create your first task and assign it to someone on the project.':'Tasks assigned by the project owner will appear here.'}</p>{tasks.length>0&&<button type="button" className={styles.secondary} onClick={()=>{setFilter('all');setQuery('');}}>Show all tasks</button>}</div>:<div className={styles.list} aria-busy={loading}>{visible.map(task=>{
      const canUpdateStatus=isOwner||task.assignedTo.id===currentCreatorId;
      const mine=task.assignedTo.id===currentCreatorId;
      const StatusIcon=task.status==='DONE'?CheckCircle2:task.status==='IN_PROGRESS'?Clock3:Circle;
      return <article key={task.id} className={styles.task}>
        <div className={styles.taskTop}><span className={styles.status} data-status={task.status}><StatusIcon size={13}/>{STATUS_LABELS[task.status]}</span><span className={styles.priority} data-priority={task.priority}>{task.priority[0]+task.priority.slice(1).toLowerCase()} priority</span>{isOwner&&<button type="button" aria-label={`Delete ${task.title}`} className={styles.delete} disabled={!!busyId} onClick={()=>void deleteTask(task.id)}><Trash2 size={15}/></button>}</div>
        <h4>{task.title}</h4>{task.description&&<p className={styles.description}>{task.description}</p>}
        <div className={styles.meta}><span><UserRound size={14}/>{mine?'Assigned to you':task.assignedTo.name||task.assignedTo.email}</span>{task.dueDate&&<span><CalendarDays size={14}/>Due {new Date(task.dueDate).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Lagos'})}</span>}</div>
        <div className={styles.statusRow}><span>{canUpdateStatus?'Move task to':'Task status'}</span><div role="group" aria-label={`Status for ${task.title}`}>{(['TODO','IN_PROGRESS','DONE']as const).map(status=><button key={status} type="button" aria-pressed={task.status===status} disabled={!canUpdateStatus||!!busyId||task.status===status} onClick={()=>void updateStatus(task.id,status)}>{busyId===task.id&&task.status!==status?<Loader2 size={12} className={styles.spinner}/>:null}{STATUS_LABELS[status]}</button>)}</div></div>
        <details className={styles.assets}><summary><Files size={16}/><span>{task.linkedAssets.length?'Files & internal review':canUpdateStatus?'Upload work & manage files':'Files & internal review'}</span><small>{task.linkedAssets.length} {task.linkedAssets.length===1?'file':'files'}</small><ChevronDown size={15}/></summary><div><TaskAssets taskId={task.id} assets={task.linkedAssets} folders={task.folders} canUpload={canUpdateStatus} isOwner={isOwner} onChanged={loadTasks}/></div></details>
      </article>;
    })}</div>}
  </div>;
}
