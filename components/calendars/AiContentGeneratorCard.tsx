"use client";
import studioStyles from "./GenerateStudio.module.css";
import PlatformBrandIcon from "./PlatformBrandIcon";
import { WandSparkles, BookOpenText, Layers3, CalendarRange, ShieldCheck, Sparkles, Target, PenLine } from "lucide-react";
import { consumeResearchBrief, RESEARCH_BRIEF_EVENT } from "@/lib/knowledge/researchHandoff";
import { generationCount } from "@/lib/content/schedule";
import KnowledgeClarification, { type ClarificationPrompt, type ClarificationResponse } from "./KnowledgeClarification";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { readAiGenerationResponse, waitForAiGeneration } from "@/lib/aiGenerationResponse";

import { useEffect, useState, useMemo, useRef } from "react";
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
 const [wizardStep, setWizardStep] = useState("platforms");
 const stepHeading = useRef<HTMLHeadingElement>(null);
 const wizardSteps = platforms.length > 1 ? ["platforms", "schedule", "options", "direction"] : ["platforms", "schedule", "direction"];
 const stepIndex = wizardSteps.indexOf(wizardStep);
 function moveStep(next: string) { setWizardStep(next); requestAnimationFrame(() => stepHeading.current?.focus()); }
 const stepTitles: Record<string,string> = {platforms:"Where do you want to post?",schedule:"When should your calendar run?",options:"How should your channels work together?",direction:"What should this calendar focus on?"};
 const advancedRef = useRef<HTMLDetailsElement>(null);
 useEffect(() => {
   if (platforms.length > 1 && advancedRef.current) advancedRef.current.open = true;
 }, [platforms.length]);
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
        <header className={studioStyles.simpleHeader}><div><h1>Generate your content calendar</h1><p>Build your calendar, one simple step at a time.</p></div></header>
        <div className={`${studioStyles.layout} ${!hasBusinessSummaryState ? studioStyles.singleColumn : ""}`}>
        <div className={studioStyles.form}>
          {reportingRecommendationLoaded && (
            <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
              <SparkIcon /> Reporting recommendations added to Creative direction. Review or edit them before generating.
            </p>
          )}

          {!hasBusinessSummaryState ? (
            <div className={studioStyles.missingKnowledge}><BookOpenText size={25}/><h2>Add business knowledge first</h2><p>Add your documents or website and set your brand voice to give these drafts the right foundation.</p><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("showwork-workspace-navigate", { detail: { id: "knowledge" } }))}>Set up business knowledge <ArrowIcon/></button></div>
          ) : (
            <>

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

              <div className={studioStyles.wizardProgress}><span>Step {stepIndex + 1} of {wizardSteps.length}</span><progress value={stepIndex + 1} max={wizardSteps.length} aria-label="Calendar setup progress"/></div>
              <h2 className={studioStyles.wizardTitle} ref={stepHeading} tabIndex={-1}>{stepTitles[wizardStep]}</h2>
              <div className={studioStyles.calendarBrief}>
                <div className={studioStyles.planningFields}>
              <div hidden={wizardStep !== "platforms"} className={studioStyles.channelChoices}>
                <div className={studioStyles.channelLabel}><strong>Channels</strong><span>{platforms.length} selected</span></div>
                <div className={studioStyles.channelRow}>
                  {PLATFORMS.map((platform) => {
                    const selected = platforms.includes(platform.value);

                    return (
                      <button
                        key={platform.value}
                        type="button"
                        onClick={() => togglePlatform(platform.value)}
                        aria-pressed={selected}
                        aria-label={platform.label}
                        title={platform.label}
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

              <div hidden={wizardStep !== "schedule"} className={studioStyles.scheduleRow}>
                <label>Start date<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)}/></label>
                <label>End date<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)}/></label>
                <label>Posts per week<input type="number" min={1} max={14} value={postsPerWeek} onChange={event => setPostsPerWeek(Math.min(14,Math.max(1,Number(event.target.value)||1)))}/></label>
              </div>
              <div hidden={wizardStep !== "direction"}><label className={studioStyles.goalField}>Content goal <span className="font-normal text-slate-400">Optional</span><select value={campaignObjective} onChange={e=>setCampaignObjective(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="">Use my business knowledge</option>{["Brand Awareness","Engagement","Audience Education","Lead Generation","Product Adoption","Sales / Conversion","Custom Objective"].map(objective=><option key={objective}>{objective}</option>)}</select></label>
              {campaignObjective==="Custom Objective"&&<p className="mt-1 text-xs text-slate-500">Describe your goal in Creative direction.</p>}</div>
              <details ref={advancedRef} hidden={wizardStep !== "options"} open className={studioStyles.channelOptions}>
                <summary>Channel options <span>{platforms.length > 1 ? "Grouping & timing" : "Select multiple channels to customize"}</span></summary>
                {platforms.length > 1 && <div className={studioStyles.optionFields}>
                  <label>Content approach<select value={contentStrategy} onChange={event => {
                    const value = event.target.value as typeof contentStrategy;
                    setContentStrategy(value);
                    if(value === "CUSTOM_GROUPS" && !contentGroups.length) setContentGroups([platforms]);
                  }}><option value="SAME_CONTENT">Shared ideas, adapted per channel</option><option value="DIFFERENT_CONTENT">Different ideas for each channel</option><option value="CUSTOM_GROUPS">Custom channel groups</option></select></label>
                  <label>Schedule across channels<select value={scheduleStrategy} onChange={event => {
                    const value = event.target.value as typeof scheduleStrategy;
                    setScheduleStrategy(value);
                    if(value === "SAME_TIME" || value === "SAME_DAY") setPlatformSchedules(Object.fromEntries(platforms.map((platform,index) => [platform,{date:startDate,time:value === "SAME_TIME" ? "10:00" : `${String(10+index).padStart(2,"0")}:00`}])));
                    else setPlatformSchedules(previous => {const next = {...previous};platforms.forEach(platform => {if(!next[platform])next[platform]={date:startDate,time:"10:00"};});return next;});
                  }}><option value="SAME_TIME">Same day & time</option><option value="SAME_DAY">Same day, different times</option><option value="CUSTOM">Custom dates & times</option></select></label>
                  <p>These settings plan drafts. Publishing still requires approval.</p>
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
    )}    {scheduleStrategy === "CUSTOM" && (
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


                </div>}
              </details>
                </div>
              <label hidden={wizardStep !== "direction"} className={studioStyles.directionPanel}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-[#101828]">
                      Creative direction
                    </span>
                    <span className="mt-1 block text-[10px] leading-5 text-[#667085]">
                      What should this calendar focus on?
                    </span>
                  </div>
                  <span className="hidden text-[9px] text-[#98A2B3] sm:block">
                    Optional
                  </span>
                </div>

                <textarea
                  value={customInstructions}
                  onChange={(event) => { setCustomInstructions(event.target.value); if (!event.target.value.trim()) setReportingRecommendationLoaded(false); }}
                  rows={2}
                  placeholder="For example: Focus on our new service, address common customer questions, and use a friendly tone."
                  className="mt-3 w-full resize-y rounded-2xl border border-[#D9E2EC] bg-white px-4 py-3.5 text-[11px] leading-6 text-[#344054] outline-none transition-all placeholder:text-[#98A2B3] hover:border-[#B9C7D8] focus:border-[#2478FF] focus:ring-4 focus:ring-[#2478FF]/10"
                />
                <div className="mt-1.5 text-right text-[9px] text-[#98A2B3]">
                  Your business knowledge and brand voice guide every draft.
                </div>
              </label>
              </div>

            </>
          )}
        </div>

        {hasBusinessSummaryState && <aside className={studioStyles.summary} aria-label="Generation summary">
          <button type="button" className={studioStyles.wizardBack} disabled={generating || stepIndex <= 0} onClick={() => moveStep(wizardSteps[stepIndex-1])}>Back</button>
          <div className={studioStyles.compactCount} aria-live="polite">{wizardStep === "direction" && expected ? <strong>{expected.ideas} ideas → {expected.drafts} drafts</strong> : <span>{wizardStep === "platforms" ? `${platforms.length} selected` : wizardStep === "schedule" ? "Choose dates and a weekly frequency." : "Choose shared or separate ideas and timing."}</span>}</div>
            <button
              type="button"
              onClick={() => wizardStep === "direction" ? void generate() : moveStep(wizardSteps[stepIndex+1])}
              disabled={generating || platforms.length === 0 || (wizardStep === "schedule" && (!startDate || !endDate || endDate < startDate)) || ((wizardStep === "options" || wizardStep === "direction") && !expected?.drafts)}
              className={studioStyles.generateButton}
            >
              {generating ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating…
                </>
              ) : (
                <>
                  {wizardStep === "direction" ? "Generate calendar" : "Next"}
                  <span className="transition-transform group-hover:translate-x-0.5">
                    <ArrowIcon />
                  </span>
                </>
              )}
            </button>
          {wizardStep === "direction" && <p className={studioStyles.reviewHint}>You’ll review drafts before publishing.</p>}
        </aside>}
        </div>

        {billingBlocked && <div className="px-5 sm:px-7"><WorkspaceFeatureNotice compact message="Your current subscription or AI allowance does not cover this generation. Upgrade for more access, or wait for your monthly allowance to reset." /></div>}
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
