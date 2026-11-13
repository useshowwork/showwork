"use client";

import ShowworkLogo from "@/components/brand/ShowworkLogo";
import { CircleHelp, Menu, Sparkles, ArrowLeft, LayoutDashboard, CalendarRange, UsersRound, ChartNoAxesCombined, MessagesSquare, ContactRound, PanelsTopLeft, Cable, BrainCircuit, BookOpenText, WandSparkles, SendHorizontal, ChevronsLeft, ChevronsRight, ChevronRight } from "lucide-react";
import menuStyles from "./WorkspaceMenu.module.css";
import headerStyles from "./WorkspaceHeader.module.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MobileDrawer from "@/components/navigation/MobileDrawer";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import WorkspaceSetup from "@/components/calendars/WorkspaceSetup";
import type { WorkspaceSetupState } from "@/lib/workspaceSetup";
import WorkspaceUploadTray from "@/components/uploads/WorkspaceUploadTray";
import InboxHandoffAlert from "./InboxHandoffAlert";

type WorkspaceSectionId =
  | "overview"
  | "content"
  | "team"
  | "analytics"
  | "inbox"
  | "leads"
  | "access"
  | "channels"
  | "research"
  | "knowledge"
  | "generate"
  | "publish";

type WorkspaceSection = {
  id: WorkspaceSectionId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  group:
    | "Workspace"
    | "Collaboration"
    | "Insights"
    | "Leads & Messages"
    | "Client"
    | "Publishing"
    | "AI Studio";
  content: ReactNode;
};

type NavCluster = {
  label: string;
  items: WorkspaceSection[];
  featured?: boolean;
};

function SectionIcon({ name, className = "h-[18px] w-[18px]" }: { name: WorkspaceSectionId; className?: string }) {
  const icons = {
    overview: LayoutDashboard, content: CalendarRange, team: UsersRound,
    analytics: ChartNoAxesCombined, inbox: MessagesSquare, leads: ContactRound,
    access: PanelsTopLeft, channels: Cable, research: BrainCircuit,
    knowledge: BookOpenText, generate: WandSparkles, publish: SendHorizontal,
  };
  const Icon = icons[name];
  return <Icon className={className} strokeWidth={1.7} aria-hidden="true" />;
}

function LayersMark() { return <LayoutDashboard size={17} strokeWidth={1.8} aria-hidden="true"/>; }

function ArrowUpRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2.75 13.6 9.4 20.25 11 13.6 12.6 12 19.25 10.4 12.6 3.75 11 10.4 9.4 12 2.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function CalendarWorkspaceShell({
  calendarId,
  clientName,
  clientUrl,
  isManager,
  settings,
  publishAction,
  setup,
  sections,
}: {
  calendarId?: string;
  clientName: string;
  clientUrl: string;
  isManager: boolean;
  settings?: ReactNode;
  publishAction?: ReactNode;
  setup?: WorkspaceSetupState;
  sections: WorkspaceSection[];
}) {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  // Read the URL during render: refreshes and OAuth returns must never paint
  // The content calendar is the landing page; explicit section links remain valid.
  const activeId = sections.find(section => section.id === requestedView)?.id
    ?? sections.find(section => section.id === "content")?.id
    ?? sections[0]?.id ?? "content";
  const [mobileSheet, setMobileSheet] = useState<"more" | "ai">("more");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setKeyboardOpen(window.innerHeight - viewport.height > 150 && /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? ""));
    viewport.addEventListener("resize", update); document.addEventListener("focusout", update);
    return () => { viewport.removeEventListener("resize", update); document.removeEventListener("focusout", update); };
  }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try { setSidebarCollapsed(localStorage.getItem("showwork-workspace-sidebar-collapsed") === "true"); } catch {}
  }, []);
  const toggleSidebar = () => {
    setSidebarCollapsed(current => {
      const next = !current;
      try { localStorage.setItem("showwork-workspace-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };
  const [tourId, setTourId] = useState<WorkspaceSectionId | null>(null);
  const [mountedInsightViews, setMountedInsightViews] = useState<Set<WorkspaceSectionId>>(() => new Set([activeId]));

  useEffect(() => {
    setMountedInsightViews(current => current.has(activeId) ? current : new Set(current).add(activeId));
  }, [activeId]);

  const rememberInsightView = (id: WorkspaceSectionId) => {

    setMountedInsightViews((current) => current.has(id) ? current : new Set(current).add(id));
  };

  // Allow rich overview modules to behave like real navigation controls without
  // coupling server-rendered page content to client routing state.
  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: WorkspaceSectionId; tour?: boolean }>).detail;
      if (detail?.id) {
        rememberInsightView(detail.id);
        setMobileSheet("more");
        setMobileOpen(Boolean(detail.tour) && window.innerWidth < 1024);
        setTourId(detail.tour ? detail.id : null);
        const url = new URL(window.location.href);
        url.searchParams.set("view", detail.id);
        window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    };

    const finishTour = () => { setTourId(null); setMobileOpen(false); };
    window.addEventListener("showwork-workspace-navigate", handleNavigate);
    window.addEventListener("showwork-workspace-tour-finish", finishTour);
    return () => {
      window.removeEventListener("showwork-workspace-navigate", handleNavigate);
      window.removeEventListener("showwork-workspace-tour-finish", finishTour);
    };
  }, []);

  useEffect(() => {
    if (!tourId) return;
    setSidebarCollapsed(false);
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => setMobileOpen(!media.matches);
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, [tourId]);

  const visibleSections = useMemo(() => sections.filter(Boolean), [sections]);

  useEffect(() => {
    setMountedInsightViews(current => current.has(activeId) ? current : new Set(current).add(activeId));
  }, [activeId]);

  const active =
    visibleSections.find((section) => section.id === activeId) ??
    visibleSections.find((section) => section.id === "content") ??
    visibleSections[0];

  const nav = useMemo<NavCluster[]>(() => {
    const byId = (id: WorkspaceSectionId) =>
      visibleSections.find((section) => section.id === id);

    const compact = (items: Array<WorkspaceSection | undefined>) =>
      items.filter(Boolean) as WorkspaceSection[];

    return [
  {
    label: "Workspace",
    items: compact([
      byId("content"),
      byId("access"),
    ]),
  },

  {
    label: "AI Studio",
    featured: true,
    items: compact([
      byId("knowledge"),
      byId("generate"),
      byId("research"),
    ]),
  },

  {
    label: "Leads & Messages",
    items: compact([byId("inbox"), byId("leads")]),
  },

  {
    label: "Understand",
    items: compact([byId("analytics")]),
  },

  {
    label: "Collaborate",
    items: compact([
      byId("team"),
    ]),
  },

  {
    label: "Publish",
    items: compact([
      byId("channels"),
      byId("publish"),
    ]),
  },

  {
    label: "Summary",
    items: compact([byId("overview")]),
  },
].filter((cluster) => cluster.items.length > 0);
  }, [visibleSections]);

  if (!active) return null;

  const canGenerate = visibleSections.some((section) => section.id === "generate");

  const select = (id: WorkspaceSectionId) => {
    if (tourId) window.dispatchEvent(new Event("showwork-workspace-tour-dismiss"));
    rememberInsightView(id);
    setMobileOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("view") !== id) {
      url.searchParams.set("view", id);
      window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    document.getElementById("workspace-main")?.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const aiSections = (["knowledge", "generate", "research"] as WorkspaceSectionId[]).map(id => visibleSections.find(section => section.id === id)).filter(Boolean) as WorkspaceSection[];
  const primaryMobile = (["content", "generate", "inbox"] as WorkspaceSectionId[]).map(id => visibleSections.find(section => section.id === id)).filter(Boolean) as WorkspaceSection[];
  const moreSections = visibleSections.filter(section => !["content", "inbox", "analytics", "knowledge", "research", "generate"].includes(section.id)).sort((a, b) => Number(a.id === "overview") - Number(b.id === "overview"));
  const openSheet = (sheet: "more" | "ai") => { setMobileSheet(sheet); setMobileOpen(true); };
  const sidebar = <>
    <nav className={menuStyles.navigation} aria-label="Workspace sections">
      {nav.map(cluster => <div key={cluster.label} className={menuStyles.cluster} data-featured={cluster.featured || undefined}>
        <div className={menuStyles.clusterHeading}><p>{cluster.label}</p>{cluster.featured && <Sparkles size={12} aria-hidden="true"/>}</div>
        <div className={menuStyles.items}>{cluster.items.map(item => <div key={item.id}>
          <button type="button" data-tour-target={item.id} data-section={item.id} aria-current={item.id === active.id ? "page" : undefined} onClick={() => select(item.id)} className={menuStyles.navItem}>
            <span className={menuStyles.iconWell}><SectionIcon name={item.id}/></span><span className={menuStyles.navLabel}>{item.label}</span>
            {item.id === active.id && <span className={menuStyles.activeArrow} aria-hidden="true"><ChevronRight size={12}/></span>}
          </button><div data-tour-slot={item.id}/>
        </div>)}</div>
      </div>)}
    </nav>
    <div className={menuStyles.footer}>
      <a href="/help/workspace" target="_blank" rel="noopener noreferrer" className={menuStyles.helpLink}><CircleHelp size={16}/><span>Help & guides</span><span className="sr-only"> (opens in a new tab)</span><ArrowUpRight className="h-3.5 w-3.5"/></a>
      {clientUrl && <a href={clientUrl} target="_blank" rel="noopener noreferrer" className={menuStyles.clientLink}><span className={menuStyles.clientIcon}><PanelsTopLeft size={17}/></span><span><strong>Preview client page</strong><small>See what your client sees</small></span><ArrowUpRight/></a>}
      {publishAction}
    </div>
  </>;

  return (
    <div data-marketing-workspace="true" data-sidebar-collapsed={sidebarCollapsed} className={`${menuStyles.desktopFrame} min-h-screen w-full min-w-0 bg-[#F7F8FA] text-[#101828]`}>
      {calendarId && <WorkspaceUploadTray workspaceId={calendarId} />}
      <header className={headerStyles.header}>
        <div className={headerStyles.inner}>
          <button type="button" className={menuStyles.headerMenu} onClick={() => openSheet("more")} aria-label="Open workspace menu" aria-expanded={mobileOpen && mobileSheet === "more"} aria-haspopup="dialog"><Menu size={21}/></button>
          <Link href="/dashboard/calendars" aria-label="Back to workspaces" title="All workspaces" className={headerStyles.back}><ArrowLeft size={16}/><span>All workspaces</span></Link>
          <span className={headerStyles.divider} aria-hidden="true"/>
          <div className={headerStyles.identity}><span className={headerStyles.monogram} aria-hidden="true">{clientName.slice(0, 2).toUpperCase()}</span><div className={headerStyles.name}><p title={clientName}>{clientName}</p><span><span className={headerStyles.desktopSection}>Marketing workspace</span><span className={headerStyles.mobileSection}>{active.label}</span></span></div></div>
          <span className={headerStyles.location}><SectionIcon name={active.id} className="h-3.5 w-3.5"/>{active.label}</span>
          <div className={headerStyles.actions}>
            {clientUrl && <a href={clientUrl} target="_blank" rel="noopener noreferrer" className={headerStyles.client}>Preview client page <ArrowUpRight className="h-3.5 w-3.5"/></a>}
            {canGenerate && active.id !== "content" && active.id !== "generate" && <button type="button" onClick={() => select("generate")} className={headerStyles.create}><Sparkles size={15}/> Create with AI</button>}
          </div>
          {settings}
        </div>
      </header>
      <MobileDrawer motion="slide" placement={mobileSheet === "more" ? "left" : "bottom"} open={mobileOpen} onClose={() => { setMobileOpen(false); if (tourId && window.innerWidth < 1024) window.dispatchEvent(new Event("showwork-workspace-tour-dismiss")); }} label={mobileSheet === "ai" ? "AI Studio" : "Showwork navigation"} heading={mobileSheet === "more" ? <ShowworkLogo tone="white" width={120} /> : undefined} panelClassName={mobileSheet === "more" ? menuStyles.navigationDrawer : menuStyles.mobilePanel} className={mobileSheet === "more" ? "bg-[#123568] text-white" : "bg-white text-slate-800"}>
        {tourId || mobileSheet === "more" ? <><div className={menuStyles.drawerBrand}><p>{clientName}</p></div>{sidebar}<Link href="/dashboard/calendars" className={menuStyles.helpLink}><ArrowLeft size={16}/>All workspaces</Link></> : <div className={menuStyles.sheetBody}>
          {mobileSheet === "ai" && <p className={menuStyles.sheetIntro}>Build your knowledge, explore ideas and create content.</p>}
          <nav aria-label={mobileSheet === "ai" ? "AI Studio tools" : "More workspace sections"} className={menuStyles.sheetGrid}>
            {(mobileSheet === "ai" ? aiSections : moreSections).map(item => <button key={item.id} onClick={() => select(item.id)} aria-current={item.id === active.id ? "page" : undefined} data-section={item.id} className={menuStyles.sheetItem}><span className={menuStyles.iconWell}><SectionIcon name={item.id} className="h-5 w-5"/></span><span className={menuStyles.sheetLabel}>{item.label}</span><ChevronRight size={14} className={menuStyles.sheetChevron} aria-hidden="true"/>{item.id === active.id && <span className={menuStyles.sheetActive}>You’re here</span>}</button>)}
          </nav>
        </div>}
      </MobileDrawer>
      <nav aria-label="Mobile workspace navigation" data-workspace-bottom-nav hidden={keyboardOpen} className={`${menuStyles.bottomNav} lg:hidden`}>
        {primaryMobile.map(item => <button key={item.id} onClick={() => select(item.id)} aria-current={item.id === active.id ? "page" : undefined} className={menuStyles.dockItem}><SectionIcon name={item.id} className="h-5 w-5"/><span>{item.id === "content" ? "Calendar" : item.id === "generate" ? "Generate calendar" : "Inbox"}</span></button>)}
        <button onClick={() => openSheet("more")} aria-current={!primaryMobile.some(item => item.id === active.id) ? "true" : undefined} aria-expanded={mobileOpen && mobileSheet === "more"} aria-haspopup="dialog" className={menuStyles.dockItem}><Menu size={20}/>Menu</button>
      </nav>

      <div className={`${menuStyles.desktopLayout} mx-auto grid max-w-[1800px] ${sidebarCollapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[224px_minmax(0,1fr)]"}`}>
        {/* WORKSPACE NAVIGATION */}
        <aside className={`${menuStyles.rail} sticky top-[72px] hidden h-[calc(100dvh-72px)] flex-col lg:flex`} data-collapsed={sidebarCollapsed}>
          <div className={menuStyles.railHeader}>
            {!sidebarCollapsed && <div className={menuStyles.workspaceIdentity}><Link href="/dashboard" className={menuStyles.workspaceBrand}><ShowworkLogo tone="white" width={104}/><small title={clientName}>{clientName}</small></Link></div>}
            <button type="button" onClick={toggleSidebar} aria-expanded={!sidebarCollapsed} aria-controls="workspace-desktop-navigation"
              aria-label={sidebarCollapsed ? "Expand workspace menu" : "Collapse workspace menu"} title={sidebarCollapsed ? "Expand workspace menu" : "Collapse workspace menu"}
              className={menuStyles.collapseButton}>{sidebarCollapsed ? <ChevronsRight size={16} aria-hidden="true"/> : <ChevronsLeft size={16} aria-hidden="true"/>}</button>
          </div>
          <div id="workspace-desktop-navigation" className="flex min-h-0 flex-1 flex-col">
            {sidebarCollapsed ? <>
              <nav aria-label="Workspace sections" className={menuStyles.iconNavigation}>
                {nav.map(cluster => <div key={cluster.label} className={menuStyles.iconCluster}>
                  {cluster.items.map(item => <button key={item.id} type="button" onClick={() => select(item.id)} data-section={item.id}
                    data-tour-target={item.id} title={item.label} aria-label={item.label} aria-current={item.id === active.id ? "page" : undefined}
                    className={menuStyles.iconItem}><SectionIcon name={item.id} className="h-5 w-5"/>{item.id === active.id && <span className={menuStyles.iconActiveDot} aria-hidden="true"/>}</button>)}
                </div>)}
              </nav>
              <a href="/help/workspace" target="_blank" rel="noopener noreferrer" title="Workspace help (opens in a new tab)" aria-label="Workspace help (opens in a new tab)" className={menuStyles.collapsedHelp}><CircleHelp size={19}/></a>
              {clientUrl && <div className={menuStyles.collapsedFooter}>
                <a href={clientUrl} target="_blank" rel="noopener noreferrer" title="Preview client page" aria-label="Preview client page"
                  className={menuStyles.collapsedAction}><ArrowUpRight className="h-5 w-5" /></a>
              </div>}
              {publishAction && <div className={menuStyles.collapsedFooter}><button type="button" onClick={toggleSidebar} title="Publishing actions" aria-label="Expand menu for publishing actions" className={menuStyles.collapsedAction}><SectionIcon name="publish" className="h-5 w-5"/></button></div>}
            </> : sidebar}
          </div>
        </aside>

        {/* ACTIVE WORKSPACE */}
        <main id="workspace-main" className="min-w-0 pb-[calc(104px+env(safe-area-inset-bottom))] lg:pb-0">
          <div
            className={`${menuStyles.contentSurface} mx-auto ${
              active.id === "content" ? "max-w-none" : "max-w-[1480px]"
            } ${["inbox", "team", "analytics"].includes(active.id) ? "px-3 py-4 sm:px-4 lg:px-5" : "px-4 py-6 sm:px-5 md:py-8 lg:px-7 xl:px-9"}`}
          >
            {/* CONTEXT BAR */}
            {calendarId && active.id !== "inbox" && sections.some(section => section.id === "inbox") && <InboxHandoffAlert calendarId={calendarId} />}
            {["overview", "content", "generate", "knowledge", "channels", "research", "inbox", "team", "analytics"].includes(active.id) ? <h1 className="sr-only">{active.title}</h1> : (
            <div className="mb-6 flex flex-col gap-4 px-1 py-1 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF5FF] px-2.5 py-1 text-[10px] font-medium text-[#1768E8]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1768E8]" />
                    {active.eyebrow}
                  </span>
                  {active.id === "generate" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0B1220] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.13em] text-white">
                      <SparkMark className="h-2.5 w-2.5" /> AI assisted
                    </span>
                  )}
                </div>

                <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                  {active.title}
                </h1>
                <p className="mt-2.5 max-w-3xl text-[13px] leading-6 text-[#667085]">
                  {active.description}
                </p>
              </div>


            </div>
            )}

            {calendarId && setup && <WorkspaceSetup calendarId={calendarId} initialState={setup} activeSection={active.id} onNavigate={select} />}
            {/* Keep visited panels mounted so navigation preserves local work. */}
            {visibleSections.map((section) => {
              if (section.id !== active.id && !mountedInsightViews.has(section.id)) return null;
              return <div key={section.id} data-workspace-panel={section.id} hidden={active.id !== section.id}>
                {section.content}
              </div>;
            })}

            {active.id !== "inbox" && <div className="mt-8 flex items-center justify-between border-t border-[#E4E9F0] pt-5 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#A0A8B4]">
              <span className="inline-flex items-center gap-3"><ShowworkLogo width={80}/><span>Marketing Workspace</span></span>
              <span className="hidden sm:inline">{clientName}</span>
            </div>}
          </div>
        </main>
           </div>


      <style jsx global>{`
        [data-marketing-workspace] [data-workspace-bottom-nav][hidden] { display: none; }
        @media (max-width: 1023px) {
          [data-marketing-workspace]:has([data-workspace-panel]:not([hidden]) [data-mobile-chat-open="true"]) [data-workspace-bottom-nav] { display: none; }
          [data-marketing-workspace]:has([data-workspace-panel]:not([hidden]) [data-mobile-chat-open="true"]) #workspace-main { padding-bottom: 0; }
        }
        /* Hidden panels stay mounted without fading or changing text contrast. */
        [data-marketing-workspace] [data-workspace-panel][hidden] { display: none !important; }

      `}</style>
    </div>
  );
}

export type { WorkspaceSection };
