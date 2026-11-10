"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import CreativeBriefEditor, {
  type BriefEditorPost,
  type BriefEditorState,
} from "./CreativeBriefEditor";
import PlatformBrandIcon from "./PlatformBrandIcon";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { editablePostBrief } from "@/lib/content/brief";
import {
  draftTitle,
  mergeDraftSnapshots,
  reviewDraftBatch,
} from "@/lib/content/draftReview";
import styles from "./DraftReview.module.css";
type Draft = BriefEditorPost & {
  postDate: string;
  postType: string | null;
  contentIdea: string | null;
  hook: string | null;
  caption: string | null;
  category?: string | null;
};
type Generation = Draft & { generationNumber: number; createdAt: string };
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Error(body.error || "Could not complete this action. Try again.");
  return body;
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
  const router = useRouter();
  const openCalendar = () => {
    onClose();
    router.push(`/dashboard/calendars/${encodeURIComponent(calendarId)}?view=content`);
    router.refresh();
  };
  const [reviewStep, setReviewStep] = useState("copy");
  const dialog = useRef<HTMLDialogElement>(null),
    content = useRef<HTMLDivElement>(null),
    removed = useRef(new Set<string>()),
    loadVersion = useRef(0),
    historyVersion = useRef(0),
    alive = useRef(true);
  const [drafts, setDrafts] = useState<Draft[] | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [reviewed, setReviewed] = useState<string[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [jobRunning, setJobRunning] = useState(Boolean(jobId)),
    [progress, setProgress] = useState({ completedCount: 0, totalCount: 0 }),
    [history, setHistory] = useState<Generation[]>([]),
    [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => { setReviewStep("copy"); }, [selectedId]);
  const [editorState, setEditorState] = useState<BriefEditorState>({
    dirty: false,
    busy: false,
    needsContext: false,
  });
  const stateRef = useRef(editorState);
  stateRef.current = editorState;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const saveAction = useRef<(() => void) | null>(null);
  const onSaveReady = useCallback((save: (() => void) | null) => {
    saveAction.current = save;
  }, []);
  const onEditorState = useCallback(
    (state: BriefEditorState) => setEditorState(state),
    [],
  );
  const [tabBarHost, setTabBarHost] = useState<HTMLDivElement | null>(null);
  const selected = drafts?.find((row) => row.id === selectedId) ?? null;
  const locked = busy || editorState.busy;
  const confirmNavigation = () =>
    !stateRef.current.dirty ||
    window.confirm("Discard your unsaved changes? Saved drafts will be kept.");
  const requestClose = useCallback(() => {
    if (busyRef.current || stateRef.current.busy) return;
    if (
      !stateRef.current.dirty ||
      window.confirm(
        "Close without saving your latest edits? Your saved drafts will be kept.",
      )
    )
      onClose();
  }, [onClose]);
  const loadDrafts = useCallback(async () => {
    const version = ++loadVersion.current;
    const data = await json(
      await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts`, {
        cache: "no-store",
      }),
    );
    if (!alive.current || version !== loadVersion.current) return;
    const incoming = (data.drafts || []) as Draft[];
    if (
      stateRef.current.dirty &&
      selectedIdRef.current &&
      !incoming.some((row) => row.id === selectedIdRef.current)
    ) {
      setNotice(
        "This draft changed outside this review. Your unsaved edits are kept here; save or copy them before refreshing.",
      );
      return;
    }
    setDrafts((current) =>
      mergeDraftSnapshots(current || [], incoming, removed.current),
    );
    setSelectedId((current) =>
      current &&
      incoming.some((row) => row.id === current && !removed.current.has(row.id))
        ? current
        : (incoming.find((row) => !removed.current.has(row.id))?.id ?? null),
    );
  }, [calendarId]);
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void loadDrafts().catch((e) => setError(e.message));
    return () => {
      alive.current = false;
      loadVersion.current++;
      historyVersion.current++;
      document.body.style.overflow = previous;
    };
  }, [loadDrafts]);
  useEffect(() => {
    if (!jobId) return;
    setJobRunning(true);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(
          `/api/calendars/${encodeURIComponent(calendarId)}/ai-generate/${encodeURIComponent(jobId!)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (cancelled) return;
        if (response.status === 200 || data.status === "COMPLETED") {
          await loadDrafts();
          if (!cancelled) {
            setJobRunning(false);
            setNotice("Generation complete. Your drafts are ready to review.");
          }
          return;
        }
        if (response.status >= 400) {
          setJobRunning(false);
          setError(
            data.error ||
              "Generation stopped. Your saved drafts are still available.",
          );
          await loadDrafts();
          return;
        }
        if (data.progress) setProgress(data.progress);
      } catch {
        if (!cancelled)
          setNotice("Connection interrupted. Retrying generation status…");
      }
      if (!cancelled) timer = setTimeout(poll, 2500);
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [calendarId, jobId, loadDrafts]);
  useEffect(() => {
    setHistory([]);
    historyVersion.current++;
    setHistoryLoading(false);
    setEditorState({ dirty: false, busy: false, needsContext: false });
    content.current?.scrollTo({ top: 0 });
  }, [selectedId]);
  function choose(id: string) {
    if (locked || id === selectedId || !confirmNavigation()) return;
    setSelectedId(id);
    setError("");
    setNotice("");
  }
  function updated(post: Draft) {
    setDrafts(
      (current) =>
        current?.map((row) =>
          row.id === post.id ? { ...row, ...post } : row,
        ) || null,
    );
  }
  function finished(id: string) {
    removed.current.add(id);
    setReviewed((current) =>
      current.includes(id) ? current : [...current, id],
    );
    setDrafts((current) => current?.filter((row) => row.id !== id) || []);
    window.dispatchEvent(new Event("showwork-calendar-posts-sync"));
  }
  async function confirm(id: string) {
    await json(
      await calendarMutationFetch(
        `/api/calendars/${calendarId}/ai-drafts/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      ),
    );
  }
  async function markReviewed() {
    if (!selected || locked || editorState.dirty || editorState.needsContext)
      return;
    setBusy(true);
    setError("");
    try {
      await confirm(selected.id);
      finished(selected.id);
      const index = drafts!.findIndex((row) => row.id === selected.id);
      setSelectedId(
        drafts?.[index + 1]?.id ??
          drafts?.find((row) => row.id !== selected.id)?.id ??
          null,
      );
      setNotice("Post reviewed and added to your calendar. It has not been published.");
      setReviewStep("copy");
      if (drafts?.length === 1 && !jobRunning) openCalendar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reviewAll() {
    if (locked || jobRunning || !drafts?.length || editorState.dirty) return;
    if (
      drafts.some((row) => {
        const brief = editablePostBrief(row);
        return (
          !brief.hook.trim() ||
          !brief.objective.trim() ||
          !brief.targetAudience.trim()
        );
      })
    ) {
      setError(
        "Complete the missing strategy fields before reviewing all drafts.",
      );
      return;
    }
    if (
      !window.confirm(
        `Add all ${drafts.length} posts and open your Content Calendar? This does not publish them.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    const ids = drafts.map((row) => row.id);
    try {
      const failures = await reviewDraftBatch(ids, confirm, finished);
      if (failures.length) {
        setError(
          `${ids.length - failures.length} reviewed; ${failures.length} still need attention. ${failures[0].message}`,
        );
        setSelectedId(failures[0].id);
      } else {
        setSelectedId(null);
        setNotice("All drafts accepted and added to your calendar. Nothing has been published.");
        openCalendar();
      }
    } finally {
      setBusy(false);
    }
  }
  async function discardAll() {
    if (locked || jobRunning || !drafts?.length || !confirmNavigation()) return;
    if (
      !window.confirm(
        `Permanently remove all ${drafts.length} saved drafts? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await json(
        await calendarMutationFetch(`/api/calendars/${calendarId}/ai-drafts`, {
          method: "DELETE",
        }),
      );
      drafts.forEach((row) => removed.current.add(row.id));
      setDrafts([]);
      setSelectedId(null);
      setNotice("Drafts removed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadHistory() {
    if (!selected) return;
    const id = selected.id,
      version = ++historyVersion.current;
    setHistoryLoading(true);
    try {
      const data = await json(
        await calendarMutationFetch(
          `/api/calendars/${calendarId}/ai-drafts/${id}`,
          { cache: "no-store" },
        ),
      );
      if (
        alive.current &&
        version === historyVersion.current &&
        selectedIdRef.current === id
      )
        setHistory(data.generations || []);
    } catch (e) {
      if (version === historyVersion.current) setError((e as Error).message);
    } finally {
      if (version === historyVersion.current) setHistoryLoading(false);
    }
  }
  async function restore(generation: Generation) {
    if (
      !selected ||
      locked ||
      !confirmNavigation() ||
      !window.confirm(
        "Restore this saved version? Current saved content will be replaced.",
      )
    )
      return;
    setBusy(true);
    try {
      const data = await json(
        await calendarMutationFetch(
          `/api/calendars/${calendarId}/ai-drafts/${selected.id}/restore`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ generationId: generation.id }),
          },
        ),
      );
      updated(data.post);
      setNotice("Version restored.");
      await loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const remaining = drafts?.length || 0,
    total = remaining + reviewed.length,
    index = drafts?.findIndex((row) => row.id === selectedId) ?? -1;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="draft-review-title"
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className={styles.layout}>
        <header className={styles.header}>
          <div>
            <h1 id="draft-review-title">Review your drafts</h1>
            <p>Make it yours. Review it. Add it to your calendar.</p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${styles.primary} ${styles.addAllButton}`}
              disabled={locked || jobRunning || !remaining || editorState.dirty}
              title={editorState.dirty ? "Save your changes before adding all posts" : "Add all posts and open Content Calendar. Nothing is published."}
              onClick={() => void reviewAll()}
            >
              <Check size={16} />
              Add all posts to calendar
            </button>
            <button
              type="button"
              disabled={locked || jobRunning || !remaining}
              className={styles.discardButton}
              onClick={() => void discardAll()}
            >
              <Trash2 size={16} aria-hidden="true" />
              Discard all drafts
            </button>
            <button
              type="button"
              className={styles.iconButton}
              disabled={locked}
              onClick={requestClose}
              aria-label="Close review and keep saved drafts"
            >
              <X size={19} />
            </button>
          </div>
        </header>
        <div className={styles.mobilePicker}>
          <span>{remaining ? `${index + 1} of ${remaining}` : "Drafts"}</span>
          <select
            aria-label="Choose a draft"
            disabled={locked || !remaining}
            value={selectedId || ""}
            onChange={(event) => choose(event.target.value)}
          >
            {!remaining && (
              <option value="">
                {jobRunning ? "Preparing drafts…" : "Review complete"}
              </option>
            )}
            {drafts?.map((row) => (
              <option key={row.id} value={row.id}>
                {draftTitle(row)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.body}>
          <aside className={styles.queue} aria-label="Draft queue">
            <div className={styles.queueHeading}>
              Your drafts
              <p aria-live="polite">
                {reviewed.length} reviewed · {remaining} to go
              </p>
              <div
                className={styles.progress}
                role="progressbar"
                aria-label="Drafts reviewed in this session"
                aria-valuenow={reviewed.length}
                aria-valuemin={0}
                aria-valuemax={Math.max(1, total)}
              >
                <span
                  style={{
                    width: `${total ? (reviewed.length / total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className={styles.queueList}>
              {drafts?.map((row) => (
                <button
                  type="button"
                  disabled={locked}
                  key={row.id}
                  aria-current={row.id === selectedId ? "page" : undefined}
                  className={styles.queueItem}
                  onClick={() => choose(row.id)}
                >
                  <span className={styles.queueMark}>
                    <PlatformBrandIcon platform={row.platform} size={16} />
                  </span>
                  <span>
                    <strong>{draftTitle(row)}</strong>
                    <small>
                      {date(row.postDate)} · {row.postType || "Post"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <div className={styles.queueFooter}>
              <button
                type="button"
                disabled={locked || editorState.dirty}
                onClick={() =>
                  void loadDrafts().catch((e) => setError(e.message))
                }
              >
                Refresh drafts
              </button>
            </div>
          </aside>
          <div className={styles.reviewPane}>
            <div className={styles.reviewStepHeading}>Explore this post <span>Click any section</span></div>
            <div className={styles.tabBarHost} ref={setTabBarHost} />
          <div className={styles.content} ref={content}>
            <div className={styles.editorWrap}>
              {error && (
                <div role="alert" className={styles.error}>
                  {error}
                  <button
                    type="button"
                    disabled={locked || editorState.dirty}
                    onClick={() =>
                      void loadDrafts()
                        .then(() => setError(""))
                        .catch((e) => setError(e.message))
                    }
                    className="ml-3 underline"
                  >
                    Refresh drafts
                  </button>
                </div>
              )}
              {notice && (
                <p role="status" className={styles.notice}>
                  {notice}
                </p>
              )}
              {jobRunning && (
                <p role="status" className={styles.notice}>
                  <Loader2 size={14} className="mr-2 inline animate-spin" />
                  {progress.totalCount
                    ? `Preparing ${progress.completedCount} of ${progress.totalCount} drafts. `
                    : "Preparing your drafts. "}
                  They will appear after quality checks. You can close this
                  window and return.
                </p>
              )}
              {selected ? (
                <>
                  <div className={styles.metadata}>
                    <PlatformBrandIcon platform={selected.platform} size={17} />
                    <strong>
                      {selected.platform.charAt(0) +
                        selected.platform.slice(1).toLowerCase()}
                    </strong>
                    <span>
                      ·{" "}
                      {selected.creativeBrief?.format ||
                        selected.postType ||
                        "Post"}
                    </span>
                    <time dateTime={selected.postDate}>
                      {date(selected.postDate)}
                    </time>
                  </div>
                  <CreativeBriefEditor
                    key={selected.id}
                    calendarId={calendarId}
                    tabBarHost={tabBarHost}
                    reviewStep={reviewStep}
                    onReviewStepChange={step => { setReviewStep(step); content.current?.scrollTo({top:0}); }}
                    post={selected}
                    onStateChange={onEditorState}
                    onSaveReady={onSaveReady}
                    onUpdated={updated}
                  />
                  <details
                    key={`${selected.id}-history`}
                    className={styles.history}
                    onToggle={(event) => {
                      if (event.currentTarget.open) void loadHistory();
                    }}
                  >
                    <summary>Version history</summary>
                    {historyLoading ? (
                      <p className="py-4">Loading versions…</p>
                    ) : (
                      history.map((generation, i) => (
                        <article key={generation.id}>
                          <span>
                            Version {generation.generationNumber} ·{" "}
                            {date(generation.createdAt)}
                          </span>
                          <button
                            disabled={locked || i === history.length - 1}
                            className={styles.button}
                            onClick={() => void restore(generation)}
                          >
                            Restore
                          </button>
                        </article>
                      ))
                    )}
                  </details>
                </>
              ) : (
                <div className={styles.empty}>
                  {drafts === null && !error ? (
                    <>
                      <Loader2 className="mx-auto animate-spin" />
                      <h2>Opening your drafts…</h2>
                    </>
                  ) : drafts === null ? (
                    <>
                      <h2>Couldn’t open your drafts.</h2>
                      <p>
                        Your saved content is kept. Use Refresh drafts above to
                        try again.
                      </p>
                    </>
                  ) : busy ? (
                    <>
                      <Loader2 className="mx-auto animate-spin" />
                      <h2>Reviewing your saved drafts…</h2>
                      <p>
                        {reviewed.length} reviewed so far. Successful posts are
                        kept if another needs attention.
                      </p>
                    </>
                  ) : jobRunning ? (
                    <>
                      <Loader2 className="mx-auto animate-spin" />
                      <h2>Your content is on its way.</h2>
                      <p>
                        We’re preparing complete drafts with their strategy and
                        creative direction.
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        className="mx-auto text-blue-500"
                        size={35}
                      />
                      <h2>
                        {reviewed.length
                          ? "You’re all caught up."
                          : "No drafts to review."}
                      </h2>
                      <p>
                        {reviewed.length
                          ? `${reviewed.length} posts added to your calendar. They have not been published.`
                          : "Your saved content stays in your workspace."}
                      </p>
                      <button className={styles.primary} onClick={openCalendar}>
                        Return to calendar
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
        <footer className={styles.footer}>
          <span role="status" className={styles.saveState}>
            {locked ? (
              <Loader2 size={14} className="animate-spin" />
            ) : editorState.dirty ? null : (
              <Check size={14} />
            )}{" "}
            {busy
              ? `Reviewing drafts… ${reviewed.length} reviewed`
              : editorState.busy
                ? "Saving your update…"
                : editorState.dirty
                  ? "Unsaved changes · save before continuing"
                  : selected && editorState.needsContext
                    ? "Strategy needs attention · you can browse other posts"
                    : "Saved drafts are kept when you close"}
          </span>
          <div className={`${styles.actions} ${styles.postNavigation}`}>
            <button type="button" className={styles.button} disabled={locked || index <= 0} onClick={() => choose(drafts![index - 1].id)}><ArrowLeft size={15} aria-hidden="true"/>Previous post</button>
            <button type="button" className={`${styles.button} ${styles.nextPost}`} disabled={locked || index < 0 || index >= remaining - 1} onClick={() => choose(drafts![index + 1].id)}>
              <span><strong>Next post</strong><small>{drafts?.[index + 1] ? draftTitle(drafts[index + 1]) : "You’re on the last post"}</small></span><ArrowRight size={16} aria-hidden="true"/>
            </button>
            <button type="button" className={`${styles.primary} ${styles.acceptPost}`} disabled={!selected || locked || (!editorState.dirty && editorState.needsContext)} onClick={() => editorState.dirty ? saveAction.current?.() : void markReviewed()}>
              {editorState.dirty ? "Save changes" : remaining === 1 && !jobRunning ? "Add post & open calendar" : "Add post to calendar"}<Check size={15} aria-hidden="true"/>
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
