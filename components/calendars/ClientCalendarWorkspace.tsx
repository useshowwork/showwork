"use client";

import PlatformBrandIcon from "./PlatformBrandIcon";
import styles from "./ClientWorkspace.module.css";
import HelpLink from "@/components/help/HelpLink";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Moon, Sun, ChartNoAxesCombined, ArrowUpRight, CalendarDays, CheckCheck, Clock3, FileImage, ShieldCheck, MoreHorizontal, ContactRound, LayoutDashboard, MessageSquareText } from "lucide-react";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import { useSearchParams } from "next/navigation";
import MobileDrawer, { NavigationToggle } from "@/components/navigation/MobileDrawer";
import CalendarLeadsPanel from "./CalendarLeadsPanel";
import CalendarReportingPanel from "@/components/calendars/CalendarReportingPanel";
import ClientCalendarView from "@/components/calendars/ClientCalendarView";
import SocialFeedPreview from "@/components/calendars/SocialFeedPreview";
import InstagramPreview from "@/components/calendars/InstagramPreview";
import TikTokPreview from "@/components/calendars/TikTokPreview";

type WorkspaceView = "leads" | "overview" | "calendar" | "instagram" | "tiktok" | "linkedin" | "facebook" | "x" | "review" | "analytics";

type Platform =
  | "INSTAGRAM"
  | "TIKTOK"
  | "YOUTUBE"
  | "FACEBOOK"
  | "X"
  | "LINKEDIN";

type ApprovalStatus = "PENDING" | "APPROVED" | "NEEDS_REVISION";

type CalendarPost = {
  id: string;
  postDate: string;
  platform: Platform;
  postType: string | null;
  category: string | null;
  caption: string | null;
  contentIdea: string | null;
  cta: string | null;
  hashtags: string | null;
  taggedAccounts: string | null;
  linkUrl: string | null;
  approvalStatus: ApprovalStatus;
  approvalNote: string | null;
  assets: Array<{
    id: string;
    mediaType: "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";
    contentUrl: string; posterUrl?: string | null;
  }>;
  videoComments: Array<{
    id: string;
    authorName: string | null;
    authorEmail: string;
    note: string;
    videoTimestampSeconds: number;
  }>;
  customFields: Array<{
    id: string;
    label: string;
    value: string;
  }>;
};

type PreviewAsset = {
  id: string;
  mediaType: "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";
  contentUrl: string; posterUrl?: string | null;
};

type PreviewPost = Omit<CalendarPost, "assets"> & {
  assets: PreviewAsset[];
};

type Props = {
  slug: string;
  clientName: string;
  planStatus: string;
  displayTitle: string;
  displayDescription: string;
  desktopBannerUrl: string | null;
  mobileBannerUrl: string | null;
  posts: CalendarPost[];
  stats: {
    totalPosts: number;
    approvedPosts: number;
    pendingPosts: number;
    revisionPosts: number;
    totalAssets: number;
    approvalPercentage: number;
  };
};

function Icon({
  name,
  className = "",
}: {
  name:
    | "grid"
    | "calendar"
    | "instagram"
    | "tiktok"
    | "linkedin"
    | "facebook"
    | "x"
    | "leads"
    | "analytics"
    | "review"
    | "check"
    | "clock"
    | "message"
    | "lock"
    | "arrow"
    | "spark";
  className?: string;
}) {
  if (["instagram","tiktok","linkedin","facebook","x"].includes(name)) return <PlatformBrandIcon platform={name.toUpperCase()} size={18}/>;
  if (name === "leads") return <ContactRound className={className} aria-hidden="true"/>;
  if (name === "analytics") return <ChartNoAxesCombined className={className} aria-hidden="true"/>;

  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M8 2.5v4M16 2.5v4M3 9h18" />
          <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "review":
      return (
        <svg {...common}>
          <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="m8 11 2.2 2.2L16 7.5" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path d="M19 4H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3l4 3 4-3h3a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
          <path d="M7 9h10M7 12h6" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="10" rx="2.5" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
          <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
        </svg>
      );
  }
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        `${styles.navItem} group flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[12px] font-medium transition-all duration-200`,
        active
          ? "bg-[#2478FF] text-white shadow-[0_10px_24px_rgba(36,120,255,0.22)]"
          : "text-[rgb(var(--client-muted))] hover:bg-[rgb(var(--client-ink))]/[0.055] hover:text-[rgb(var(--client-ink))]",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-[rgb(var(--client-ink))]/12 text-[rgb(var(--client-ink))]" : "bg-[rgb(var(--client-ink))]/[0.035] text-[rgb(var(--client-muted))] group-hover:text-[rgb(var(--client-muted))]",
        ].join(" ")}
      >
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className={[
          "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-bold",
          active ? "bg-[rgb(var(--client-ink))]/15 text-[rgb(var(--client-ink))]" : "bg-[#F7B742]/10 text-[#F7B742]",
        ].join(" ")}>
          {count}
        </span>
      )}
    </button>
  );
}

function ViewHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--client-muted))]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[rgb(var(--client-ink))] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgb(var(--client-muted))]">
        {description}
      </p>
    </div>
  );
}

export default function ClientCalendarWorkspace({
  slug,
  clientName,
  planStatus,
  displayTitle,
  displayDescription,
  desktopBannerUrl,
  mobileBannerUrl,
  posts,
  stats,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("showwork-calendar-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch { /* The toggle remains usable when browser storage is unavailable. */ }
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("showwork-calendar-theme", next); } catch {}
  };
  const themeStyle = {
    "--client-bg": theme === "dark" ? "8 9 11" : "245 247 251",
    "--client-panel": theme === "dark" ? "11 13 16" : "255 255 255",
    "--client-ink": theme === "dark" ? "255 255 255" : "16 24 40",
    "--client-muted": theme === "dark" ? "156 163 175" : "100 116 139",
    "--client-blue": theme === "dark" ? "104 178 255" : "23 104 232",
    "--client-green": theme === "dark" ? "114 232 172" : "22 101 52",
    "--client-amber": theme === "dark" ? "247 199 102" : "146 64 14",
    colorScheme: theme,
  } as CSSProperties;
  const themeToggle = (
    <button type="button" onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--client-ink))]/10 bg-[rgb(var(--client-ink))]/5 text-[rgb(var(--client-ink))] transition hover:bg-[rgb(var(--client-ink))]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2478FF]">
      {theme === "dark" ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
  const [previewPostId, setPreviewPostId] = useState<string>();
  const [previewRequest, setPreviewRequest] = useState(0);
  const [calendarVisited, setCalendarVisited] = useState(false);
  const [analyticsVisited, setAnalyticsVisited] = useState(false);
  const [leadsVisited, setLeadsVisited] = useState(false);
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const validViews: WorkspaceView[] = ["overview", "calendar", "leads", "instagram", "tiktok", "linkedin", "facebook", "x", "review", "analytics"];
  const activeView: WorkspaceView = validViews.includes(requestedView as WorkspaceView)
    ? requestedView as WorkspaceView : "calendar";
  useEffect(() => { if (activeView === "calendar") setCalendarVisited(true); if (activeView === "analytics") setAnalyticsVisited(true); if (activeView === "leads") setLeadsVisited(true); }, [activeView]);

  // Keyboard navigation makes the workspace feel like an application rather than
  // a collection of page anchors.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === "1") { event.preventDefault(); navigate("calendar"); }
      if (event.altKey && event.key === "2") { event.preventDefault(); navigate("analytics"); }
      if (event.altKey && event.key === "3") { event.preventDefault(); navigate("overview"); }
      if (event.altKey && event.key === "4") { event.preventDefault(); navigate("tiktok"); }
      if (event.altKey && event.key === "5") { event.preventDefault(); navigate("review"); }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const previewPosts = useMemo<PreviewPost[]>(
    () =>
      posts.map((post) => ({
        ...post,
        assets: post.assets.map((asset) => ({
          id: asset.id,
          mediaType:
            asset.mediaType === "VIDEO"
              ? "VIDEO"
              : asset.mediaType === "DOCUMENT"
                ? "DOCUMENT"
                : asset.mediaType === "PDF"
                  ? "PDF"
                  : "PHOTO",
          contentUrl: asset.contentUrl,
          posterUrl: asset.posterUrl,
        })),
        videoComments: post.videoComments.map((comment) => ({
          ...comment,
          authorEmail: comment.authorEmail || "",
        })),
      })),
    [posts],
  );

  const reviewPosts = useMemo(
    () => posts.filter((post) => post.approvalStatus !== "APPROVED"),
    [posts],
  );

  const contentScrollRef = useRef<HTMLDivElement>(null);
  // Reset after the new view commits; resetting before navigation lets browser
  // scroll anchoring carry the previous view's offset into the preview.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({top:0,behavior:"instant"});
      window.scrollTo({top:0,behavior:"instant"});
    });
    return () => cancelAnimationFrame(frame);
  }, [activeView]);


  const navigate = (view: WorkspaceView) => {
    setMobileOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("view") !== view) {
      url.searchParams.set("view", view);
      window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const sidebar = <>
          <div className="border-b border-[rgb(var(--client-ink))]/[0.07] px-5 py-5">
          <span className={styles.sidebarLogo}><ShowworkLogo tone="white" width={104}/></span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-5">
            <div className="mb-7 rounded-2xl border border-[rgb(var(--client-ink))]/[0.07] bg-[rgb(var(--client-ink))]/[0.025] p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2478FF]/10 text-[rgb(var(--client-blue))]">
                  <Icon name="spark" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[rgb(var(--client-muted))]">{clientName}</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[rgb(var(--client-muted))]">
                    Private workspace
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[rgb(var(--client-ink))]/[0.025] px-2.5 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#43E097] shadow-[0_0_10px_rgba(67,224,151,0.65)]" />
                <span className="text-[9px] font-medium text-[rgb(var(--client-muted))]">Secure client access</span>
              </div>
            </div>

            <div className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[rgb(var(--client-muted))]">
              Workspace
            </div>
            <div className="space-y-1">
              <SidebarItem active={activeView === "calendar"} onClick={() => navigate("calendar")} icon="calendar" label="Content Calendar" />
              <SidebarItem active={activeView === "analytics"} onClick={() => navigate("analytics")} icon="analytics" label="Analytics & Reporting" />
              <SidebarItem active={activeView === "leads"} onClick={() => navigate("leads")} icon="leads" label="Leads" />
              <SidebarItem active={activeView === "overview"} onClick={() => navigate("overview")} icon="grid" label="Overview" />
            </div>

            <div className="mb-2 mt-7 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[rgb(var(--client-muted))]">
              Previews
            </div>
            <div className="space-y-1">
              <SidebarItem active={activeView === "instagram"} onClick={() => navigate("instagram")} icon="instagram" label="Instagram" />
              <SidebarItem active={activeView === "tiktok"} onClick={() => navigate("tiktok")} icon="tiktok" label="TikTok" />
              <SidebarItem active={activeView === "linkedin"} onClick={() => navigate("linkedin")} icon="linkedin" label="LinkedIn" />
              <SidebarItem active={activeView === "facebook"} onClick={() => navigate("facebook")} icon="facebook" label="Facebook" />
              <SidebarItem active={activeView === "x"} onClick={() => navigate("x")} icon="x" label="X" />
            </div>

            <div className="mb-2 mt-7 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[rgb(var(--client-muted))]">
              Review
            </div>
            <div className="space-y-1">
              <SidebarItem
                active={activeView === "review"}
                onClick={() => navigate("review")}
                icon="review"
                label="Review Centre"
                count={reviewPosts.length}
              />
            </div>
          </div>

          <div className="border-t border-[rgb(var(--client-ink))]/[0.07] p-3.5">
            <HelpLink className={styles.helpLink}/>
            <div className="rounded-xl border border-[rgb(var(--client-ink))]/[0.06] bg-[rgb(var(--client-ink))]/[0.025] px-3.5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--client-ink))]/[0.04]">
                  <Icon name="lock" className="h-3.5 w-3.5 text-[rgb(var(--client-muted))]" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold text-[rgb(var(--client-muted))]">Private workspace</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[9px] text-[rgb(var(--client-muted))]"><span>Powered by</span><ShowworkLogo tone="white" width={62}/></div>
                </div>
              </div>
            </div>
          </div>
  </>;

  return (
    <main style={themeStyle} data-showwork-client-view="workspace" data-client-theme={theme} className={`${styles.workspace} min-h-screen overflow-x-hidden bg-[rgb(var(--client-bg))] text-[rgb(var(--client-ink))] lg:h-dvh lg:min-h-0 lg:overflow-hidden`}>
      {/* Mobile app header */}
      <header className={`${styles.mobileHeader} sticky top-0 z-50 border-b border-[rgb(var(--client-ink))]/[0.07] bg-[rgb(var(--client-bg))]/94 backdrop-blur-2xl lg:hidden`}>
        <div className="flex h-[68px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <NavigationToggle open={mobileOpen} onClick={() => setMobileOpen(true)} label="workspace navigation" />
          <ShowworkLogo tone="white" width={96}/>
          <div className="h-5 w-px bg-[rgb(var(--client-ink))]/10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[rgb(var(--client-muted))]">{clientName}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-[rgb(var(--client-muted))]">
              Client workspace
            </p>
          </div>
          {themeToggle}

        </div>

      </header>

      <MobileDrawer motion="fade" placement="bottom" panelClassName={styles.mobileSheet} open={mobileOpen} onClose={() => setMobileOpen(false)} label="Your workspace" className="bg-[rgb(var(--client-panel))] text-[rgb(var(--client-ink))]">{sidebar}</MobileDrawer>

      <div className={`${styles.desktopLayout} flex min-h-screen lg:h-full lg:min-h-0`}>
        {/* Persistent desktop navigation */}
        <aside className={`${styles.sidebar} hidden h-full w-[240px] shrink-0 flex-col overflow-hidden border-r border-[rgb(var(--client-ink))]/[0.07] bg-[rgb(var(--client-panel))] lg:flex`}>
          {sidebar}
        </aside>

        {/* Everything below stays mounted. Only the active workspace view changes. */}
        <section aria-label="Marketing workspace content" className={`${styles.content} min-w-0 flex-1 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain`}>
          <header className={`${styles.topbar} sticky top-0 z-30 hidden h-[68px] items-center border-b border-[rgb(var(--client-ink))]/[0.07] bg-[rgb(var(--client-bg))]/90 px-6 backdrop-blur-2xl lg:flex xl:px-9`}>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--client-muted))]">
                {activeView === "overview"
                  ? "Workspace"
                  : activeView === "calendar"
                    ? "Content"
                    : activeView === "analytics"
                      ? "Analytics & Reporting"
                    : activeView === "leads"
                      ? "Leads"
                    : activeView === "review"
                      ? "Client review"
                      : "Social preview"}
              </p>
              <p className="mt-1 text-xs font-medium text-[rgb(var(--client-muted))]">{clientName}</p>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {themeToggle}
              <span className="rounded-full border border-[#43E097]/15 bg-[#43E097]/[0.07] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--client-green))]">
                Private
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgb(var(--client-ink))]/[0.08] bg-[rgb(var(--client-ink))]/[0.035]">
                <Icon name="lock" className="h-4 w-4 text-[rgb(var(--client-muted))]" />
              </span>
            </div>
          </header>

          <div ref={contentScrollRef} tabIndex={0} className={styles.contentSurface} aria-label="Client workspace content">
          {activeView === "overview" && <section className={styles.hero} aria-label="Your client workspace">
            {(desktopBannerUrl || mobileBannerUrl) && <picture className={styles.heroImage}>{mobileBannerUrl && <source media="(max-width:639px)" srcSet={mobileBannerUrl}/>}<img src={desktopBannerUrl || mobileBannerUrl!} alt=""/></picture>}
            <div className={styles.heroCopy}><span className={styles.heroEyebrow}><ShieldCheck size={13}/>Your private review room</span><h1>{displayTitle}</h1><p>{displayDescription}</p><button type="button" onClick={() => navigate(reviewPosts.length ? "review" : "calendar")}>{reviewPosts.length ? "Review your content" : "Explore your calendar"}<ArrowUpRight size={16}/></button></div>
            <div className={styles.heroStamp}><span>{clientName.slice(0,2).toUpperCase()}</span><p>Created together.<br/><strong>Shared with you.</strong></p></div>
          </section>}

          <div className={styles.pageBody}>
            <div>
              {activeView === "overview" && <div className={styles.overview}>
                <div className={styles.statGrid}>{[
                  { label:"Shared posts", value:stats.totalPosts, icon:CalendarDays, tone:"blue" },
                  { label:"Approved", value:stats.approvedPosts, icon:CheckCheck, tone:"green" },
                  { label:"Awaiting review", value:stats.pendingPosts, icon:Clock3, tone:"amber" },
                  { label:"Creative files", value:stats.totalAssets, icon:FileImage, tone:"violet" },
                ].map(({label,value,icon:StatIcon,tone}) => <div key={label} className={styles.stat} data-tone={tone}><span><StatIcon size={18}/></span><div><p>{label}</p><strong>{value}</strong></div></div>)}</div>
                <div className={styles.overviewGrid}>
                  <section className={styles.reviewCard}>
                    <span className={styles.kicker}>Make it yours</span><h2>{reviewPosts.length ? "Your perspective makes the difference." : stats.totalPosts ? "Good work. All caught up." : "Your next chapter starts here."}</h2><p>{reviewPosts.length ? `${stats.pendingPosts} awaiting review · ${stats.revisionPosts} needing revision. Explore the creative, leave feedback and approve when it feels right.` : stats.totalPosts ? "Everything shared with you has been approved. Your calendar holds the complete picture." : "Your team’s content will appear here once it is ready for your review."}</p>
                    <button type="button" onClick={() => navigate(reviewPosts.length ? "review" : "calendar")}>{reviewPosts.length ? "Go to reviews" : "Open calendar"}<ArrowUpRight size={16}/></button>
                  </section>
                  <section className={styles.progressCard} aria-label="Client approval progress"><div><span className={styles.kicker}>Moving forward</span><h2>Approval progress</h2><p>{stats.approvedPosts} of {stats.totalPosts} shared posts</p></div><div className={styles.progressRing}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48"/><circle cx="60" cy="60" r="48" strokeDasharray="301.6" strokeDashoffset={301.6 * (1 - Math.max(0,Math.min(100,stats.approvalPercentage))/100)}/></svg><span><strong>{stats.approvalPercentage}%</strong><small>approved</small></span></div><div className={styles.progressLegend}><span><i/>{stats.approvedPosts} approved</span><span><i/>{reviewPosts.length} to review</span></div></section>
                </div>
                <section className={styles.queue}><header><div><span className={styles.kicker}>A clear next step</span><h2>Ready for your eyes</h2></div><button type="button" onClick={() => navigate("calendar")}>View calendar<ArrowUpRight size={14}/></button></header>
                 {reviewPosts.length ? <div className={styles.queueList}>{reviewPosts.slice(0,5).map(post => <button type="button" key={post.id} className={styles.queueItem} onClick={() => { setPreviewPostId(post.id); setPreviewRequest(value => value + 1); navigate("calendar"); }}><span className={styles.queueIcon}>{post.assets[0]?.mediaType === "PHOTO" ? <img src={post.assets[0].contentUrl} alt="" loading="lazy"/> : <FileImage size={20}/>}</span><span className={styles.queueTitle}><strong>{post.contentIdea || post.caption || "Untitled post"}</strong><small>{post.platform} · {new Date(post.postDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</small></span><span className={styles.status} data-revision={post.approvalStatus === "NEEDS_REVISION"}>{post.approvalStatus === "NEEDS_REVISION" ? "Needs revision" : "Awaiting review"}</span><ArrowUpRight size={16}/></button>)}</div> : <div className={styles.empty}><CheckCheck size={24}/><p>{stats.totalPosts ? "Nothing waiting for your review." : "No content has been shared yet."}</p></div>}
                </section>
              </div>}

              {(activeView === "leads" || leadsVisited) && <div hidden={activeView !== "leads"} data-client-panel="leads"><CalendarLeadsPanel calendarId={slug} clientSlug={slug} canEdit={false}/></div>}

              {(activeView === "analytics" || analyticsVisited) && (
                <div hidden={activeView !== "analytics"} data-client-panel="analytics">
                  <CalendarReportingPanel calendarId={slug} clientSlug={slug} onOpenLeads={()=>navigate("leads")} isManager={false} canAnalyze={false} canApplyRecommendations={false} />
                </div>
              )}

              {(activeView === "calendar" || calendarVisited) && (
                <div hidden={activeView !== "calendar"} className="mx-auto max-w-6xl">
                  <ClientCalendarView
                    key={`${previewPostId || "calendar"}:${previewRequest}`}
                    initialPostId={previewPostId}
                    controlledTheme={theme}
                    onThemeChange={toggleTheme}
                    slug={slug}
                    planStatus={planStatus}
                    clientName={clientName}
                    posts={posts}
                  />
                </div>
              )}

              {(activeView === "linkedin" || activeView === "facebook" || activeView === "x") && (
                <section className="rounded-3xl border border-[rgb(var(--client-ink))]/10 bg-[rgb(var(--client-panel))] p-3 sm:p-6">
                  <SocialFeedPreview posts={posts} clientName={clientName.trim() || "Your brand"} channel={activeView}
                    onOpen={(post) => { setPreviewPostId(post.id); setPreviewRequest(value => value + 1); navigate("calendar"); }}
                    filtersActive={false} onClearFilters={() => {}} />
                </section>
              )}

              {activeView === "instagram" && (
                <div className="mx-auto max-w-6xl">
                  <div className="relative min-w-0 overflow-hidden rounded-[22px]">
                    <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-[#E1306C]/10 blur-[110px]" />
                    <div className="pointer-events-none absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-[#7C3AED]/10 blur-[110px]" />
                    <div className="relative z-10">
                      <InstagramPreview posts={previewPosts} clientName={clientName.trim() || "Your brand"} />
                    </div>
                  </div>
                </div>
              )}

              {activeView === "tiktok" && (
                <div className="mx-auto max-w-6xl">
                  <div className="relative min-w-0 overflow-hidden rounded-[22px]">
                    <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-[#25F4EE]/10 blur-[110px]" />
                    <div className="pointer-events-none absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-[#FE2C55]/10 blur-[110px]" />
                    <div className="relative z-10">
                      <TikTokPreview posts={previewPosts} clientName={clientName.trim() || "Your brand"} />
                    </div>
                  </div>
                </div>
              )}

              {activeView === "review" && <div className={styles.overview}>
                <ViewHeader eyebrow="Client review" title="A fresh pair of eyes." description="Explore the creative, share your feedback and give your team the go-ahead."/>
                <div className={styles.reviewStats}>{[
                  {label:"Awaiting review",value:stats.pendingPosts,icon:Clock3,tone:"amber"},
                  {label:"Needs revision",value:stats.revisionPosts,icon:MessageSquareText,tone:"violet"},
                  {label:"Approved",value:stats.approvedPosts,icon:CheckCheck,tone:"green"},
                ].map(({label,value,icon:StatIcon,tone}) => <div key={label} className={styles.stat} data-tone={tone}><span><StatIcon size={18}/></span><div><p>{label}</p><strong>{value}</strong></div></div>)}</div>
                <section className={styles.queue}><header><div><span className={styles.kicker}>Your review list</span><h2>{reviewPosts.length ? `${reviewPosts.length} ${reviewPosts.length === 1 ? "post" : "posts"} to explore` : "Nothing outstanding"}</h2></div><button type="button" onClick={() => navigate("calendar")}>Full calendar<ArrowUpRight size={14}/></button></header>
                 {reviewPosts.length ? <div className={styles.queueList}>{reviewPosts.map(post => <button type="button" key={post.id} className={styles.queueItem} onClick={() => { setPreviewPostId(post.id); setPreviewRequest(value => value + 1); navigate("calendar"); }}><span className={styles.queueIcon}><FileImage size={20}/></span><span className={styles.queueTitle}><strong>{post.contentIdea || post.caption || "Untitled post"}</strong><small>{post.platform} · {new Date(post.postDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</small></span><span className={styles.status} data-revision={post.approvalStatus === "NEEDS_REVISION"}>{post.approvalStatus === "NEEDS_REVISION" ? "Needs revision" : "Awaiting review"}</span><ArrowUpRight size={16}/></button>)}</div> : <div className={styles.empty}><CheckCheck size={24}/><p>{stats.totalPosts ? "Your team has your approval. You’re all caught up." : "Your team hasn’t shared any content yet."}</p></div>}
                </section>
              </div>}

            </div>
          </div>
          </div>
        </section>
      </div>

      <nav className={styles.mobileDock} aria-label="Client workspace navigation">{([{id:"calendar",label:"Calendar",icon:CalendarDays},{id:"analytics",label:"Analytics",icon:ChartNoAxesCombined},{id:"leads",label:"Leads",icon:ContactRound},{id:"overview",label:"Overview",icon:LayoutDashboard}] as const).map(item => <button key={item.id} type="button" onClick={() => navigate(item.id)} aria-current={activeView === item.id ? "page" : undefined}><item.icon size={20}/><span>{item.label}</span></button>)}<button type="button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-current={["calendar","analytics","leads","overview"].includes(activeView) ? undefined : "true"} aria-haspopup="dialog"><MoreHorizontal size={20}/><span>More</span></button></nav>

    </main>
  );
}
