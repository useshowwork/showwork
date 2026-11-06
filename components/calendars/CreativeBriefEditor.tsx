"use client";
import { useEffect, useRef, useState, type TextareaHTMLAttributes } from "react";
import { Sparkles, PenLine, Target, Palette } from "lucide-react";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { reconcileBrief, editablePostBrief, BRIEF_FIELDS, EXECUTION_KINDS, FORMATS, platformBriefFormats, briefSnapshot, type BriefField, type CreativeBrief, type CreativeDevelopment, type ExecutionKind } from "@/lib/content/brief";
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
const LABELS: Record<BriefField, string> = { title: "Content title", hook: "Hook", caption: "Caption", hashtags: "Hashtags", objective: "Objective", targetAudience: "Target Audience", coreIdea: "The core idea", keyMessage: "Key message", creativeDirection: "Creative direction", desiredResponse: "Desired audience response", brandConnection: "Brand connection", suggestedCta: "Call to Action", pillar: "Content pillar" };
const TOOLS: Record<ExecutionKind, string> = { script: "Script", caption: "Caption", carouselOutline: "Carousel structure", visualApproaches: "Visual approaches", productionNotes: "Production notes", hashtags: "Hashtags" };
// Expand with the actual copy instead of trapping long briefs in a tiny scroll box.
export function GrowingTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
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
            if (nextWidth !== width) { width = nextWidth; fit(); }
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
    creativeDirection: "The concept, the feeling and the creative possibilities. Give each thought room.",
    suggestedCta: "One clear next step for your audience.",
    hashtags: "Relevant tags, ready to use.",
};
export default function CreativeBriefEditor({ calendarId, post, onUpdated, readOnly = false }: {
    calendarId: string;
    post: BriefEditorPost;
    onUpdated: (post: any) => void;
    readOnly?: boolean;
}) {
    const [brief, setBrief] = useState(() => editablePostBrief(post));
    const incomingBrief = editablePostBrief(post);
    const previousServerBrief = useRef(incomingBrief);
    const incomingSignature = JSON.stringify(incomingBrief);
    useEffect(() => {
        const previous = previousServerBrief.current;
        previousServerBrief.current = incomingBrief;
        setBrief(current => reconcileBrief(current, previous, incomingBrief));
    }, [post.id, incomingSignature]);
    const [text, setText] = useState<Partial<Record<ExecutionKind, string>>>(() => Object.fromEntries(EXECUTION_KINDS.map(kind => [kind, post.creativeDevelopment?.[kind]?.text || (["script", "caption", "hashtags"].includes(kind) ? String(post[kind] || "") : "")])));
    const [active, setActive] = useState<ExecutionKind | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [instruction, setInstruction] = useState("");
    const dirty = !post.creativeBrief || post.creativeBrief.version !== 2 || JSON.stringify(brief) !== JSON.stringify(editablePostBrief(post));
    const run = async (kind: "brief" | ExecutionKind, generate = false, field?: BriefField, fillMissing = false) => {
        if (busy)
            return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const response = await calendarMutationFetch(`/api/calendars/${calendarId}/posts/${post.id}/creative`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, generate, field, instruction, fillMissing, expectedUpdatedAt: post.updatedAt, ...(kind === "brief" ? { brief } : { text: text[kind] || "" }) }) });
            const data = await response.json();
            if (!response.ok)
                throw Error(data.error || "Could not update this creative section.");
            if (kind === "brief") {
                const received = editablePostBrief(data.post);
                if (!received.objective.trim() || !received.targetAudience.trim()) throw Error("The server response is missing the saved objective or audience. Reload the post and retry completion.");
                setBrief(received);
            }
            else
                setText(previous => ({ ...previous, [kind]: data.post.creativeDevelopment?.[kind]?.text || "" }));
            onUpdated(data.post);
            setNotice(generate ? "New suggestion saved. Your other sections were preserved." : "Saved.");
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Could not save.");
        }
        finally {
            setBusy(false);
        }
    };
    const attemptedCompletion = useRef(false);
    const missingContext = ["hook", "objective", "targetAudience"].some(key => !brief[key as BriefField]?.trim());
    const hasContent = !!(post.caption || post.contentIdea || post.hook || post.script);
    useEffect(() => {
        if (readOnly || attemptedCompletion.current || !missingContext || !hasContent) return;
        attemptedCompletion.current = true;
        void run("brief", true, undefined, true);
    }, [post.id, readOnly, missingContext, hasContent]);
    const field = (name: BriefField, rows = 3) => <label key={name} className="block min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-4"><span className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-slate-800">{LABELS[name]}{!readOnly && <button type="button" disabled={busy || dirty} onClick={() => void run("brief", true, name)} title={dirty ? "Save your changes before reimagining this field" : `Reimagine ${LABELS[name]}`} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40" aria-label={`Regenerate ${LABELS[name]}`}><Sparkles size={13}/>Reimagine</button>}</span>{HELP[name] && <span className="mt-1 block text-xs leading-5 text-slate-500">{HELP[name]}</span>}<GrowingTextarea disabled={readOnly || busy} aria-label={LABELS[name]} maxLength={name === "caption" ? 5000 : name === "creativeDirection" ? 1800 : 800} value={brief[name] || ""} rows={rows} onChange={event => { setBrief(current => ({ ...current, [name]: event.target.value })); setNotice(""); }} className="mt-3 block min-h-[88px] w-full resize-y overflow-hidden rounded-xl border border-transparent bg-slate-50/70 p-3 text-[15px] leading-7 text-slate-900 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-50 disabled:bg-white disabled:opacity-100"/>{!readOnly && (name === "caption" || name === "creativeDirection") && <span className="mt-2 block text-right text-[11px] tabular-nums text-slate-400">{(brief[name] || "").length.toLocaleString()} / {name === "caption" ? "5,000" : "1,800"}</span>}</label>;
    return <div className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Creative brief</p><h3 className="mt-1 text-lg font-semibold text-slate-900">Your post copy</h3></div><span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">{post.platform}</span></header>
    {busy && missingContext && <p role="status" className="text-sm text-blue-700">Deriving the hook, objective and audience from this content…</p>}
    {!!brief.reviewWarnings?.length && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Needs editorial review</p>{brief.reviewWarnings.map((warning,index)=><p key={index} className="mt-1">{warning}</p>)}</div>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-blue-700">{notice}</p>}
    {!readOnly && missingContext && hasContent && !busy && <button type="button" onClick={() => void run("brief", true, undefined, true)} className="text-sm font-semibold text-blue-600">Complete missing fields from this content</button>}
    <div className="grid items-start gap-4 sm:grid-cols-[1fr_160px]">{field("title", 2)}<label className="text-xs font-semibold text-slate-700">Format<select disabled={readOnly || busy} value={brief.format} onChange={e => setBrief(b => ({ ...b, format: e.target.value }))} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">{platformBriefFormats(post.platform).map(format => <option key={format}>{format}</option>)}</select></label></div>
    {brief.version === 2 ? <>
      <section className="space-y-3">{field("caption", 6)}<div className="grid items-start gap-3 xl:grid-cols-2">{field("suggestedCta")}{field("hashtags")}</div></section>
      <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Hook, objective & audience</summary><div className="mt-4 space-y-3">{field("hook")}<div className="grid items-start gap-3 xl:grid-cols-2">{field("objective")}{field("targetAudience")}</div></div></details>
      <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Creative direction</summary><div className="mt-4">{field("creativeDirection", 6)}</div></details>
    </> : <>{field("coreIdea", 3)}<div className="grid gap-4 sm:grid-cols-2">{field("objective")}{field("targetAudience")}</div>{field("creativeDirection", 4)}</>}
    <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Message, response & brand context</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{((brief.version === 2 ? ["coreIdea", "keyMessage", "desiredResponse", "brandConnection", "pillar"] : ["keyMessage", "desiredResponse", "brandConnection", "suggestedCta", "pillar"]) as BriefField[]).map(name => field(name))}</div></details>
    {!readOnly && <><input aria-label="Creative revision guidance" placeholder="Optional: give the idea a different angle or refine a selected field…" value={instruction} onChange={e => setInstruction(e.target.value)} maxLength={3000} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !dirty} onClick={() => void run("brief")} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Working…" : "Save brief"}</button><button type="button" disabled={busy || dirty} onClick={() => void run("brief", true)} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-blue-700 disabled:opacity-40">Suggest a different idea</button></div></>}
    <section className="border-t border-slate-200 pt-5"><h4 className="font-semibold text-slate-900">Creative development <span className="ml-1 text-xs font-normal text-slate-500">Optional</span></h4><p className="mt-1 text-xs leading-5 text-slate-500">Develop only what you need. Optional production guidance preserves your content and creative brief.</p>
      {dirty && <p className="mt-2 text-xs text-amber-700">Save the brief before generating execution material.</p>}
      <div className="mt-4 space-y-2">{EXECUTION_KINDS.filter(kind => !["script", "caption", "hashtags"].includes(kind)).map(kind => { const artifact = post.creativeDevelopment?.[kind]; const stale = artifact && artifact.briefSnapshot !== JSON.stringify(brief); return <div key={kind} className="rounded-xl border border-slate-200 bg-white"><button type="button" aria-expanded={active === kind} onClick={() => setActive(active === kind ? null : kind)} className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm font-medium text-slate-800"><span>{TOOLS[kind]}</span><span className="text-xs text-slate-500">{stale ? "Brief changed" : text[kind] ? "Available" : "Create when needed"} {active === kind ? "−" : "+"}</span></button>{active === kind && <div className="space-y-3 border-t border-slate-100 p-3">{stale && <p className="text-xs text-amber-700">This was based on an earlier brief. Your text has been kept; review it or explicitly regenerate.</p>}<GrowingTextarea aria-label={TOOLS[kind]} disabled={busy || readOnly} value={text[kind] || ""} onChange={e => setText(previous => ({ ...previous, [kind]: e.target.value }))} rows={8} maxLength={18000} placeholder={`Write ${TOOLS[kind].toLowerCase()} yourself, or ask AI to help.`} className="w-full resize-y rounded-xl border border-slate-200 p-4 text-[15px] leading-7 text-slate-900"/>{!readOnly && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || dirty} onClick={() => void run(kind, true)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{text[kind] ? `Regenerate ${TOOLS[kind].toLowerCase()}` : `Generate ${TOOLS[kind].toLowerCase()}`}</button><button type="button" disabled={busy} onClick={() => void run(kind)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">Save this section</button></div>}</div>}</div>; })}</div>
    </section>
    {!post.caption?.trim() && <p role="status" className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">Ready for creative planning. Add finished copy and required media before publishing.</p>}
  </div>;
}
