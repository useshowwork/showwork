"use client";
import studioStyles from "./GenerateStudio.module.css";
import PlatformBrandIcon from "./PlatformBrandIcon";
import { WandSparkles, BookOpenText, Layers3, CalendarRange, ShieldCheck, Sparkles, Target, PenLine } from "lucide-react";
import { consumeResearchBrief, RESEARCH_BRIEF_EVENT } from "@/lib/knowledge/researchHandoff";
import { generationCount } from "@/lib/content/schedule";
import KnowledgeClarification, { type ClarificationPrompt, type ClarificationResponse } from "./KnowledgeClarification";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { readAiGenerationResponse, waitForAiGeneration } from "@/lib/aiGenerationResponse";

import { useEffect, useState, useMemo } from "react";
import { consumeReportingRecommendation, REPORTING_RECOMMENDATION_EVENT } from "@/lib/reporting/recommendationHandoff";
import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";
import AiDraftReviewModal from "@/components/calendars/AiDraftReviewModal";

const PLATFORMS = [
  { value: "INSTAGRAM", label: "Instagram", short: "IG" },
  { value: "TIKTOK", label: "TikTok", short: "TT" },
  { value: "YOUTUBE", label: "YouTube", short: "YT" },
  { value: "FACEBOOK", label: "Facebook", short: "FB" },
  { value: "X", label: "X", short: "X" },
  { value: "LINKEDIN", label: "LinkedIn", short: "LI" },
] as const;

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 2.75 13.9 9.1 20.25 11l-6.35 1.9L12 19.25l-1.9-6.35L3.75 11l6.35-1.9L12 2.75Z" strokeLinejoin="round" />
      <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AiContentGeneratorCard({
  calendarId,
  hasBusinessSummary,
  performanceRecommendationsAccess = true,
}: {
  calendarId: string;
  hasBusinessSummary: boolean;
  performanceRecommendationsAccess?: boolean;
}) {
  const today = new Date();
  const defaultStart = today.toISOString().slice(0, 10);
  const defaultEnd = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  )
    .toISOString()
    .slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [campaignObjective,setCampaignObjective]=useState("");
  const [timeZone,setTimeZone]=useState("UTC");
  useEffect(()=>{setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC");},[]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [researchLoaded, setResearchLoaded] = useState(false);
  useEffect(() => {
    const apply = () => { const text = consumeResearchBrief(calendarId); if (text) { setCustomInstructions(text); setResearchLoaded(true); } };
    apply(); window.addEventListener(RESEARCH_BRIEF_EVENT, apply);
    return () => window.removeEventListener(RESEARCH_BRIEF_EVENT, apply);
  }, [calendarId]);
  const [reportingRecommendationLoaded, setReportingRecommendationLoaded] = useState(false);
 const [platforms, setPlatforms] = useState<string[]>(["INSTAGRAM"]);
const [contentStrategy, setContentStrategy] = useState<
  "SAME_CONTENT" | "DIFFERENT_CONTENT" | "CUSTOM_GROUPS"
>("SAME_CONTENT");
const [contentGroups, setContentGroups] = useState<string[][]>([]);
const [scheduleStrategy, setScheduleStrategy] = useState<
  "SAME_TIME" | "SAME_DAY" | "CUSTOM"
>("SAME_TIME");
const [platformSchedules, setPlatformSchedules] = useState<
  Record<string, { date: string; time: string }>
>(() =>
  Object.fromEntries(
    ["INSTAGRAM"].map((platform) => [
      platform,
      {
        date: defaultStart,
        time: "10:00",
      },
    ])
  )
);
  const [clarification, setClarification] = useState<ClarificationPrompt | null>(null);
  const [knowledgeAnswers, setKnowledgeAnswers] = useState<ClarificationResponse["knowledgeAnswers"]>([]);
  useEffect(() => { setClarification(null); setKnowledgeAnswers([]); }, [calendarId, customInstructions]);
  const expected = useMemo(()=>{try{return generationCount(startDate,endDate,postsPerWeek,platforms,contentStrategy,contentGroups);}catch{return null;}},[startDate,endDate,postsPerWeek,platforms,contentStrategy,contentGroups]);
  const [generating, setGenerating] = useState(false);
  const [hasBusinessSummaryState, setHasBusinessSummaryState] = useState(hasBusinessSummary);
  const [error, setError] = useState<string | null>(null);
  const [billingBlocked, setBillingBlocked] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(`calendar:${calendarId}:has-business-summary`) === "true") setHasBusinessSummaryState(true);
    } catch { /* The server-provided business summary remains authoritative. */ }
  }, [calendarId]);

  useEffect(() => {
    if (!performanceRecommendationsAccess) return;
    const applyPending = () => {
      const recommendation = consumeReportingRecommendation(calendarId);
      if (!recommendation) return;
      setCustomInstructions(recommendation);
      setReportingRecommendationLoaded(true);
      setError(null);
    };
    const onRecommendation = (event: Event) => {
      if ((event as CustomEvent<{ calendarId: string }>).detail?.calendarId === calendarId) applyPending();
    };
    window.addEventListener(REPORTING_RECOMMENDATION_EVENT, onRecommendation);
    applyPending();
    return () => window.removeEventListener(REPORTING_RECOMMENDATION_EVENT, onRecommendation);
  }, [calendarId, performanceRecommendationsAccess]);

const togglePlatform = (platform: string) => {
  setPlatforms((previous) => {
    const next = previous.includes(platform)
      ? previous.filter((value) => value !== platform)
      : [...previous, platform];

    if (contentStrategy === "CUSTOM_GROUPS") {
      setContentGroups(next.length > 0 ? [next] : []);
    }

    setPlatformSchedules((currentSchedules) => {
      const nextSchedules = { ...currentSchedules };

      if (!next.includes(platform)) {
        delete nextSchedules[platform];
      } else if (!nextSchedules[platform]) {
        nextSchedules[platform] = {
          date: defaultStart,
          time: "10:00",
        };
      }

      return nextSchedules;
    });

    return next;
  });
};

  const generate = async (resolution?: ClarificationResponse) => {
    if (platforms.length === 0) {
      setError("Choose at least one platform.");
      return;
    }

    if (!startDate || !endDate) {
      setError("Choose a start and end date.");
      return;
    }

    if (endDate < startDate) {
      setError("The end date must be after the start date.");
      return;
    }

    if (!expected?.drafts) {setError("Choose a range with publishing slots and valid platform groups.");return;}
    setGenerating(true);
    setError(null);
    setBillingBlocked(false);

    try {
     let res = await calendarMutationFetch(
  `/api/calendars/${encodeURIComponent(calendarId)}/ai-generate`,
  {
        method: "POST",
        headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
  startDate,
  endDate,
  postsPerWeek,
  campaignObjective,
  timeZone,
  platforms,
  customInstructions,
  knowledgeAnswers: resolution?.knowledgeAnswers ?? knowledgeAnswers,
  omitUnsupportedDetails: resolution?.omitUnsupportedDetails ?? false,
  useAvailableKnowledge: resolution?.useAvailableKnowledge ?? false,
  usePerformanceRecommendations: reportingRecommendationLoaded,
  contentStrategy,
  contentGroups,
  scheduleStrategy,
  platformSchedules,
}),
      });

      let data = await readAiGenerationResponse(res);
      if (data.code === "KNOWLEDGE_CLARIFICATION_REQUIRED" && Array.isArray(data.gaps)) {
        if (resolution) setKnowledgeAnswers(resolution.knowledgeAnswers);
        setClarification({ gaps: data.gaps, incomplete: data.incomplete === true, canSave: data.canSave === true });
        requestAnimationFrame(() => { const panel = document.getElementById("knowledge-clarification"); panel?.scrollIntoView({ behavior: "smooth", block: "center" }); panel?.focus({ preventScroll: true }); });
        return;
      }
      if (!res.ok) {
        setBillingBlocked(res.status === 402 || (res.status === 403 && !!(data.requiresUpgrade || data.code === "WORKSPACE_FEATURE_LOCKED" || /subscription|allowance|limit|upgrade|trial/i.test(data.error || ""))));
        throw new Error(data.error ?? "Failed to generate content");
      }

      setClarification(null);
      setKnowledgeAnswers([]);

      if (res.status === 202 && typeof data.jobId === "string") {
        setActiveJobId(data.jobId);
        setReviewOpen(true);
        return;
      }

      setReviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <section className={studioStyles.studio}>
        <header className={studioStyles.hero}>
          <div><p className={studioStyles.eyebrow}><Sparkles size={14}/> AI Studio / Generate</p><h1>Your knowledge.<br/><span>A fresh creative direction.</span></h1><p>Shape the brief. Choose your channels. Give your team something worth creating.</p></div>
          <div className={studioStyles.heroArt} aria-hidden="true"><span className={studioStyles.orbitOne}/><span className={studioStyles.orbitTwo}/><div className={studioStyles.artMain}><WandSparkles size={35} strokeWidth={1.4}/></div><span className={studioStyles.artMini}><BookOpenText size={19}/></span><span className={studioStyles.artMiniTwo}><Layers3 size={20}/></span></div>
        </header>
        <div className={`${studioStyles.layout} ${!hasBusinessSummaryState ? studioStyles.singleColumn : ""}`}>
        <div className={studioStyles.form}>
          {reportingRecommendationLoaded && (
            <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
              <SparkIcon /> Reporting recommendations added to Creative direction. Review or edit them before generating.
            </p>
          )}

          {!hasBusinessSummaryState ? (
            <div className="relative mt-6 overflow-hidden rounded-[22px] border border-[#E4E7EC] bg-[#F8FAFC] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#98A2B3] shadow-sm ring-1 ring-[#E4E7EC]">
                  <SparkIcon />
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex min-w-0 items-start gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D6E4FF] bg-[#EEF5FF]">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 3L14.8 9.2L21 12L14.8 14.8L12 21L9.2 14.8L3 12L9.2 9.2L12 3Z"
          stroke="#2563EB"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>

    <div className="min-w-0">
      <p className="text-xs font-semibold text-[#101828]">
        Build the business context first
      </p>

      <p className="mt-1.5 max-w-xl text-[11px] leading-5 text-[#667085]">
        Upload a business document so the AI understands this client before
        generating content. This keeps drafts grounded in the actual business
        rather than generic ideas.
      </p>
    </div>
  </div>

  <button
    type="button"
    onClick={() => {
      window.dispatchEvent(
        new CustomEvent("showwork-workspace-navigate", {
          detail: { id: "knowledge" },
        }),
      );
    }}
    className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#101828] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#1D2939] hover:shadow-md"
  >
    <span>Go to Knowledge</span>

    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-transform group-hover:translate-x-0.5"
      aria-hidden="true"
    >
      <path
        d="M5 12H19M13 6L19 12L13 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
</div>
              </div>

              <div className="mt-5 flex items-center gap-2 text-[10px] font-semibold text-[#98A2B3]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#CBD5E1]" />
                Business knowledge required
              </div>
            </div>
          ) : (
            <>
              <div className={studioStyles.contextStrip}><BookOpenText size={17}/><div><strong>Grounded in your business</strong><span>Your knowledge and saved brand personality guide this batch.</span></div><span className={studioStyles.draftBadge}><ShieldCheck size={13}/> Drafts only</span></div>
              <div className={studioStyles.sectionTitle}><span>01</span><div><h2>Give it a purpose.</h2><p>What should this content help you achieve?</p></div><Target size={20}/></div>
              <label className="mt-4 block text-xs font-semibold text-slate-700">Campaign objective <span className="font-normal text-slate-400">Optional</span><select value={campaignObjective} onChange={e=>setCampaignObjective(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="">Let the strategy follow my business knowledge</option>{["Brand Awareness","Engagement","Audience Education","Lead Generation","Product Adoption","Sales / Conversion","Custom Objective"].map(objective=><option key={objective}>{objective}</option>)}</select></label>
              {campaignObjective==="Custom Objective"&&<p className="mt-1 text-xs text-slate-500">Describe your objective in Creative direction below.</p>}
              {researchLoaded && <p role="status" className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Research opportunity added to your instructions. Review the brief settings before generating.</p>}
              {clarification && <KnowledgeClarification calendarId={calendarId} prompt={clarification} busy={generating} onContinue={resolution => void generate(resolution)} />}

              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-3 rounded-2xl border border-[#FECACA] bg-[#FFF7F7] px-4 py-3.5 text-[11px] leading-5 text-[#B42318]"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F04438]" />
                  <span>{error}</span>
                </div>
              )}

              <div className={studioStyles.sectionTitle}><span>02</span><div><h2>Find your rhythm.</h2><p>Set the date range and a pace that works for your team.</p></div><CalendarRange size={20}/></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#667085]">
                    Start date
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 text-xs font-medium text-[#344054] outline-none transition-all hover:border-[#B9C7D8] focus:border-[#2478FF] focus:ring-4 focus:ring-[#2478FF]/10"
                  />
                </label>

                <label className="block min-w-0">
                  <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#667085]">
                    End date
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 text-xs font-medium text-[#344054] outline-none transition-all hover:border-[#B9C7D8] focus:border-[#2478FF] focus:ring-4 focus:ring-[#2478FF]/10"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-[22px] border border-[#E4E7EC] bg-[#F8FAFC] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#101828]">
                      Publishing rhythm
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-[#667085]">
                      Choose how many draft posts the AI should aim for each week.
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center rounded-xl border border-[#D9E2EC] bg-white p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPostsPerWeek((value) => Math.max(1, value - 1))
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] transition-colors hover:bg-[#F2F4F7] hover:text-[#101828]"
                      aria-label="Decrease posts per week"
                    >
                      −
                    </button>

                    <div className="min-w-[58px] px-2 text-center">
                      <p className="text-sm font-bold tracking-tight text-[#101828]">
                        {postsPerWeek}
                      </p>
                      <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        per week
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setPostsPerWeek((value) => Math.min(14, value + 1))
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] transition-colors hover:bg-[#F2F4F7] hover:text-[#101828]"
                      aria-label="Increase posts per week"
                    >
                      +
                    </button>
                  </div>
                </div>

                <input
                  type="number"
                  min={1}
                  max={14}
                  value={postsPerWeek}
                  onChange={(event) =>
                    setPostsPerWeek(
                      Math.min(14, Math.max(1, Number(event.target.value) || 1))
                    )
                  }
                  className="sr-only"
                  aria-label="Posts per week"
                />
              </div>

              <div className="mt-5">
                <div className={studioStyles.sectionTitle}><span>03</span><div><h2>Choose your channels.</h2><p>Each platform gets content adapted to its audience.</p></div><Layers3 size={20}/></div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#101828]">
                      Publishing platforms
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-[#667085]">
                      Choose where this batch should be tailored.
                    </p>
                  </div>

                  <span className="shrink-0 text-[10px] font-semibold text-[#98A2B3]">
                    {platforms.length} selected
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PLATFORMS.map((platform) => {
                    const selected = platforms.includes(platform.value);

                    return (
                      <button
                        key={platform.value}
                        type="button"
                        onClick={() => togglePlatform(platform.value)}
                        aria-pressed={selected}
                        className={`group flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                          selected
                            ? "border-[#B9D2FA] bg-[#F3F8FF] shadow-[0_5px_16px_rgba(36,120,255,0.07)]"
                            : "border-[#E4E7EC] bg-white hover:border-[#CBD5E1] hover:bg-[#FAFBFC]"
                        }`}
                      >
                        <span className={studioStyles.platformLogo}><PlatformBrandIcon platform={platform.value}/></span>

                        <span
                          className={`min-w-0 flex-1 truncate text-xs font-medium ${
                            selected ? "text-[#175CD3]" : "text-[#475467]"
                          }`}
                        >
                          {platform.label}
                        </span>

                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-[#2478FF] bg-[#2478FF] text-white"
                              : "border-[#D0D5DD] bg-white"
                          }`}
                        >
                          {selected && (
                            <svg
                              viewBox="0 0 16 16"
                              className="h-2.5 w-2.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="m3.5 8 3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

                            {platforms.length > 1 && (
  <div className="mt-5 rounded-[22px] border border-[#E4E7EC] bg-[#F8FAFC] p-4 sm:p-5">
    <div>
      <p className="text-xs font-semibold text-[#101828]">
        Content strategy
      </p>
      <p className="mt-1 text-[10px] leading-5 text-[#667085]">
        Choose how AI should create content across your selected platforms.
      </p>
    </div>

    <div className="mt-3 grid gap-2">
      {[
        {
          value: "SAME_CONTENT" as const,
          title: "Same content for all platforms",
          description:
            "Create one content concept and adapt it for every selected platform.",
        },
        {
          value: "DIFFERENT_CONTENT" as const,
          title: "Different content for each platform",
          description:
            "Create a separate content concept for every selected platform.",
        },
        {
          value: "CUSTOM_GROUPS" as const,
          title: "Customize content groups",
          description:
            "Choose which platforms should share the same content.",
        },
      ].map((option) => {
        const selected = contentStrategy === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setContentStrategy(option.value);

              if (
                option.value === "CUSTOM_GROUPS" &&
                contentGroups.length === 0
              ) {
                setContentGroups([platforms]);
              }
            }}
            aria-pressed={selected}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
              selected
                ? "border-[#B9D2FA] bg-[#F3F8FF] shadow-[0_5px_16px_rgba(36,120,255,0.07)]"
                : "border-[#E4E7EC] bg-white hover:border-[#CBD5E1] hover:bg-[#FAFBFC]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                selected
                  ? "border-[#2478FF] bg-[#2478FF]"
                  : "border-[#D0D5DD] bg-white"
              }`}
            >
              {selected && (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </span>

            <span className="min-w-0">
              <span
                className={`block text-[11px] font-semibold ${
                  selected ? "text-[#175CD3]" : "text-[#344054]"
                }`}
              >
                {option.title}
              </span>

              <span className="mt-1 block text-[10px] leading-5 text-[#667085]">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>

    {scheduleStrategy === "CUSTOM" && (
  <div className="mt-4 rounded-2xl border border-[#DCE3EC] bg-white p-4">
    <div>
      <p className="text-[11px] font-semibold text-[#101828]">
        Platform schedules
      </p>
      <p className="mt-1 text-[10px] leading-5 text-[#667085]">
        Set when each platform should publish. Platforms can use different
        dates and times.
      </p>
    </div>

    <div className="mt-3 space-y-2">
      {platforms.map((platform) => {
        const meta = PLATFORMS.find(
          (item) => item.value === platform
        );

        if (!meta) return null;

        const schedule = platformSchedules[platform] ?? {
          date: startDate,
          time: "10:00",
        };

        return (
          <div
            key={platform}
            className="rounded-xl border border-[#E4E7EC] bg-[#F8FAFC] p-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF5FF] text-[8px] font-bold text-[#2478FF]">
                <PlatformBrandIcon platform={meta.value} size={17}/>
              </span>

              <span className="text-[10px] font-semibold text-[#344054]">
                {meta.label}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">
                  Date
                </span>

                <input
                  type="date"
                  value={schedule.date}
                  min={startDate}
                  max={endDate}
                  onChange={(event) => {
                    const date = event.target.value;

                    setPlatformSchedules((previous) => ({
                      ...previous,
                      [platform]: {
                        ...schedule,
                        date,
                      },
                    }));
                  }}
                  className="h-9 w-full rounded-lg border border-[#D9E2EC] bg-white px-2.5 text-[10px] font-medium text-[#344054] outline-none focus:border-[#2478FF] focus:ring-2 focus:ring-[#2478FF]/10"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">
                  Time
                </span>

                <input
                  type="time"
                  value={schedule.time}
                  onChange={(event) => {
                    const time = event.target.value;

                    setPlatformSchedules((previous) => ({
                      ...previous,
                      [platform]: {
                        ...schedule,
                        time,
                      },
                    }));
                  }}
                  className="h-9 w-full rounded-lg border border-[#D9E2EC] bg-white px-2.5 text-[10px] font-medium text-[#344054] outline-none focus:border-[#2478FF] focus:ring-2 focus:ring-[#2478FF]/10"
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}

    {contentStrategy === "CUSTOM_GROUPS" && (
      <div className="mt-4 rounded-2xl border border-[#DCE3EC] bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-[#101828]">
              Content groups
            </p>
            <p className="mt-1 text-[10px] leading-5 text-[#667085]">
              Platforms in the same group will receive the same content.
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {contentGroups.map((group, groupIndex) => (
  <div
    key={`content-group-${groupIndex}`}
    className="rounded-xl border border-[#E4E7EC] bg-[#F8FAFC] p-3"
  >
    <div className="flex items-center justify-between gap-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">
        Group {groupIndex + 1}
      </p>

      {contentGroups.length > 1 && (
        <button
          type="button"
          onClick={() => {
            setContentGroups((previous) => {
              const next = previous.filter(
                (_, index) => index !== groupIndex
              );

              const removedPlatforms = group;

              if (next.length === 0) {
                return [removedPlatforms];
              }

              return [
                ...next.slice(0, -1),
                [...next[next.length - 1], ...removedPlatforms],
              ];
            });
          }}
          className="text-[9px] font-semibold text-[#667085] transition-colors hover:text-[#B42318]"
        >
          Remove group
        </button>
      )}
    </div>

    <div className="mt-2 flex flex-wrap gap-2">
      {group.map((platform) => {
  const meta = PLATFORMS.find(
    (item) => item.value === platform
  );

  if (!meta) return null;

  return (
    <div
      key={platform}
      className="flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-white px-2 py-1.5"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#EEF5FF] text-[7px] font-bold text-[#2478FF]">
        <PlatformBrandIcon platform={meta.value} size={17}/>
      </span>

      <span className="text-[9px] font-semibold text-[#344054]">
        {meta.label}
      </span>

      {contentGroups.length > 1 && (
        <select
          value={groupIndex}
          onChange={(event) => {
            const targetGroupIndex = Number(event.target.value);

            if (targetGroupIndex === groupIndex) {
              return;
            }

            setContentGroups((previous) => {
              const next = previous.map((currentGroup) => [
                ...currentGroup,
              ]);

              next[groupIndex] = next[groupIndex].filter(
                (value) => value !== platform
              );

              next[targetGroupIndex] = [
                ...next[targetGroupIndex],
                platform,
              ];

              return next.filter((currentGroup) => currentGroup.length > 0);
            });
          }}
          className="max-w-[90px] rounded-md border border-[#E4E7EC] bg-white px-1.5 py-1 text-[8px] font-medium text-[#667085] outline-none focus:border-[#2478FF]"
          aria-label={`Move ${meta.label} to another content group`}
        >
          {contentGroups.map((_, index) => (
            <option key={index} value={index}>
              {index === groupIndex
                ? "This group"
                : `Group ${index + 1}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
})}
    </div>
    <button
  type="button"
  onClick={() => {
    const groupedPlatforms = new Set(contentGroups.flat());

    const ungroupedPlatform = platforms.find(
      (platform) => !groupedPlatforms.has(platform)
    );

    if (ungroupedPlatform) {
      setContentGroups((previous) => [
        ...previous,
        [ungroupedPlatform],
      ]);
      return;
    }

    setContentGroups((previous) => [...previous, []]);
  }}
  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-[#CBD5E1] bg-white px-3 py-2 text-[9px] font-semibold text-[#475467] transition-colors hover:border-[#2478FF] hover:bg-[#F8FAFC] hover:text-[#175CD3]"
>
  <span className="text-sm leading-none">+</span>
  Add content group
</button>
  </div>
))}
        </div>

        <p className="mt-3 text-[9px] leading-4 text-[#98A2B3]">
          Platforms in a group share the same creative idea, adapted to each channel.
        </p>
      </div>
    )}
  </div>
)}

{platforms.length > 1 && (
  <div className="mt-5 rounded-[22px] border border-[#E4E7EC] bg-[#F8FAFC] p-4 sm:p-5">
    <div>
      <p className="text-xs font-semibold text-[#101828]">
        Publishing schedule
      </p>
      <p className="mt-1 text-[10px] leading-5 text-[#667085]">
        Choose how AI should schedule posts across your selected platforms.
      </p>
    </div>

    <div className="mt-3 grid gap-2">
      {[
        {
          value: "SAME_TIME" as const,
          title: "Same date & time",
          description:
            "Publish all platform posts at the same date and time.",
        },
        {
          value: "SAME_DAY" as const,
          title: "Same day, different times",
          description:
            "Publish on the same day but let AI choose the best time for each platform.",
        },
        {
          value: "CUSTOM" as const,
          title: "Customize the schedule",
          description:
            "Choose different dates and times for different platforms.",
        },
      ].map((option) => {
        const selected = scheduleStrategy === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
  setScheduleStrategy(option.value);

  if (option.value === "SAME_TIME") {
    setPlatformSchedules(
      Object.fromEntries(
        platforms.map((platform) => [
          platform,
          {
            date: startDate,
            time: "10:00",
          },
        ])
      )
    );
  }

  if (option.value === "SAME_DAY") {
    setPlatformSchedules(
      Object.fromEntries(
        platforms.map((platform, index) => [
          platform,
          {
            date: startDate,
            time: `${String(10 + index).padStart(2, "0")}:00`,
          },
        ])
      )
    );
  }

  if (option.value === "CUSTOM") {
    setPlatformSchedules((previous) => {
      const next = { ...previous };

      platforms.forEach((platform) => {
        if (!next[platform]) {
          next[platform] = {
            date: startDate,
            time: "10:00",
          };
        }
      });

      return next;
    });
  }
}}
            aria-pressed={selected}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
              selected
                ? "border-[#B9D2FA] bg-[#F3F8FF] shadow-[0_5px_16px_rgba(36,120,255,0.07)]"
                : "border-[#E4E7EC] bg-white hover:border-[#CBD5E1] hover:bg-[#FAFBFC]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                selected
                  ? "border-[#2478FF] bg-[#2478FF]"
                  : "border-[#D0D5DD] bg-white"
              }`}
            >
              {selected && (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </span>

            <span className="min-w-0">
              <span
                className={`block text-[11px] font-semibold ${
                  selected ? "text-[#175CD3]" : "text-[#344054]"
                }`}
              >
                {option.title}
              </span>

              <span className="mt-1 block text-[10px] leading-5 text-[#667085]">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  </div>
)}

              {!performanceRecommendationsAccess && <WorkspaceFeatureNotice compact feature="performanceRecommendations" />}
              <div className={studioStyles.sectionTitle}><span>04</span><div><h2>Make it yours.</h2><p>Share an angle, an audience need or a thought to build on.</p></div><PenLine size={20}/></div>
              <label className="mt-5 block">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-[#101828]">
                      Creative direction
                    </span>
                    <span className="mt-1 block text-[10px] leading-5 text-[#667085]">
                      Optional guidance for this batch.
                    </span>
                  </div>
                  <span className="hidden text-[9px] text-[#98A2B3] sm:block">
                    Optional
                  </span>
                </div>

                <textarea
                  value={customInstructions}
                  onChange={(event) => { setCustomInstructions(event.target.value); if (!event.target.value.trim()) setReportingRecommendationLoaded(false); }}
                  rows={6}
                  placeholder="What should this campaign achieve? Share priorities, audience needs, tone or exclusions. AI will generate hooks, specific objectives, audiences, complete captions, flexible creative direction, CTAs and relevant hashtags. Scripts are optional."
                  className="mt-3 w-full resize-y rounded-2xl border border-[#D9E2EC] bg-white px-4 py-3.5 text-[11px] leading-6 text-[#344054] outline-none transition-all placeholder:text-[#98A2B3] hover:border-[#B9C7D8] focus:border-[#2478FF] focus:ring-4 focus:ring-[#2478FF]/10"
                />
                <div className="mt-1.5 text-right text-[9px] text-[#98A2B3]">
                  {customInstructions.length} characters
                </div>
              </label>
            </>
          )}
        </div>

        {hasBusinessSummaryState && <aside className={studioStyles.summary} aria-label="Generation summary">
          <div className={studioStyles.summaryTop}><span><WandSparkles size={17}/> Your creative batch</span><span className={studioStyles.previewBadge}>Preview</span></div>
          <h2>A clear brief.<br/><span>Better possibilities.</span></h2>
          <div className={studioStyles.batchNumbers} aria-live="polite"><div><strong>{expected?.ideas ?? "—"}</strong><span>creative ideas</span></div><div><strong>{expected?.drafts ?? "—"}</strong><span>calendar drafts</span></div></div>
          {!expected && <p className={studioStyles.summaryHelp}>Complete your dates and platform groups to calculate this batch.</p>}
          <div className={studioStyles.summaryPlatforms}>{platforms.length ? platforms.map(platform => <span key={platform} title={PLATFORMS.find(p => p.value === platform)?.label}><PlatformBrandIcon platform={platform} size={20}/><span className="sr-only">{PLATFORMS.find(p => p.value === platform)?.label}</span></span>) : <p>Choose at least one platform.</p>}</div>
          <dl className={studioStyles.summaryDetails}><div><dt>Objective</dt><dd>{campaignObjective || "Guided by your business"}</dd></div><div><dt>Date range</dt><dd>{startDate || "Choose start"}<br/>{endDate || "Choose end"}</dd></div><div><dt>Weekly rhythm</dt><dd>{postsPerWeek} per week</dd></div><div><dt>Time zone</dt><dd>{timeZone}</dd></div>{platforms.length > 1 && <div><dt>Content approach</dt><dd>{contentStrategy === "SAME_CONTENT" ? "Shared ideas, adapted" : contentStrategy === "DIFFERENT_CONTENT" ? "Distinct ideas per platform" : "Custom platform groups"}</dd></div>}</dl>
          <details className={studioStyles.scheduleNote}><summary>How draft counts work</summary><p>Monday-based weeks. Partial weeks include only selected publishing days. {postsPerWeek > 7 ? "Two daily slots are used where needed." : "One slot per publishing day, per platform."}</p></details>
          <div className={studioStyles.reviewNote}><ShieldCheck size={18}/><p><strong>You stay in creative control.</strong>Review and edit the drafts before moving them into your workflow. Nothing is published by generating.</p></div>
        </aside>}
        </div>

        {billingBlocked && <div className="px-5 sm:px-7"><WorkspaceFeatureNotice compact message="Your current subscription or AI allowance does not cover this generation. Upgrade for more access, or wait for your monthly allowance to reset." /></div>}
        {hasBusinessSummaryState && (
          <div className={studioStyles.footer}>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#101828]">
                Ready to create your batch?
              </p>
              <p className="mt-1 text-[10px] leading-5 text-[#667085]">
                Your drafts will open in review before anything is published.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void generate()}
              disabled={generating || platforms.length === 0 || !expected?.drafts}
              className="group mt-4 inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2478FF] px-5 py-3 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(36,120,255,0.20)] transition-all hover:-translate-y-0.5 hover:bg-[#1768E8] hover:shadow-[0_16px_34px_rgba(36,120,255,0.24)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 sm:mt-0 sm:w-auto"
            >
              {generating ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating…
                </>
              ) : (
                <>
                  Create content
                  <span className="transition-transform group-hover:translate-x-0.5">
                    <ArrowIcon />
                  </span>
                </>
              )}
            </button>
          </div>
        )}
        {activeJobId && !reviewOpen && (
          <div className="mx-5 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 sm:mx-7">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 animate-ping rounded-full bg-blue-600" />
              <span className="font-semibold">Content generation is running in the background.</span>
            </div>
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white shadow-sm hover:bg-blue-700"
            >
              Open draft queue
            </button>
          </div>
        )}
      </section>

      {reviewOpen && (
        <AiDraftReviewModal
          calendarId={calendarId}
          jobId={activeJobId}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </>
  );
}
