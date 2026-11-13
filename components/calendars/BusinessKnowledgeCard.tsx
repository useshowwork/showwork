"use client";
import { cancelWorkspaceUpload } from "@/lib/workspaceUploadCancellation";
import knowledgeStyles from "./KnowledgeStudio.module.css";
import { brandPersonalityDocumentId } from "@/lib/knowledge/brandPersonality";
import KnowledgeIndexStatus from "./KnowledgeIndexStatus";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { businessDocumentType, BUSINESS_DOCUMENT_ACCEPT } from "@/lib/businessDocumentTypes";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, CheckCircle2, RefreshCw, Globe2, BookOpenText, Plus, ArrowUpRight, Database, Trash2 } from "lucide-react";

import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";

import UiSymbol from "@/components/ui/UiSymbol";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { workspaceUploadQueue } from "@/lib/workspaceUploadQueue";
import { putFileWithProgress } from "@/lib/uploadClient";

export interface BusinessDocumentData {
  id: string;
  originalName: string;
  createdAt: string;
  websiteUrl?: string | null;
}

type BusinessKnowledgeCardProps = {
  compact?: boolean;
  canEdit?: boolean;
  nextSection?: "channels" | "generate";
  hasBrandVoice?: boolean;
  calendarId: string;
  aiActive: boolean;
  businessSummary: string | null;
  summaryUpdatedAt: string | null;
  lastResearchedAt: string | null;
  documents: BusinessDocumentData[];
};

function formatDate(value: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        d="M6 2.75h8.75L19 7v13.25A1.75 1.75 0 0 1 17.25 22h-11.5A1.75 1.75 0 0 1 4 20.25V4.5a1.75 1.75 0 0 1 2-1.75Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 2.75V7H19"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 11h8M8 14.5h8M8 18h5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        d="M12 2.75 13.9 9.1 20.25 11 13.9 12.9 12 19.25 10.1 12.9 3.75 11l6.35-1.9L12 2.75Z"
        strokeLinejoin="round"
      />
      <path
        d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 15V3.5M7.5 8 12 3.5 16.5 8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 13.5v5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4.5 7h15M9 7V4.5h6V7M7 7l.75 13h8.5L17 7M10 10.5v6M14 10.5v6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 transition-transform ${
        open ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="m6 9 6 6 6-6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BusinessKnowledgeCard({
  calendarId,
  aiActive,
  businessSummary,
  summaryUpdatedAt,
  lastResearchedAt,
  documents,
  compact = false,
  canEdit = true,
  nextSection,
  hasBrandVoice = false,
}: BusinessKnowledgeCardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [businessSummaryState, setBusinessSummaryState] = useState(businessSummary);
  const [summaryUpdatedAtState, setSummaryUpdatedAtState] = useState(summaryUpdatedAt);
  const [documentsState, setDocumentsState] = useState(documents.filter(doc => doc.id !== brandPersonalityDocumentId(calendarId)));
  const [uploading, setUploading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  async function rebuildSummary() {
    setRebuilding(true); setError(null);
    try {
      const response = await fetch(`/api/calendars/${calendarId}/business-documents/rebuild`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to rebuild knowledge.");
      setBusinessSummaryState(body.businessSummary); setSummaryUpdatedAtState(body.summaryUpdatedAt); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to rebuild knowledge."); }
    finally { setRebuilding(false); }
  }
  const [uploadFile, setUploadFile] = useState<{ index: number; total: number; name: string } | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [addingWebsite, setAddingWebsite] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] =
    useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setBusinessSummaryState(businessSummary);
    setSummaryUpdatedAtState(summaryUpdatedAt);
    setDocumentsState(documents.filter(doc => doc.id !== brandPersonalityDocumentId(calendarId)));
  }, [businessSummary, summaryUpdatedAt, documents]);

  const uploadOne = async (file: File) => workspaceUploadQueue.enqueue(calendarId, file, async (task) => {
    setUploadPercent(0);
    /*
     * Step 1:
     * Reserve the file's storage allowance and obtain the R2
     * presigned upload URL.
     */
    const prepared = await task.step("prepare", async () => {
    const presignRes = await calendarMutationFetch(
      `/api/calendars/${calendarId}/business-documents/upload-presign`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: businessDocumentType(file),
          fileSize: file.size,
        }),
      }
    );

    const presignContentType = presignRes.headers.get("content-type") ?? "";

let presignData: {
  uploadUrl?: string;
  fileKey?: string;
  fileSize?: number;
  reservationId?: string;
  error?: string;
};

if (presignContentType.includes("application/json")) {
  presignData = await presignRes.json();
} else {
  const rawResponse = await presignRes.text();

  console.error("Business document presign returned non-JSON:", {
    status: presignRes.status,
    statusText: presignRes.statusText,
    contentType: presignContentType,
    response: rawResponse.slice(0, 1000),
  });

  throw new Error(
    `Upload preparation failed (${presignRes.status}). The server returned an unexpected response.`
  );
}

    if (!presignRes.ok) {
      throw new Error(
        presignData.error ?? "Failed to start upload"
      );
    }

    if (
      !presignData.uploadUrl ||
      !presignData.fileKey ||
      !presignData.reservationId
    ) {
      throw new Error(
        "The upload could not be prepared correctly. Please try again."
      );
    }

    return presignData;
    });
    /*
     * Step 2:
     * Upload the file directly to R2.
     */
    task.onCancel(() => cancelWorkspaceUpload(calendarId, { reservationId: prepared.reservationId!, fileKey: prepared.fileKey! }));
    await task.step("transfer", () => putFileWithProgress(prepared.uploadUrl!, file, {
      signal: task.signal,
      contentType: businessDocumentType(file),
      onProgress: ({ percent }) => { setUploadPercent(percent); task.progress(percent); },
    }));
    task.saving();

    /*
     * Step 3:
     * Tell the backend that the R2 upload is complete.
     *
     * The reservationId identifies the exact storage reservation
     * created during presign.
     */
    const completeRes = await calendarMutationFetch(
      `/api/calendars/${calendarId}/business-documents/upload-complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileKey: prepared.fileKey,
          originalName: file.name,
          contentType: businessDocumentType(file),
          fileSize: file.size,
          reservationId: prepared.reservationId,
        }),
      }
    );

    const completeData = await completeRes.json();

    if (!completeRes.ok) {
      throw new Error(
        completeData.error ?? "Failed to process document"
      );
    }

    return completeData;
  }, "business-documents");

  const focusBrandVoice = () => window.dispatchEvent(new CustomEvent("showwork-brand-voice-focus", { detail: { calendarId } }));

  const handleFiles = async (files: FileList) => {
    const selectedFiles = Array.from(files);
    if (!selectedFiles.length || uploading || !canEdit) return;
    setUploading(true);
    setError(null);
    const failures: string[] = [];
    try {
      await Promise.all(selectedFiles.map(async (file, index) => {
        setUploadFile({ index: index + 1, total: selectedFiles.length, name: file.name });
        try {
          const result = await uploadOne(file);
          if (result?.document) {
            const uploadedDocument = result.document as BusinessDocumentData;
            setDocumentsState(current => [...current.filter(document => document.id !== uploadedDocument.id), uploadedDocument]);
          }
          if (result?.summaryUpdated && typeof result.businessSummary === "string") {
            setBusinessSummaryState(result.businessSummary);
            setSummaryUpdatedAtState(result.summaryUpdatedAt ?? new Date().toISOString());
            window.sessionStorage.setItem(`calendar:${calendarId}:has-business-summary`, "true");
          }
          if (result?.summaryUpdated === false && !result?.alreadyCompleted) failures.push(`${file.name}: uploaded, but AI could not update its knowledge.`);
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed. Please try again."}`);
        }
      }));
      router.refresh();
      if (failures.length) setError(failures.join("\n"));
    } finally {
      setUploading(false);
      setUploadFile(null);
    }
  };

  const addWebsite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!websiteUrl.trim() || !canEdit) return;
    setAddingWebsite(true);
    setError(null);
    try {
      const response = await calendarMutationFetch(`/api/calendars/${calendarId}/business-documents/website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not read that website.");
      if (data.document) {
        const source = data.document as BusinessDocumentData;
        setDocumentsState((current) => [source, ...current.filter((item) => item.id !== source.id)]);
      }
      if (data.summaryUpdated && typeof data.businessSummary === "string") {
        setBusinessSummaryState(data.businessSummary);
        setSummaryUpdatedAtState(data.summaryUpdatedAt ?? new Date().toISOString());
        window.sessionStorage.setItem(`calendar:${calendarId}:has-business-summary`, "true");
        setWebsiteUrl("");
        router.refresh();
      } else {
        setError("The website was saved, but the AI couldn't update its business summary. Try again shortly.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that website.");
    } finally {
      setAddingWebsite(false);
    }
  };

  const removeDocument = async (documentId: string) => {
    if (!canEdit) return;
    setDeletingId(documentId);
    setError(null);

    try {
      const res = await calendarMutationFetch(
        `/api/calendars/${calendarId}/business-documents/${documentId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        throw new Error(
          data.error ?? "Failed to remove document"
        );
      }

      setConfirmingDeleteId(null);
      setDocumentsState((current) => current.filter((document) => document.id !== documentId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const indexStatus = <KnowledgeIndexStatus calendarId={calendarId} revision={documentsState.map(d=>d.id).join(",") + summaryUpdatedAtState} />;
  const updated = formatDate(summaryUpdatedAtState);
  const researched = formatDate(lastResearchedAt);

  if (compact) {
    return <div className="mt-5 border-t border-[#DCE6F3] pt-5">
      <h4 className="text-base font-medium tracking-tight text-[#26496E]">Teach AI the details.</h4>{indexStatus}
      <p className="mt-2 text-xs leading-6 text-[#6B83A3]">Add price lists, FAQs, or a business profile. These are the facts your assistant uses.</p>
      {!aiActive && <WorkspaceFeatureNotice compact message="Activate your workspace to add business documents." />}
      <button type="button" disabled={uploading || !aiActive || !canEdit} onClick={() => fileInputRef.current?.click()} className="mt-4 flex min-h-24 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#9FBDEB] bg-[linear-gradient(135deg,#E8F1FF,#F7FAFF)] px-5 py-6 text-[#285B9E] transition hover:border-[#3478EC] hover:bg-[#E1EDFF] disabled:opacity-50">
        <UploadCloud size={23} strokeWidth={1.5} aria-hidden="true" />
        <span className="text-sm font-semibold">{uploading ? `File ${uploadFile?.index || 1} of ${uploadFile?.total || 1} · Uploading ${uploadPercent}% & reading…` : documentsState.length ? "Add more documents" : "Upload documents or price lists"}</span>
        <span className="text-xs text-[#6B83A3]">PDF · Word · Excel · CSV · Text</span>
      </button>
      <input ref={fileInputRef} type="file" multiple accept={BUSINESS_DOCUMENT_ACCEPT} disabled={uploading || !aiActive || !canEdit} className="hidden" aria-label="Upload business documents and price lists" onChange={event => { if (event.target.files?.length) void handleFiles(event.target.files); event.currentTarget.value = ""; }} />
      {uploadFile && <p role="status" className="mt-3 truncate text-xs text-[#607898]" title={uploadFile.name}>{uploadFile.name}</p>}
      {error && <p role="alert" className="mt-3 whitespace-pre-line rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</p>}
      {businessSummaryState && !error && <p role="status" className="mt-4 flex items-center gap-2 text-xs text-[#287768]"><CheckCircle2 size={15} aria-hidden="true" />Business knowledge ready{updated ? ` · Updated ${updated}` : ""}</p>}
      {documentsState.length > 0 && <p className="mt-4 text-xs font-semibold text-[#42658D]">{documentsState.length} source {documentsState.length === 1 ? "document" : "documents"}</p>}
      {documentsState.length > 0 && <ul className="mt-3 max-h-44 overflow-y-auto divide-y divide-[#DFE7F3]">{documentsState.map(document => <li key={document.id} className="flex min-w-0 items-center gap-3 py-3 text-xs text-[#4D6D94]"><FileText size={16} className="shrink-0" aria-hidden="true" /><span className="truncate" title={document.originalName}>{document.originalName}</span></li>)}</ul>}
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("showwork-workspace-navigate", { detail: { id: "knowledge" } }))} className="mt-3 min-h-11 text-xs font-semibold text-[#2866BE]">Review business knowledge →</button>
    </div>;
  }

  if (!aiActive) {
    return (
      <section className="relative w-full overflow-hidden rounded-[30px] border border-[#DCE5F2] bg-[#0A101A] shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#2478FF]/14 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#2478FF]/8 blur-3xl" />

        <div className="relative p-6 sm:p-8 lg:p-9">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#2478FF]/20 bg-[#2478FF]/10 text-[#69A0FF] shadow-[0_10px_30px_rgba(36,120,255,0.12)]">
                <SparkIcon />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#78A9F8]">
                  AI add-on
                </p>

                <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl">
                  Teach Showwork the business.
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[#AAB7C8]">
                  Give the assistant the context it needs to
                  understand this client, research their space,
                  and build better content plans.
                </p>
              </div>
            </div>

            <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/45 sm:inline-flex">
              Premium
            </span>
          </div>

          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            {[
              ["01", "Business context"],
              ["02", "AI research"],
              ["03", "Content planning"],
            ].map(([number, label]) => (
              <div
                key={number}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3.5"
              >
                <p className="text-[9px] font-bold tracking-[0.12em] text-[#52729E]">
                  {number}
                </p>

                <p className="mt-1 text-xs font-semibold text-white/75">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative border-t border-white/[0.07] bg-[#0D1520]/90 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-8">
          <div>
            <p className="text-xs font-semibold text-white">
              Unlock AI business knowledge
            </p>

            <p className="mt-1 text-[10px] leading-5 text-[#718096]">
              Activate the premium content assistant for this
              workspace.
            </p>
          </div>

          <a
            href="/dashboard/calendars"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#2478FF] px-5 py-3 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(36,120,255,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#1768E8] sm:mt-0 sm:w-auto"
          >
            Activate AI
            <span className="ml-2"><><UiSymbol name="right" /></></span>
          </a>
        </div>
      </section>
    );
  }

  return <section id="knowledge-sources" className={knowledgeStyles.library} aria-label="Business knowledge sources">
    {error && <div role="alert" className={knowledgeStyles.error}>{error}{/upgrade|allowance|quota|subscription|trial.*(ended|expired)/i.test(error) && <WorkspaceFeatureNotice compact message="Your current plan or allowance does not cover this action. View plans to restore access or increase your limits."/>}</div>}
    <div className={knowledgeStyles.sourceLayout}>
      <aside className={knowledgeStyles.addPanel} aria-label="Add business knowledge">
        <h2 className={knowledgeStyles.addSourceTitle}>Add a source</h2>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || addingWebsite || !canEdit} className={knowledgeStyles.upload}><span className={knowledgeStyles.uploadIcon}><UploadCloud size={24}/></span><strong>{uploading ? `Uploading ${uploadPercent}% & reading…` : "Upload documents"}</strong><span>PDF · Word · Excel · CSV · Text</span></button>
        <div className={knowledgeStyles.or}><span/>or<span/></div>
        <form onSubmit={event => void addWebsite(event)} className={knowledgeStyles.websiteForm}><label htmlFor={`knowledge-website-${calendarId}`}>Website address</label><div><Globe2 size={15}/><input id={`knowledge-website-${calendarId}`} type="text" inputMode="url" placeholder="yourbusiness.com" value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} disabled={addingWebsite || uploading || !canEdit}/></div><button type="submit" disabled={addingWebsite || uploading || !canEdit || !websiteUrl.trim()}>{addingWebsite ? "Reading website…" : "Add website"}<Plus size={14}/></button><p>Use your business website or a page about your services.</p></form>
        {uploadFile && <p role="status" className={knowledgeStyles.uploadProgress}>File {uploadFile.index} of {uploadFile.total} · {uploadFile.name}</p>}
      </aside>
      <details className={knowledgeStyles.sourcesDisclosure}>
        <summary><span><FileText size={16}/>Your sources <strong>{documentsState.length}</strong></span><span>View & manage <ChevronIcon open={false}/></span></summary>
        <div className={knowledgeStyles.sourcesDisclosureBody}>
        {documentsState.length > 0 && indexStatus}
        {documentsState.length ? <ul className={knowledgeStyles.sourceList}>{documentsState.map(doc => <li key={doc.id} className={knowledgeStyles.sourceRow}>
          <span className={knowledgeStyles.fileIcon} data-website={!!doc.websiteUrl}>{doc.websiteUrl ? <Globe2 size={19}/> : <FileText size={19}/>}</span>
          <div className={knowledgeStyles.fileCopy}><p title={doc.originalName}>{doc.originalName}</p><span>{doc.websiteUrl ? "Website" : "Document"} · Added {formatDate(doc.createdAt)}</span>{doc.websiteUrl && <a href={doc.websiteUrl} target="_blank" rel="noopener noreferrer">Visit website <ArrowUpRight size={11}/></a>}</div>
          {canEdit && (confirmingDeleteId === doc.id ? <div className={knowledgeStyles.confirm}><button disabled={deletingId === doc.id} onClick={() => void removeDocument(doc.id)}>{deletingId === doc.id ? "Removing…" : "Remove"}</button><button disabled={deletingId === doc.id} onClick={() => setConfirmingDeleteId(null)}>Cancel</button></div> : <button type="button" aria-label={`Remove ${doc.originalName}`} onClick={() => setConfirmingDeleteId(doc.id)} className={knowledgeStyles.remove}><Trash2 size={15}/></button>)}
        </li>)}</ul> : <div className={knowledgeStyles.empty}><BookOpenText size={31}/><h3>No sources yet</h3><p>Add a business profile, price list, FAQ or website above.</p></div>}

    <details className={knowledgeStyles.understanding}>
      <summary><span className={knowledgeStyles.understandingIcon}><BookOpenText size={18}/></span><span><strong>What Showwork understands</strong><small>{updated ? `Overview updated ${updated}` : "Read the source-derived business overview"}</small></span><ChevronIcon open={false}/></summary>
      <div className={knowledgeStyles.understandingBody}>{businessSummaryState ? <p className={knowledgeStyles.summaryText}>{businessSummaryState}</p> : <p>Add a source to start building your business overview.</p>}
        {canEdit && documentsState.length > 0 && <button type="button" onClick={rebuildSummary} disabled={rebuilding} className={knowledgeStyles.rebuild}><RefreshCw size={14} className={rebuilding ? "animate-spin" : ""}/>{rebuilding ? "Rebuilding from current sources…" : "Refresh overview from sources"}</button>}
        <p className={knowledgeStyles.finePrint}>This overview summarizes your sources. Relevant source text takes priority in replies; research is reviewed separately in Randy.{researched ? ` Last researched ${researched}.` : ""}</p>
      </div>
    </details>
        </div>
      </details>

    </div>
    <input ref={fileInputRef} type="file" multiple accept={BUSINESS_DOCUMENT_ACCEPT} disabled={uploading || addingWebsite || !canEdit} className="hidden" aria-label="Upload business knowledge documents" onChange={event => { if (event.target.files?.length) { void handleFiles(event.target.files); event.currentTarget.value = ""; } }}/>

    {documentsState.length > 0 && <div className={knowledgeStyles.nextStep}><div><strong>Your business knowledge is ready</strong><p>Continue to the next step. Brand voice is optional.</p></div>{!hasBrandVoice && <button type="button" disabled={uploading || addingWebsite} onClick={focusBrandVoice}>Add brand voice (optional)</button>}{nextSection && <button type="button" disabled={uploading || addingWebsite} onClick={() => window.dispatchEvent(new CustomEvent("showwork-workspace-navigate", { detail: { id: nextSection } }))}>{nextSection === "channels" ? "Connect channels" : "Generate content"}<ArrowUpRight size={15}/></button>}</div>}

  </section>;
}
