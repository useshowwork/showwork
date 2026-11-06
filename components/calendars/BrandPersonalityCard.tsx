"use client";
import { useRouter } from "next/navigation";
import knowledgeStyles from "./KnowledgeStudio.module.css";
import { useEffect, useRef, useState } from "react";
import { Fingerprint, Check, ArrowRight } from "lucide-react";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { PERSONALITY_QUESTIONS, parseBrandPersonality, type BrandPersonality, type PersonalityKey, type PersonalityAnswer } from "@/lib/knowledge/brandPersonality";
export default function BrandPersonalityCard({ calendarId, canEdit, hasKnowledge = false, nextSection }: {
    calendarId: string;
    canEdit: boolean;
    hasKnowledge?: boolean;
    nextSection?: "channels" | "generate";
}) {
    const router = useRouter();
    const heading = useRef<HTMLHeadingElement>(null);
    const autoFocused = useRef(false);
    const [sourcesAdded, setSourcesAdded] = useState(hasKnowledge);
    const focusVoice = () => {
        const target = heading.current;
        target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
        target?.focus({ preventScroll: true });
    };
    useEffect(() => { setSourcesAdded(hasKnowledge); }, [hasKnowledge]);
    useEffect(() => {
        const focus = (event: Event) => {
            if ((event as CustomEvent<{calendarId: string}>).detail?.calendarId !== calendarId) return;
            setSourcesAdded(true); autoFocused.current = true; focusVoice();
        };
        window.addEventListener("showwork-brand-voice-focus", focus);
        return () => window.removeEventListener("showwork-brand-voice-focus", focus);
    }, [calendarId]);
    const [answers, setAnswers] = useState<Partial<Record<PersonalityKey, PersonalityAnswer>>>({});
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [canManage, setCanManage] = useState(false), [reload, setReload] = useState(0);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        setAnswers({});
        setNotice("");
        void fetch(`/api/calendars/${encodeURIComponent(calendarId)}/business-documents/brand-personality`, { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok)
            throw Error(data.error || "Could not load brand personality."); if (!cancelled) {
            setAnswers(data.profile?.answers || {});
            setCanManage(data.canManage === true);
        } }).catch(e => { if (!cancelled)
            setError(e.message); }).finally(() => { if (!cancelled)
            setLoading(false); });
        return () => { cancelled = true; };
    }, [calendarId, reload]);
    const answeredCount = PERSONALITY_QUESTIONS.filter(question => {
        const answer = answers[question.key];
        return answer && (question.options as readonly string[]).includes(answer.choice) && (answer.choice !== "Other" || (!!answer.custom.trim() && answer.custom.trim().length <= 200));
    }).length;
    useEffect(() => {
        if (sourcesAdded && !loading && !error && answeredCount === 0 && !autoFocused.current) {
            autoFocused.current = true; focusVoice();
        }
    }, [sourcesAdded, loading, error, answeredCount]);
    const editable = canEdit && canManage && sourcesAdded && !loading && !saving;
    async function save() {
        setError("");
        setNotice("");
        let profile: BrandPersonality;
        try {
            profile = parseBrandPersonality({ version: 1, answers });
        }
        catch (e) {
            setError((e as Error).message);
            return;
        }
        setSaving(true);
        try {
            const response = await calendarMutationFetch(`/api/calendars/${encodeURIComponent(calendarId)}/business-documents/brand-personality`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
            const data = await response.json();
            if (!response.ok)
                throw Error(data.error || "Could not save.");
            setAnswers(data.profile.answers);
            setNotice("Brand voice saved. Your content and customer replies will use these choices.");
            router.refresh();
            if (nextSection) window.dispatchEvent(new CustomEvent("showwork-workspace-navigate", { detail: { id: nextSection } }));
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setSaving(false);
        }
    }
    return <section id="brand-personality" className={knowledgeStyles.personality} aria-label="Brand personality">
  <div className={knowledgeStyles.voiceHeader}><div><span className={knowledgeStyles.voiceStep}>STEP 2</span><h2 ref={heading} tabIndex={-1} className={knowledgeStyles.voiceTitle}><Fingerprint size={20} aria-hidden="true"/>Define your brand voice</h2><p>Choose the personality behind every post and reply.</p></div><span className={knowledgeStyles.voiceCount} aria-live="polite">{loading ? "Loading…" : `${answeredCount} of 5 answered`}</span></div>
  <div className={knowledgeStyles.voiceBody}>
  {!sourcesAdded && <p role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">Add your business documents or website above, then choose your brand voice here.</p>}
  {loading ? <p role="status" className="text-sm text-slate-500">Loading brand personality…</p> : <BrandPersonalityQuestions calendarId={calendarId} answers={answers} disabled={!editable} onAnswer={(key, answer) => { setAnswers(current => ({ ...current, [key]: answer })); setNotice(""); }}/>}
  {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}{notice && <p role="status" className="mt-4 text-sm text-green-700">{notice}</p>}
  <footer className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">{canEdit && canManage && <button type="button" onClick={() => void save()} disabled={!editable || answeredCount !== PERSONALITY_QUESTIONS.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : nextSection ? "Save voice & continue" : "Save brand voice"}{nextSection && <ArrowRight size={15}/>}</button>}{error && !saving && <button type="button" onClick={() => setReload(value => value + 1)} className="min-h-11 text-sm text-blue-600">Reload saved profile</button>}<p className="text-xs leading-5 text-slate-500">You can update these choices anytime.</p></footer>
  </div>
 </section>;
}
export function BrandPersonalityQuestions({ calendarId, answers, disabled, onAnswer }: {
    calendarId: string;
    answers: Partial<Record<PersonalityKey, PersonalityAnswer>>;
    disabled: boolean;
    onAnswer: (key: PersonalityKey, answer: PersonalityAnswer) => void;
}) { return <div className={knowledgeStyles.questions}>{PERSONALITY_QUESTIONS.map((question, index) => <fieldset key={question.key} disabled={disabled} className={knowledgeStyles.question}><legend><span>{index + 1 < 10 ? `0${index + 1}` : index + 1}</span>{question.label}</legend><div className="flex flex-wrap gap-2">{question.options.map(option => { const checked = answers[question.key]?.choice === option; return <label key={option} data-selected={checked} className={knowledgeStyles.personalityOption}><input type="radio" className="sr-only" name={`${calendarId}-${question.key}`} value={option} checked={checked} onChange={() => onAnswer(question.key, { choice: option, custom: answers[question.key]?.custom || "" })}/>{checked && <Check size={14} aria-hidden="true"/>}{option}</label>; })}</div>{answers[question.key]?.choice === "Other" && <label className="mt-3 block text-xs font-medium text-slate-600">Your answer<input type="text" maxLength={200} value={answers[question.key]?.custom || ""} onChange={e => onAnswer(question.key, { choice: "Other", custom: e.target.value })} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-blue-500"/></label>}</fieldset>)}</div>; }
