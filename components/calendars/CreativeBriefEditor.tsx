"use client";
import {
  useEffect,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from "react";
import { Sparkles, Check, Copy, Pencil, Save, Loader2, FileText, Target, Palette, X } from "lucide-react";
import styles from "./CreativeBriefEditor.module.css";
import { createPortal } from "react-dom";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import {
  reconcileBrief,
  editablePostBrief,
  BRIEF_FIELDS,
  EXECUTION_KINDS,
  FORMATS,
  platformBriefFormats,
  briefSnapshot,
  type BriefField,
  type CreativeBrief,
  type CreativeDevelopment,
  type ExecutionKind,
} from "@/lib/content/brief";
export interface BriefEditorPost {
  id: string;
  updatedAt?: string;
  platform: string;
  creativeBrief?: CreativeBrief | null;
  creativeDevelopment?: CreativeDevelopment | null;
  caption?: string | null;
  script?: string | null;
  hashtags?: string | null;
  [key: string]: unknown;
}
const LABELS: Record<BriefField, string> = {
  title: "Content title",
  hook: "Hook",
  caption: "Caption",
  hashtags: "Hashtags",
  objective: "Objective",
  targetAudience: "Target Audience",
  coreIdea: "The core idea",
  keyMessage: "Key message",
  creativeDirection: "Creative direction",
  desiredResponse: "Desired audience response",
  brandConnection: "Brand connection",
  suggestedCta: "Call to Action",
  pillar: "Content pillar",
};
const TOOLS: Record<ExecutionKind, string> = {
  script: "Script",
  caption: "Caption",
  carouselOutline: "Carousel structure",
  visualApproaches: "Visual approaches",
  productionNotes: "Production notes",
  hashtags: "Hashtags",
};
// Expand with the actual copy instead of trapping long briefs in a tiny scroll box.
export function GrowingTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      if (!element.getClientRects().length) return;
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    };
    fit();
    let width = element.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = element.getBoundingClientRect().width;
      if (nextWidth !== width) {
        width = nextWidth;
        fit();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={ref} />;
}
const HELP: Partial<Record<BriefField, string>> = {
  hook: "The opening that earns attention.",
  objective: "What this post should achieve.",
  targetAudience: "Who this idea is speaking to, and why it matters to them.",
  caption: "Your audience-facing copy. Use a blank line between paragraphs.",
  creativeDirection:
    "The concept, the feeling and the creative possibilities. Give each thought room.",
  suggestedCta: "One clear next step for your audience.",
  hashtags: "Relevant tags, ready to use.",
};
export type BriefEditorState = {
  dirty: boolean;
  busy: boolean;
  needsContext: boolean;
};
export default function CreativeBriefEditor({
  calendarId,
  post,
  onUpdated,
  onStateChange,
  onSaveReady,
  tabBarHost,
  aiControlsHost,
  reviewStep,
  onReviewStepChange,
  guided = false,
  guidedSection,
  readOnly = false,
}: {
  calendarId: string;
  post: BriefEditorPost;
  onUpdated: (post: any) => void;
  tabBarHost?: HTMLElement | null;
  aiControlsHost?: HTMLElement | null;
  reviewStep?: string;
  onReviewStepChange?: (step: string) => void;
  guided?: boolean;
  guidedSection?: "copy" | "brief";
  readOnly?: boolean;
  onStateChange?: (state: BriefEditorState) => void;
  onSaveReady?: (save: (() => void) | null) => void;
}) {
  const aiMenuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!aiControlsHost) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !aiMenuRef.current?.contains(event.target) && aiMenuRef.current) aiMenuRef.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [aiControlsHost]);
  const [brief, setBrief] = useState(() => editablePostBrief(post));
  const incomingBrief = editablePostBrief(post);
  const previousServerBrief = useRef(incomingBrief);
  const incomingSignature = JSON.stringify(incomingBrief);
  useEffect(() => {
    const previous = previousServerBrief.current;
    previousServerBrief.current = incomingBrief;
    setBrief((current) => reconcileBrief(current, previous, incomingBrief));
  }, [post.id, incomingSignature]);
  const [text, setText] = useState<Partial<Record<ExecutionKind, string>>>(() =>
    Object.fromEntries(
      EXECUTION_KINDS.map((kind) => [
        kind,
        post.creativeDevelopment?.[kind]?.text ||
          (["script", "caption", "hashtags"].includes(kind)
            ? String(post[kind] || "")
            : ""),
      ]),
    ),
  );
  const [editing, setEditing] = useState<{ kind: "brief" | ExecutionKind; name: string; original: string } | null>(null);
  const actionToFocus = useRef<string | null>(null);
  const [copiedField, setCopiedField] = useState("");
  useEffect(() => {
    if (!editing && actionToFocus.current) {
      document.getElementById(actionToFocus.current)?.focus();
      actionToFocus.current = null;
    }
  }, [editing]);
  useEffect(() => {
    if (!copiedField) return;
    const timer = window.setTimeout(() => setCopiedField(""), 1700);
    return () => window.clearTimeout(timer);
  }, [copiedField]);
  const [dirtyKinds, setDirtyKinds] = useState<string[]>([]);
  const developmentDirty = dirtyKinds.length > 0;
  const [active, setActive] = useState<ExecutionKind | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [instruction, setInstruction] = useState("");
  const [localTab, setLocalTab] = useState("copy");
  const tab = reviewStep ?? localTab;
  const setTab = (next: string) => { setLocalTab(next); onReviewStepChange?.(next); };
  const [aiField, setAiField] = useState<BriefField>("caption");
  const dirty =
    JSON.stringify(brief) !== JSON.stringify(editablePostBrief(post));
  const run = async (
    kind: "brief" | ExecutionKind,
    generate = false,
    field?: BriefField,
    fillMissing = false,
    section?: "strategy" | "creativeDirection",
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await calendarMutationFetch(
        `/api/calendars/${calendarId}/posts/${post.id}/creative`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            generate,
            field,
            instruction,
            fillMissing,
            section,
            expectedUpdatedAt: post.updatedAt,
            ...(kind === "brief" ? { brief } : { text: text[kind] || "" }),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Could not update this creative section.");
      if (kind === "brief") {
        const received = editablePostBrief(data.post);
        if (fillMissing && (!received.objective.trim() || !received.targetAudience.trim()))
          throw Error(
            "The server response is missing the saved objective or audience. Reload the post and retry completion.",
          );
        setBrief(received);
      } else {
        setText((previous) => ({
          ...previous,
          [kind]: data.post.creativeDevelopment?.[kind]?.text || "",
        }));
        setDirtyKinds((current) => current.filter((item) => item !== kind));
      }
      if (!generate && editing) {
        actionToFocus.current = `${post.id}-${editing.kind}-${editing.name}-edit`;
        setEditing(null);
      }
      onUpdated(data.post);
      setNotice(generate ? "Updated and saved." : "All changes saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    onSaveReady?.(
      () =>
        void (editing ? run(editing.kind, false, editing.kind === "brief" ? editing.name as BriefField : undefined) : run(dirty ? "brief" : (dirtyKinds[0] as ExecutionKind) || "brief")),
    );
    return () => onSaveReady?.(null);
  }, [
    brief,
    text,
    dirty,
    dirtyKinds,
    editing,
    busy,
    instruction,
    post.updatedAt,
    onSaveReady,
  ]);
  const missingContext = ["hook", "objective", "targetAudience"].some(
    (key) => !brief[key as BriefField]?.trim(),
  );
  const hasContent = !!(
    post.caption ||
    post.contentIdea ||
    post.hook ||
    post.script
  );
  useEffect(() => {
    onStateChange?.({
      dirty: dirty || developmentDirty,
      busy,
      needsContext: missingContext,
    });
  }, [dirty, developmentDirty, busy, missingContext, onStateChange]);
  const improveSection = (section: "strategy" | "creativeDirection", label: string) =>
    !readOnly && hasContent && (
      <button type="button" disabled={busy || dirty || developmentDirty || !!editing} onClick={() => void run("brief", true, undefined, false, section)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-600 disabled:opacity-40">
        <Sparkles size={15} aria-hidden="true" />{label}
      </button>
    );
  const renderTextContainer = (
    kind: "brief" | ExecutionKind, name: string, label: string, value: string, rows: number, maxLength: number,
    onChange: (next: string) => void, placeholder?: string,
  ) => {
    const id = `${post.id}-${kind}-${name}`;
    const isEditing = editing?.kind === kind && editing.name === name;
    function stopEditing() {
      if (!editing) return;
      onChange(editing.original);
      if (kind !== "brief") setDirtyKinds(current => current.filter(item => item !== kind));
      actionToFocus.current = `${id}-edit`;
      setEditing(null);
      setError("");
    }
    async function copy() {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedField(id);
      } catch {
        setError(`Could not copy ${label.toLowerCase()}. You can select and copy the text directly.`);
      }
    }
    return (
      <div key={name} className={styles.textContainer}>
        <div className={styles.textContainerHeader}>
          <label id={`${id}-label`} htmlFor={isEditing ? id : undefined}>{label}</label>
          <div className={styles.textContainerActions}>
            <button type="button" disabled={!value.trim()} onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`}>
              {copiedField === id ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              <span>{copiedField === id ? "Copied" : "Copy"}</span>
            </button>
            {!readOnly && (isEditing ? <>
              <button type="button" disabled={busy} onClick={() => void run(kind, false, kind === "brief" ? name as BriefField : undefined)} aria-label={`Save ${label.toLowerCase()}`}>
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                <span>{busy ? "Saving…" : "Save"}</span>
              </button>
              <button type="button" disabled={busy} onClick={stopEditing} aria-label={`Cancel editing ${label.toLowerCase()}`} title="Cancel edit">
                <X size={15} aria-hidden="true" />
              </button>
            </> : (
              <button id={`${id}-edit`} type="button" disabled={busy || !!editing || dirty || developmentDirty} onClick={() => { setError(""); setEditing({ kind, name, original: value }); }} aria-label={`Edit ${label.toLowerCase()}`}>
                <Pencil size={15} aria-hidden="true" /><span>Edit</span>
              </button>
            ))}
          </div>
        </div>
        {isEditing && !readOnly ? (
          <GrowingTextarea id={id} autoFocus disabled={busy} aria-labelledby={`${id}-label`} value={value}
            rows={rows} maxLength={maxLength} placeholder={placeholder} onChange={event => onChange(event.target.value)}
            onKeyDown={event => { if (event.key === "Escape" && !busy) { event.preventDefault(); event.stopPropagation(); stopEditing(); } }}
            className={styles.textContainerInput} />
        ) : (
          <div aria-labelledby={`${id}-label`} className={styles.textContainerValue}>
            {value || <span>{placeholder || "No text yet."}</span>}
          </div>
        )}
        {isEditing && name === "caption" && <span className="mt-1 block text-right text-[10px] text-slate-400">{value.length.toLocaleString()} / 5,000</span>}
        <span className="sr-only" role="status">{copiedField === id ? `${label} copied` : ""}</span>
      </div>
    );
  };
  const field = (name: BriefField, rows = 2) => renderTextContainer(
    "brief", name, LABELS[name], brief[name] || "", rows,
    name === "caption" ? 5000 : name === "creativeDirection" ? 1800 : 800,
    next => { setBrief(current => ({ ...current, [name]: next })); setNotice(""); },
    name === "objective" ? "What should this post achieve?" : name === "targetAudience" ? "Who is this post for?" : undefined,
  );
  const tabs = [
    { id: "copy", label: "Post copy", icon: FileText },
    { id: "strategy", label: "Strategy", icon: Target },
    { id: "creative", label: "Creative direction", icon: Palette },
  ];
  const tabBar = (
      <div
        role="tablist"
        aria-label="Post editor sections"
        className={`${styles.tabs} ${reviewStep !== undefined ? styles.reviewSteps : ""}`}
      >
        {tabs.map((item, index) => (
          <button
            id={`${post.id}-tab-${item.id}`}
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`${post.id}-editor-panel`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={(event) => {
              setTab(item.id);
              event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
            }}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % 3
                  : event.key === "ArrowLeft"
                    ? (index + 2) % 3
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : null;
              if (next !== null) {
                event.preventDefault();
                setTab(tabs[next].id);
                document
                  .getElementById(`${post.id}-tab-${tabs[next].id}`)
                  ?.focus();
              }
            }}
            className={styles.tab}
          >
            <item.icon size={17} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>
  );
  const aiControls = (<>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles size={15} className="text-blue-500" />
          <select
            aria-label="Choose what AI should improve"
            value={aiField}
            onChange={(e) => setAiField(e.target.value as BriefField)}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs"
          >
            {BRIEF_FIELDS.map((name) => (
              <option key={name} value={name}>
                Rewrite {LABELS[name].toLowerCase()}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || dirty || missingContext || !!editing}
            onClick={() => void run("brief", true, aiField)}
            className="min-h-11 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-600 disabled:opacity-40"
          >
            {busy ? "Working…" : "Improve with AI"}
          </button>
          <details className="w-full text-xs text-slate-500">
            <summary className="cursor-pointer py-1">Add instructions</summary>
            <input
              aria-label="Creative revision guidance"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={3000}
              placeholder="e.g. Make the caption warmer and more direct"
              className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-[16px]"
            />
          </details>
        </div>
      )}
  </>);
  return (
    <div className={`min-w-0 space-y-5 ${guided ? styles.guided : ""}`}>
      {aiControlsHost && !readOnly && createPortal(<details ref={aiMenuRef} className={styles.headerAi} onKeyDown={event => { if(event.key === "Escape") { event.stopPropagation(); if(aiMenuRef.current) aiMenuRef.current.open = false; aiMenuRef.current?.querySelector("summary")?.focus(); } }}><summary aria-label="Edit with AI"><Sparkles size={16} aria-hidden="true"/><span>Edit with AI</span></summary><div className={styles.headerAiPanel}><strong>What would you like to improve?</strong>{aiControls}{dirty && <p>Save your changes before using AI.</p>}{missingContext && <p>Complete the post’s strategy to use these tools.</p>}</div></details>, aiControlsHost)}
      {!guided && (tabBarHost ? createPortal(tabBar, tabBarHost) : tabBar)}
      {!!brief.reviewWarnings?.length && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"
        >
          <p className="font-semibold">Needs editorial review</p>
          {brief.reviewWarnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {missingContext && !guided && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
          This draft needs its hook, objective or audience.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setTab("strategy")}
          >
            Complete strategy
          </button>
          {!readOnly && hasContent && (
            <button
              type="button"
              disabled={busy || !!editing || dirty || developmentDirty}
              onClick={() => void run("brief", true, undefined, true)}
              className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 font-semibold disabled:opacity-40"
            >
              <Sparkles size={14} />
              {busy
                ? "Completing strategy…"
                : "Complete missing fields with AI"}
            </button>
          )}
        </div>
      )}
      {!guided && !aiControlsHost && aiControls}
      <section
        id={`${post.id}-editor-panel`}
        role={guided ? undefined : "tabpanel"}
        aria-labelledby={guided ? undefined : `${post.id}-tab-${tab}`}
        className="space-y-5"
      >
        {((guided && guidedSection !== "brief") || (!guided && tab === "copy")) && (
          <>
            {guided ? <>
              {guidedSection && field("title", 1)}
              {field("caption", 4)}
              {guidedSection ? <>
                {field("hashtags", 1)}
                <details className={styles.disclosure}><summary>Call to action <span>+</span></summary><div>{field("suggestedCta", 1)}</div></details>
              </> : <details className={styles.disclosure}><summary>Post title, call to action &amp; hashtags <span>+</span></summary><div className="space-y-4">{field("title", 1)}{field("suggestedCta", 1)}{field("hashtags", 1)}</div></details>}
              {!readOnly && !aiControlsHost && <details className={styles.disclosure}><summary><span className="inline-flex items-center gap-2"><Sparkles size={15}/>Improve with AI</span><span>+</span></summary><div>{aiControls}</div></details>}
            </> : <>{field("title", 1)}{field("caption", 4)}{field("suggestedCta", 1)}{field("hashtags", 1)}</>}
          </>
        )}
        {((guided && guidedSection !== "copy") || (!guided && tab === "strategy")) && (
          <details id={`${post.id}-brief-strategy`} open={guidedSection === "brief" ? true : guided ? undefined : true} className={guided ? styles.disclosure : undefined}>
            {!guided && <summary hidden>Strategy</summary>}
            {guided && <summary><span className="inline-flex items-center gap-2"><Target size={16}/>Strategy {missingContext && <small>Needs attention</small>}</span><span>+</span></summary>}
            <div className="space-y-4">
            {guided && missingContext && <p className="text-xs text-amber-700">Add the hook, objective and audience before team review.</p>}
            {guided && missingContext && !readOnly && hasContent && <button type="button" disabled={busy || dirty || !!editing} onClick={() => void run("brief", true, undefined, true)} className="min-h-11 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-600 disabled:opacity-40">{busy ? "Completing…" : "Complete missing fields with AI"}</button>}
            <p className="text-xs text-slate-500">
              Who this post speaks to, why it belongs in the calendar, and what it should achieve.
            </p>
            {improveSection("strategy", "Improve Strategy")}
            {brief.sourceAnchor && <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><strong>Based on</strong> <q>{brief.sourceAnchor}</q></p>}
            {field("hook")}
            {field("objective")}
            {field("targetAudience")}
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer py-2">
                Message & brand context
              </summary>
              <div className="mt-3 space-y-4">
                {(
                  [
                    "coreIdea",
                    "keyMessage",
                    "desiredResponse",
                    "brandConnection",
                    "pillar",
                  ] as BriefField[]
                ).map((name) => field(name))}
              </div>
            </details>
            </div>
          </details>
        )}
        {((guided && guidedSection !== "copy") || (!guided && tab === "creative")) && (
          <details id={`${post.id}-brief-creative`} open={guidedSection === "brief" ? true : guided ? undefined : true} className={guided ? styles.disclosure : undefined}>
            {!guided && <summary hidden>Creative direction</summary>}
            {guided && <summary><span className="inline-flex items-center gap-2"><Palette size={16}/>Creative direction</span><span>+</span></summary>}
            <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-600">
              Format
              <select
                aria-label="Format"
                disabled={readOnly || busy || !!editing}
                value={brief.format}
                onChange={(e) =>
                  setBrief((current) => ({
                    ...current,
                    format: e.target.value,
                  }))
                }
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white p-3 text-[16px]"
              >
                {platformBriefFormats(post.platform).map((format) => (
                  <option key={format}>{format}</option>
                ))}
              </select>
            </label>
            {field("creativeDirection", 3)}
            {improveSection("creativeDirection", "Improve Creative Direction")}
            <details className="border-t border-slate-200 pt-4">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                Production tools · optional
              </summary>
              <div className="mt-3 space-y-3">
                {EXECUTION_KINDS.filter(
                  (kind) => !["caption", "hashtags"].includes(kind),
                ).map((kind) => (
                  <div
                    key={kind}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => setActive(active === kind ? null : kind)}
                      aria-expanded={active === kind}
                      className="flex min-h-11 w-full items-center justify-between text-xs font-semibold text-slate-600"
                    >
                      {TOOLS[kind]}
                      <span>{active === kind ? "−" : "+"}</span>
                    </button>
                    {active === kind && (
                      <div className="space-y-3">
                        {post.creativeDevelopment?.[kind] &&
                          post.creativeDevelopment[kind]!.briefSnapshot !==
                            JSON.stringify(brief) && (
                            <p className="text-xs leading-5 text-amber-700">
                              This was based on an earlier brief. Review it or
                              regenerate when needed.
                            </p>
                          )}
                        {renderTextContainer(kind, kind, TOOLS[kind], text[kind] || "", 4, 18000, next => {
                          setDirtyKinds(current => current.includes(kind) ? current : [...current, kind]);
                          setText(current => ({ ...current, [kind]: next }));
                          setNotice("");
                        })}
                        {!readOnly && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy || dirty || !!editing}
                              onClick={() => void run(kind, true)}
                              className="min-h-11 rounded-lg bg-blue-600 px-3 text-xs text-white disabled:opacity-40"
                            >
                              Generate {TOOLS[kind].toLowerCase()}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
            </div>
          </details>
        )}
      </section>
      {!readOnly && !onSaveReady && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <span
            role="status"
            className="flex items-center gap-2 text-xs text-slate-500"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Working…
              </>
            ) : dirty || developmentDirty ? (
              "Unsaved changes"
            ) : (
              <>
                <Check size={14} />
                {notice || "Saved"}
              </>
            )}
          </span>
          {!onSaveReady && (
            <button
              type="button"
              disabled={busy || !dirty || !!editing}
              onClick={() => void run("brief")}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-xs font-semibold text-blue-600 disabled:opacity-40"
            >
              <Save size={14} />
              Save changes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
