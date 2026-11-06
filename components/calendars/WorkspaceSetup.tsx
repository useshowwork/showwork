"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { WORKSPACE_SETUP_STEPS, workspaceSetupStep, type WorkspaceSetupState } from "@/lib/workspaceSetup";
import styles from "./WorkspaceSetup.module.css";
const guidance = [
  { title: "How would you like to publish?", detail: "Choose what happens after team and client approvals. You can change this later in publishing settings.", action: "", section: "overview" },
  { title: "Give your content the right foundation", detail: "Upload your business documents or add your website so Randy understands your business, audience and voice.", action: "Add business knowledge", section: "knowledge" },
  { title: "Make it sound like your business", detail: "Your sources are added. Choose your brand’s personality, tone and audience feeling before creating content.", action: "Set brand voice", section: "knowledge" },
  { title: "Connect the channels you create for", detail: "Connect at least one social account before generating content. You can add more channels whenever you’re ready.", action: "Connect channels", section: "channels" },
  { title: "Let’s create your first content batch", detail: "Your business knowledge and channels are ready. Choose your dates and platforms, then generate your first set of ideas.", action: "Generate first content", section: "generate" },
  { title: "Take a look at your first content", detail: "Open your posts, check the copy and creative, and make any changes. Internal and client approvals still come before publishing.", action: "Review my content", section: "content" },
] as const;
export default function WorkspaceSetup({ calendarId, initialState, onNavigate, activeSection }: { calendarId: string; initialState: WorkspaceSetupState; onNavigate: (section: "overview" | "knowledge" | "channels" | "generate" | "content") => void; activeSection: string }) {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewOpened, setReviewOpened] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const latestState = useRef(initialState);
  latestState.current = state;
  const router = useRouter();
  const step = workspaceSetupStep(state);
  const current = guidance[Math.min(step, 5)];
  useEffect(() => { setState(initialState); }, [initialState]);
  useEffect(() => {
    if (state.complete || !state.enabled) return;
    let disposed = false;
    let refreshing = false;
    async function refresh() {
      if (refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      try {
        const response = await fetch(`/api/calendars/${calendarId}/setup`, { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json() as WorkspaceSetupState;
        if (!disposed && JSON.stringify(latestState.current) !== JSON.stringify(next)) { setState(next); router.refresh(); }
      } catch { /* Preserve progress during a temporary connection interruption. */ }
      finally { refreshing = false; }
    }
    const timer = window.setInterval(refresh, 8000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [calendarId, state.complete, state.enabled, router]);
  async function save(body: object) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await calendarMutationFetch(`/api/calendars/${calendarId}/setup`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t save your progress. Please try again.");
      setState(data); router.refresh(); heading.current?.focus();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { setBusy(false); }
  }
  if (!state.enabled || state.complete) return null;
  return <section className={styles.setup} aria-labelledby="workspace-setup-heading" aria-busy={busy}>
    <div className={styles.top}><span>LET’S SET UP YOUR WORKSPACE</span><span>Step {step + 1} of {WORKSPACE_SETUP_STEPS.length}</span></div>
    <ol className={styles.steps} aria-label="Workspace setup progress">{WORKSPACE_SETUP_STEPS.map((item, index) => <li key={item.id} aria-current={index === step ? "step" : undefined} data-done={index < step}><span>{index < step ? <Check size={12}/> : index + 1}</span>{item.label}</li>)}</ol>
    <div className={styles.body}><div><h2 id="workspace-setup-heading" ref={heading} tabIndex={-1}>{current.title}</h2><p>{current.detail}</p></div>
      {step > 0 && <button type="button" className={styles.primary} onClick={() => { if (step === 5) setReviewOpened(true); onNavigate(current.section); if (step === 2) window.setTimeout(() => window.dispatchEvent(new CustomEvent("showwork-brand-voice-focus", { detail: { calendarId } })), 100); }}>{current.action}<ArrowRight size={15}/></button>}
    </div>
    {step === 0 && <div className={styles.choices}>
      <button type="button" disabled={busy} onClick={() => void save({ action: "publishing", autoPublishEnabled: true })}><strong>Automate publishing <ArrowRight size={15}/></strong><span>Publish approved posts at their scheduled time on supported channels.</span></button>
      <button type="button" disabled={busy} onClick={() => void save({ action: "publishing", autoPublishEnabled: false })}><strong>I’ll manage publishing <ArrowRight size={15}/></strong><span>Keep automatic publishing off and choose when to publish each post.</span></button>
    </div>}
    {step === 5 && reviewOpened && activeSection === "content" && <div className={styles.finish}><span>Once you’ve checked your posts, you’re ready to finish setup.</span><button type="button" disabled={busy} onClick={() => void save({ action: "complete" })}>I’ve reviewed my content <Check size={15}/></button></div>}
    {busy && <p role="status" className={styles.saving}><LoaderCircle size={14} className="animate-spin"/>Saving your progress…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
