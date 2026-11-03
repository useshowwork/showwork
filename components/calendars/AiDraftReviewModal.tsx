"use client";
import CreativeBriefEditor from "./CreativeBriefEditor";
import type { CreativeBrief, CreativeDevelopment } from "@/lib/content/brief";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";

import UiSymbol from "@/components/ui/UiSymbol";
import { useEffect, useMemo, useState } from "react";

interface DraftPost {
  updatedAt?: string;
  creativeBrief?: CreativeBrief | null;
  creativeDevelopment?: CreativeDevelopment | null;
  id: string;
  postDate: string;
  platform: string;
  postType: string | null;
  category: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  contentIdea: string | null;
  cta: string | null;
  hashtags: string | null;
}

interface Generation extends DraftPost {
  generationNumber: number;
  createdAt: string;
}

type EditableKey =
  | "hook"
  | "script"
  | "caption"
  | "contentIdea"
  | "cta"
  | "hashtags";

const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "X", "LINKEDIN"];

const PLATFORM_META: Record<string, { label: string; mark: string }> = {
  INSTAGRAM: { label: "Instagram", mark: "IG" },
  TIKTOK: { label: "TikTok", mark: "TK" },
  YOUTUBE: { label: "YouTube", mark: "YT" },
  FACEBOOK: { label: "Facebook", mark: "FB" },
  X: { label: "X", mark: "X" },
  LINKEDIN: { label: "LinkedIn", mark: "IN" },
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function snapshot(draft: DraftPost): DraftPost {
  return { ...draft };
}

export default function AiDraftReviewModal({
  calendarId,
  jobId = null,
  onClose,
}: {
  calendarId: string;
  jobId?: string | null;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<DraftPost[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [generationIndex, setGenerationIndex] = useState(-1);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jobStatus, setJobStatus] = useState<"PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | null>(jobId ? "RUNNING" : null);
  const [jobProgress, setJobProgress] = useState<{ inProgress?: boolean; completedCount?: number; totalCount?: number } | null>(null);

  const selected = useMemo(
    () => drafts?.find((draft) => draft.id === selectedId) ?? null,
    [drafts, selectedId]
  );

  const selectedGeneration = generationIndex >= 0 ? generations[generationIndex] : null;

  async function readJson(res: Response) {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  async function loadDrafts(silent = false) {
    try {
      if (!silent) setError(null);
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts`, {
        cache: "no-store",
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load drafts");

      const incoming: DraftPost[] = data.drafts ?? [];
      setDrafts((current) => {
        if (!current || current.length === 0) return incoming;
        const currentIds = new Set(current.map((d) => d.id));
        const newItems = incoming.filter((d) => !currentIds.has(d.id));
        if (newItems.length === 0) return current;
        return [...current, ...newItems];
      });
      if (incoming.length) {
        setSelectedId((current: string | null) => current ?? incoming[0].id);
      }
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Failed to load drafts");
    }
  }

  async function loadGenerations(postId: string) {
    try {
      setError(null);
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts/${postId}`, {
        cache: "no-store",
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load generation history");

      const history = (data.generations ?? []) as Generation[];
      setGenerations(history);
      setGenerationIndex(history.length ? history.length - 1 : -1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load generation history");
    }
  }

  useEffect(() => {
    loadDrafts();
  }, []);

  // Poll for background generation progress and stream new drafts
  useEffect(() => {
    if (!jobId || jobStatus === "COMPLETED" || jobStatus === "FAILED") return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/calendars/${encodeURIComponent(calendarId)}/ai-generate/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.status === 200 || data.status === "COMPLETED") {
          setJobStatus("COMPLETED");
          await loadDrafts(true);
          return;
        }

        if (res.status === 202) {
          setJobStatus("RUNNING");
          if (data.progress) {
            setJobProgress(data.progress);
          }
          await loadDrafts(true);
        } else if (res.status >= 400) {
          setJobStatus("FAILED");
          if (data.error) setError(data.error);
        }
      } catch {
        // Soft network failure; keep polling
      }
    };

    const interval = setInterval(poll, 2500);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [calendarId, jobId, jobStatus]);

  useEffect(() => {
    if (selectedId) loadGenerations(selectedId);
  }, [selectedId]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
  void discardAllDrafts();
}
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function updateField(field: EditableKey, value: string) {
    if (!selected) return;
    setDrafts((current) =>
      current?.map((draft) => (draft.id === selected.id ? { ...draft, [field]: value } : draft)) ?? null
    );
  }

  async function saveEdits() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
  hook: selected.hook,
  script: selected.script,
  caption: selected.caption,
  contentIdea: selected.contentIdea,
  cta: selected.cta,
  hashtags: selected.hashtags,
  postDate: selected.postDate,
}),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to save edits");
      setError(null);
      await loadGenerations(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save edits");
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to regenerate");

      const generation = data.generation as Generation;

      setDrafts((current) =>
        current?.map((draft) =>
          draft.id === selected.id
            ? {
                ...draft,
                postDate: generation.postDate,
                platform: generation.platform,
                postType: generation.postType,
                category: generation.category,
                hook: generation.hook,
                script: generation.script,
                caption: generation.caption,
                contentIdea: generation.contentIdea,
                cta: generation.cta,
                hashtags: generation.hashtags,
              }
            : draft
        ) ?? null
      );

      setInstruction("");
      await loadGenerations(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setBusy(false);
    }
  }

  async function restoreGeneration(generation: Generation) {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: generation.id }),
      });

      // The route above is intentionally the regeneration endpoint in this
      // example; restore uses the dedicated /restore endpoint below.
      if (!res.ok) throw new Error("Failed to restore generation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore generation");
    } finally {
      setSaving(false);
    }
  }

  async function restore(generation: Generation) {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const res = await calendarMutationFetch(
        `/api/calendars/${calendarId}/ai-drafts/${selected.id}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generationId: generation.id }),
        }
      );
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to restore generation");

      setDrafts((current) =>
        current?.map((draft) =>
          draft.id === selected.id ? { ...draft, ...data.post, postDate: data.post.postDate } : draft
        ) ?? null
      );
      await loadGenerations(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore generation");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDraft(id: string) {
    setSaving(true);
    try {
      const draft = drafts?.find((item) => item.id === id);
      if (!draft) return;

      const res = await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
  hook: draft.hook,
  script: draft.script,
  caption: draft.caption,
  contentIdea: draft.contentIdea,
  cta: draft.cta,
  hashtags: draft.hashtags,
  postDate: draft.postDate,
}),
      });

      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to confirm draft");

      setDrafts((current) => current?.filter((item) => item.id !== id) ?? null);
      setSelectedId((current) => {
        if (current !== id) return current;
        const remaining = drafts?.filter((item) => item.id !== id) ?? [];
        return remaining[0]?.id ?? null;
      });
      window.dispatchEvent(new Event("showwork-calendar-posts-sync"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm draft");
    } finally {
      setSaving(false);
    }
  }

  async function discardDraft(id: string) {
    setSaving(true);
    try {
      const res = await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts/${id}`, {
        method: "DELETE",
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to discard draft");

      setDrafts((current) => current?.filter((item) => item.id !== id) ?? null);
      setSelectedId((current) => {
        if (current !== id) return current;
        const remaining = drafts?.filter((item) => item.id !== id) ?? [];
        return remaining[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discard draft");
    } finally {
      setSaving(false);
    }
  }

  async function discardAllDrafts() {
  if (!drafts?.length || saving) {
    onClose();
    return;
  }

  const confirmed = window.confirm(
    `Remove all ${drafts.length} AI drafts?\n\nThese drafts will be deleted and will not be added to your calendar.`
  );

  if (!confirmed) return;

  setSaving(true);
  setError(null);

  try {
    const res = await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts`, {
      method: "DELETE",
    });

    const data = await readJson(res);

    if (!res.ok) {
      throw new Error(data.error ?? "Failed to remove all drafts");
    }

    setDrafts([]);
    setSelectedId(null);
    setGenerations([]);
    setGenerationIndex(-1);

    onClose();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to remove all drafts"
    );
  } finally {
    setSaving(false);
  }
}

  async function confirmAll() {
    if (!drafts?.length || saving) return;

    setSaving(true);
    try {
      for (const draft of drafts) {
        const res = await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
  hook: draft.hook,
  script: draft.script,
  caption: draft.caption,
  contentIdea: draft.contentIdea,
  cta: draft.cta,
  hashtags: draft.hashtags,
  postDate: draft.postDate,
}),
        });
        const data = await readJson(res);
        if (!res.ok) throw new Error(data.error ?? `Failed to confirm ${draft.id}`);
      }

      setDrafts([]);
      window.dispatchEvent(new Event("showwork-calendar-posts-sync"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm all drafts");
    } finally {
      setSaving(false);
    }
  }

  if (drafts === null) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07101C]/90 p-4">
        <div className="rounded-2xl border border-white/10 bg-[#0D1724] px-8 py-7 text-center text-white">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#4C9BFF]" />
          <p className="text-sm font-semibold">Opening your AI studio…</p>
        </div>
      </div>
    );
  }

  const remaining = drafts.length;
  const progress = remaining ? Math.round(((remaining - 1) / Math.max(1, remaining)) * 100) : 100;
  const meta = selected ? PLATFORM_META[selected.platform] ?? { label: selected.platform, mark: "•" } : null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#07101C]/80 backdrop-blur-md"
      onMouseDown={(e) => {
  if (e.target === e.currentTarget) {
    void discardAllDrafts();
  }
}}
    >
      <div className="mx-auto flex h-[100dvh] w-full max-w-[1440px] flex-col overflow-hidden bg-[#F5F7FB] shadow-2xl lg:my-6 lg:h-[calc(100dvh-48px)] lg:rounded-[28px]">
        <header className="flex shrink-0 items-center justify-between border-b border-[#E4E9F1] bg-white px-5 py-4 lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#2478FF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2478FF]" />
              Showwork AI Studio
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#101828]">
              Review your content
            </h1>
            <p className="mt-1 text-xs text-[#667085]">
              Refine every post until it feels ready to publish.
            </p>
          </div>

          <button
            onClick={() => void discardAllDrafts()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E9F1] bg-white text-xl text-[#667085] hover:bg-[#F5F7FB]"
            aria-label="Close AI Studio"
          >
            ×
          </button>
        </header>

               {/* Mobile draft navigation + bulk action */}
        <div className="sticky top-0 z-30 shrink-0 border-b border-[#E4E9F1] bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!drafts.length || !selectedId) return;
                const index = drafts.findIndex((draft) => draft.id === selectedId);
                if (index > 0) setSelectedId(drafts[index - 1].id);
              }}
              disabled={
                !drafts.length ||
                !selectedId ||
                drafts.findIndex((draft) => draft.id === selectedId) <= 0
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DDE3EB] bg-white text-[#344054] shadow-sm transition hover:bg-[#F7F9FC] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Previous draft"
            ><UiSymbol name="left" /></button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">
                  AI draft queue
                </p>

                <span className="shrink-0 text-[10px] font-semibold text-[#667085]">
                  {selectedId
                    ? `${Math.max(
                        1,
                        drafts.findIndex((draft) => draft.id === selectedId) + 1
                      )} of ${drafts.length}`
                    : `0 of ${drafts.length}`}
                </span>
              </div>

              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {drafts.map((draft, index) => {
                  const draftMeta =
                    PLATFORM_META[draft.platform] ?? {
                      label: draft.platform,
                      mark: "•",
                    };

                  const active = draft.id === selectedId;

                  return (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => setSelectedId(draft.id)}
                      className={[
                        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[9px] font-bold transition-all",
                        active
                          ? "border-[#2478FF] bg-[#2478FF] text-white shadow-[0_5px_14px_rgba(36,120,255,0.18)]"
                          : "border-[#E4E9F1] bg-[#F8FAFC] text-[#667085]",
                      ].join(" ")}
                      aria-label={`Open draft ${index + 1}`}
                      aria-current={active ? "true" : undefined}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-black/10 text-[8px]">
                        {draftMeta.mark}
                      </span>
                      <span>#{index + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!drafts.length || !selectedId) return;

                const index = drafts.findIndex(
                  (draft) => draft.id === selectedId
                );

                if (index < drafts.length - 1) {
                  setSelectedId(drafts[index + 1].id);
                }
              }}
              disabled={
                !drafts.length ||
                !selectedId ||
                drafts.findIndex((draft) => draft.id === selectedId) >=
                  drafts.length - 1
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DDE3EB] bg-white text-[#344054] shadow-sm transition hover:bg-[#F7F9FC] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next draft"
            ><UiSymbol name="right" /></button>
          </div>

          {/* Mobile bulk confirmation */}
          {drafts.length > 0 && (
            <div className="mt-3 border-t border-[#EEF2F6] pt-3">
              <button
                type="button"
                onClick={confirmAll}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#101828] px-4 py-3 text-xs font-bold text-white shadow-[0_8px_20px_rgba(16,24,40,0.12)] transition hover:bg-[#1D2939] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {saving
                    ? "Confirming drafts…"
                    : `Confirm all ${drafts.length} drafts`}
                </span>
                {!saving && (
                  <span className="text-white/50"><><UiSymbol name="right" /></></span>
                )}
              </button>
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[310px] shrink-0 border-r border-[#E4E9F1] bg-white lg:flex lg:flex-col">
            <div className="border-b border-[#EEF2F6] px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#101828]">Draft queue</span>
                <div className="flex items-center gap-1.5">
                  {jobStatus === "RUNNING" && (
                    <span className="flex items-center gap-1 rounded-full bg-[#EBF3FF] px-2 py-0.5 text-[9px] font-bold text-[#2478FF]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2478FF]" />
                      Generating
                    </span>
                  )}
                  <span className="rounded-full bg-[#EEF5FF] px-2 py-1 text-[10px] font-bold text-[#2478FF]">
                    {remaining}
                  </span>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEF2F6]">
                <div
                  className="h-full rounded-full bg-[#2478FF] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {jobStatus === "RUNNING" && (
                <p className="mt-2 text-[10px] text-[#667085]">
                  {jobProgress?.completedCount && jobProgress.totalCount
                    ? `Generated ${jobProgress.completedCount} of ${jobProgress.totalCount} drafts…`
                    : "Drafts are streaming in live…"}
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {drafts.map((draft, index) => {
                const active = draft.id === selectedId;
                const draftMeta = PLATFORM_META[draft.platform] ?? { label: draft.platform, mark: "•" };

                return (
                  <button
                    key={draft.id}
                    onClick={() => setSelectedId(draft.id)}
                    className={`mb-2 w-full rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-[#2478FF]/30 bg-[#F1F6FF]"
                        : "border-transparent bg-white hover:border-[#E4E9F1] hover:bg-[#FAFBFD]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#101828] text-[9px] font-bold text-white">
                        {draftMeta.mark}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#667085]">
                          {draftMeta.label}
                        </p>
                        <p className="text-xs font-semibold text-[#101828]">
                          {formatDate(draft.postDate)}
                        </p>
                      </div>
                      <span className="ml-auto text-[10px] text-[#98A2B3]">#{index + 1}</span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-[#667085]">
                      {draft.creativeBrief?.title || draft.caption || "No caption yet"}
                    </p>
                  </button>
                );
              })}
            </div>

           {remaining > 0 && (
  <div className="border-t border-[#EEF2F6] p-4">
    <button
      onClick={confirmAll}
      disabled={saving}
      className="w-full rounded-xl bg-[#101828] px-4 py-3 text-xs font-bold text-white hover:bg-[#1D2939] disabled:opacity-50"
    >
      {saving ? "Saving…" : `Confirm all ${remaining} drafts`}
    </button>

    <button
      type="button"
      onClick={() => void discardAllDrafts()}
      disabled={saving}
      className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Remove all drafts
    </button>
  </div>
)}
          </aside>

          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            {error && (
              <div className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 lg:mx-8">
                {error}
                {/upgrade|allowance|quota|subscription|trial.*(ended|expired)/i.test(error) && <WorkspaceFeatureNotice compact message="Your current plan or allowance does not cover this action. View plans to restore access or increase your limits." />}
              </div>
            )}

            {selected ? (
              <div className="mx-auto w-full max-w-[1120px] p-3 sm:p-5 lg:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#EEF5FF] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#2478FF]">
                    {meta?.label}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-[#667085] ring-1 ring-[#E4E9F1]">
                    {selected.postType || "Post"}
                  </span>
                  {selected.category && (
                    <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-[#667085] ring-1 ring-[#E4E9F1]">
                      {selected.category}
                    </span>
                  )}
                  <span className="ml-auto text-xs font-semibold text-[#667085]">
                    {formatDate(selected.postDate)}
                  </span>
                </div>

                <CreativeBriefEditor key={selected.id} calendarId={calendarId} post={{...selected}} onUpdated={post=>{setDrafts(current=>current?.map(d=>d.id===post.id?{...d,...post}:d)||null);void loadGenerations(post.id);}} />

                {generations.length > 0 && (
                  <section className="mt-5 rounded-[24px] border border-[#E1E7EF] bg-white p-5 lg:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
                          Version history
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-[#101828]">
                          Every AI generation is saved
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            setGenerationIndex((value) => Math.max(0, value - 1))
                          }
                          disabled={generationIndex <= 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E1E7EF] text-[#667085] disabled:opacity-30"
                        ><UiSymbol name="left" /></button>
                        <span className="px-2 text-[10px] font-bold text-[#667085]">
                          {generationIndex + 1} / {generations.length}
                        </span>
                        <button
                          onClick={() =>
                            setGenerationIndex((value) =>
                              Math.min(generations.length - 1, value + 1)
                            )
                          }
                          disabled={generationIndex >= generations.length - 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E1E7EF] text-[#667085] disabled:opacity-30"
                        ><UiSymbol name="right" /></button>
                      </div>
                    </div>

                    {selectedGeneration && (
                      <div className="mt-4 rounded-2xl bg-[#F7F9FC] p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#101828]">
                            Generation {selectedGeneration.generationNumber}
                          </span>
                          <button
                            onClick={() => restore(selectedGeneration)}
                            disabled={saving}
                            className="rounded-lg border border-[#D5E1F2] bg-white px-3 py-2 text-[10px] font-bold text-[#2478FF] hover:bg-[#F1F6FF] disabled:opacity-50"
                          >
                            Restore this version
                          </button>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-[#667085]">
                          {selectedGeneration.caption || "No caption"}
                        </p>
                      </div>
                    )}
                  </section>
                )}

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={() => discardDraft(selected.id)}
                    disabled={saving}
                    className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:w-auto"
                  >
                    Discard this post
                  </button>

                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
                    <button
                      onClick={() => confirmDraft(selected.id)}
                      disabled={saving}
                      className="w-full rounded-xl bg-[#101828] px-5 py-3 text-xs font-bold text-white hover:bg-[#1D2939] disabled:opacity-50 sm:w-auto"
                    >
                      Confirm & add to calendar
                    </button>
                  </div>
                </div>
              </div>
            ) : jobStatus === "RUNNING" && (!drafts || drafts.length === 0) ? (
              <div className="flex min-h-full items-center justify-center p-8 text-center">
                <div className="mx-auto max-w-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF5FF] text-[#2478FF] shadow-sm">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#2478FF]/30 border-t-[#2478FF]" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-[#101828]">Generating your content…</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#667085]">
                    The AI is planning and drafting posts based on your brand knowledge. Drafts will appear in the queue on the left as soon as they are ready.
                  </p>
                  {jobProgress?.totalCount ? (
                    <p className="mt-3 text-[11px] font-bold text-[#2478FF]">
                      Planning {jobProgress.totalCount} publishing slots…
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-full items-center justify-center p-8 text-center">
                <div>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF2FF] text-2xl text-[#2478FF]"><UiSymbol name="check" /></div>
                  <h2 className="mt-4 text-lg font-semibold text-[#101828]">All clear</h2>
                  <p className="mt-1 text-xs text-[#667085]">
                    Every AI draft has been reviewed.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-5 rounded-xl bg-[#101828] px-5 py-3 text-xs font-bold text-white"
                  >
                    Return to workspace
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
