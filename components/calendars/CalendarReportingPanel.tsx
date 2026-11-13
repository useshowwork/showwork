"use client";

import { strategyBrief, type MonthlyStrategy } from "@/lib/reporting/monthlyStrategy";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";
import PlatformBrandIcon from "./PlatformBrandIcon";
import ReportingVisuals from "./ReportingVisuals";
import ReportingChannels from "./ReportingChannels";
import ReportingInsights from "./ReportingInsights";
import dashboardStyles from "./ReportingDashboard.module.css";


import { queueReportingRecommendation } from "@/lib/reporting/recommendationHandoff";
import UiSymbol from "@/components/ui/UiSymbol";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3,  Eye, Flame, Minus, Target, RefreshCw, Sparkles, Users, ChartNoAxesCombined, ChevronDown } from "lucide-react";

type Metrics = {
  reach?: number | null;
  impressions?: number | null;
  views?: number | null;
  engagement?: number | null;
  engagementRate?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
};
type Change = { value: number | null; delta: number | null; percent: number | null; basis: string; note?: string };
export type Report = {
  advancedAccess?: boolean;
  updating?: boolean;
  updateUnavailable?: boolean;
  comparisonPeriod: { start: string; end: string };
  performance: Record<string, Change>;
  leads: { total: number; acquired: Change; hotCount: number; customers: number; hottest: Array<{ id: string; name: string; company: string | null; username: string | null; status: string; source: string; updatedAt: string; socialConversation: { platform: string; participantName: string | null; participantUsername: string | null } | null }> } | null;
  period: { start: string; end: string };
  facebookPageActivity: {
    pageId: string; pageName: string; followers: number | null;
    notices: string[];
    latestMetrics?: { asOf: string; reach: number | null; views: number | null; engagement: number | null; mediaViews: number | null } | null;
    posts: Array<{ id: string; message: string | null; createdAt: string | null; permalink: string | null; imageUrl: string | null; likes: number | null; comments: number | null; shares: number | null; reach: number | null; impressions: number | null }>;
  } | null;
  facebookPageActivityError: string | null;
  connections: Array<{
    id: string; platform: string; platformAccountId: string; accountName: string | null; username: string | null;
    status: string; lastSyncAt: string | null; lastSyncAttemptAt: string | null; lastSyncError?: string | null;
    accountMetricSnapshots: Array<{ snapshotDate: string; followers: number | null; followerGrowth: number | null; reach: number | null; views: number | null; engagement: number | null; additionalMetrics?: Record<string, unknown> | null }>;
  }>;
  accountPosts: Array<{
    id: string; connectionId: string; platform: string; platformPostId: string; caption: string | null; postType: string | null;
    publishedAt: string; permalink: string | null; views: number | null; reach: number | null;
    impressions: number | null; engagement: number | null; likes: number | null; comments: number | null;
    shares: number | null; saves: number | null; metricsUpdatedAt: string | null;
    accountName: string | null; username: string | null; source: "PLATFORM";
  }>;
  posts: Array<{
    id: string; platform: string; permalink: string | null; status: string; publishedAt: string | null;
    metricSnapshots: Array<Metrics & { snapshotDate: string }>;
    connection: { accountName: string | null; username: string | null } | null;
    calendarPost: { caption: string | null; postType: string; assets: Array<{ mediaType: string; previewUrl: string | null }> };
  }>;
  insights: Array<{ id: string; platform: string | null; type: string; title: string; description: string; recommendation: string | null; generatedAt: string; strategy?: MonthlyStrategy | null; evidence?: string | null; researchSources?: Array<{ url: string; title: string }>; targetMonth?: { startDate: string; endDate: string } | null }>;
};

const label: Record<string, string> = { INSTAGRAM: "Instagram", TIKTOK: "TikTok", FACEBOOK: "Facebook", LINKEDIN: "LinkedIn", X: "X", YOUTUBE: "YouTube" };
const dateInput = (date: Date) => date.toISOString().slice(0, 10);
const number = (value: number | null | undefined) => value == null ? "—" : Intl.NumberFormat(undefined, { maximumFractionDigits: 1, notation: value >= 100000 ? "compact" : "standard" }).format(value);

function renderMetricNote(note: string) {
  return note.split("→").map((part, index) => <span key={index}>{index > 0 && <><UiSymbol name="right" /><span className="sr-only">to</span></>}{part}</span>);
}

function Trend({ metric, followers = false }: { metric: Change; followers?: boolean }) {
  if (metric.delta == null) return <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Activity className="h-3 w-3" />{renderMetricNote(metric.note || "No earlier data to compare")}<span className="sr-only"> · {metric.basis}</span></span>;
  const Icon = metric.delta === 0 ? Minus : metric.delta > 0 ? ArrowUpRight : ArrowDownRight;
  return <div><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${metric.delta === 0 ? "bg-slate-100 text-slate-600" : metric.delta > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}><Icon aria-hidden="true" className="h-3.5 w-3.5" />{metric.delta > 0 ? "+" : metric.delta < 0 ? "−" : ""}{followers && metric.delta === 0 ? "No net follower change recorded" : `${metric.delta === 0 ? "0" : number(Math.abs(metric.delta))}${followers ? " followers" : ""}`}{metric.percent != null && !(followers && metric.delta === 0) && <span className="font-normal">({Math.abs(metric.percent).toFixed(1)}%)</span>}<span className="sr-only">{metric.delta > 0 ? "increase" : metric.delta < 0 ? "decrease" : "no change"}</span></span>{metric.note && <p className="mt-2 text-[10px] leading-4 text-slate-500">{renderMetricNote(metric.note)}</p>}</div>;
}

export default function CalendarReportingPanel({ calendarId, isManager, canAnalyze, canApplyRecommendations, canViewLeads = true, clientSlug, advancedAccess = true, recommendationsAccess = true }: { calendarId: string; isManager: boolean; canAnalyze: boolean; canApplyRecommendations: boolean; canViewLeads?: boolean; clientSlug?: string; advancedAccess?: boolean; recommendationsAccess?: boolean }) {
  const [from, setFrom] = useState(() => dateInput(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => dateInput(new Date()));
  const [platform, setPlatform] = useState("");
  const [datePreset, setDatePreset] = useState("30");
  const queryKey = JSON.stringify([calendarId, clientSlug, from, to, platform]);
  const [loadedReport, setLoadedReport] = useState<{ key: string; data: Report } | null>(null);
  // A filter change immediately invalidates old actions, before the fetch effect runs.
  const report = loadedReport?.key === queryKey ? loadedReport.data : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [reportSection, setReportSection] = useState("performance");
  const [postsExpanded, setPostsExpanded] = useState(false);
  const [sectionRequest, setSectionRequest] = useState(0);
  const pendingSection = useRef<{ id: string; focus: boolean } | null>(null);
  function showSection(id: string, focus = false) {
    pendingSection.current = { id, focus };
    setReportSection(id);
    setSectionRequest(value => value + 1);
  }
  useEffect(() => {
    const pending = pendingSection.current;
    if (!pending || pending.id !== reportSection || !report) return;
    const panel = document.getElementById?.(`analytics-panel-${pending.id}`);
    if (!panel) return;
    pendingSection.current = null;
    // Run after the destination is visible; hidden panels otherwise preserve the old bottom position.
    panel.scrollIntoView({ block: "start", behavior: "instant" });
    if (pending.focus) panel.focus({ preventScroll: true });
  }, [reportSection, report, sectionRequest]);
  const channelDropdown = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (channelDropdown.current && !channelDropdown.current.contains(event.target as Node)) channelDropdown.current.open = false;
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, []);
  function toggleChannel(key: string) {
    setPlatform(current => {
      const selected = current ? current.split(",") : [];
      return (selected.includes(key) ? selected.filter(value => value !== key) : [...selected, key]).sort().join(",");
    });
  }

  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!from || !to || from > to) { setError("Choose a valid reporting date range."); setLoadedReport(null); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ from, to });
      if (platform) query.set("platform", platform);
      const response = await calendarMutationFetch(`${clientSlug ? `/api/social-calendar/${encodeURIComponent(clientSlug)}` : `/api/calendars/${encodeURIComponent(calendarId)}`}/reporting?${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load reporting.");
      if (version === requestVersion.current) setLoadedReport({ key: queryKey, data });
    } catch (err) { if (version === requestVersion.current) setError(err instanceof Error ? err.message : "Could not load reporting."); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [calendarId, clientSlug, from, to, platform, queryKey]);

  const latestLoad = useRef(load);
  const mounted = useRef(false);
  useEffect(() => {
    latestLoad.current = load;
    void load();
    return () => { ++requestVersion.current; };
  }, [load]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const invalidate = () => { ++requestVersion.current; setLoadedReport(null); void latestLoad.current(); };
    const onChange = (event: Event) => {
      if ((event as CustomEvent<{ calendarId: string }>).detail?.calendarId === calendarId) invalidate();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "showwork-reporting-channel-change" || !event.newValue) return;
      try { if (JSON.parse(event.newValue).calendarId === calendarId) invalidate(); } catch { /* Ignore unrelated/malformed storage. */ }
    };
    const onFocus = () => { void latestLoad.current(); };
    window.addEventListener("showwork-reporting-channels-changed", onChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("showwork-reporting-channels-changed", onChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [calendarId, clientSlug]);

  const syncInFlight = useRef(false);
  async function syncReportingNow() {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncing(true); setSyncNotice("");
    try {
      const response = await calendarMutationFetch(`/api/calendars/${encodeURIComponent(calendarId)}/reporting/sync`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start the update.");
      if (mounted.current) {
        setSyncNotice(data.queued ? "Updating your results in the background. You can keep exploring." : data.eligible ? "Your results are up to date. Updates run automatically." : "Connect a supported channel to start collecting results.");
        await latestLoad.current();
      }
    } catch (err) { if (mounted.current) setSyncNotice(err instanceof Error ? err.message : "Could not start the update."); }
    finally { syncInFlight.current = false; if (mounted.current) setSyncing(false); }
  }

  // Reload saved data while jobs run; never issue AI requests or hide existing results.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void latestLoad.current();
    }, report?.updating ? 5000 : 60_000);
    return () => window.clearInterval(timer);
  }, [calendarId, clientSlug, report?.updating]);

  const connected = report?.connections.filter(c => c.status === "CONNECTED" && c.platform !== "YOUTUBE").length ?? 0;
  const [strategyDirty, setStrategyDirty] = useState(false);
  const [strategyObjective, setStrategyObjective] = useState("");
  const shownInsights = report?.insights ?? [];
  const canApply = canApplyRecommendations && recommendationsAccess && !clientSlug && !analyzing && !!report && !strategyDirty;

  async function analyzePerformance() {
    setAnalyzing(true); setError("");
    try {
      const response = await calendarMutationFetch(`/api/calendars/${encodeURIComponent(calendarId)}/reporting/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, objective: strategyObjective, ...(platform ? { platform } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not analyze reporting data.");
      if (mounted.current) { await latestLoad.current(); setStrategyDirty(false); }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not analyze reporting data."); }
    finally { setAnalyzing(false); }
  }

  function applyRecommendation(title: string, description: string, recommendation: string | null) {
    if (!canApply) return;
    const insight = shownInsights.find(item => item.strategy && item.title === title);
    if (insight?.strategy) {
      openContentGenerator(strategyBrief(insight.strategy));
      return;
    }
    if (!recommendation?.trim()) return;
    openContentGenerator(`Reporting insight: ${title}.\nEvidence: ${description}.\nRecommendation: ${recommendation}`);
  }

  function openContentGenerator(instructions: string) {
    if (!queueReportingRecommendation(calendarId, instructions)) return;
    window.dispatchEvent(new CustomEvent("showwork-workspace-navigate", { detail: { id: "generate" } }));
  }

  const unavailable: Change = { value: null, delta: null, percent: null, basis: "vs previous period" };
  const cards = [
    { title: report?.performance.followers?.basis.startsWith("Current Facebook") ? "Current followers" : "Followers", metric: report?.performance.followers ?? unavailable, icon: Users, tint: "bg-amber-50 text-amber-700" },
    { title: report?.performance.reach?.basis.includes("Latest available") ? "Latest daily reach" : report?.performance.reach?.basis.includes("lifetime totals") ? "Post reach (sum)" : "Daily reach", metric: report?.performance.reach ?? unavailable, icon: Eye, tint: "bg-blue-50 text-blue-700" },
    { title: report?.performance.views?.basis.includes("Latest available") ? "Latest daily video views" : "Video views", metric: report?.performance.views ?? unavailable, icon: BarChart3, tint: "bg-violet-50 text-violet-700" },
    { title: report?.performance.engagement?.basis.includes("Latest available") ? "Latest daily engagements" : "Engagements", metric: report?.performance.engagement ?? unavailable, icon: Activity, tint: "bg-emerald-50 text-emerald-700" },
    ...(report?.performance.likes?.value != null ? [{ title: report.performance.likes.basis.includes("lifetime totals") ? "Post likes" : "Likes", metric: report.performance.likes, icon: Activity, tint: "bg-blue-50 text-blue-700" }] : []),
    ...(report?.performance.postMediaViews?.value != null ? [{ title: "Post media views", metric: report.performance.postMediaViews, icon: Eye, tint: "bg-indigo-50 text-indigo-700" }] : []),
    { title: "Total leads", metric: { value: report?.leads?.total ?? null, delta: report?.leads?.acquired.value ?? null, percent: null, basis: "new leads in selected period" }, icon: Target, tint: "bg-rose-50 text-rose-700" },
    { title: "New leads", metric: report?.leads?.acquired ?? unavailable, icon: Flame, tint: "bg-orange-50 text-orange-700" },
  ];
  const activeConnections = report?.connections.filter(connection => connection.status === "CONNECTED" && connection.platform !== "YOUTUBE") ?? [];
  // The report is only as fresh as its oldest active channel, not the newest one.
  const updatedAt = activeConnections.length && activeConnections.every(connection => connection.lastSyncAt)
    ? activeConnections.map(connection => connection.lastSyncAt!).sort()[0] : null;
  const hasObservations = activeConnections.some(connection => connection.lastSyncAt);
  const primaryCards = [cards[0], cards[1], cards[3], !clientSlug && canViewLeads && report?.leads ? cards.at(-1)! : cards[2]];
  const topPosts = [...(report?.accountPosts ?? [])].filter(post => post.engagement != null).sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0)).slice(0, 3);
  const nextRecommendation = report?.insights.find(insight => insight.strategy || insight.recommendation?.trim());
  const openChannels = () => window.dispatchEvent(new CustomEvent("showwork-workspace-navigate", { detail: { id: "channels" } }));
  const reachDays = new Map<string, number>();
  for (const connection of report?.connections ?? []) {
    if (connection.status !== "CONNECTED") continue;
    for (const snapshot of connection.accountMetricSnapshots) {
      if (snapshot.reach != null) {
        const day = snapshot.snapshotDate.slice(0, 10);
        reachDays.set(day, (reachDays.get(day) ?? 0) + snapshot.reach);
      }
    }
  }
  const timeline: Array<[string, number | null]> = [];
  if (report && reachDays.size) {
    for (let timestamp = +new Date(report.period.start); timestamp <= +new Date(report.period.end); timestamp += 86400000) {
      const day = dateInput(new Date(timestamp));
      timeline.push([day, reachDays.get(day) ?? null]);
    }
  }
  const navigateToLeads = () => window.dispatchEvent(new CustomEvent("showwork-workspace-navigate", { detail: { id: "leads" } }));

  return <section aria-busy={loading && !report} className={dashboardStyles.dashboard} aria-label="Social reporting">
    <header className={dashboardStyles.simpleHeader}>
      <div><p className={dashboardStyles.reportEyebrow}><ChartNoAxesCombined size={15} aria-hidden="true"/> Analytics & reporting</p><h1>See what’s working.</h1>
        <div className={dashboardStyles.statusLine}><div className={dashboardStyles.freshness} role="status" aria-live="polite"><RefreshCw size={13} className={report?.updating || syncing ? "animate-spin" : ""} aria-hidden="true"/>
          {report?.updating || syncing ? "Updating your results…" : updatedAt ? `Results last updated ${new Date(updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : connected ? "Collecting your first results" : report ? "Connect a channel to get started" : "Loading your results…"}
        </div>
        </div>
      </div>
      <div className={dashboardStyles.simpleFilters}>
        <label>Period<select value={datePreset} onChange={event => {
          const value = event.target.value; setDatePreset(value);
          if (value !== "custom") { setTo(dateInput(new Date())); setFrom(dateInput(new Date(Date.now() - (Number(value) - 1) * 86400000))); }
        }}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom dates</option></select></label>
        <div className={dashboardStyles.channelFilter}><span>Channels</span>
          <details ref={channelDropdown} className={dashboardStyles.channelDropdown} onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
            <summary><span>{!platform ? "All channels" : platform.split(",").length === 1 ? label[platform] : `${platform.split(",").length} channels`}</span><ChevronDown size={16} aria-hidden="true"/></summary>
            <div className={dashboardStyles.channelOptions}>
              <fieldset><legend className="sr-only">Choose channels to compare</legend>
                <label><input type="checkbox" value="ALL" checked={!platform} onChange={() => setPlatform("")}/><span>All channels</span></label>
                {Object.entries(label).filter(([key]) => key !== "YOUTUBE").map(([key, name]) => <label key={key}><input type="checkbox" value={key} checked={platform.split(",").includes(key)} onChange={() => toggleChannel(key)}/><PlatformBrandIcon platform={key} size={17}/><span>{name}</span></label>)}
              </fieldset>
              <button type="button" onClick={() => { if (channelDropdown.current) { channelDropdown.current.open = false; channelDropdown.current.querySelector("summary")?.focus(); } }}>Done</button>
            </div>
          </details>
        </div>
        {isManager && !clientSlug && <button type="button" className={dashboardStyles.updateButton} onClick={() => void syncReportingNow()} disabled={syncing || report?.updating || !activeConnections.length}><RefreshCw size={14} aria-hidden="true"/>{syncing || report?.updating ? "Updating" : "Update now"}</button>}
      </div>
      {datePreset === "custom" && <div className={dashboardStyles.customDates}><label>From<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)}/></label><label>To<input type="date" value={to} min={from} max={dateInput(new Date())} onChange={event => setTo(event.target.value)}/></label></div>}
    </header>
    {error && <div role="alert" className={dashboardStyles.attention}>{error}<button type="button" onClick={() => void load()}>Try again</button></div>}
    {syncNotice && <p role="status" className={dashboardStyles.infoNotice}>{syncNotice}</p>}

    {(!advancedAccess || report?.advancedAccess === false) && <WorkspaceFeatureNotice compact feature="advancedAnalytics" />}
    <nav className={dashboardStyles.simpleTabs} aria-label="Analytics sections" role="tablist">{[["performance", "Overview"], ["channel-detail", "Posts"], ["ai-insights", "Recommendations"]].map(([id, title], index, tabs) => <button type="button" key={id} id={`analytics-tab-${id}`} role="tab" aria-selected={reportSection === id} aria-controls={`analytics-panel-${id}`} tabIndex={reportSection === id ? 0 : -1} onClick={() => showSection(id)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
      if (next != null) { event.preventDefault(); showSection(tabs[next][0]); document.getElementById(`analytics-tab-${tabs[next][0]}`)?.focus(); }
    }}>{title}</button>)}</nav>
    {loading && !report ? <div className={dashboardStyles.empty}>Loading your results…</div> : report && <>
      {!connected && !hasObservations && <div className={dashboardStyles.firstResults}><BarChart3 size={26} aria-hidden="true"/><h2>Your results start here</h2><p>Connect your social channels. We’ll collect the available metrics automatically.</p>{!clientSlug && <button type="button" onClick={openChannels}>Connect channels <ArrowUpRight size={15}/></button>}</div>}
      {connected > 0 && !hasObservations && <div className={dashboardStyles.firstResults} role="status"><RefreshCw size={24} aria-hidden="true"/><h2>{report.updating ? "Preparing your analytics" : "Your first results are on their way"}</h2><p>Available results will appear automatically. Some metrics need additional channel permissions.</p></div>}
      <div id="analytics-panel-performance" tabIndex={-1} role="tabpanel" aria-labelledby="analytics-tab-performance" hidden={reportSection !== "performance"} className={dashboardStyles.tabPanel}>
        <div className={dashboardStyles.metricGrid}>{primaryCards.map(({ title, metric, icon: Icon, tint }) => <article key={title} className={dashboardStyles.metricCard} data-unavailable={metric.value == null}><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-slate-600">{title}</p><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tint}`}><Icon className="h-4 w-4" aria-hidden="true"/></span></div><p className="mt-3 text-3xl font-semibold tracking-tight">{number(metric.value)}</p><p className="mt-1 text-xs leading-5 text-slate-500">{metric.basis}</p><div className="mt-3"><Trend metric={metric} followers={title.includes("followers") || title === "Followers"}/></div></article>)}</div>
        <ReportingVisuals timeline={timeline} posts={report.accountPosts} compact />
        <div className={dashboardStyles.overviewBottom}>
          <section className={dashboardStyles.topPosts}><div><h2>Top posts</h2><button type="button" onClick={() => showSection("channel-detail", true)}>View all <ArrowUpRight size={14}/></button></div><p>Ranked by available lifetime engagements.</p>{topPosts.length ? topPosts.map(post => <article key={post.id}><PlatformBrandIcon platform={post.platform} size={21}/><div><p>{post.caption || post.postType || "Published post"}</p><span>{new Date(post.publishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {number(post.engagement)} engagements</span></div>{post.permalink && <a href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label[post.platform] || post.platform} post`}><ArrowUpRight size={17}/></a>}</article>) : <p className={dashboardStyles.empty}>No post metrics for this period yet.</p>}</section>
          <section className={dashboardStyles.recommendedAction} aria-labelledby="next-move-title">
            <div className={dashboardStyles.nextMoveTop}><span><Sparkles size={13} aria-hidden="true"/>{nextRecommendation && recommendationsAccess ? "Your strategy is ready" : "Your next move"}</span><ArrowUpRight size={36} aria-hidden="true"/></div>
            <h2 id="next-move-title">Before your next post,<br/>read this.</h2>
            <p>{nextRecommendation && recommendationsAccess ? nextRecommendation.title : "Turn your results into one clear direction for your next calendar."}</p>
            <button type="button" onClick={() => showSection("ai-insights", true)}>{nextRecommendation && recommendationsAccess ? "See my recommendation" : "Explore my next move"}<ArrowUpRight size={17} aria-hidden="true"/></button>
            <span className={dashboardStyles.nextMoveNote}>The insight. The reason. Your next direction.</span>
          </section>
        </div>
        <details className={dashboardStyles.supportingDetail}><summary>Channel status & data availability</summary><div className={dashboardStyles.statusList}>{report.connections.map(connection => <div key={connection.id}><PlatformBrandIcon platform={connection.platform} size={18}/><strong>{label[connection.platform] || connection.platform}</strong><span>{connection.status === "NEEDS_REAUTH" ? "Reconnect required" : connection.status !== "CONNECTED" ? "Disconnected" : connection.platform === "YOUTUBE" ? "Reporting not available yet" : connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : "Waiting for first update"}</span>{!clientSlug && (connection.status === "NEEDS_REAUTH" || connection.lastSyncError) && <button type="button" onClick={openChannels}>Check access</button>}</div>)}</div></details>
        {!clientSlug && canViewLeads && report.leads && <details className={dashboardStyles.supportingDetail}><summary>Lead opportunities · {number(report.leads.acquired.value)} new this period</summary>
        {!clientSlug && canViewLeads && report.leads && <section id="lead-opportunities" className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Top five hottest leads"><div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6"><div><p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-600"><Flame className="h-3.5 w-3.5" /> Opportunity radar</p><h4 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Your 5 hottest leads</h4><p className="mt-1 text-xs text-slate-500">Hot leads acquired in this period, most recently updated first.</p></div><button type="button" onClick={navigateToLeads} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">Open leads <ArrowUpRight className="h-3.5 w-3.5" /></button></div><div className="mx-5 mb-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center"><div><p className="text-lg font-semibold text-slate-900">{number(report.leads?.acquired.value)}</p><p className="text-[10px] text-slate-500">New this period</p></div><div><p className="text-lg font-semibold text-orange-600">{number(report.leads?.hotCount)}</p><p className="text-[10px] text-slate-500">Hot & open now</p></div><div><p className="text-lg font-semibold text-emerald-700">{number(report.leads?.customers)}</p><p className="text-[10px] text-slate-500">Now customers</p></div></div>{report.leads?.hottest.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Top five hot open leads created in the selected period, ordered by most recent update</caption><thead className="border-y border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3">Lead</th><th scope="col" className="px-3 py-3">Source</th><th scope="col" className="px-3 py-3">Stage</th><th scope="col" className="px-5 py-3">Activity</th></tr></thead><tbody className="divide-y divide-slate-100">{report.leads.hottest.map((lead, index) => <tr key={lead.id} className="transition hover:bg-orange-50/40"><td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 font-bold text-orange-600">{index + 1}</span><div><p className="font-semibold text-slate-900">{lead.socialConversation?.participantName || lead.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{lead.company || lead.username || lead.socialConversation?.participantUsername || "Hot lead"}</p></div></div></td><td className="px-3 py-3 text-slate-500">{lead.socialConversation ? label[lead.socialConversation.platform] || lead.socialConversation.platform : lead.source === "IMPORT" ? "Import" : "Manual"}</td><td className="px-3 py-3"><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold capitalize text-indigo-700">{lead.status.toLowerCase()}</span></td><td className="whitespace-nowrap px-5 py-3 text-slate-500">{new Date(lead.updatedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <div className="mx-5 mb-5 rounded-xl border border-dashed border-orange-200 bg-orange-50/40 p-5 text-center"><Flame className="mx-auto h-6 w-6 text-orange-400" /><p className="mt-2 text-sm font-semibold text-slate-700">No hot open leads in this period</p><p className="mt-1 text-xs leading-5 text-slate-500">Qualify leads as Hot in your lead pipeline to surface your next opportunities here.</p></div>}<p className="px-5 pb-5 pt-3 text-[10px] leading-4 text-slate-400">Stages reflect current qualification. Customers and lost leads are excluded from the shortlist.{platform && " Platform filtering includes leads linked to the selected social channels."}</p></section>}
        </details>}
        <details className={dashboardStyles.supportingDetail}><summary>How these numbers are calculated</summary><p>Comparisons use {report.comparisonPeriod.start.slice(0, 10)}–{report.comparisonPeriod.end.slice(0, 10)}. Missing observations remain gaps, never zeroes. Post counters are current lifetime totals for posts published in this period. Daily reach may count the same person on different days. Metrics depend on channel access and availability.</p></details>
      </div>
      <div id="analytics-panel-channel-detail" tabIndex={-1} role="tabpanel" aria-labelledby="analytics-tab-channel-detail" hidden={reportSection !== "channel-detail"}><ReportingChannels report={report} expanded={postsExpanded} onToggle={() => setPostsExpanded(value => !value)} /></div>
      <div id="analytics-panel-ai-insights" tabIndex={-1} role="tabpanel" aria-labelledby="analytics-tab-ai-insights" hidden={reportSection !== "ai-insights"}><ReportingInsights insights={shownInsights} total={report.insights.length} analyzing={analyzing} loading={loading && !report} canAnalyze={canAnalyze} canApply={canApply} access={recommendationsAccess} client={Boolean(clientSlug)} onAnalyze={() => void analyzePerformance()} onApply={applyRecommendation} objective={strategyObjective} onObjective={value => { setStrategyObjective(value); setStrategyDirty(true); }} goalChanged={strategyDirty}/></div>
    </>}
  </section>;
}
