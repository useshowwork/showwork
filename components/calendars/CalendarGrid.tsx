"use client";
import MobileDrawer from "@/components/navigation/MobileDrawer";
function CalendarFilterPanel({ mobile, open, onClose, children, label = "Filters & search" }: { mobile: boolean; open: boolean; onClose: () => void; children: ReactNode; label?: string }) {
  return mobile ? <MobileDrawer breakpoint="md" placement="bottom" open={open} onClose={onClose} label={label} panelClassName={contentStyles.mobileSheet}>{children}</MobileDrawer> : <>{children}</>;
}

import type { ReactNode } from "react";
import contentStyles from "./ContentPlanner.module.css";
import { calendarWeek, moveCalendarPeriod } from "@/lib/calendarView";
import CreativeBriefEditor, { type BriefEditorState } from "./CreativeBriefEditor";
import BulkApprovalBubble from "./BulkApprovalBubble";
import ReusePostMedia from "./ReusePostMedia";
import reviewStyles from "./PostReviewFlow.module.css";
import type { CreativeBrief, CreativeDevelopment } from "@/lib/content/brief";
import { Upload, FilePenLine, ShieldCheck, Users, MessageSquare, Send, X, Plus, CalendarDays, Layers3, Sparkles, SlidersHorizontal, ChevronDown } from "lucide-react";
import { calendarWorkflow, matchesCalendarStage, type CalendarStageFilter } from "@/lib/calendarWorkflow";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { mergeSavedCalendarPosts } from "@/lib/calendarPostCollection";
import type { TeamPermission } from "@/lib/calendarTeamPolicy";

import { MEDIA_FILE_ACCEPT, getFileContentType } from "@/lib/mediaFileTypes";

import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";
import UiSymbol from "@/components/ui/UiSymbol";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import CalendarVideoComments, {
  type CalendarVideoCommentData,
} from "@/components/calendars/CalendarVideoComments";
import SocialFeedPreview from "@/components/calendars/SocialFeedPreview";
import InstagramPreview from "@/components/calendars/InstagramPreview";
import TikTokPreview from "@/components/calendars/TikTokPreview";
import TikTokPrivacySelect from "@/components/calendars/TikTokPrivacySelect";
import AutoPublishToggle from "@/components/calendars/AutoPublishToggle";
import SocialPostPublishing from "@/components/calendars/SocialPostPublishing";
import ImportCalendar from "@/components/calendars/ImportCalendar";
import { uploadWorkspaceAsset } from "@/lib/workspaceVideoClient";
import { workspaceUploadQueue } from "@/lib/workspaceUploadQueue";

type Platform =
  | "INSTAGRAM"
  | "TIKTOK"
  | "YOUTUBE"
  | "FACEBOOK"
  | "X"
  | "LINKEDIN";

type ApprovalStatus = "PENDING" | "APPROVED" | "NEEDS_REVISION";
type Theme = "dark" | "light";

interface CalendarPostAssetData {
  id: string;
  fileKey: string;
  mediaType: "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";
  contentUrl: string;
  posterUrl?: string | null;
}

interface CalendarPostCustomFieldData {
  id: string;
  label: string;
  value: string;
}

type InstagramPublishStatus = "NOT_SCHEDULED" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";
type TikTokPublishStatus = "NOT_SCHEDULED" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";
type TikTokPrivacyLevel = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";

export interface CalendarPostData {
  isAiDraft?: boolean;
  updatedAt?: string;
  creativeBrief?: CreativeBrief | null;
  creativeDevelopment?: CreativeDevelopment | null;
  id: string;
  postDate: string;
  platform: Platform;
  postType: string | null;
  category: string | null;
hook: string | null;
script: string | null;
caption: string | null;
contentIdea: string | null;
  cta: string | null;
  hashtags: string | null;
  taggedAccounts: string | null;
  linkUrl: string | null;
  internalReviewStatus?: "PENDING" | "APPROVED" | "NEEDS_CHANGES";
  internalReviewNote?: string | null;
  internalReviewVersion?: number;
  internalReviewedAt?: string | null;
  approvalStatus: ApprovalStatus;
  approvalNote: string | null;
  publishStatus?: InstagramPublishStatus;
  publishError?: string | null;
  publishPermalink?: string | null;
  instagramPublishStatus: InstagramPublishStatus;
  instagramPermalink: string | null;
  instagramPublishError: string | null;
  tikTokPublishStatus: TikTokPublishStatus;
  tikTokPrivacyLevel: TikTokPrivacyLevel | null;
  tikTokSettings?: unknown;
  tikTokConsentAt?: string | null;
  tikTokPublishId?: string | null;
  tikTokInitStartedAt?: string | null;
  tikTokPublishError: string | null;
  assets: CalendarPostAssetData[];
  videoComments: CalendarVideoCommentData[];
  customFields: CalendarPostCustomFieldData[];
}
const PLATFORMS: {
  value: Platform;
  label: string;
  color: string;
}[] = [
    { value: "INSTAGRAM", label: "Instagram", color: "#E1306C" },
    { value: "TIKTOK", label: "TikTok", color: "#00F2EA" },
    { value: "YOUTUBE", label: "YouTube", color: "#FF0000" },
    { value: "FACEBOOK", label: "Facebook", color: "#1877F2" },
    { value: "X", label: "X", color: "#FFFFFF" },
    { value: "LINKEDIN", label: "LinkedIn", color: "#0A66C2" },
  ];

const POST_TYPES = [
  "Single Image",
  "Carousel",
  "Reel",
  "Video",
  "Story",
];

const DEFAULT_CATEGORIES = [
  "Educational",
  "Lifestyle",
  "Promotional",
  "Behind the Scenes",
  "Testimonial",
  "Announcement",
];

const DEFAULT_CTAS = [
  "Link in bio",
  "Comment below",
  "Shop now",
  "Swipe up",
  "DM us",
  "Tag a friend",
  "Save this post",
];

const DAY_COLORS = [
  "#E9735B", // Sunday · coral
  "#3479DF", // Monday · blue
  "#8A6ED8", // Tuesday · lavender
  "#C5962D", // Wednesday · gold
  "#279F8F", // Thursday · teal
  "#D16D98", // Friday · rose
  "#6774C5", // Saturday · indigo
];

const APPROVAL_META: Record<
  ApprovalStatus,
  {
    text: string;
    color: string;
    bg: string;
  }
> = {
  PENDING: {
    text: "Pending",
    color: "#FFCC00",
    bg: "rgba(255,204,0,0.15)",
  },
  APPROVED: {
    text: "Approved",
    color: "#4ade80",
    bg: "rgba(74,222,128,0.15)",
  },
  NEEDS_REVISION: {
    text: "Needs revision",
    color: "#F97316",
    bg: "rgba(249,115,22,0.15)",
  },
};

const THEMES: Record<
  Theme,
  {
    pageBg: string;
    cardBg: string;
    cardBorder: string;
    cardBorderActive: string;
    modalBg: string;
    text: string;
    textMuted: string;
    textFaint: string;
    inputBg: string;
    inputBorder: string;
    pillBg: string;
    pillText: string;
  }
> = {
  dark: {
    pageBg: "#0A0A0A",
    cardBg: "rgba(255,255,255,0.025)",
    cardBorder: "rgba(255,255,255,0.06)",
    cardBorderActive: "#2478FF",
    modalBg: "#1A1A1A",
    text: "#FFFFFF",
    textMuted: "rgba(255,255,255,0.5)",
    textFaint: "rgba(255,255,255,0.3)",
    inputBg: "rgba(255,255,255,0.05)",
    inputBorder: "rgba(255,255,255,0.1)",
    pillBg: "rgba(255,255,255,0.06)",
    pillText: "rgba(255,255,255,0.6)",
  },

  light: {
    pageBg: "#FFFFFF",
    cardBg: "rgba(0,0,0,0.025)",
    cardBorder: "rgba(0,0,0,0.09)",
    cardBorderActive: "#2478FF",
    modalBg: "#FFFFFF",
    text: "#0A0A0A",
    textMuted: "rgba(0,0,0,0.5)",
    textFaint: "rgba(0,0,0,0.35)",
    inputBg: "rgba(0,0,0,0.03)",
    inputBorder: "rgba(0,0,0,0.14)",
    pillBg: "rgba(0,0,0,0.05)",
    pillText: "rgba(0,0,0,0.6)",
  },
};

const THEME_STORAGE_KEY = "showwork-calendar-theme";

/* =========================================================
   PLATFORM ICON
   ========================================================= */

function CalendarDateHeading({ date, today, spacious, count }: { date: Date; today: boolean; spacious: boolean; count: number }) {
  return <div className={`${contentStyles.dateHeading} ${spacious ? contentStyles.spaciousDate : ""}`}>
    <div className={contentStyles.dateIdentity}>
      <span className={contentStyles.dateNumber}><CalendarDays size={14} aria-hidden="true" />{date.getDate()}</span>
      <div><span className={contentStyles.dateMonth}>{date.toLocaleDateString("en-US", {month:"short"})}</span>{spacious && <strong className={contentStyles.dateWeekday}>{date.toLocaleDateString("en-US", {weekday:"long",year:"numeric"})}</strong>}</div>
    </div>
    <div className={contentStyles.dateBadges}>{today && <span className={contentStyles.todayBadge}><span aria-hidden="true" />Today</span>}{spacious && <span className={contentStyles.dayPostCount}>{count} {count === 1 ? "post" : "posts"}</span>}</div>
  </div>;
}

function PlatformIcon({
  platform,
  className,
  style,
}: {
  platform: Platform;
  className?: string;
  style?: React.CSSProperties;
}) {
  switch (platform) {
    case "INSTAGRAM":
      return (
        <svg
          className={className}
          style={style}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle
            cx="17.2"
            cy="6.8"
            r="1"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );

    case "TIKTOK":
      return (
        <svg
          className={className}
          style={style}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M16.6 2h-3.3v13.8c0 1.5-1.2 2.7-2.7 2.7a2.7 2.7 0 0 1 0-5.4c.3 0 .5 0 .8.1V9.8a6.1 6.1 0 0 0-.8 0A6.1 6.1 0 1 0 16.6 15.9V8.5a8 8 0 0 0 4.6 1.5V6.7a4.8 4.8 0 0 1-4.6-4.7Z" />
        </svg>
      );

    case "YOUTUBE":
      return (
        <svg
          className={className}
          style={style}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M22 12s0-3.1-.4-4.6a3 3 0 0 0-2.1-2.1C17.9 5 12 5 12 5s-5.9 0-7.5.3a3 3 0 0 0-2.1 2.1C2 8.9 2 12 2 12s0 3.1.4 4.6a3 3 0 0 0 2.1 2.1C6.1 19 12 19 12 19s5.9 0 7.5-.3a3 3 0 0 0 2.1-2.1c.4-1.5.4-4.6.4-4.6Zm-11.9 3V9l5.2 3-5.2 3Z" />
        </svg>
      );

    case "FACEBOOK":
      return (
        <svg
          className={className}
          style={style}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.57 14.2 3.57c-2.4 0-4.05 1.47-4.05 4.16v2.16H7.4V13h2.75v8h3.35Z" />
        </svg>
      );

    case "X":
      return (
        <svg
          className={className}
          style={style}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M18.9 2H22l-7.2 8.2L23.3 22h-6.6l-5.2-6.8L5.5 22H2.4l7.7-8.8L1.7 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20Z" />
        </svg>
      );

    case "LINKEDIN":
      return (
        <svg
          className={className}
          style={style}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5ZM3 9.75h4v11H3v-11Zm7 0h3.83v1.5h.05c.53-1 1.84-2.06 3.79-2.06 4.06 0 4.81 2.67 4.81 6.14v6.42h-4v-5.7c0-1.36-.02-3.1-1.89-3.1-1.9 0-2.19 1.48-2.19 3v5.8h-4v-11Z" />
        </svg>
      );
  }
}

/* =========================================================
   ICONS
   ========================================================= */

function IconPin({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="7" fill={color} />
      <circle
        cx="9.5"
        cy="7.5"
        r="2"
        fill="rgba(255,255,255,0.55)"
      />
      <path
        d="M12 16.5 L12 21"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 2 2 7l10 5 10-5-10-5Z"
        strokeLinejoin="round"
      />
      <path
        d="M2 17l10 5 10-5M2 12l10 5 10-5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M20.4 14.7A8.5 8.5 0 0 1 9.3 3.6a.6.6 0 0 0-.7-.85A10 10 0 1 0 21.25 15.4a.6.6 0 0 0-.85-.7Z" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="4.5" />
      <path
        d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <path
        d="m5 12.5 4.5 4.5L19 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================
   THEME TOGGLE
   ========================================================= */

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        theme === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      className="
        flex h-9 w-9
        items-center justify-center
        rounded-full
        transition-all
        active:scale-95
        sm:h-10 sm:w-10
      "
      style={{
        background:
          theme === "dark"
            ? "rgba(255,255,255,0.05)"
            : "rgba(0,0,0,0.05)",
        color:
          theme === "dark"
            ? "#F5C842"
            : "#F59E0B",
      }}
    >
      {theme === "dark" ? (
        <IconSun className="h-4 w-4" />
      ) : (
        <IconMoon className="h-4 w-4" />
      )}
    </button>
  );
}

/* =========================================================
   VIDEO THUMBNAIL
   ========================================================= */

function VideoThumbnail({
  posterUrl,
  src,
  className,
}: {
  src: string;
  posterUrl?: string | null;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failedPoster, setFailedPoster] = useState(false);
  if (posterUrl && !failedPoster) return <img src={posterUrl} alt="Video preview" loading="lazy" className={className} onError={() => setFailedPoster(true)} />;

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      preload="metadata"
      className={className}
      onLoadedMetadata={() => {
        const vid = videoRef.current;

        if (vid) {
          try {
            vid.currentTime = 0.1;
          } catch { }
        }
      }}
    />
  );
}

/* =========================================================
   POST TILE
   ========================================================= */

function PostTile({ post, onClick, canDelete, onDelete }: { post: CalendarPostData; index: number; onClick: () => void; canDelete: boolean; onDelete: () => Promise<void> }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const cover = post.assets[0];
  const workflow = calendarWorkflow(post);
  const meta = PLATFORMS.find(p => p.value === post.platform)!;
  const time = new Date(post.postDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return <article className={contentStyles.postCard}>
    <button type="button" onClick={onClick} className={contentStyles.postOpen} aria-label={`Open ${meta.label} post: ${post.contentIdea || post.hook || "Untitled post"}`}>
      <div className={contentStyles.postTop}><PlatformIcon platform={post.platform} className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }}/><span>{meta.label}</span><time>{time}</time></div>
      {cover && <div className={contentStyles.cover}>{cover.mediaType === "PHOTO" ? <img src={cover.contentUrl} alt="" loading="lazy"/> : cover.mediaType === "VIDEO" ? <><VideoThumbnail posterUrl={cover.posterUrl} src={cover.contentUrl} className="h-full w-full object-cover"/><span className={contentStyles.play}><IconPlay className="h-4 w-4"/></span></> : <FilePenLine size={24}/>}</div>}
      <p className={contentStyles.postTitle}>{post.contentIdea || post.hook || post.caption || "Untitled post"}</p>
      <div className={contentStyles.postStatus} data-tone={workflow.tone}><span/>{workflow.label}</div>
      {post.assets.length > 1 && <span className={contentStyles.assetCount}><IconLayers className="h-3 w-3"/>{post.assets.length} files</span>}
    </button>
    {canDelete && <div className={contentStyles.deleteArea}>{!confirmingDelete ? <button type="button" onClick={() => setConfirmingDelete(true)} aria-label="Delete post" className={contentStyles.deleteTrigger}><X size={12}/></button> : <div className={contentStyles.confirmDelete}><span>Remove from calendar? Live social posts stay live.</span><button disabled={deleting} onClick={async () => { setDeleting(true); setDeleteError(""); try { await onDelete(); } catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete. Try again."); } finally { setDeleting(false); } }}>{deleting ? "Deleting…" : "Delete"}</button><button disabled={deleting} onClick={() => setConfirmingDelete(false)}>Cancel</button></div>}{deleteError && <p role="alert">{deleteError}</p>}</div>}
  </article>;
}

function AddPostPanel({
  calendarId,
  canUpload = true,
  date,
  theme,
  onClose,
  onCreated,
}: {
  calendarId: string;
  canUpload?: boolean;
  date: Date;
  theme: Theme;
  onClose: () => void;
  onCreated: (posts: CalendarPostData[]) => void;
}) {
  const t = THEMES[theme];

  // Multiple platforms can be selected at once — if it's the exact
  // same content going out everywhere, one post gets created per
  // platform chosen here, instead of repeating this whole form once
  // per platform.
  const [platforms, setPlatforms] =
    useState<Platform[]>([]);

  const [tikTokPrivacyLevel, setTikTokPrivacyLevel] =
    useState<TikTokPrivacyLevel | null>(null);

  // Time of day this post is scheduled for — combined with the
  // clicked calendar day before sending to the server, since the day
  // alone would otherwise default to midnight.
  const [postTime, setPostTime] = useState("09:00");

  const [postType, setPostType] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] =
    useState("");
  const [addingCustomCategory, setAddingCustomCategory] =
    useState(false);

  const [caption, setCaption] = useState("");
  const [contentIdea, setContentIdea] =
    useState("");

  const [cta, setCta] = useState("");
  const [customCta, setCustomCta] = useState("");
  const [addingCustomCta, setAddingCustomCta] =
    useState(false);

  const [hashtags, setHashtags] = useState("");
  const [taggedAccounts, setTaggedAccounts] =
    useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [customFields, setCustomFields] =
    useState<
      { label: string; value: string }[]
    >([]);

  // Optional — if the content is already ready, it can be attached
  // right here at creation time instead of only afterward from the
  // post's own tile.
  const [pendingFiles, setPendingFiles] =
    useState<{ file: File; previewUrl: string }[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploadingStage, setUploadingStage] =
    useState<string | null>(null);
  const [uploadProgress, setUploadProgress] =
    useState(0);
  const [sharingProgress, setSharingProgress] =
    useState(0);
  const [error, setError] =
    useState<string | null>(null);

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) =>
      prev.includes(p)
        ? prev.filter((x) => x !== p)
        : [...prev, p]
    );

  const addCustomField = () =>
    setCustomFields((prev) => [
      ...prev,
      { label: "", value: "" },
    ]);

  const updateCustomField = (
    index: number,
    key: "label" | "value",
    val: string
  ) =>
    setCustomFields((prev) =>
      prev.map((f, i) =>
        i === index
          ? { ...f, [key]: val }
          : f
      )
    );

  const removeCustomField = (index: number) =>
    setCustomFields((prev) =>
      prev.filter((_, i) => i !== index)
    );

  // Mirrors pendingFiles at all times. Async functions below read
  // from this ref instead of the state variable directly — refs
  // always hold the current value no matter when the enclosing
  // function was created, which rules out any possibility of an
  // upload silently running against an outdated, stale list of
  // files depending on what order things were clicked in.
  const pendingFilesRef = useRef<
    { file: File; previewUrl: string }[]
  >([]);
  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  // The preview URL is created exactly once per file, right here —
  // not during render — so the browser gets a stable src that
  // actually finishes loading, instead of a brand new blob URL every
  // time the form re-renders (which happens on every keystroke
  // elsewhere in the form).
  const addFiles = (files: FileList) => {
    if (!canUpload) return;
    // Converted to real, independent objects right here, synchronously,
    // the instant this runs — not deferred into the setState updater
    // below. React doesn't guarantee that updater function runs
    // immediately; if it runs after the input's value gets cleared,
    // reading the browser's live FileList at that point could see it
    // already emptied out.
    const newEntries = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingFiles((prev) => [...prev, ...newEntries]);
  };

  const removePendingFile = (index: number) =>
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });

  // Clean up every remaining object URL when the panel closes. Reads
  // from the ref (not the pendingFiles variable) so this always sees
  // whatever was actually selected most recently, not just whatever
  // existed the one time this effect was first set up.
  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((pf) =>
        URL.revokeObjectURL(pf.previewUrl)
      );
    };
  }, []);

  // Uploads every pending file onto one already-created post — same
  // presign → PUT → complete flow used from the post's own detail
  // panel.
  // Uploads every pending file to ONE source post.
  // The resulting assets can then be attached to the other
  // platform posts without uploading the actual files again.
  // Upload every pending file to ONE source post.
  // Files are uploaded concurrently so multiple images/videos
  // can transfer at the same time. Each physical file is still
  // uploaded only once.
  // Upload every pending file to ONE source post.
  // Files are uploaded concurrently so multiple images/videos
  // can transfer at the same time. Each physical file is still
  // uploaded only once.
  //
  // Progress is calculated from the actual number of bytes
  // uploaded across ALL files, so larger files contribute more
  // to the overall percentage than smaller files.
  const uploadFilesToPost = async (
    postId: string
  ): Promise<CalendarPostData | null> => {
    const files = pendingFilesRef.current;

    if (files.length === 0) {
      return null;
    }

    const totalBytes = files.reduce(
      (total, { file }) => total + file.size,
      0
    );

    const uploadedBytesByFile = new Array(files.length).fill(0);

    const updateOverallProgress = () => {
      const uploadedBytes = uploadedBytesByFile.reduce(
        (total, bytes) => total + bytes,
        0
      );

      const overallPercent =
        totalBytes > 0
          ? Math.min(
            100,
            Math.round(
              (uploadedBytes / totalBytes) * 100
            )
          )
          : 100;

      setUploadProgress(overallPercent);

      setUploadingStage(
        `Uploading ${files.length
        } ${files.length === 1 ? "file" : "files"}`
      );
    };

    const uploadSingleFile = async (
      file: File,
      index: number
    ): Promise<CalendarPostData> => workspaceUploadQueue.enqueue(calendarId, file, async (task) => {
      return uploadWorkspaceAsset<CalendarPostData>(calendarId, postId, file, task, loaded => {
        uploadedBytesByFile[index] = loaded;
        updateOverallProgress();
      });
    });

    setUploadingStage(
      `Preparing ${files.length
      } ${files.length === 1 ? "file" : "files"}...`
    );

    const outcomes = await Promise.allSettled(
      files.map(({ file }, index) => uploadSingleFile(file, index))
    );
    // Explicit cancellation keeps posts already created and files already saved.
    const uploadedPosts = outcomes.flatMap(result => result.status === "fulfilled" ? [result.value] : []);

    setUploadProgress(100);

    setUploadingStage(
      "Upload complete — 100%. Saving content..."
    );

    // The upload-complete requests can finish in any order.
    // Return whichever response contains the most complete
    // asset collection.
    const latestPost = uploadedPosts.reduce(
      (latest, current) => {
        const latestAssetCount =
          latest?.assets?.length ?? 0;

        const currentAssetCount =
          current?.assets?.length ?? 0;

        return currentAssetCount >= latestAssetCount
          ? current
          : latest;
      },
      null as CalendarPostData | null
    );

    return latestPost;
  };
  // Attaches an asset that already exists on the source post
  // to another platform post. This does NOT upload the file again.
  const attachAssetToPost = async (
    sourcePostId: string,
    destinationPostId: string,
    fileKey: string
  ): Promise<CalendarPostData> => {
    const response = await calendarMutationFetch(
      `/api/calendars/${calendarId}/posts/${destinationPostId}/attach-asset`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourcePostId,
          fileKey,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ??
        "Failed to share content with another platform"
      );
    }

    return {
      ...data.post,
      assets: data.post.assets ?? [],
      videoComments: data.post.videoComments ?? [],
      customFields: data.post.customFields ?? [],
    };
  };
  const submit = async () => {
    setUploadProgress(0);
    setSharingProgress(0);
    if (platforms.length === 0) {
      setError("Pick at least one platform");
      return;
    }

    setSaving(true);
    setError(null);
    setUploadingStage(null);

    const finalCategory = addingCustomCategory
      ? customCategory.trim()
      : category;

    const finalCta = addingCustomCta
      ? customCta.trim()
      : cta;

    // Combine the day that was clicked with the chosen time of day —
    // without this, every post would default to midnight regardless
    // of when it's actually meant to go out.
    const [hours, minutes] = postTime.split(":").map(Number);
    const fullDate = new Date(date);
    fullDate.setHours(hours || 0, minutes || 0, 0, 0);

    try {
      const res = await calendarMutationFetch(
        `/api/calendars/${calendarId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            postDate: fullDate.toISOString(),
            platforms,
            postType,
            category: finalCategory,
            caption,
            contentIdea,
            cta: finalCta,
            hashtags,
            taggedAccounts,
            linkUrl,
            customFields,
            tikTokPrivacyLevel: platforms.includes("TIKTOK") ? tikTokPrivacyLevel : undefined,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ?? "Failed to add post"
        );
      }

      const createdPosts: CalendarPostData[] = (
        data.posts ?? [data.post]
      ).map((p: CalendarPostData) => ({
        ...p,
        assets: p.assets ?? [],
        videoComments: p.videoComments ?? [],
        customFields: p.customFields ?? [],
      }));

      // Uploading is entirely optional — if files were attached,
      // every platform's post gets the same content; if not, the
      // posts are simply created empty, ready to have content added
      // later from their own tile, exactly as before.
      if (pendingFilesRef.current.length > 0) {
        setUploadProgress(0);
        setSharingProgress(0);
        // The first platform is the single source upload target.
        // Every selected file is physically uploaded only once.
        const sourcePost = createdPosts[0];

        if (!sourcePost) {
          throw new Error(
            "No post was created for the selected platform."
          );
        }

        const updatedSourcePost =
          await uploadFilesToPost(sourcePost.id);

        if (updatedSourcePost) {
          createdPosts[0] = {
            ...updatedSourcePost,
            assets: updatedSourcePost.assets ?? [],
            videoComments:
              updatedSourcePost.videoComments ?? [],
            customFields:
              updatedSourcePost.customFields ?? [],
          };
        }

        // Share each already-uploaded asset with the remaining
        // platform posts. No additional R2 upload takes place.
        if (createdPosts.length > 1) {
          const sourceAssets =
            createdPosts[0].assets ?? [];

          const destinationCount =
            createdPosts.length - 1;

          setSharingProgress(0);

          for (
            let destinationIndex = 1;
            destinationIndex < createdPosts.length;
            destinationIndex++
          ) {
            const destinationPost =
              createdPosts[destinationIndex];

            setUploadingStage(
              `Sharing content with platform ${destinationIndex} of ${destinationCount}...`
            );

            let updatedDestinationPost =
              destinationPost;

            for (
              let assetIndex = 0;
              assetIndex < sourceAssets.length;
              assetIndex++
            ) {
              const sourceAsset =
                sourceAssets[assetIndex];

              updatedDestinationPost =
                await attachAssetToPost(
                  sourcePost.id,
                  destinationPost.id,
                  sourceAsset.fileKey
                );
            }

            createdPosts[destinationIndex] =
              updatedDestinationPost;

            setSharingProgress(
              Math.round(
                (destinationIndex / destinationCount) * 100
              )
            );
          }
        }
      }

      onCreated(createdPosts);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setSaving(false);
      setUploadingStage(null);
    }
  };

  const inputStyle = {
    background: t.inputBg,
    borderColor: t.inputBorder,
    color: t.text,
  };

  return (
    <div
      className="
        fixed inset-0 z-[100]
        flex items-end justify-center
        bg-black/75
        p-0
        sm:items-center sm:p-4
        md:p-6
      "
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          relative
          flex
          h-[96dvh]
          max-h-[96dvh]
          w-full
          flex-col
          overflow-hidden
          rounded-t-3xl
          border
          shadow-2xl
          sm:h-auto
          sm:max-h-[94vh]
          sm:max-w-xl
          sm:rounded-3xl
        "
        style={{
          background: t.modalBg,
          borderColor: t.cardBorder,
          boxShadow:
            theme === "dark"
              ? "0 35px 120px rgba(0,0,0,0.6)"
              : "0 35px 120px rgba(0,0,0,0.16)",
        }}
      >
        {/* HEADER */}
        <div
          className="
            flex-shrink-0
            border-b
            px-4 py-4
            sm:px-7 sm:py-6
          "
          style={{
            borderColor: t.cardBorder,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="
                  flex h-10 w-10
                  flex-shrink-0
                  items-center justify-center
                  rounded-2xl
                "
                style={{
                  background:
                    "rgba(36,120,255,0.1)",
                  color: "#2478FF",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="17"
                    rx="3"
                  />
                  <path
                    d="M8 2.5v4M16 2.5v4M3 9h18"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 12v6M9 15h6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className="
                      text-base
                      font-semibold
                      tracking-tight
                      sm:text-lg
                    "
                    style={{ color: t.text }}
                  >
                    Plan a post
                  </h2>

                  <span
                    className="
                      rounded-full
                      px-2 py-0.5
                      text-[8px]
                      font-bold
                      uppercase
                    "
                    style={{
                      background: t.pillBg,
                      color: t.textFaint,
                      letterSpacing: "0.08em",
                    }}
                  >
                    New post
                  </span>
                </div>

                <p
                  className="mt-1 text-[10px] sm:text-xs"
                  style={{
                    color: t.textMuted,
                  }}
                >
                  {date.toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="
                flex h-9 w-9
                flex-shrink-0
                items-center justify-center
                rounded-full
                text-lg
                transition-all
                active:scale-95
              "
              style={{
                background: t.pillBg,
                color: t.textMuted,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            className="
              flex flex-col gap-7
              px-4 py-5
              sm:px-7 sm:py-6
            "
          >
            {/* DATE & TIME */}
            <section>
              <div className="mb-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: t.text }}
                >
                  When is this going out?
                </h3>

                <p
                  className="mt-1 text-[11px]"
                  style={{ color: t.textFaint }}
                >
                  The calendar date is already set — pick the time
                  of day this post is scheduled for.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div
                  className="
                    flex items-center gap-3
                    rounded-xl
                    border
                    px-4 py-3
                  "
                  style={{
                    background: t.inputBg,
                    borderColor: t.inputBorder,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 flex-shrink-0"
                    fill="none"
                    stroke={t.textFaint}
                    strokeWidth="1.8"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="17"
                      rx="3"
                    />
                    <path
                      d="M8 2.5v4M16 2.5v4M3 9h18"
                      strokeLinecap="round"
                    />
                  </svg>

                  <span
                    className="truncate text-xs font-medium"
                    style={{
                      color: t.textMuted,
                    }}
                  >
                    {date.toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }
                    )}
                  </span>
                </div>

                <div
                  className="
                    flex items-center gap-3
                    rounded-xl
                    border
                    px-4 py-2.5
                  "
                  style={{
                    background: t.inputBg,
                    borderColor: t.inputBorder,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 flex-shrink-0"
                    fill="none"
                    stroke={t.textFaint}
                    strokeWidth="1.8"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path
                      d="M12 7v5l3 2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <input
                    type="time"
                    value={postTime}
                    onChange={(e) =>
                      setPostTime(e.target.value)
                    }
                    style={{
                      fontSize: "16px",
                      color: t.text,
                    }}
                    className="
                      w-full
                      min-w-0
                      bg-transparent
                      text-xs
                      font-medium
                      outline-none
                    "
                  />
                </div>
              </div>
            </section>

            {/* PLATFORM */}
            <section>
              <div className="mb-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: t.text }}
                >
                  Where are you posting?
                </h3>

                <p
                  className="mt-1 text-[11px] leading-relaxed"
                  style={{ color: t.textFaint }}
                >
                  Select every platform this exact same content is
                  going to — one post gets created per platform you
                  pick, all sharing everything below.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PLATFORMS.map((p) => {
                  const selected =
                    platforms.includes(p.value);

                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() =>
                        togglePlatform(p.value)
                      }
                      className="
                        group
                        relative
                        flex
                        min-h-[60px]
                        items-center
                        gap-2.5
                        rounded-2xl
                        border
                        p-3
                        text-left
                        transition-all
                        active:scale-[0.98]
                      "
                      style={{
                        borderColor: selected
                          ? p.color
                          : t.inputBorder,
                        background: selected
                          ? `${p.color}12`
                          : t.inputBg,
                        boxShadow: selected
                          ? `0 8px 24px ${p.color}18`
                          : "none",
                      }}
                    >
                      <span
                        className="
                          flex h-9 w-9
                          flex-shrink-0
                          items-center justify-center
                          rounded-xl
                        "
                        style={{
                          background: selected
                            ? `${p.color}18`
                            : t.pillBg,
                          color: p.color,
                        }}
                      >
                        <PlatformIcon
                          platform={p.value}
                          className="h-4 w-4"
                        />
                      </span>

                      <span className="min-w-0">
                        <span
                          className="
                            block
                            truncate
                            text-xs
                            font-semibold
                          "
                          style={{
                            color: selected
                              ? t.text
                              : t.textMuted,
                          }}
                        >
                          {p.label}
                        </span>

                        {selected && (
                          <span
                            className="
                              mt-0.5
                              block
                              text-[9px]
                              font-medium
                            "
                            style={{
                              color: p.color,
                            }}
                          >
                            Selected
                          </span>
                        )}
                      </span>

                      {selected && (
                        <span
                          className="
                            absolute
                            right-2
                            top-2
                            flex h-4 w-4
                            items-center justify-center
                            rounded-full
                          "
                          style={{
                            background: p.color,
                            color: "#fff",
                          }}
                        >
                          <IconCheck className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {platforms.length > 1 && (
                <div
                  className="
                    mt-3
                    rounded-xl
                    border
                    p-3
                  "
                  style={{
                    background:
                      "rgba(36,120,255,0.05)",
                    borderColor:
                      "rgba(36,120,255,0.1)",
                  }}
                >
                  <p
                    className="text-[11px] leading-relaxed"
                    style={{ color: t.textMuted }}
                  >
                    This will create {platforms.length} separate
                    posts — one for each platform selected — all
                    with the same content below.
                  </p>
                </div>
              )}

              {/* TikTok requires a real, active privacy choice —
                  it can never be silently decided by this app, and
                  which levels are even available differs per
                  account (checked for real right before publish). */}
              {platforms.includes("TIKTOK") && <TikTokPrivacySelect calendarId={calendarId} value={tikTokPrivacyLevel} onChange={setTikTokPrivacyLevel} />}
            </section>

            {/* POST TYPE */}
            <section>
              <div className="mb-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: t.text }}
                >
                  What are you publishing?
                </h3>

                <p
                  className="mt-1 text-[11px]"
                  style={{ color: t.textFaint }}
                >
                  Choose the format of your content.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {POST_TYPES.map((type) => {
                  const selected =
                    postType === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setPostType(type)
                      }
                      className="
                        rounded-xl
                        border
                        px-3 py-3
                        text-left
                        text-xs
                        font-semibold
                        transition-all
                        active:scale-[0.98]
                      "
                      style={{
                        borderColor: selected
                          ? "#2478FF"
                          : t.inputBorder,
                        background: selected
                          ? "rgba(36,120,255,0.1)"
                          : t.inputBg,
                        color: selected
                          ? t.text
                          : t.pillText,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{type}</span>

                        {selected && (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background:
                                "#2478FF",
                            }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {postType === "Carousel" && (
                <div
                  className="
                    mt-3
                    rounded-xl
                    border
                    p-3
                  "
                  style={{
                    background:
                      "rgba(36,120,255,0.05)",
                    borderColor:
                      "rgba(36,120,255,0.1)",
                  }}
                >
                  <p
                    className="text-[11px] leading-relaxed"
                    style={{
                      color: t.textMuted,
                    }}
                  >
                    A carousel can contain several
                    images or videos uploaded together.
                  </p>
                </div>
              )}
            </section>

            {/* CATEGORY */}
            <section>
              <div className="mb-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: t.text }}
                >
                  Content category
                </h3>

                <p
                  className="mt-1 text-[11px]"
                  style={{ color: t.textFaint }}
                >
                  Optional — useful for organizing your calendar.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {DEFAULT_CATEGORIES.map((cat) => {
                  const selected =
                    category === cat &&
                    !addingCustomCategory;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setCategory(cat);
                        setAddingCustomCategory(
                          false
                        );
                      }}
                      className="
                        rounded-full
                        border
                        px-3 py-2
                        text-[11px]
                        font-semibold
                        transition-all
                        active:scale-[0.98]
                      "
                      style={{
                        borderColor: selected
                          ? "#2478FF"
                          : t.inputBorder,
                        background: selected
                          ? "rgba(36,120,255,0.11)"
                          : t.pillBg,
                        color: selected
                          ? "#2478FF"
                          : t.pillText,
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setAddingCustomCategory(
                      true
                    )
                  }
                  className="
                    rounded-full
                    border
                    px-3 py-2
                    text-[11px]
                    font-semibold
                    transition-all
                  "
                  style={{
                    borderColor:
                      addingCustomCategory
                        ? "#2478FF"
                        : t.inputBorder,
                    background:
                      addingCustomCategory
                        ? "rgba(36,120,255,0.11)"
                        : t.pillBg,
                    color:
                      addingCustomCategory
                        ? "#2478FF"
                        : t.pillText,
                  }}
                >
                  + Custom
                </button>
              </div>

              {addingCustomCategory && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) =>
                    setCustomCategory(
                      e.target.value
                    )
                  }
                  placeholder="Enter your own category"
                  autoFocus
                  style={{
                    fontSize: "16px",
                    ...inputStyle,
                  }}
                  className="
                    mt-3
                    w-full
                    rounded-xl
                    border
                    px-4 py-3
                    text-sm
                    outline-none
                    focus:ring-4
                    focus:ring-blue-500/10
                  "
                />
              )}
            </section>

            {/* CONTENT */}
            <section>
              <div className="mb-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: t.text }}
                >
                  Content details
                </h3>

                <p
                  className="mt-1 text-[11px]"
                  style={{ color: t.textFaint }}
                >
                  Give your team enough context to create
                  the post correctly.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-[10px]
                      font-bold
                      uppercase
                    "
                    style={{
                      color: t.textFaint,
                      letterSpacing: "0.09em",
                    }}
                  >
                    Caption
                  </label>

                  <textarea
                    value={caption}
                    onChange={(e) =>
                      setCaption(e.target.value)
                    }
                    rows={4}
                    placeholder="Write the caption..."
                    style={{
                      fontSize: "16px",
                      ...inputStyle,
                    }}
                    className="
                      w-full
                      resize-none
                      rounded-xl
                      border
                      px-4 py-3
                      text-sm
                      leading-relaxed
                      outline-none
                      focus:ring-4
                      focus:ring-blue-500/10
                    "
                  />
                </div>

                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-[10px]
                      font-bold
                      uppercase
                    "
                    style={{
                      color: t.textFaint,
                      letterSpacing: "0.09em",
                    }}
                  >
                    Creative direction
                  </label>

                  <textarea
                    value={contentIdea}
                    onChange={(e) =>
                      setContentIdea(
                        e.target.value
                      )
                    }
                    rows={8}
                    placeholder="For a video, give the designer/editor a clear production brief: concept, audience takeaway, format, shot sequence, b-roll or screen recordings, framing, lighting, graphics, pacing, sound and subtitle direction."
                    style={{
                      fontSize: "16px",
                      ...inputStyle,
                    }}
                    className="
                      w-full
                      resize-y
                      rounded-xl
                      border
                      px-4 py-3
                      text-sm
                      leading-relaxed
                      outline-none
                      focus:ring-4
                      focus:ring-blue-500/10
                    "
                  />
                </div>
              </div>
            </section>

            {/* CTA */}
            <section>
              <div className="mb-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: t.text }}
                >
                  Call to action
                </h3>

                <p
                  className="mt-1 text-[11px]"
                  style={{ color: t.textFaint }}
                >
                  What should the audience do next?
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {DEFAULT_CTAS.map((c) => {
                  const selected =
                    cta === c && !addingCustomCta;

                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCta(c);
                        setAddingCustomCta(
                          false
                        );
                      }}
                      className="
                        rounded-full
                        border
                        px-3 py-2
                        text-[11px]
                        font-semibold
                        transition-all
                      "
                      style={{
                        borderColor: selected
                          ? "#2478FF"
                          : t.inputBorder,
                        background: selected
                          ? "rgba(36,120,255,0.11)"
                          : t.pillBg,
                        color: selected
                          ? "#2478FF"
                          : t.pillText,
                      }}
                    >
                      {c}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setAddingCustomCta(true)
                  }
                  className="
                    rounded-full
                    border
                    px-3 py-2
                    text-[11px]
                    font-semibold
                  "
                  style={{
                    borderColor:
                      addingCustomCta
                        ? "#2478FF"
                        : t.inputBorder,
                    background:
                      addingCustomCta
                        ? "rgba(36,120,255,0.11)"
                        : t.pillBg,
                    color:
                      addingCustomCta
                        ? "#2478FF"
                        : t.pillText,
                  }}
                >
                  + Custom
                </button>
              </div>

              {addingCustomCta && (
                <input
                  type="text"
                  value={customCta}
                  onChange={(e) =>
                    setCustomCta(e.target.value)
                  }
                  placeholder="Write your own call to action"
                  autoFocus
                  style={{
                    fontSize: "16px",
                    ...inputStyle,
                  }}
                  className="
                    mt-3
                    w-full
                    rounded-xl
                    border
                    px-4 py-3
                    text-sm
                    outline-none
                  "
                />
              )}
            </section>

            {/* DISCOVERY */}
            <section>
              <div className="mb-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: t.text }}
                >
                  Discovery & reach
                </h3>

                <p
                  className="mt-1 text-[11px]"
                  style={{ color: t.textFaint }}
                >
                  Add hashtags, mentions or a destination link.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label
                    className="
                      mb-2
                      block
                      text-[10px]
                      font-bold
                      uppercase
                    "
                    style={{
                      color: t.textFaint,
                      letterSpacing: "0.09em",
                    }}
                  >
                    Hashtags
                  </label>

                  <textarea
                    value={hashtags}
                    onChange={(e) =>
                      setHashtags(e.target.value)
                    }
                    rows={2}
                    placeholder="#yourbrand #contentcreator"
                    style={{
                      fontSize: "16px",
                      ...inputStyle,
                    }}
                    className="
                      w-full
                      resize-none
                      rounded-xl
                      border
                      px-4 py-3
                      text-sm
                      outline-none
                    "
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="
                        mb-2 block
                        text-[10px]
                        font-bold
                        uppercase
                      "
                      style={{
                        color: t.textFaint,
                        letterSpacing: "0.09em",
                      }}
                    >
                      Tagged accounts
                    </label>

                    <input
                      type="text"
                      value={taggedAccounts}
                      onChange={(e) =>
                        setTaggedAccounts(
                          e.target.value
                        )
                      }
                      placeholder="@someone"
                      style={{
                        fontSize: "16px",
                        ...inputStyle,
                      }}
                      className="
                        w-full
                        rounded-xl
                        border
                        px-4 py-3
                        text-sm
                        outline-none
                      "
                    />
                  </div>

                  <div>
                    <label
                      className="
                        mb-2 block
                        text-[10px]
                        font-bold
                        uppercase
                      "
                      style={{
                        color: t.textFaint,
                        letterSpacing: "0.09em",
                      }}
                    >
                      Link
                    </label>

                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) =>
                        setLinkUrl(e.target.value)
                      }
                      placeholder="https://"
                      style={{
                        fontSize: "16px",
                        ...inputStyle,
                      }}
                      className="
                        w-full
                        rounded-xl
                        border
                        px-4 py-3
                        text-sm
                        outline-none
                      "
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* CONTENT FILES (OPTIONAL, UPLOAD NOW) */}
            <section>
              <div className="mb-3">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: t.text }}
                >
                  Content files
                </h3>

                <p
                  className="mt-1 text-[11px] leading-relaxed"
                  style={{ color: t.textFaint }}
                >
                  Optional — if you already have the image or video
                  ready, attach it now. If not, that&apos;s fine too:
                  you can come back and upload it later from this
                  post&apos;s own tile.
                </p>
              </div>

              {pendingFiles.length > 0 && (
                <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {pendingFiles.map(({ file, previewUrl }, i) => {
                    const isVideo = getFileContentType(file).startsWith("video/");
                    return (
                      <div
                        key={i}
                        className="
                          relative
                          aspect-square
                          overflow-hidden
                          rounded-xl
                          border
                        "
                        style={{
                          background: t.inputBg,
                          borderColor: t.inputBorder,
                        }}
                      >
                        {isVideo ? (
                          <video
                            src={previewUrl}
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}

                        {isVideo && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[10px] text-white"><UiSymbol name="play" /></span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            removePendingFile(i)
                          }
                          className="
                            absolute right-1 top-1
                            flex h-6 w-6
                            items-center justify-center
                            rounded-full
                            bg-black/65
                            text-xs
                            text-white
                            backdrop-blur-md
                            transition-all
                            hover:bg-red-500
                            active:scale-95
                          "
                          aria-label="Remove file"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <label
                className="
                  group
                  flex
                  min-h-[60px]
                  cursor-pointer
                  items-center
                  justify-center
                  gap-3
                  rounded-2xl
                  border
                  border-dashed
                  px-4 py-3
                  text-center
                  transition-all
                  hover:border-blue-500/40
                  active:scale-[0.99]
                "
                style={{
                  borderColor: t.inputBorder,
                  background: t.inputBg,
                }}
              >
                <span
                  className="
                    flex h-9 w-9
                    flex-shrink-0
                    items-center justify-center
                    rounded-xl
                  "
                  style={{
                    background: "rgba(36,120,255,0.1)",
                    color: "#2478FF",
                  }}
                >
                  +
                </span>

                <span className="min-w-0 text-left">
                  <span
                    className="block text-xs font-semibold"
                    style={{ color: "#2478FF" }}
                  >
                    {pendingFiles.length > 0
                      ? "Add another file"
                      : "Attach content now"}
                  </span>

                  <span
                    className="mt-0.5 block text-[9px]"
                    style={{ color: t.textFaint }}
                  >
                    JPG, PNG, WebP, MP4, MOV or WebM — optional
                  </span>
                </span>

                <input
                  type="file"
                    disabled={!canUpload}
                  multiple
                  accept={MEDIA_FILE_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    if (
                      e.target.files &&
                      e.target.files.length > 0
                    ) {
                      addFiles(e.target.files);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </label>
            </section>

            {/* CUSTOM FIELDS */}
            <section>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: t.text }}
                  >
                    Additional details
                  </h3>

                  <p
                    className="
                      mt-1
                      text-[11px]
                      leading-relaxed
                    "
                    style={{ color: t.textFaint }}
                  >
                    Music, location, filter, reference or
                    anything else your team needs.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addCustomField}
                  className="
                    flex
                    flex-shrink-0
                    items-center
                    gap-1.5
                    rounded-lg
                    px-3 py-2
                    text-[10px]
                    font-bold
                  "
                  style={{
                    background:
                      "rgba(36,120,255,0.1)",
                    color: "#2478FF",
                  }}
                >
                  <span className="text-sm">+</span>
                  <span className="hidden xs:inline">
                    Add detail
                  </span>
                  <span className="xs:hidden">
                    Add
                  </span>
                </button>
              </div>

              {customFields.length === 0 ? (
                <button
                  type="button"
                  onClick={addCustomField}
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-dashed
                    p-5
                    text-center
                    transition-all
                    hover:border-blue-500/40
                  "
                  style={{
                    borderColor: t.inputBorder,
                    background: t.inputBg,
                  }}
                >
                  <div
                    className="
                      mx-auto mb-2
                      flex h-8 w-8
                      items-center justify-center
                      rounded-full
                    "
                    style={{
                      background: t.pillBg,
                      color: t.textFaint,
                    }}
                  >
                    +
                  </div>

                  <p
                    className="text-xs font-semibold"
                    style={{ color: t.textMuted }}
                  >
                    Add a custom detail
                  </p>

                  <p
                    className="mt-1 text-[10px]"
                    style={{ color: t.textFaint }}
                  >
                    Keep important information that doesn't fit above.
                  </p>
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  {customFields.map((field, i) => (
                    <div
                      key={i}
                      className="
                        flex flex-col gap-2
                        rounded-xl
                        border
                        p-2
                        sm:flex-row
                        sm:items-center
                      "
                      style={{
                        background: t.inputBg,
                        borderColor: t.inputBorder,
                      }}
                    >
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) =>
                          updateCustomField(
                            i,
                            "label",
                            e.target.value
                          )
                        }
                        placeholder="Detail name"
                        style={{
                          fontSize: "16px",
                          ...inputStyle,
                        }}
                        className="
                          w-full
                          rounded-lg
                          border
                          px-3 py-2.5
                          text-xs
                          outline-none
                          sm:w-1/3
                        "
                      />

                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) =>
                          updateCustomField(
                            i,
                            "value",
                            e.target.value
                          )
                        }
                        placeholder="Enter detail"
                        style={{
                          fontSize: "16px",
                          ...inputStyle,
                        }}
                        className="
                          min-w-0
                          w-full
                          rounded-lg
                          border
                          px-3 py-2.5
                          text-xs
                          outline-none
                          sm:flex-1
                        "
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeCustomField(i)
                        }
                        className="
                          flex
                          h-9
                          w-full
                          items-center
                          justify-center
                          rounded-lg
                          text-xs
                          font-medium
                          text-red-400
                          transition-colors
                          hover:bg-red-500/10
                          sm:h-8 sm:w-8
                        "
                        aria-label="Remove detail"
                      >
                        <span className="sm:hidden">
                          Remove detail
                        </span>

                        <span className="hidden sm:block">
                          ×
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {error && /upgrade|allowance|quota|subscription|trial.*(ended|expired)/i.test(error) && <WorkspaceFeatureNotice compact message="Your current plan or storage allowance does not cover this action. View plans to restore access or increase your limits." />}
            {/* ERROR */}
            {error && (
              <div
                className="
                  flex items-start gap-3
                  rounded-xl
                  border
                  p-3.5
                "
                style={{
                  background:
                    "rgba(239,68,68,0.07)",
                  borderColor:
                    "rgba(239,68,68,0.15)",
                }}
              >
                <span
                  className="
                    flex h-5 w-5
                    flex-shrink-0
                    items-center justify-center
                    rounded-full
                    bg-red-500/10
                    text-[10px]
                    font-bold
                    text-red-400
                  "
                >
                  !
                </span>

                <p className="text-xs leading-relaxed text-red-300">
                  {error}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div
          className="
          flex
          flex-col
          flex-shrink-0
          gap-3
          border-t
            px-4 py-3
            sm:px-7 sm:py-4
          "
          style={{
            borderColor: t.cardBorder,
            background:
              theme === "dark"
                ? "rgba(20,20,20,0.96)"
                : "rgba(255,255,255,0.96)",
            backdropFilter: "blur(16px)",
          }}
        >
          {saving && uploadingStage && (
  <div className="mb-3 w-full">
    <div className="mb-1.5 flex items-center justify-between">
      <span
        className="truncate pr-4 text-[11px] font-medium"
        style={{ color: t.textMuted }}
      >
        {uploadingStage}
      </span>

      <span
        className="flex-shrink-0 text-[11px] font-semibold"
        style={{ color: t.text }}
      >
        {uploadingStage.startsWith("Sharing")
          ? sharingProgress
          : uploadProgress}
        %
      </span>
    </div>

    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{
        background:
          theme === "dark"
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.08)",
      }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-200 ease-out"
        style={{
          width: `${
            uploadingStage.startsWith("Sharing")
              ? sharingProgress
              : uploadProgress
          }%`,
          background:
            "linear-gradient(90deg, #2478FF 0%, #0052FF 100%)",
        }}
      />
    </div>
  </div>
)}
          <button
            type="button"
            onClick={onClose}
            className="
              min-h-11
              rounded-xl
              px-3
              text-xs
              font-semibold
              transition-colors
              hover:bg-black/5
              dark:hover:bg-white/5
            "
            style={{ color: t.textMuted }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={
              saving || platforms.length === 0
            }
            className="
              flex
              min-h-11
              flex-1
              items-center
              justify-center
              gap-2
              rounded-xl
              px-4 py-2.5
              text-xs
              font-semibold
              text-white
              transition-all
              active:scale-[0.98]
              disabled:cursor-not-allowed
              disabled:opacity-40
              sm:flex-none
              sm:px-5
            "
            style={{
              background:
                "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)",
              boxShadow: platforms.length > 0
                ? "0 8px 24px rgba(36,120,255,0.22)"
                : "none",
            }}
          >
            {saving ? (
              <div className="flex w-full items-center justify-center gap-3">
                <span
                  className="
        h-4 w-4
        animate-spin
        rounded-full
        border-2
        border-white/30
        border-t-white
      "
                />

                <span className="truncate">
                  {uploadingStage ?? "Adding..."}
                </span>
              </div>
            ) : (
              <>
                Add to calendar
                <span className="text-white/70"><UiSymbol name="right" /></span>
              </>
            )}
          </button>
          

        </div>
      </div>
    </div>
  );
}

/* =========================================================
   POST DETAIL PANEL
   ========================================================= */

function PostDetailPanel({
  calendarId,
  post,
  posts,
  onOtherPostUpdated,
  userRole,
  permissions,
  theme,
  onClose,
  onUpdated,
}: {
  calendarId: string;
  post: CalendarPostData;
  posts: CalendarPostData[];
  onOtherPostUpdated: (post: CalendarPostData) => void;
  userRole: "VIEW_ONLY" | "ADD_CONTENT" | "EDIT_CALENDAR";
  permissions?: readonly TeamPermission[];
  theme: Theme;
  onClose: () => void;
  onUpdated: (post: CalendarPostData) => void;
}) {
  const canUpload = permissions ? permissions.includes("creatives.upload") : userRole !== "VIEW_ONLY";
  const canEdit = permissions ? permissions.includes("calendar.edit") : userRole === "EDIT_CALENDAR";
  const canAiEdit = false;
  const canPublish = permissions ? permissions.includes("publishing.manage") : userRole === "EDIT_CALENDAR";
  const canInternalReview = permissions?.includes("internal_review.manage") === true;
  const canDeliver = permissions ? permissions.includes("delivery.manage") : userRole === "EDIT_CALENDAR";
  const t = THEMES[theme];
  const router = useRouter();
  const [detailTab, setDetailTab] = useState<"content" | "brief" | "internal" | "client" | "publishing">("content");
  const [briefState, setBriefState] = useState<BriefEditorState>({dirty:false,busy:false,needsContext:false});
  const briefSave = useRef<(() => void) | null>(null);
  const registerBriefSave = useCallback((save: (() => void) | null) => { briefSave.current = save; }, []);
  const mainSection = detailTab === "content" || detailTab === "brief" ? detailTab : "review";
  const detailScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (detailScrollRef.current) detailScrollRef.current.scrollTop = 0; }, [detailTab]);
  const [internalNote, setInternalNote] = useState(post.internalReviewNote ?? "");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [confirmApproval, setConfirmApproval] = useState(false);
  const quickFeedbackRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (feedbackOpen) quickFeedbackRef.current?.focus(); }, [feedbackOpen]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const internallyApproved = post.internalReviewStatus === "APPROVED";
  useEffect(() => { setInternalNote(post.internalReviewNote ?? ""); }, [post.internalReviewVersion, post.internalReviewNote]);
  async function saveInternalReview(action: "approve" | "request_changes" | "reopen" | "feedback") {
    if (!canInternalReview) return;
    if (reviewSaving || briefState.dirty || briefState.busy || editingDetails || savingDetails) return;
    setConfirmApproval(false);
    setReviewSaving(true); setReviewError(null); setReviewNotice(null);
    try {
      const response = await calendarMutationFetch(`/api/calendars/${calendarId}/posts/${post.id}/internal-review`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({action, note: internalNote, version: post.internalReviewVersion ?? 0}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save internal review.");
      onUpdated(result.post);
      setInternalNote(result.post.internalReviewNote ?? "");
      setReviewNotice(result.notifications?.failed ? "Review saved. Some team emails could not be delivered. Your team can still read the update here." : `Review saved. ${result.notifications?.sent ?? 0} team members notified.`);
      router.refresh();
    } catch (error) { setReviewError(error instanceof Error ? error.message : "Unable to save internal review."); }
    finally { setReviewSaving(false); }
  }
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex="0"]'
      ) ?? []).filter(element => element.getClientRects().length > 0);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const videoRef =
    useRef<HTMLVideoElement>(null);

  const [uploading, setUploading] =
    useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  const [error, setError] =
    useState<string | null>(null);

  const [activeAssetIdx, setActiveAssetIdx] =
    useState(0);

  const isApproved = post.approvalStatus === "APPROVED";
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingWithAI, setEditingWithAI] = useState(false);
const [aiInstruction, setAiInstruction] = useState("");
const [aiEditing, setAiEditing] = useState(false);
const [aiEditError, setAiEditError] = useState("");
const [aiEditFields, setAiEditFields] = useState<string[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);

  const [draftDetails, setDraftDetails] = useState({
  postDate: "",
  platform: post.platform,
  postType: post.postType ?? "",
  category: post.category ?? "",
  hook: post.hook ?? "",
  script: post.script ?? "",
  caption: post.caption ?? "",
    contentIdea: post.contentIdea ?? "",
    cta: post.cta ?? "",
    hashtags: post.hashtags ?? "",
    taggedAccounts: post.taggedAccounts ?? "",
    linkUrl: post.linkUrl ?? "",
  });

  const handleAiEdit = async () => {
  const instruction = aiInstruction.trim();

  if (!canAiEdit || !instruction || aiEditing) {
    return;
  }

  setAiEditing(true);
  setAiEditError("");

  try {
    const response = await calendarMutationFetch(
      `/api/calendars/${calendarId}/ai-drafts/${post.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
  instruction,
  fields: aiEditFields.length > 0 ? aiEditFields : undefined,
}),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof result?.error === "string"
          ? result.error
          : "Unable to edit this post with AI."
      );
    }

    const generation = result?.generation;

    if (!generation) {
      throw new Error(
        "AI updated the post, but the updated post could not be loaded."
      );
    }

    const updatedPost: CalendarPostData = {
      ...post,
      internalReviewStatus: "PENDING",
      internalReviewNote: null,
      internalReviewVersion: (post.internalReviewVersion ?? 0) + 1,
      approvalStatus: "PENDING",
      postDate: generation.postDate,
      platform: generation.platform,
      postType: generation.postType ?? null,
      category: generation.category ?? null,
      hook: generation.hook ?? null,
      script: generation.script ?? null,
      caption: generation.caption ?? null,
      contentIdea: generation.contentIdea ?? null,
      cta: generation.cta ?? null,
      hashtags: generation.hashtags ?? null,
      taggedAccounts: post.taggedAccounts,
      linkUrl: post.linkUrl,
    };

    onUpdated(updatedPost);

    setEditingWithAI(false);
    setAiInstruction("");
    router.refresh();
  } catch (error) {
    setAiEditError(
      error instanceof Error
        ? error.message
        : "Unable to edit this post with AI."
    );
  } finally {
    setAiEditing(false);
  }
};
  const startEditingDetails = () => {
    if (!canEdit || isApproved) return;

    const date = new Date(post.postDate);
    const localDateTime = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);

   setDraftDetails({
  postDate: localDateTime,
  platform: post.platform,
  postType: post.postType ?? "",
  category: post.category ?? "",
  hook: post.hook ?? "",
  script: post.script ?? "",
  caption: post.caption ?? "",
      contentIdea: post.contentIdea ?? "",
      cta: post.cta ?? "",
      hashtags: post.hashtags ?? "",
      taggedAccounts: post.taggedAccounts ?? "",
      linkUrl: post.linkUrl ?? "",
    });
    setDetailsError(null);
    setEditingDetails(true);
  };

  const cancelEditingDetails = () => {
    if (savingDetails) return;
    setEditingDetails(false);
    setDetailsError(null);
  };

  const saveDetails = async () => {
    if (!canEdit || isApproved || savingDetails) return;

    setSavingDetails(true);
    setDetailsError(null);

    try {
      const res = await calendarMutationFetch(
        `/api/calendars/${calendarId}/posts/${post.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(post.creativeBrief ? {postDate:draftDetails.postDate?new Date(draftDetails.postDate).toISOString():undefined,platform:draftDetails.platform,taggedAccounts:draftDetails.taggedAccounts,linkUrl:draftDetails.linkUrl} : {
            postDate: draftDetails.postDate
              ? new Date(draftDetails.postDate).toISOString()
              : undefined,
            platform: draftDetails.platform,
postType: draftDetails.postType,
category: draftDetails.category,
hook: draftDetails.hook,
script: draftDetails.script,
caption: draftDetails.caption,
            contentIdea: draftDetails.contentIdea,
            cta: draftDetails.cta,
            hashtags: draftDetails.hashtags,
            taggedAccounts: draftDetails.taggedAccounts,
            linkUrl: draftDetails.linkUrl,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ??
          "We couldn't save these changes. Please try again."
        );
      }

      onUpdated({
        ...data.post,
        assets: data.post?.assets ?? post.assets,
        videoComments: data.post?.videoComments ?? post.videoComments,
        customFields: data.post?.customFields ?? post.customFields,
      });

      setEditingDetails(false);
      router.refresh();
    } catch (err) {
      setDetailsError(
        err instanceof Error
          ? err.message
          : "We couldn't save these changes. Please try again."
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const platformMeta =
    PLATFORMS.find(
      (p) => p.value === post.platform
    )!;

  const approvalMeta =
    { ...APPROVAL_META[post.approvalStatus], text: calendarWorkflow(post).label };

  const activeAsset =
    post.assets[activeAssetIdx] ??
    post.assets[0] ??
    null;

  const uploadOne = async (file: File) => workspaceUploadQueue.enqueue(calendarId, file, async (task) => {
    if (!canUpload) throw new Error("You do not have permission to upload creative assets.");
    setUploadPercent(0);
    if (isApproved) {
      throw new Error(
        "This post has already been approved by the client and is locked."
      );
    }

    const updated = await uploadWorkspaceAsset<CalendarPostData>(calendarId, post.id, file, task, loaded => setUploadPercent(loaded / file.size * 100));
    onUpdated({ ...updated, assets: updated.assets ?? [], videoComments: updated.videoComments ?? [], customFields: updated.customFields ?? [] });
    return updated;
  });

  const uploadMany = async (
    files: FileList
  ) => {
    setUploading(true);
    setUploadPercent(0);
    setError(null);

    try {
      const outcomes = await Promise.allSettled(Array.from(files).map(file => uploadOne(file)));
      const failures = outcomes.filter(result => result.status === "rejected");
      if (failures.length) throw new Error(`${failures.length} upload(s) cancelled. Successfully saved files are kept.`);

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  };

  const removeAsset = async (
    assetId: string
  ) => {
    if (isApproved) {
      setError(
        "This post has already been approved by the client and is locked."
      );
      return;
    }

    if (!canEdit) return;
    try {
      const res = await calendarMutationFetch(
        `/api/calendars/${calendarId}/posts/${post.id}/assets/${assetId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to remove content"
        );
      }

      const updatedAssets =
        post.assets.filter(
          (a) => a.id !== assetId
        );

      onUpdated({
        ...post,
        internalReviewStatus: "PENDING",
        internalReviewNote: null,
        internalReviewVersion: (post.internalReviewVersion ?? 0) + 1,
        approvalStatus: "PENDING",
        assets: updatedAssets,
      });

      setActiveAssetIdx(0);

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove content"
      );
    }
  };

  const resubmitForApproval = async () => {
    setResubmitting(true);
    setError(null);
    try {
      const res = await calendarMutationFetch(
        `/api/calendars/${calendarId}/posts/${post.id}/resubmit`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to resubmit this post");
      onUpdated({
        ...data.post,
        assets: data.post?.assets ?? post.assets,
        videoComments: data.post?.videoComments ?? post.videoComments,
        customFields: data.post?.customFields ?? post.customFields,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resubmit this post");
    } finally {
      setResubmitting(false);
    }
  };

  return (
    <div
      className="
        fixed inset-0 z-[150]
        flex items-center justify-center
        bg-black/75
        p-2 sm:p-6
      "
      onClick={onClose}
    >
      <div
        ref={panelRef}
        data-theme={theme}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-post-detail-title"
        tabIndex={-1}
        onClick={(e) =>
          e.stopPropagation()
        }
        className={`${reviewStyles.panel} ${reviewStyles.dialogPanel}
          relative
          flex
          w-full
          flex-col
          overflow-hidden
        `}
        style={{
          "--review-surface": t.modalBg,
          "--review-soft": t.inputBg,
          "--review-border": t.cardBorder,
          "--review-text": t.text,
          "--review-muted": t.textMuted,
          background: t.modalBg,
          borderColor: t.cardBorder,
        } as React.CSSProperties}
      >
        {/* HEADER */}
        <div
          className={`${reviewStyles.editorHeader}
            flex-shrink-0
            border-b
            px-4 py-4
            sm:px-7 sm:py-4
          `}
          style={{
            borderColor: t.cardBorder,
          }}
        >
          <div className={reviewStyles.headerRow}>
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="
                  flex h-10 w-10
                  flex-shrink-0
                  items-center justify-center
                  rounded-2xl
                "
                style={{
                  background:
                    `${platformMeta.color}18`,
                  color:
                    platformMeta.color,
                }}
              >
                <PlatformIcon
                  platform={post.platform}
                  className="h-5 w-5"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="calendar-post-detail-title"
                    className="
                      line-clamp-2
                      text-base
                      font-semibold
                      tracking-tight
                      sm:text-lg
                    "
                    style={{
                      color: t.text,
                    }}
                  >
                    {`${platformMeta.label} post`}
                  </h2>
                  <span role="status" className={reviewStyles.headerSave}>{reviewSaving || briefState.busy || savingDetails ? "Saving…" : briefState.dirty || editingDetails ? "Unsaved changes" : "Saved ✓"}</span>

                  {post.postType && (
                    <span
                      className="
                        rounded-full
                        px-2 py-1
                        text-[8px]
                        font-bold
                        uppercase
                      "
                      style={{
                        background: t.pillBg,
                        color: t.pillText,
                        letterSpacing:
                          "0.08em",
                      }}
                    >
                      {post.postType}
                    </span>
                  )}

                  {post.category && (
                    <span
                      className="
                        max-w-[130px]
                        truncate
                        rounded-full
                        px-2 py-1
                        text-[8px]
                        font-semibold
                      "
                      style={{
                        background:
                          `${platformMeta.color}12`,
                        color:
                          platformMeta.color,
                      }}
                    >
                      {post.category}
                    </span>
                  )}
                </div>

                <p
                  className="mt-1 text-[10px] sm:text-xs"
                  style={{
                    color: t.textMuted,
                  }}
                >
                  {new Date(
                    post.postDate
                  ).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                  {" · "}
                  {new Date(
                    post.postDate
                  ).toLocaleTimeString(
                    "en-US",
                    {
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  )}
                </p>
              </div>
            </div>

            <div className={reviewStyles.headerActions}><div className={reviewStyles.headerTools}>
              {(detailTab === "content" || detailTab === "brief") && canInternalReview && !isApproved && <button id="quick-feedback-toggle" type="button" className={reviewStyles.feedbackButton} aria-expanded={feedbackOpen} aria-controls="quick-team-feedback" onClick={() => setFeedbackOpen(open => !open)}><MessageSquare size={16} aria-hidden="true"/><span>Feedback</span></button>}
              {editingDetails ? <button type="button" onClick={saveDetails} disabled={savingDetails} className={reviewStyles.next}>{savingDetails ? "Saving…" : "Save changes"}</button>
                : briefState.dirty ? <button type="button" disabled={briefState.busy} onClick={() => briefSave.current?.()} className={reviewStyles.next}>Save changes</button>
                : (detailTab === "content" || detailTab === "brief") ? <button type="button" disabled={briefState.busy || reviewSaving} onClick={() => { setFeedbackOpen(false); setDetailTab("internal"); }} className={reviewStyles.next}>Continue to review<span aria-hidden="true">→</span></button>
                : detailTab === "internal" && canInternalReview && !internallyApproved && !isApproved ? <button type="button" disabled={reviewSaving} onClick={() => setConfirmApproval(true)} className={reviewStyles.next}>{reviewSaving ? "Saving…" : "Approve for client review"}</button>
                : detailTab === "internal" ? <button type="button" disabled={!internallyApproved} onClick={() => setDetailTab("client")} className={reviewStyles.next}>Client approval<span aria-hidden="true">→</span></button>
                : detailTab === "client" ? <button type="button" disabled={!isApproved} onClick={() => setDetailTab("publishing")} className={reviewStyles.next}>Publishing<span aria-hidden="true">→</span></button>
                : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="
                flex h-9 w-9
                flex-shrink-0
                items-center justify-center
                rounded-full
                text-lg
                transition-all
                active:scale-95
              "
              style={{
                background: t.pillBg,
                color: t.textMuted,
              }}
            >
              <X size={18} />
            </button>
            </div>
          </div>
          {feedbackOpen && (detailTab === "content" || detailTab === "brief") && canInternalReview && !isApproved && (
            <section id="quick-team-feedback" className={reviewStyles.quickFeedback} aria-label="Private team feedback" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setFeedbackOpen(false); document.getElementById("quick-feedback-toggle")?.focus(); } }}>
              <div className={reviewStyles.feedbackHeading}><label htmlFor="quick-team-note"><Users size={16} aria-hidden="true"/>Private team feedback</label><button type="button" aria-label="Collapse feedback" onClick={() => setFeedbackOpen(false)}><X size={18}/></button></div>
              <p>Only your team sees this. Your post stays in view.</p>
              <textarea ref={quickFeedbackRef} id="quick-team-note" value={internalNote} onChange={e => setInternalNote(e.target.value)} maxLength={4000} rows={3} disabled={reviewSaving} placeholder="Share feedback on the creative, caption or direction…"/>
              <div className={reviewStyles.quickFeedbackActions}><span>{internalNote.length.toLocaleString()} / 4,000</span><button type="button" className={reviewStyles.feedbackButton} disabled={reviewSaving || !internalNote.trim() || briefState.dirty || briefState.busy || editingDetails || savingDetails} onClick={() => saveInternalReview("feedback")}>{reviewSaving ? "Sharing…" : "Share feedback"}<Send size={14} aria-hidden="true"/></button></div>
              {reviewNotice && <p role="status">{reviewNotice}</p>}
              {reviewError && <p role="alert" className={reviewStyles.feedbackError}>{reviewError}</p>}
            </section>
          )}
          {confirmApproval && detailTab === "internal" && <div className={reviewStyles.approvalConfirm}><span>Make this post available for client review? Approval does not publish it.</span><button type="button" onClick={() => setConfirmApproval(false)}>Cancel</button><button type="button" disabled={reviewSaving || briefState.dirty || briefState.busy || editingDetails || savingDetails} onClick={() => saveInternalReview("approve")} className={reviewStyles.feedbackButton}>Confirm approval</button></div>}
        </div>

        <nav className={reviewStyles.sectionNavigation} aria-label="Post sections">
          {([
            ["content", "Content", FilePenLine],
            ["brief", "Creative brief", Sparkles],
            ["review", "Review & publish", ShieldCheck],
          ] as const).map(([value, label, Icon]) => <button key={value} type="button" aria-current={mainSection === value ? "page" : undefined} disabled={briefState.dirty || briefState.busy || editingDetails} onClick={() => { setFeedbackOpen(false); setConfirmApproval(false); setDetailTab(value === "review" ? "internal" : value); }}><Icon size={16} aria-hidden="true"/><span>{label}</span></button>)}
        </nav>
        {mainSection === "review" && <nav className={reviewStyles.reviewNavigation} aria-label="Review progress">{([["internal", "Team review"], ["client", "Client approval"], ["publishing", "Publishing"]] as const).map(([value, label], index) => <button key={value} type="button" aria-current={detailTab === value ? "step" : undefined} onClick={() => {setConfirmApproval(false); setDetailTab(value);}}><span>{index + 1}</span>{label}</button>)}</nav>}
        {(reviewError || reviewNotice) && !feedbackOpen && <p className={reviewStyles.reviewMessage} role={reviewError ? "alert" : "status"}>{reviewError || reviewNotice}</p>}
        {/* A single scroll surface keeps long captions and publishing controls reachable. */}
        <div ref={detailScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-wrap:anywhere]">

          <div className={(detailTab === "content" || detailTab === "brief") ? `${contentStyles.editorColumns} ${reviewStyles.columns} mx-auto grid w-full max-w-[1440px] min-w-0 gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8` : "hidden"}>
            <div className={`${contentStyles.editorMedia} min-w-0`}>
              {canUpload && !isApproved && <div className={reviewStyles.mediaUploadAction}>
                <button type="button" className={reviewStyles.mediaUploadButton} disabled={uploading} onClick={() => mediaInputRef.current?.click()}>
                  <Upload size={17} aria-hidden="true"/>
                  {uploading ? `Uploading ${Math.round(uploadPercent)}%` : post.assets.length ? post.postType === "Carousel" ? "Add more files" : "Replace content" : "Upload content"}
                </button>
                <input ref={mediaInputRef} type="file" multiple={post.postType === "Carousel"} accept={MEDIA_FILE_ACCEPT} className="hidden" disabled={uploading} onChange={event => { if (event.target.files?.length) void uploadMany(event.target.files); event.currentTarget.value = ""; }}/>
              </div>}

              {canUpload && post.assets.length > 0 && !uploading && <ReusePostMedia key={post.id} calendarId={calendarId} source={post} posts={posts} canReplace={canEdit} onUpdated={onOtherPostUpdated} />}
            {/* MEDIA */}
            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3
                    className="text-sm font-semibold"
                    style={{
                      color: t.text,
                    }}
                  >
                    Preview
                  </h3>

                  <p
                    className="mt-1 text-[11px]"
                    style={{
                      color: t.textFaint,
                    }}
                  >
                    Your creative
                  </p>
                </div>

                {post.assets.length > 0 && (
                  <span
                    className="
                      flex-shrink-0
                      rounded-full
                      px-2.5 py-1
                      text-[10px]
                      font-semibold
                    "
                    style={{
                      background: t.pillBg,
                      color: t.textMuted,
                    }}
                  >
                    {post.assets.length}{" "}
                    {post.assets.length === 1
                      ? "file"
                      : "files"}
                  </span>
                )}
              </div>

              {activeAsset ? (
                <div>
                  <div
                    className="
                      group
                      relative
                      overflow-hidden
                      rounded-2xl
                      border
                    "
                    style={{
                      background: theme === "dark" ? "#14243a" : "#edf2f9",
                      borderColor:
                        t.cardBorder,
                    }}
                  >
                    {activeAsset.mediaType ===
                      "VIDEO" ? (
                      <video
                        ref={videoRef}
                        poster={activeAsset.posterUrl ?? undefined}
                        preload={activeAsset.posterUrl ? "none" : "metadata"}
                        src={
                          activeAsset.contentUrl
                        }
                        controls
                        playsInline
                        className="
                          max-h-[42vh]
                          w-full
                          object-contain
                          sm:max-h-[520px]
                        "
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          activeAsset.contentUrl
                        }
                        alt={`${platformMeta.label} post creative ${activeAssetIdx + 1}`}
                        className="
                          max-h-[42vh]
                          w-full
                          object-contain
                          sm:max-h-[520px]
                        "
                      />
                    )}

                    <button
                      type="button"
                      disabled={!canEdit || isApproved}
                      onClick={() =>
                        removeAsset(
                          activeAsset.id
                        )
                      }
                      className="
                        absolute right-2.5 top-2.5
                        flex h-9 w-9
                        items-center justify-center
                        rounded-full
                        border border-white/10
                        bg-black/65
                        text-sm
                        text-white
                        backdrop-blur-md
                        transition-all
                        active:scale-95
                        hover:bg-red-500
                      "
                      aria-label="Remove this file"
                    >
                      ×
                    </button>

                    {post.assets.length > 1 && (
                      <div
                        className="
                          absolute bottom-2.5 right-2.5
                          rounded-full
                          bg-black/65
                          px-2.5 py-1
                          text-[10px]
                          font-semibold
                          text-white/80
                          backdrop-blur-md
                        "
                      >
                        {activeAssetIdx + 1} /{" "}
                        {post.assets.length}
                      </div>
                    )}
                  </div>

                  {post.assets.length > 1 && (
                    <div
                      className="
                        mt-3
                        flex gap-2
                        overflow-x-auto
                        pb-1
                        scrollbar-thin
                      "
                    >
                      {post.assets.map(
                        (asset, i) => {
                          const selected =
                            i ===
                            activeAssetIdx;

                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() =>
                                setActiveAssetIdx(
                                  i
                                )
                              }
                              className="
                                relative
                                h-16 w-16
                                flex-shrink-0
                                overflow-hidden
                                rounded-xl
                                transition-all
                                active:scale-95
                                sm:h-[68px]
                                sm:w-[68px]
                              "
                              style={{
                                border: selected
                                  ? "2px solid #2478FF"
                                  : `2px solid ${t.inputBorder}`,
                                opacity:
                                  selected
                                    ? 1
                                    : 0.7,
                              }}
                            >
                              {asset.mediaType ===
                                "VIDEO" ? (
                                <>
                                  <video
                                    poster={asset.posterUrl ?? undefined}
                                    src={
                                      asset.contentUrl
                                    }
                                    muted
                                    playsInline
                                    preload={asset.posterUrl ? "none" : "metadata"}
                                    className="
                                      h-full
                                      w-full
                                      object-cover
                                    "
                                  />

                                  <span className="
                                    absolute inset-0
                                    flex items-center
                                    justify-center
                                    bg-black/20
                                  ">
                                    <span className="
                                      flex h-6 w-6
                                      items-center
                                      justify-center
                                      rounded-full
                                      bg-black/60
                                      text-[9px]
                                      text-white
                                    "><UiSymbol name="play" /></span>
                                  </span>
                                </>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={
                                    asset.contentUrl
                                  }
                                  alt=""
                                  className="
                                    h-full
                                    w-full
                                    object-cover
                                  "
                                />
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}

                  {activeAsset.mediaType ===
                    "VIDEO" && (
                      <div className="mt-4">
                        <CalendarVideoComments
                          comments={
                            post.videoComments
                          }
                          readOnly
                          onSeekTo={(seconds) => {
                            const vid =
                              videoRef.current;

                            if (!vid) return;

                            vid.currentTime =
                              seconds;

                            vid
                              .play()
                              .catch(() => { });
                          }}
                        />
                      </div>
                    )}
                </div>
              ) : (
                <div
                  className="
                    rounded-2xl
                    border
                    border-dashed
                    px-5 py-10
                    text-center
                  "
                  style={{
                    background: t.inputBg,
                    borderColor:
                      t.inputBorder,
                  }}
                >
                  <p
                    className="text-xs font-semibold"
                    style={{
                      color: t.textMuted,
                    }}
                  >
                    No content uploaded yet
                  </p>

                  <p
                    className="mt-1 text-[10px]"
                    style={{
                      color: t.textFaint,
                    }}
                  >
                    Add an image or video to prepare this post.
                  </p>
                </div>
              )}



              {isApproved && (
                <div
                  className="mt-3 flex items-center gap-2.5 rounded-2xl border px-4 py-3"
                  style={{
                    background: "rgba(34,197,94,0.045)",
                    borderColor: "rgba(34,197,94,0.14)",
                  }}
                >
                  <IconCheck className="h-4 w-4 flex-shrink-0 text-[#4ADE80]" />
                  <p className="text-[10px] leading-relaxed" style={{ color: t.textMuted }}>
                    Content is locked after client approval.
                  </p>
                </div>
              )}

              {error && /upgrade|allowance|quota|subscription|trial.*(ended|expired)/i.test(error) && <WorkspaceFeatureNotice compact message="Your current plan or storage allowance does not cover this action. View plans to restore access or increase your limits." />}
              {error && (
                <div
                  className="
                    mt-3
                    flex items-start gap-2.5
                    rounded-xl
                    border
                    px-3.5 py-3
                  "
                  style={{
                    background:
                      "rgba(239,68,68,0.07)",
                    borderColor:
                      "rgba(239,68,68,0.14)",
                  }}
                >
                  <span className="text-xs text-red-400">
                    !
                  </span>

                  <p className="
                    text-xs
                    leading-relaxed
                    text-red-300
                  ">
                    {error}
                  </p>
                </div>
              )}
            </section>


            </div>
            <div className="min-w-0 space-y-7 lg:border-l lg:pl-8" style={{ borderColor: t.cardBorder }}>
            {/* POST DETAILS */}
            <section>
              <div className={reviewStyles.copyHeading}>
                <div><h3>{detailTab === "brief" ? "Creative brief" : "Post content"}</h3><p className={reviewStyles.sectionHelp}>{detailTab === "brief" ? "The direction and thinking behind this post." : "Shape the copy that goes with your creative."}</p></div>
                <span className={reviewStyles.status}>{isApproved ? "Client approved · Locked" : internallyApproved ? "Ready for client review" : "Team only · Awaiting review"}</span>
              </div>
              {detailTab === "content" && canEdit && !isApproved && !editingDetails && <button type="button" onClick={startEditingDetails} disabled={briefState.dirty || briefState.busy} className={reviewStyles.editSchedule}><FilePenLine size={14}/>Edit schedule &amp; details</button>}

              {isApproved && (
                <div
                  className="mb-4 flex items-start gap-3 rounded-2xl border p-4"
                  style={{
                    background:
                      theme === "dark"
                        ? "rgba(34,197,94,0.055)"
                        : "rgba(34,197,94,0.045)",
                    borderColor: "rgba(34,197,94,0.16)",
                  }}
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "rgba(34,197,94,0.12)",
                      color: "#4ADE80",
                    }}
                  >
                    <IconCheck className="h-4 w-4" />
                  </span>

                  <div>
                    <p
                      className="text-xs font-semibold"
                      style={{ color: t.text }}
                    >
                      Approved content is protected
                    </p>
                    <p
                      className="mt-1 text-[11px] leading-relaxed"
                      style={{ color: t.textMuted }}
                    >
                      This post can still be viewed and reviewed, but its
                      details and content can no longer be changed. If something
                      needs to change, ask the client to request a revision.
                    </p>
                  </div>
                </div>
              )}

              
{editingWithAI ? (
  <div className="space-y-5">
    <div>
      <h3 className="text-base font-semibold">Edit with AI</h3>
      <p className="mt-1 text-sm text-gray-500">
        Tell AI what you want to change about this post.
      </p>
    </div>

    <div>
  <p className="mb-2 text-sm font-semibold text-gray-900">
    What would you like to edit?
  </p>

  <div className="flex flex-wrap gap-2">
    {[
      { value: "hook", label: "Hook" },
      { value: "caption", label: "Caption" },
      { value: "contentIdea", label: "Creative direction" },
      { value: "cta", label: "CTA" },
      { value: "hashtags", label: "Hashtags" },
    ].map((field) => {
      const selected = aiEditFields.includes(field.value);

      return (
        <button
          key={field.value}
          type="button"
          onClick={() => {
            setAiEditFields((current) =>
              current.includes(field.value)
                ? current.filter((value) => value !== field.value)
                : [...current, field.value]
            );
            setAiEditError("");
          }}
          disabled={aiEditing}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            selected
              ? "border-purple-600 bg-purple-50 text-purple-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {selected ? <><UiSymbol name="check" />{" "}</> : ""}
          {field.label}
        </button>
      );
    })}
  </div>

  <p className="mt-2 text-xs text-gray-400">
    Select one or more fields. Leave everything unselected to edit the entire post.
  </p>
</div>

    <textarea
      value={aiInstruction}
      onChange={(e) => {
        setAiInstruction(e.target.value);
        setAiEditError("");
      }}
      placeholder="e.g. Make the hook more attention-grabbing and shorten the caption."
      rows={5}
      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
      disabled={aiEditing}
    />

    {aiEditError && (
      <p className="text-sm text-red-600">
        {aiEditError}
      </p>
    )}

    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => {
          setEditingWithAI(false);
          setAiInstruction("");
          setAiEditError("");
        }}
        disabled={aiEditing}
        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>

      <button
  type="button"
  onClick={handleAiEdit}
  disabled={
  aiEditing ||
  (!aiInstruction.trim() && aiEditFields.length === 0)
}
  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  {aiEditing ? "AI is editing..." : "Generate changes"}
</button>
    </div>
  </div>
) : !editingDetails ? (
  <CreativeBriefEditor guided guidedSection={detailTab === "brief" ? "brief" : "copy"} onStateChange={setBriefState} onSaveReady={registerBriefSave} key={post.id} calendarId={calendarId} post={{...post}} readOnly={!canEdit||isApproved} onUpdated={updated=>onUpdated({...post,...updated})}/>
) : editingDetails ? (
                <div
                  className="rounded-2xl border p-4 sm:p-5"
                  style={{
                    background: t.inputBg,
                    borderColor: t.inputBorder,
                  }}
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Publish date & time
                      </span>
                      <input
                        type="datetime-local"
                        value={draftDetails.postDate}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            postDate: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border px-3.5 py-3 text-xs outline-none transition-all"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      />
                    </label>

                    <label className="block">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Platform
                      </span>
                      <select
                        value={draftDetails.platform}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            platform: e.target.value as Platform,
                          }))
                        }
                        className="w-full rounded-xl border px-3.5 py-3 text-xs outline-none"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      >
                        {PLATFORMS.map((platform) => (
                          <option
                            key={platform.value}
                            value={platform.value}
                          >
                            {platform.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {!post.creativeBrief && <>
<label className="block">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Format
                      </span>
                      <select
                        value={draftDetails.postType}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            postType: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border px-3.5 py-3 text-xs outline-none"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      >
                        <option value="">No format</option>
                        {POST_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Category
                      </span>
                      <input
                        value={draftDetails.category}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                        list="calendar-post-categories"
                        placeholder="e.g. Educational"
                        className="w-full rounded-xl border px-3.5 py-3 text-xs outline-none"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      />
                      <datalist id="calendar-post-categories">
                        {DEFAULT_CATEGORIES.map((category) => (
                          <option key={category} value={category} />
                        ))}
                      </datalist>
                    </label>

                    <label className="block sm:col-span-2">
  <span
    className="mb-1.5 block text-[10px] font-bold uppercase"
    style={{
      color: t.textFaint,
      letterSpacing: "0.08em",
    }}
  >
    Hook
  </span>
  <textarea
    value={draftDetails.hook}
    onChange={(e) =>
      setDraftDetails((prev) => ({
        ...prev,
        hook: e.target.value,
      }))
    }
    rows={3}
    placeholder="Write the opening hook..."
    className="w-full resize-y rounded-xl border px-3.5 py-3 text-sm leading-relaxed outline-none"
    style={{
      background: t.modalBg,
      borderColor: t.inputBorder,
      color: t.text,
    }}
  />
</label>



                    <label className="block sm:col-span-2">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Caption
                      </span>
                      <textarea
                        value={draftDetails.caption}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            caption: e.target.value,
                          }))
                        }
                        rows={7}
                        placeholder="Write the caption..."
                        className="w-full resize-y rounded-xl border px-3.5 py-3 text-sm leading-relaxed outline-none"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Creative direction
                      </span>
                      <textarea
                        value={draftDetails.contentIdea}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            contentIdea: e.target.value,
                          }))
                        }
                        rows={12}
                        placeholder="Give the designer/editor a production-ready brief: concept, audience takeaway, format, duration, shot list, screen recordings or b-roll, framing, lighting, graphics, pacing, transitions, sound, subtitles and safe-area notes."
                        className="w-full resize-y rounded-xl border px-3.5 py-3 text-sm leading-relaxed outline-none"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      />
                    </label>

                    <label className="block">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Call to action
                      </span>
                      <input
                        value={draftDetails.cta}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            cta: e.target.value,
                          }))
                        }
                        list="calendar-post-ctas"
                        placeholder="e.g. Comment below"
                        className="w-full rounded-xl border px-3.5 py-3 text-xs outline-none"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      />
                      <datalist id="calendar-post-ctas">
                        {DEFAULT_CTAS.map((cta) => (
                          <option key={cta} value={cta} />
                        ))}
                      </datalist>
                    </label>

                    <label className="block">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Hashtags
                      </span>
                      <input
                        value={draftDetails.hashtags}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            hashtags: e.target.value,
                          }))
                        }
                        placeholder="#brand #content"
                        className="w-full rounded-xl border px-3.5 py-3 text-xs outline-none"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      />
                    </label>
</>}

                    <label className="block">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Tagged accounts
                      </span>
                      <input
                        value={draftDetails.taggedAccounts}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            taggedAccounts: e.target.value,
                          }))
                        }
                        placeholder="@account"
                        className="w-full rounded-xl border px-3.5 py-3 text-xs outline-none"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      />
                    </label>

                    <label className="block">
                      <span
                        className="mb-1.5 block text-[10px] font-bold uppercase"
                        style={{
                          color: t.textFaint,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Destination link
                      </span>
                      <input
                        type="url"
                        value={draftDetails.linkUrl}
                        onChange={(e) =>
                          setDraftDetails((prev) => ({
                            ...prev,
                            linkUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="w-full rounded-xl border px-3.5 py-3 text-xs outline-none"
                        style={{
                          background: t.modalBg,
                          borderColor: t.inputBorder,
                          color: t.text,
                        }}
                      />
                    </label>
                  </div>

                  {detailsError && (
                    <div
                      className="mt-4 rounded-xl border px-3.5 py-3 text-xs leading-relaxed"
                      style={{
                        background: "rgba(239,68,68,0.07)",
                        borderColor: "rgba(239,68,68,0.14)",
                        color: "#FCA5A5",
                      }}
                    >
                      {detailsError}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={cancelEditingDetails}
                      disabled={savingDetails}
                      className="rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all disabled:opacity-40"
                      style={{
                        borderColor: t.inputBorder,
                        color: t.textMuted,
                        background: t.pillBg,
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={saveDetails}
                      disabled={savingDetails}
                      className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background:
                          "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)",
                        boxShadow:
                          "0 8px 24px rgba(36,120,255,0.22)",
                      }}
                    >
                      {savingDetails ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Saving changes...
                        </>
                      ) : (
                        <>
                          Save changes
                          <span className="text-white/70"><><UiSymbol name="right" /></></span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {post.hook && (
  <div
    className="rounded-2xl border p-4"
    style={{
      background: t.inputBg,
      borderColor: t.inputBorder,
    }}
  >
    <p
      className="mb-2 text-[10px] font-bold uppercase"
      style={{
        color: t.textFaint,
        letterSpacing: "0.08em",
      }}
    >
      Hook
    </p>

    <p
      className="whitespace-pre-wrap break-words text-sm leading-relaxed"
      style={{ color: t.textMuted }}
    >
      {post.hook}
    </p>
  </div>
)}


                  {post.caption && (
                    <div className="rounded-2xl border p-4" style={{ background: t.inputBg, borderColor: t.inputBorder }}>
                      <p className="mb-2 text-[10px] font-bold uppercase" style={{ color: t.textFaint, letterSpacing: "0.08em" }}>
                        Caption
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ color: t.textMuted }}>
                        {post.caption}
                      </p>
                    </div>
                  )}

                  {post.contentIdea && (
                    <div className="rounded-2xl border p-4" style={{ background: t.inputBg, borderColor: t.inputBorder }}>
                      <p className="mb-2 text-[10px] font-bold uppercase" style={{ color: t.textFaint, letterSpacing: "0.08em" }}>
                        Creative direction
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ color: t.textMuted }}>
                        {post.contentIdea}
                      </p>
                    </div>
                  )}

                  {post.cta && (
                    <div className="flex items-center justify-between gap-4 rounded-2xl border p-4" style={{ background: t.inputBg, borderColor: t.inputBorder }}>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase" style={{ color: t.textFaint, letterSpacing: "0.08em" }}>
                          Call to action
                        </p>
                        <p className="mt-1.5 break-words text-sm font-medium" style={{ color: t.textMuted }}>
                          {post.cta}
                        </p>
                      </div>
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(36,120,255,0.1)", color: "#2478FF" }}><UiSymbol name="right" /></span>
                    </div>
                  )}

                  {post.hashtags && (
                    <div className="rounded-2xl border p-4" style={{ background: t.inputBg, borderColor: t.inputBorder }}>
                      <p className="mb-2 text-[10px] font-bold uppercase" style={{ color: t.textFaint, letterSpacing: "0.08em" }}>
                        Hashtags
                      </p>
                      <p className="break-words text-sm leading-relaxed" style={{ color: "#2478FF" }}>
                        {post.hashtags}
                      </p>
                    </div>
                  )}

                  {!post.hook &&
  !post.script &&
  !post.caption &&
  !post.contentIdea &&
  !post.cta &&
  !post.hashtags && (
                      <div
                        className="rounded-2xl border border-dashed p-5 text-center"
                        style={{
                          background: t.inputBg,
                          borderColor: t.inputBorder,
                        }}
                      >
                        <p className="text-xs font-semibold" style={{ color: t.textMuted }}>
                          No post details yet
                        </p>
                        <p className="mt-1 text-[10px]" style={{ color: t.textFaint }}>
                          {isApproved
                            ? "This approved post has no additional details."
                            : "Add the details that will guide this post."}
                        </p>
                      </div>
                    )}
                </div>
              )}
            </section>

            {/* DISCOVERY */}
            {(post.taggedAccounts ||
              post.linkUrl) && (
                <section>
                  <div className="mb-3">
                    <h3
                      className="text-sm font-semibold"
                      style={{
                        color: t.text,
                      }}
                    >
                      Discovery & reach
                    </h3>

                    <p
                      className="mt-1 text-[11px]"
                      style={{
                        color: t.textFaint,
                      }}
                    >
                      Accounts and destinations connected to this post.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {post.taggedAccounts && (
                      <div
                        className="
                        rounded-2xl
                        border
                        p-4
                      "
                        style={{
                          background: t.inputBg,
                          borderColor:
                            t.inputBorder,
                        }}
                      >
                        <p
                          className="
                          text-[10px]
                          font-bold
                          uppercase
                        "
                          style={{
                            color:
                              t.textFaint,
                            letterSpacing:
                              "0.08em",
                          }}
                        >
                          Tagged accounts
                        </p>

                        <p
                          className="
                          mt-2
                          break-words
                          text-xs
                        "
                          style={{
                            color:
                              t.textMuted,
                          }}
                        >
                          {post.taggedAccounts}
                        </p>
                      </div>
                    )}

                    {post.linkUrl && (
                      <div
                        className="
                        rounded-2xl
                        border
                        p-4
                      "
                        style={{
                          background: t.inputBg,
                          borderColor:
                            t.inputBorder,
                        }}
                      >
                        <p
                          className="
                          text-[10px]
                          font-bold
                          uppercase
                        "
                          style={{
                            color:
                              t.textFaint,
                            letterSpacing:
                              "0.08em",
                          }}
                        >
                          Destination link
                        </p>

                        <a
                          href={post.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="
                          mt-2
                          flex items-center gap-1.5
                          text-xs
                          font-medium
                        "
                          style={{
                            color: "#2478FF",
                          }}
                        >
                          <span className="
                          min-w-0
                          truncate
                        ">
                            {post.linkUrl}
                          </span>

                          <span className="flex-shrink-0"><UiSymbol name="upRight" /></span>
                        </a>
                      </div>
                    )}
                  </div>
                </section>
              )}

            {/* CUSTOM FIELDS */}
            {post.customFields.length >
              0 && (
                <section>
                  <div className="mb-3">
                    <h3
                      className="text-sm font-semibold"
                      style={{
                        color: t.text,
                      }}
                    >
                      Additional details
                    </h3>

                    <p
                      className="mt-1 text-[11px]"
                      style={{
                        color: t.textFaint,
                      }}
                    >
                      Extra information attached to this post.
                    </p>
                  </div>

                  <div
                    className="
                    overflow-hidden
                    rounded-2xl
                    border
                  "
                    style={{
                      borderColor:
                        t.inputBorder,
                      background:
                        t.inputBg,
                    }}
                  >
                    {post.customFields.map(
                      (field, index) => (
                        <div
                          key={field.id}
                          className="
                          flex
                          flex-col
                          gap-1.5
                          px-4 py-3
                          sm:grid
                          sm:grid-cols-[120px_1fr]
                          sm:gap-4
                        "
                          style={{
                            borderTop:
                              index > 0
                                ? `1px solid ${t.inputBorder}`
                                : undefined,
                          }}
                        >
                          <span
                            className="
                            text-[10px]
                            font-semibold
                            uppercase
                            sm:text-xs
                            sm:normal-case
                          "
                            style={{
                              color:
                                t.textFaint,
                            }}
                          >
                            {field.label}
                          </span>

                          <span
                            className="
                            break-words
                            text-xs
                          "
                            style={{
                              color:
                                t.textMuted,
                            }}
                          >
                            {field.value}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
          <div className={detailTab === "internal" ? reviewStyles.teamReview : "hidden"}>
            <section className={reviewStyles.reviewIntro} aria-labelledby="team-review-heading">
              <div className={reviewStyles.reviewIntroTop}><span className={reviewStyles.reviewIcon}><ShieldCheck size={22} aria-hidden="true"/></span><span className={reviewStyles.reviewLabel}>{internallyApproved ? "Team approved" : post.internalReviewStatus === "NEEDS_CHANGES" ? "Changes requested" : "Your review is needed"}</span><span className={reviewStyles.privateBadge}>Team only</span></div>
              <h3 id="team-review-heading">{internallyApproved ? "Ready for client approval" : "Give your post a final team check"}</h3>
              <p>{internallyApproved ? "Your team has approved this post. Continue to see the client’s approval status." : "Check the creative, caption and schedule. Add feedback if needed, then approve for client review."}</p>
              <button type="button" onClick={() => setDetailTab("content")} className={reviewStyles.checkPost}><FilePenLine size={15} aria-hidden="true"/>Check the post<span aria-hidden="true">↗</span></button>
            </section>
            <aside className={reviewStyles.importantNote} aria-label="Important approval information">
              <span className={reviewStyles.importantIcon} aria-hidden="true">!</span>
              <div><strong>{internallyApproved ? "If you edit this post" : "Before you approve"}</strong><p>{internallyApproved ? "Changes to the creative, caption or schedule require a new team approval." : "Approval makes this post ready for client review. It does not publish it."}</p></div>
            </aside>
            {canInternalReview && !isApproved ? <>
              <section className={reviewStyles.feedbackCard}>
                <div className={reviewStyles.feedbackHeading}><label htmlFor="team-review-feedback"><Users size={16} aria-hidden="true"/>Private team feedback</label><span>Optional</span></div>
                <p id="team-review-feedback-help">Only your team sees this. Add a note, or continue with approval below.</p>
                <textarea id="team-review-feedback" aria-describedby="team-review-feedback-help" value={internalNote} onChange={e=>setInternalNote(e.target.value)} maxLength={4000} rows={3} disabled={reviewSaving} placeholder="Anything your team should adjust or know?" />
                <div className={reviewStyles.feedbackMeta}><span>Included when you approve or share feedback.</span><span>{internalNote.length.toLocaleString()} / 4,000</span></div>
              </section>
              <details className={reviewStyles.reviewOptions}><summary>Need changes instead? <span aria-hidden="true">+</span></summary><div className="mt-3 flex flex-wrap gap-3">
                {canInternalReview && <button type="button" disabled={reviewSaving || !internalNote.trim()} onClick={()=>saveInternalReview("request_changes")} className="min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50" style={{borderColor:t.inputBorder,color:t.text}}>Request changes</button>}
                <button type="button" disabled={reviewSaving || !internalNote.trim()} onClick={()=>saveInternalReview("feedback")} className="min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50" style={{borderColor:t.inputBorder,color:t.text}}>Share internal feedback</button>
                {canInternalReview && internallyApproved && <button type="button" disabled={reviewSaving} onClick={()=>saveInternalReview("reopen")} className="min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold" style={{borderColor:t.inputBorder,color:t.text}}>Return to internal review</button>}
              </div></details>
            </> : <p className="whitespace-pre-wrap text-sm leading-6" style={{color:t.textMuted}}>{post.internalReviewNote || (isApproved ? "Client-approved content is locked." : "You need Internal review access to give feedback or approve this post. Ask the workspace owner or manager to update your access.")}</p>}
            {reviewNotice && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{reviewNotice}</p>}
            {reviewError && <p role="alert" className="text-sm text-red-600">{reviewError}</p>}
          </div>
          <div className={detailTab === "client" ? "mx-auto max-w-3xl space-y-6 p-4 sm:p-7" : "hidden"}>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: t.text }}>Client review</h3>
              <p className="mt-2 text-sm leading-6" style={{ color: t.textMuted }}>Internal approval makes this post available to the client. Their approval and feedback appear here.</p>
            </div>
            {!internallyApproved && <p className="rounded-xl border p-4 text-sm" style={{borderColor:t.cardBorder,color:t.textMuted}}>Hidden from client. Complete internal review before requesting client approval.</p>}
            {/* STATUS */}
            {internallyApproved && (
              <section>
                <div
                  className="
                    flex flex-col gap-3
                    rounded-2xl
                    border
                    p-4
                    sm:flex-row
                    sm:items-center
                  "
                  style={{
                    background:
                      approvalMeta.bg,
                    borderColor:
                      `${approvalMeta.color}26`,
                  }}
                >
                  <span
                    className="
                      flex h-9 w-9
                      flex-shrink-0
                      items-center justify-center
                      rounded-full
                    "
                    style={{
                      background:
                        `${approvalMeta.color}18`,
                      color:
                        approvalMeta.color,
                    }}
                  >
                    {post.approvalStatus ===
                      "APPROVED" ? (
                      <IconCheck className="h-4 w-4" />
                    ) : (
                      <span className="text-sm">
                        !
                      </span>
                    )}
                  </span>

                  <div>
                    <p
                      className="text-xs font-semibold"
                      style={{
                        color:
                          approvalMeta.color,
                      }}
                    >
                      {approvalMeta.text}
                    </p>

                    <p
                      className="mt-0.5 text-[10px]"
                      style={{
                        color: t.textMuted,
                      }}
                    >
                      {post.approvalStatus ===
                        "APPROVED"
                        ? "This content has been approved."
                        : post.approvalStatus ===
                          "NEEDS_REVISION"
                          ? "Changes have been requested before approval."
                          : "Waiting for client review."}
                    </p>
                  </div>
                </div>

                {post.approvalStatus ===
                  "NEEDS_REVISION" &&
                  post.approvalNote && (
                    <div
                      className="
                        mt-3
                        rounded-2xl
                        border
                        p-4
                      "
                      style={{
                        background:
                          "rgba(249,115,22,0.06)",
                        borderColor:
                          "rgba(249,115,22,0.14)",
                      }}
                    >
                      <p
                        className="
                          mb-2
                          text-[10px]
                          font-bold
                          uppercase
                        "
                        style={{
                          color: "#F97316",
                          letterSpacing:
                            "0.08em",
                        }}
                      >
                        Client feedback
                      </p>

                      <p
                        className="
                          text-sm
                          leading-relaxed
                        "
                        style={{
                          color: t.textMuted,
                        }}
                      >
                        &ldquo;{post.approvalNote}&rdquo;
                      </p>
                    </div>
                  )}
                {post.approvalStatus === "NEEDS_REVISION" &&
                  canDeliver && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={resubmitForApproval}
                        disabled={resubmitting || post.assets.length === 0}
                        className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)" }}
                      >
                        {resubmitting ? "Sending for approval..." : "Resubmit for approval"}
                      </button>
                      <p className="mt-2 text-[10px]" style={{ color: t.textMuted }}>
                        The client will be able to review this updated post.
                      </p>
                    </div>
                  )}
              </section>
            )}

          </div>
          <div className={detailTab === "publishing" ? "mx-auto max-w-3xl space-y-6 p-4 sm:p-7" : "hidden"}>
            <h3 className="text-lg font-semibold" style={{color:t.text}}>Publishing</h3>
            {!internallyApproved && <p className="rounded-xl border p-4 text-sm" style={{borderColor:t.cardBorder,color:t.textMuted}}>Internal and client approval are required before scheduling or publishing.</p>}
            {canPublish && internallyApproved && <SocialPostPublishing key={post.id + post.publishStatus + post.instagramPublishStatus + post.tikTokPublishStatus} calendarId={calendarId} post={post} />}

            {/* INSTAGRAM PUBLISH STATUS — only ever shown once this
                post has actually been scheduled, published, or
                failed; a post that's never been through that at all
                shows nothing here. */}
            {post.platform === "INSTAGRAM" &&
              post.instagramPublishStatus !== "NOT_SCHEDULED" && (
                <section>
                  <div
                    className="rounded-2xl border p-4"
                    style={{
                      background:
                        post.instagramPublishStatus === "PUBLISHED"
                          ? "rgba(225,48,108,0.06)"
                          : post.instagramPublishStatus === "FAILED"
                            ? "rgba(239,68,68,0.06)"
                            : "rgba(36,120,255,0.06)",
                      borderColor:
                        post.instagramPublishStatus === "PUBLISHED"
                          ? "rgba(225,48,108,0.16)"
                          : post.instagramPublishStatus === "FAILED"
                            ? "rgba(239,68,68,0.16)"
                            : "rgba(36,120,255,0.16)",
                    }}
                  >
                    <p
                      className="mb-1.5 text-[10px] font-bold uppercase"
                      style={{
                        letterSpacing: "0.08em",
                        color:
                          post.instagramPublishStatus === "PUBLISHED"
                            ? "#E1306C"
                            : post.instagramPublishStatus === "FAILED"
                              ? "#EF4444"
                              : "#2478FF",
                      }}
                    >
                      Instagram
                    </p>

                    {post.instagramPublishStatus === "SCHEDULED" && (
                      <p className="text-sm leading-relaxed" style={{ color: t.textMuted }}>
                        This will publish to Instagram automatically once its scheduled time arrives — no manual posting needed.
                      </p>
                    )}

                    {post.instagramPublishStatus === "PUBLISHED" && (
                      <>
                        <p className="text-sm leading-relaxed" style={{ color: t.textMuted }}>
                          This post is live on Instagram.
                        </p>
                        {post.instagramPermalink && (

                          <a href={post.instagramPermalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold"
                            style={{ color: "#E1306C" }}
                          >
                            View on Instagram
                            <span aria-hidden><><UiSymbol name="upRight" /></></span>
                          </a>
                        )}
                      </>
                    )}

                    {post.instagramPublishStatus === "PUBLISHING" && (
                      <p className="text-sm leading-relaxed" style={{ color: t.textMuted }}>
                        Instagram is processing this post now. Its status will update when publishing is confirmed.
                      </p>
                    )}

                    {post.instagramPublishStatus === "FAILED" && (
                      <p className="text-sm leading-relaxed text-red-400">
                        {post.instagramPublishError ?? "Something went wrong publishing this post to Instagram."}
                      </p>
                    )}
                  </div>
                </section>
              )}

            {/* Viewers see the stored publishing status. Editors already have
                the interactive TikTok panel above, which tracks action results
                immediately without repeating a stale failure below it. */}
            {post.platform === "TIKTOK" &&
              !canPublish &&
              post.tikTokPublishStatus !== "NOT_SCHEDULED" && (
                <section>
                  <div
                    className="rounded-2xl border p-4"
                    style={{
                      background:
                        post.tikTokPublishStatus === "PUBLISHED"
                          ? "rgba(0,242,234,0.06)"
                          : post.tikTokPublishStatus === "FAILED"
                            ? "rgba(239,68,68,0.06)"
                            : "rgba(36,120,255,0.06)",
                      borderColor:
                        post.tikTokPublishStatus === "PUBLISHED"
                          ? "rgba(0,242,234,0.18)"
                          : post.tikTokPublishStatus === "FAILED"
                            ? "rgba(239,68,68,0.16)"
                            : "rgba(36,120,255,0.16)",
                    }}
                  >
                    <p
                      className="mb-1.5 text-[10px] font-bold uppercase"
                      style={{
                        letterSpacing: "0.08em",
                        color:
                          post.tikTokPublishStatus === "PUBLISHED"
                            ? "#00C2B8"
                            : post.tikTokPublishStatus === "FAILED"
                              ? "#EF4444"
                              : "#2478FF",
                      }}
                    >
                      TikTok
                    </p>

                    {post.tikTokPublishStatus === "SCHEDULED" && (
                      <p className="text-sm leading-relaxed" style={{ color: t.textMuted }}>
                        This will publish to your authorized TikTok account at its scheduled time using the settings you reviewed.
                      </p>
                    )}

                    {post.tikTokPublishStatus === "PUBLISHED" && (
                      <p className="text-sm leading-relaxed" style={{ color: t.textMuted }}>
                        TikTok confirmed publishing. Open the connected TikTok account to view the post.
                      </p>
                    )}

                    {post.tikTokPublishStatus === "PUBLISHING" && (
                      <p className="text-sm leading-relaxed" style={{ color: t.textMuted }}>
                        TikTok is processing this post now. Its status will update when publishing is confirmed.
                      </p>
                    )}

                    {post.tikTokPublishStatus === "FAILED" && (
                      <p className="text-sm leading-relaxed text-red-400">
                        {post.tikTokPublishError ?? "Something went wrong publishing this post to TikTok."}
                      </p>
                    )}
                  </div>
                </section>
              )}


            {!post.assets.length && <p className="rounded-xl border p-4 text-sm" style={{ borderColor: t.cardBorder, color: t.textMuted }}>Add your creative in Content to prepare this post for review.</p>}
          </div>
        </div>



      </div>
    </div>
  );
}

/* =========================================================
   CALENDAR GRID
   ========================================================= */

export default function CalendarGrid({
  calendarId,
  planStatus,
  initialPosts,
  userRole,
  permissions,
  clientName,
  isOwner = false,
}: {
  calendarId: string;
  isOwner?: boolean;
  planStatus: string;
  initialPosts: CalendarPostData[];
  userRole: "VIEW_ONLY" | "ADD_CONTENT" | "EDIT_CALENDAR";
  permissions?: readonly TeamPermission[];
  clientName: string;
}) {
  const [theme, setTheme] =
    useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem(
      THEME_STORAGE_KEY
    );

    if (
      saved === "light" ||
      saved === "dark"
    ) {
      setTheme(saved);
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next =
        prev === "dark"
          ? "light"
          : "dark";

      localStorage.setItem(
        THEME_STORAGE_KEY,
        next
      );

      return next;
    });
  };

  const t = THEMES[theme];

  // Keep planning and channel previews together under the same filters.
  const [viewMode, setViewMode] = useState<
    "calendar" | "instagram" | "tiktok" | "linkedin" | "facebook" | "x"
  >("calendar");
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const updateLayout = () => setIsMobileLayout(mediaQuery.matches);
    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [calendarPeriod, setCalendarPeriod] = useState<"day" | "week" | "month">("week");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("showwork:calendar-period");
      if (saved === "day" || saved === "week" || saved === "month") setCalendarPeriod(saved);
    } catch { /* Use the weekly default when storage is unavailable. */ }
  }, []);
  const changeCalendarPeriod = (period: "day" | "week" | "month") => {
    setCalendarPeriod(period);
    try { localStorage.setItem("showwork:calendar-period", period); } catch { /* Selection still works. */ }
  };

  const normalize = (
    p: CalendarPostData
  ): CalendarPostData => ({
    ...p,
    assets: p.assets ?? [],
    videoComments:
      p.videoComments ?? [],
    customFields:
      p.customFields ?? [],
  });

  const [posts, setPosts] =
    useState<CalendarPostData[]>(
      initialPosts.map(normalize)
    );

  const [addingDate, setAddingDate] =
    useState<Date | null>(null);

  const [selectedPost, setSelectedPost] =
    useState<CalendarPostData | null>(
      null
    );

  useEffect(() => {
    const reset = (event: Event) => {
      if ((event as CustomEvent<{calendarId: string}>).detail?.calendarId !== calendarId) return;
      setPosts([]); setSelectedPost(null); setAddingDate(null);
    };
    window.addEventListener("showwork-calendar-reset", reset);
    return () => window.removeEventListener("showwork-calendar-reset", reset);
  }, [calendarId]);

  useEffect(() => {
    const previewReady = (event: Event) => {
      const detail = (event as CustomEvent<{calendarId:string;postId:string;assetId:string;posterUrl:string}>).detail;
      if (!detail || detail.calendarId !== calendarId) return;
      const update = (post: CalendarPostData) => post.id !== detail.postId ? post : {...post, assets: post.assets.map(asset => asset.id === detail.assetId ? {...asset, posterUrl: detail.posterUrl} : asset)};
      setPosts(current => current.map(update));
      setSelectedPost(current => current ? update(current) : current);
    };
    window.addEventListener("workspace-video-preview", previewReady);
    return () => window.removeEventListener("workspace-video-preview", previewReady);
  }, [calendarId]);

  const openedLinkedPost = useRef(false);
  useEffect(() => {
    if (openedLinkedPost.current) return;
    const id = new URLSearchParams(window.location.search).get("post");
    const linked = id && posts.find(p => p.id === id);
    if (linked) { setSelectedPost(linked); openedLinkedPost.current = true; }
  }, [posts]);

  useEffect(() => {
    const refreshedPosts = initialPosts.map(normalize);
    setPosts((current) =>
      JSON.stringify(current) === JSON.stringify(refreshedPosts)
        ? current
        : refreshedPosts
    );
    setSelectedPost((current) => {
      if (!current) return current;
      const refreshed = refreshedPosts.find((post) => post.id === current.id);
      if (!refreshed) return null;
      return JSON.stringify(current) === JSON.stringify(refreshed) ? current : refreshed;
    });
  }, [initialPosts]);

  useEffect(() => {
    let inFlight = false;
    let cancelled = false;

    const syncPosts = async () => {
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      const focused = document.activeElement;
      if (
        focused instanceof HTMLElement &&
        (focused.isContentEditable || focused.matches("input, textarea, select"))
      ) return;

      inFlight = true;
      try {
        const response = await calendarMutationFetch(`/api/calendars/${calendarId}/posts`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as { posts?: CalendarPostData[] };
        if (!Array.isArray(data.posts)) return;

        const refreshedPosts = data.posts.map(normalize);
        setPosts((current) =>
          JSON.stringify(current) === JSON.stringify(refreshedPosts)
            ? current
            : refreshedPosts
        );
        setSelectedPost((current) => {
          if (!current) return current;
          const refreshed = refreshedPosts.find((post) => post.id === current.id);
          if (!refreshed) return null;
          return JSON.stringify(current) === JSON.stringify(refreshed) ? current : refreshed;
        });
      } catch {
        // Keep the current workspace usable if a background sync temporarily fails.
      } finally {
        inFlight = false;
      }
    };

    const interval = window.setInterval(syncPosts, 15_000);
    void syncPosts();
    window.addEventListener("showwork-calendar-posts-sync", syncPosts);
    window.addEventListener("focus", syncPosts);
    document.addEventListener("visibilitychange", syncPosts);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("showwork-calendar-posts-sync", syncPosts);
      window.removeEventListener("focus", syncPosts);
      document.removeEventListener("visibilitychange", syncPosts);
    };
  }, [calendarId]);

  // =========================================================
  // SMART FILTERS
  // =========================================================
  // Filters live inside CalendarGrid so they stay in sync with the
  // calendar, Instagram preview and TikTok preview without creating
  // a second control layer in the parent page.
  const [filterOpen, setFilterOpen] = useState(false);
  const [toolbarOptionsOpen, setToolbarOptionsOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<CalendarStageFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<Platform | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [contentFilter, setContentFilter] = useState<"ALL" | "ATTACHED" | "EMPTY">("ALL");

  const availableTypes = Array.from(
    new Set(
      posts
        .map((post) => post.postType)
        .filter((value): value is string => Boolean(value))
    )
  ).sort();

  const availableCategories = Array.from(
    new Set(
      posts
        .map((post) => post.category)
        .filter((value): value is string => Boolean(value))
    )
  ).sort();

  const filteredPosts = useMemo(() => posts.filter((post) => {
    if (!matchesCalendarStage(post, stageFilter)) return false;
    const query = searchQuery.trim().toLowerCase();

    const searchable = [
      post.caption,
      post.contentIdea,
      post.category,
      post.postType,
      post.cta,
      post.hashtags,
      post.taggedAccounts,
      ...post.customFields.map((field) => `${field.label} ${field.value}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (query && !searchable.includes(query)) return false;
    if (platformFilter !== "ALL" && post.platform !== platformFilter) return false;
    if (statusFilter !== "ALL" && post.approvalStatus !== statusFilter) return false;
    if (typeFilter !== "ALL" && post.postType !== typeFilter) return false;
    if (categoryFilter !== "ALL" && post.category !== categoryFilter) return false;
    if (contentFilter === "ATTACHED" && post.assets.length === 0) return false;
    if (contentFilter === "EMPTY" && post.assets.length > 0) return false;

    return true;
  }), [posts, stageFilter, searchQuery, platformFilter, statusFilter, typeFilter, categoryFilter, contentFilter]);

  const activeFilterCount = [
    stageFilter !== "all",
    platformFilter !== "ALL",
    statusFilter !== "ALL",
    typeFilter !== "ALL",
    categoryFilter !== "ALL",
    contentFilter !== "ALL",
    Boolean(searchQuery.trim()),
  ].filter(Boolean).length;

  const filtersActive = activeFilterCount > 0;

  const clearFilters = () => {
    setStageFilter("all");
    setSearchQuery("");
    setPlatformFilter("ALL");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setCategoryFilter("ALL");
    setContentFilter("ALL");
  };

  const jumpToToday = () => {
    const now = new Date();
    setCurrentMonth(
      new Date(now.getFullYear(), now.getMonth(), now.getDate())
    );
  };

  const monthInputValue =
    `${currentMonth.getFullYear()}-${String(
      currentMonth.getMonth() + 1
    ).padStart(2, "0")}`;

  // Same delete route the full detail panel already uses — this just
  // gives a second, faster way to trigger it, right from the tile
  // itself.
  const handleDeletePost = async (
    postId: string
  ) => {
    const res = await calendarMutationFetch(
      `/api/calendars/${calendarId}/posts/${postId}`,
      { method: "DELETE", headers: { "Content-Type": "application/json" }, ...(isOwner ? { body: JSON.stringify({ confirmation: "DELETE", removeBlocked: true }) } : {}) }
    );
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "Could not delete this post."); }
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const year =
    currentMonth.getFullYear();

  const month =
    currentMonth.getMonth();

  const firstWeekday = new Date(
    year,
    month,
    1
  ).getDay();

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const cells: (
    | Date
    | null
  )[] = [];

  for (
    let i = 0;
    i < firstWeekday;
    i++
  ) {
    cells.push(null);
  }

  for (
    let d = 1;
    d <= daysInMonth;
    d++
  ) {
    cells.push(
      new Date(year, month, d)
    );
  }

  while (
    cells.length % 7 !== 0
  ) {
    cells.push(null);
  }

  const postsByDate = useMemo(() => {
    const grouped = new Map<number, CalendarPostData[]>();
    for (const post of filteredPosts) {
      const postDate = new Date(post.postDate);
      const dayKey = new Date(
        postDate.getFullYear(),
        postDate.getMonth(),
        postDate.getDate(),
      ).getTime();
      const dayPosts = grouped.get(dayKey) ?? [];
      dayPosts.push(post);
      grouped.set(dayKey, dayPosts);
    }
    for (const dayPosts of grouped.values()) {
      dayPosts.sort(
        (a, b) => new Date(a.postDate).getTime() - new Date(b.postDate).getTime(),
      );
    }
    return grouped;
  }, [filteredPosts]);

  const postsForDate = (date: Date) =>
    postsByDate.get(
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
    ) ?? [];

  const goToMonth = (delta: number) => {
    setCurrentMonth(previous => moveCalendarPeriod(previous, calendarPeriod, delta));
  };
  const weekDates = calendarWeek(currentMonth);
  const periodCells = calendarPeriod === "month" ? cells : calendarPeriod === "week" ? weekDates : [currentMonth];
  const periodLabel = calendarPeriod === "day"
    ? currentMonth.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : calendarPeriod === "week"
      ? `${weekDates[0].toLocaleDateString("en-US", {month:"short",day:"numeric"})} – ${weekDates[6].toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"})}`
      : currentMonth.toLocaleDateString("en-US", {month:"long",year:"numeric"});

  const today = new Date();

  const isToday = (
    date: Date
  ) =>
    date.getFullYear() ===
    today.getFullYear() &&
    date.getMonth() ===
    today.getMonth() &&
    date.getDate() ===
    today.getDate();

  const visibleDays =
    (isMobileLayout && calendarPeriod === "week" ? [currentMonth] : periodCells).filter(
      (date): date is Date =>
        date !== null
    );

  return (
    <div className={contentStyles.planner} data-theme={theme} style={{ background: t.pageBg, color: t.text, "--planner-text": t.text, "--planner-muted": t.textMuted, "--planner-surface": t.modalBg, "--planner-border": t.cardBorder, "--planner-soft": t.pillBg } as React.CSSProperties}>
      {/* =====================================================
          CALENDAR HEADER
          ===================================================== */}

      <div className={contentStyles.compactHeader}>
        <div className={contentStyles.calendarHeading}>
          <p
            className="
              mb-0.5
              text-[8px]
              font-bold
              uppercase
              tracking-[0.14em]
              sm:text-[9px]
            "
            style={{
              color: t.textFaint,
            }}
          >
            Content calendar
          </p>

          <h2
            className="
              truncate
              text-lg
              font-bold
              tracking-tight
              sm:text-xl
              lg:text-2xl
          "
            style={{
              color: t.text,
            }}
          >
            {viewMode === "calendar"
              ? <><span className={contentStyles.fullMonth}>{periodLabel}</span><span className={contentStyles.shortMonth}>{calendarPeriod === "week" ? `${weekDates[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})}–${weekDates[6].toLocaleDateString("en-US",{month:"short",day:"numeric"})}` : currentMonth.toLocaleDateString("en-US",{month:"short",...(calendarPeriod === "day" ? {day:"numeric" as const} : {year:"numeric" as const})})}</span></>
              : viewMode === "instagram"
                ? "Instagram Preview"
                : viewMode === "tiktok" ? "TikTok Preview"
                : viewMode === "linkedin" ? "LinkedIn Preview"
                : viewMode === "facebook" ? "Facebook Preview" : "X Preview"}
          </h2>
        </div>

        <div className={contentStyles.calendarActions}>
          {(permissions ? permissions.includes("ai.generate") : userRole === "EDIT_CALENDAR") && <button type="button" className={contentStyles.aiShortcut} onClick={() => window.dispatchEvent(new CustomEvent("showwork-workspace-navigate", { detail: { id: "generate" } }))}><Sparkles size={15}/><span>Generate calendar</span><small>~2 min</small></button>}
          <label className={contentStyles.previewControl}><span className="sr-only">Preview</span><select aria-label="Preview calendar or social channel" value={viewMode} onChange={event => { setViewMode(event.target.value as typeof viewMode); setPlatformFilter("ALL"); }}>{([['calendar','Calendar'],['instagram','Instagram'],['tiktok','TikTok'],['linkedin','LinkedIn'],['facebook','Facebook'],['x','X']] as const).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className={contentStyles.calendarOptions}><button type="button" className={contentStyles.optionsTrigger} onClick={() => setToolbarOptionsOpen(true)} aria-haspopup="dialog" aria-expanded={toolbarOptionsOpen}><SlidersHorizontal size={15}/>Options<ChevronDown size={14}/></button><CalendarFilterPanel mobile={isMobileLayout} open={toolbarOptionsOpen} onClose={() => setToolbarOptionsOpen(false)} label="Calendar options"><div className={contentStyles.calendarOptionsBody}><p className={contentStyles.optionsIntro}>Manage publishing, import content and choose your appearance.</p>
          <AutoPublishToggle compact calendarId={calendarId} canManage={isOwner || (permissions ? permissions.includes("publishing.manage") : userRole === "EDIT_CALENDAR")} />
          {userRole === "EDIT_CALENDAR" && <ImportCalendar calendarId={calendarId} theme={theme} onImported={(importedPosts, firstDate) => {
            setPosts(importedPosts.map(normalize));
            clearFilters();
            if (firstDate) {
              const date = new Date(firstDate);
              setCurrentMonth(date);
              setViewMode("calendar");
            }
          }} />}
          <div className={contentStyles.appearanceOption}><span>Appearance<small>{theme === "dark" ? "Dark mode" : "Light mode"}</small></span><ThemeToggle theme={theme} onToggle={toggleTheme}/></div>
          <button type="button" className={contentStyles.optionsDone} onClick={() => setToolbarOptionsOpen(false)}>Done</button></div></CalendarFilterPanel></div>
          {viewMode === "calendar" && (
            <>
              <button
                type="button"
                onClick={() =>
                  goToMonth(-1)
                }
                aria-label={`Previous ${calendarPeriod}`}
                className="
                  flex h-9 w-9
                  items-center
                  justify-center
                  rounded-full
                  transition-all
                  active:scale-95
                  sm:h-10 sm:w-10
                "
                style={{
                  background: t.pillBg,
                  color: t.textMuted,
                }}
              ><UiSymbol name="left" /></button>

              <button
                type="button"
                onClick={() =>
                  goToMonth(1)
                }
                aria-label={`Next ${calendarPeriod}`}
                className="
                  flex h-9 w-9
                  items-center
                  justify-center
                  rounded-full
                  transition-all
                  active:scale-95
                  sm:h-10 sm:w-10
                "
                style={{
                  background: t.pillBg,
                  color: t.textMuted,
                }}
              ><UiSymbol name="right" /></button>
            </>
          )}
        </div>
      </div>

      <button type="button" className={contentStyles.mobileFilterToggle} onClick={() => setFilterOpen(open => !open)} aria-expanded={filterOpen} aria-controls="calendar-filter-controls"><SlidersHorizontal size={15}/> Filters & search {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</button>
      {/* =====================================================
          SMART FILTER / SEARCH BAR
          ===================================================== */}
      <CalendarFilterPanel mobile={isMobileLayout} open={filterOpen} onClose={() => setFilterOpen(false)}>
      <div
        id="calendar-filter-controls"
        className={`${contentStyles.filterBar} ${filterOpen ? contentStyles.mobileFiltersOpen : ""}`}
        style={{
          background:
            theme === "dark"
              ? "rgba(255,255,255,0.028)"
              : "rgba(0,0,0,0.018)",
          borderColor: t.cardBorder,
          boxShadow:
            theme === "dark"
              ? "0 12px 40px rgba(0,0,0,0.12)"
              : "0 12px 40px rgba(0,0,0,0.045)",
        }}
      >
        <div className={contentStyles.mobileFilterSheetHeading}><strong>Find your content</strong><button type="button" onClick={() => setFilterOpen(false)} aria-label="Close filters">×</button></div>
        <div className={contentStyles.mobileFilterRow}>
          <div
            className="
              flex min-w-0 flex-1 items-center gap-2.5
              rounded-xl border px-3.5 py-2.5 sm:min-w-[180px]
            "
            style={{
              background: t.inputBg,
              borderColor: t.inputBorder,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" strokeLinecap="round" />
            </svg>

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts…"
              aria-label="Search content"
              className="
                min-w-0 flex-1 bg-transparent text-xs
                outline-none placeholder:opacity-40
              "
              style={{ color: t.text }}
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="
                  flex h-6 w-6 items-center justify-center
                  rounded-full text-sm
                "
                style={{
                  background: t.pillBg,
                  color: t.textMuted,
                }}
              >
                ×
              </button>
            )}
          </div>

          <select className={contentStyles.stageSelect} aria-label="Filter by workflow stage" value={stageFilter} onChange={event => setStageFilter(event.target.value as CalendarStageFilter)}>{([
            { id: "all", label: "All stages" }, { id: "internal", label: "Internal review" }, { id: "client", label: "Client review" }, { id: "publishing", label: "Publishing" },
          ] as const).map(item => <option key={item.id} value={item.id}>{item.label} ({posts.filter(post => matchesCalendarStage(post, item.id)).length})</option>)}</select>
          {viewMode === "calendar" && (
            <>
              <label className={contentStyles.monthPicker}
                style={{
                  background: t.inputBg,
                  borderColor: t.inputBorder,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="3" y="4" width="18" height="17" rx="3" />
                  <path d="M8 2.5v4M16 2.5v4M3 9h18" strokeLinecap="round" />
                </svg>
                <span className={contentStyles.mobileMonthLabel} aria-hidden="true">{currentMonth.toLocaleDateString("en-US",{month:"short",...(calendarPeriod === "month" ? {year:"numeric" as const} : {day:"numeric" as const})})}</span>
                <input
                  type={calendarPeriod === "month" ? "month" : "date"}
                  value={calendarPeriod === "month" ? monthInputValue : `${year}-${String(month + 1).padStart(2,"0")}-${String(currentMonth.getDate()).padStart(2,"0")}`}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [y, m, d = 1] = e.target.value.split("-").map(Number);
                    setCurrentMonth(new Date(y, m - 1, d));
                  }}
                  aria-label={calendarPeriod === "month" ? "Choose month" : "Choose date"}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                  style={{ color: t.text }}
                />
              </label>

              <button
                type="button"
                onClick={jumpToToday}
                className="
                  h-10 rounded-xl border px-3 text-[11px]
                  font-semibold transition-all active:scale-[0.98]
                "
                style={{
                  background: t.pillBg,
                  borderColor: t.inputBorder,
                  color: t.textMuted,
                }}
              >
                Today
              </button>
            </>
          )}

          {!isMobileLayout && <button
            type="button"
            aria-label="Filters"
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
            className="
              flex h-10 items-center justify-center gap-2
              rounded-xl border px-3.5 text-xs font-semibold
              transition-all active:scale-[0.98]
            "
            style={{
              background: filterOpen || filtersActive
                ? "rgba(36,120,255,0.10)"
                : t.pillBg,
              borderColor: filterOpen || filtersActive
                ? "rgba(36,120,255,0.35)"
                : t.inputBorder,
              color: filterOpen || filtersActive
                ? "#2478FF"
                : t.textMuted,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
            </svg>
            <span className={contentStyles.filterText}>Filters</span>
            {activeFilterCount > 0 && (
              <span
                className="
                  flex h-5 min-w-5 items-center justify-center
                  rounded-full px-1.5 text-[9px] font-bold text-white
                "
                style={{ background: "#2478FF" }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>}
        </div>

        {filterOpen && (
          <div
            className={`${contentStyles.filterFields} border-t px-3 pb-3 pt-3 sm:px-4 sm:pb-4`}
            style={{ borderColor: t.cardBorder }}
          >
            <div className={`${contentStyles.filterFieldsGrid} grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4`}>
              {[
                {
                  label: "Platform",
                  value: platformFilter,
                  onChange: (value: string) =>
                    setPlatformFilter(value as Platform | "ALL"),
                  options: [
                    { value: "ALL", label: "All platforms" },
                    ...PLATFORMS.map((platform) => ({
                      value: platform.value,
                      label: platform.label,
                    })),
                  ],
                },
                {
                  label: "Approval",
                  value: statusFilter,
                  onChange: (value: string) =>
                    setStatusFilter(value as ApprovalStatus | "ALL"),
                  options: [
                    { value: "ALL", label: "All statuses" },
                    { value: "PENDING", label: "Pending approval" },
                    { value: "APPROVED", label: "Approved" },
                    { value: "NEEDS_REVISION", label: "Needs revision" },
                  ],
                },
                {
                  label: "Format",
                  value: typeFilter,
                  onChange: setTypeFilter,
                  options: [
                    { value: "ALL", label: "All formats" },
                    ...availableTypes.map((type) => ({
                      value: type,
                      label: type,
                    })),
                  ],
                },
                {
                  label: "Category",
                  value: categoryFilter,
                  onChange: setCategoryFilter,
                  options: [
                    { value: "ALL", label: "All categories" },
                    ...availableCategories.map((category) => ({
                      value: category,
                      label: category,
                    })),
                  ],
                },
              ].map((filter) => (
                <label key={filter.label} className="block">
                  <span
                    className="
                      mb-1.5 block text-[9px] font-bold uppercase
                      tracking-[0.12em]
                    "
                    style={{ color: t.textFaint }}
                  >
                    {filter.label}
                  </span>
                  <select
                    value={filter.value}
                    onChange={(e) => filter.onChange(e.target.value)}
                    className="
                      h-10 w-full rounded-xl border px-3 text-xs
                      font-semibold outline-none
                    "
                    style={{
                      background: t.inputBg,
                      borderColor: t.inputBorder,
                      color: t.text,
                    }}
                  >
                    {filter.options.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        style={{
                          background: theme === "dark" ? "#1A1A1A" : "#FFFFFF",
                          color: theme === "dark" ? "#FFFFFF" : "#0A0A0A",
                        }}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="
              mt-3 flex flex-col gap-2
              sm:flex-row sm:items-center sm:justify-between
            ">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[10px] font-medium"
                  style={{ color: t.textMuted }}
                >
                  Content
                </span>

                {(
                  [
                    { value: "ALL", label: "Everything" },
                    { value: "ATTACHED", label: "Has files" },
                    { value: "EMPTY", label: "Needs content" },
                  ] as const
                ).map((option) => {
                  const active = contentFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setContentFilter(option.value)}
                      className="
                        rounded-full border px-2.5 py-1.5
                        text-[10px] font-semibold transition-all
                      "
                      style={{
                        background: active
                          ? "rgba(36,120,255,0.10)"
                          : t.pillBg,
                        borderColor: active
                          ? "rgba(36,120,255,0.35)"
                          : t.inputBorder,
                        color: active ? "#2478FF" : t.textMuted,
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="
                    self-start rounded-full px-3 py-1.5
                    text-[10px] font-semibold sm:self-auto
                  "
                  style={{
                    background: t.pillBg,
                    color: t.textMuted,
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
        <div className={contentStyles.mobileFilterFooter}><button type="button" onClick={clearFilters}>Clear filters</button><button type="button" onClick={() => setFilterOpen(false)}>Show results</button></div>
      </div>

      </CalendarFilterPanel>
      {filtersActive && (
        <div className="
          mb-4 flex flex-wrap items-center gap-2
          sm:mb-5
        ">
          <span
            className="text-[10px] font-semibold"
            style={{ color: t.textFaint }}
          >
            Showing {filteredPosts.length} of {posts.length}
          </span>

          {platformFilter !== "ALL" && (
            <span
              className="rounded-full px-2.5 py-1 text-[9px] font-semibold"
              style={{
                background: "rgba(36,120,255,0.10)",
                color: "#2478FF",
              }}
            >
              {PLATFORMS.find((p) => p.value === platformFilter)?.label}
            </span>
          )}

          {statusFilter !== "ALL" && (
            <span
              className="rounded-full px-2.5 py-1 text-[9px] font-semibold"
              style={{
                background: `${APPROVAL_META[statusFilter].color}18`,
                color: APPROVAL_META[statusFilter].color,
              }}
            >
              {APPROVAL_META[statusFilter].text}
            </span>
          )}

          {typeFilter !== "ALL" && (
            <span
              className="rounded-full px-2.5 py-1 text-[9px] font-semibold"
              style={{
                background: t.pillBg,
                color: t.textMuted,
              }}
            >
              {typeFilter}
            </span>
          )}

          {categoryFilter !== "ALL" && (
            <span
              className="rounded-full px-2.5 py-1 text-[9px] font-semibold"
              style={{
                background: t.pillBg,
                color: t.textMuted,
              }}
            >
              {categoryFilter}
            </span>
          )}

          {contentFilter !== "ALL" && (
            <span
              className="rounded-full px-2.5 py-1 text-[9px] font-semibold"
              style={{
                background: t.pillBg,
                color: t.textMuted,
              }}
            >
              {contentFilter === "ATTACHED" ? "Has files" : "Needs content"}
            </span>
          )}
        </div>
      )}

      {/* =====================================================
          CALENDAR AND CHANNEL PREVIEWS
          ===================================================== */}

      {viewMode === "instagram" && (
        <InstagramPreview
          posts={filteredPosts}
          clientName={clientName}
        />
      )}

      {viewMode === "tiktok" && (
        <TikTokPreview
          posts={filteredPosts}
          clientName={clientName}
        />
      )}

      {(viewMode === "linkedin" || viewMode === "facebook" || viewMode === "x") && (
        <SocialFeedPreview posts={filteredPosts} clientName={clientName} channel={viewMode}
          onOpen={setSelectedPost} filtersActive={filtersActive} onClearFilters={clearFilters} />
      )}

      {viewMode === "calendar" && (
        <>
          {/* =====================================================
          DESKTOP / TABLET CALENDAR
          ===================================================== */}

          <label className={contentStyles.mobilePeriodSelect}><span className="sr-only">Calendar view</span><select value={calendarPeriod} onChange={event => changeCalendarPeriod(event.target.value as "day" | "week" | "month")}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
          <div className={contentStyles.periodSelector} role="group" aria-label="Calendar view">
            {(["day", "week", "month"] as const).map(period => <button key={period} type="button" aria-pressed={calendarPeriod === period} onClick={() => changeCalendarPeriod(period)}>{period === "day" ? "Day" : period === "week" ? "Week" : "Month"}</button>)}
          </div>
          {isMobileLayout && calendarPeriod === "week" && <div className={contentStyles.weekStrip} aria-label="Select a day this week">
            {weekDates.map(date => <button key={date.getTime()} type="button" aria-pressed={date.toDateString() === currentMonth.toDateString()} aria-label={date.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})} onClick={() => setCurrentMonth(date)}><span>{date.toLocaleDateString("en-US",{weekday:"short"})}</span><strong>{date.getDate()}</strong><small>{postsForDate(date).length || "·"}</small></button>)}
          </div>}
          {!isMobileLayout && <div className={contentStyles.calendar} style={calendarPeriod === "day" ? {gridTemplateColumns:"minmax(0,1fr)"} : undefined}>
            {[
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ].filter((_, index) => calendarPeriod !== "day" || index === currentMonth.getDay()).map((day) => (
              <div
                key={day}
                className="
              pb-1.5
              text-center
              text-[9px]
              font-bold
              uppercase
              tracking-[0.1em]
              md:text-[10px]
              lg:pb-2
              lg:text-xs
            "
                style={{
                  color:
                    DAY_COLORS[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(day)],
                }}
              >
                {day}
              </div>
            ))}

            {periodCells.map((date, i) => {
              if (!date) return <div key={i} aria-hidden="true" />;
              const dayPosts = postsForDate(date);
              const dayColor = DAY_COLORS[date.getDay()];
              const todayDate = isToday(date);
              return (
                <div key={date.getTime()} data-period={calendarPeriod} data-today={todayDate || undefined} className={contentStyles.dateCell}
                  style={{
                    background: theme === "dark" ? `${dayColor}18` : `${dayColor}0C`,
                    border: `1px solid ${dayColor}35`,
                  }}>
                  <CalendarDateHeading date={date} today={todayDate} spacious={calendarPeriod === "day"} count={dayPosts.length} />

                  {/* POSTS */}
                  <div className={calendarPeriod === "day" ? contentStyles.dayPostGrid : contentStyles.datePostList}>
                    {calendarPeriod === "day" && !dayPosts.length && <div className={contentStyles.dayEmpty}><CalendarDays size={28} aria-hidden="true" /><strong>{filtersActive ? "No matching posts" : "A little room for your next idea"}</strong><span>{filtersActive ? "Try changing your filters." : "Add a post or generate your next content calendar."}</span></div>}
                    {dayPosts.map(
                      (
                        post,
                        postIndex
                      ) => (
                        <PostTile
                          key={post.id}
                          post={post}
                          index={
                            postIndex
                          }
                          onClick={() =>
                            setSelectedPost(
                              post
                            )
                          }
                          canDelete={
                            userRole === "EDIT_CALENDAR" &&
                            (isOwner || post.approvalStatus !== "APPROVED")
                          }
                          onDelete={() =>
                            handleDeletePost(
                              post.id
                            )
                          }
                        />
                      )
                    )}

                    {userRole ===
                      "EDIT_CALENDAR" && (
                        <button
                          type="button"
                          onClick={() =>
                            setAddingDate(
                              date
                            )
                          }
                          className="
                      flex
                      w-full
                      min-h-8
                      flex-shrink-0
                      items-center
                      justify-center
                      gap-1
                      rounded-lg
                      border
                      border-dashed
                      px-1.5
                      py-1.5
                      text-[8px]
                      font-semibold
                      transition-all
                      hover:opacity-80
                      active:scale-[0.98]
                      md:min-h-9
                      md:px-2
                      md:py-2
                      md:text-[9px]
                      lg:text-[10px]
                    "
                          style={{
                            borderColor:
                              `${dayColor}55`,
                            color:
                              dayColor,
                          }}
                        >
                          <span className="
                      text-xs
                      leading-none
                      md:text-sm
                    ">
                            +
                          </span>

                          <span>
                            Add post
                          </span>
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>}

          {/* =====================================================
          MOBILE AGENDA
          ===================================================== */}

          {isMobileLayout && <div className="
        flex
        flex-col
        gap-3
      ">
            {visibleDays.map((date) => {
              const dayPosts =
                postsForDate(date);

              const dayColor =
                DAY_COLORS[
                date.getDay()
                ];

              const todayDate =
                isToday(date);

              return (
                <section
                  key={date.toISOString()}
                  data-period={calendarPeriod}
                  data-today={todayDate || undefined}
                  className={contentStyles.dateCell}
                  style={{
                    background: theme === "dark" ? `${dayColor}16` : `${dayColor}09`,
                    borderColor: todayDate ? dayColor : `${dayColor}35`,
                    boxShadow: todayDate
                      ? `0 0 0 1px ${dayColor}18`
                      : "none",
                  }}
                >
                  <CalendarDateHeading date={date} today={todayDate} spacious count={dayPosts.length} />

                  {/* DAY CONTENT */}
                  <div className="flex flex-col gap-2 p-3">
                    {dayPosts.length >
                      0 ? (
                      dayPosts.map(
                        (
                          post,
                          postIndex
                        ) => (
                          <PostTile
                            key={post.id}
                            post={post}
                            index={
                              postIndex
                            }
                            onClick={() =>
                              setSelectedPost(
                                post
                              )
                            }
                            canDelete={
                              userRole === "EDIT_CALENDAR" &&
                              (isOwner || post.approvalStatus !== "APPROVED")
                            }
                            onDelete={() =>
                              handleDeletePost(
                                post.id
                              )
                            }
                          />
                        )
                      )
                    ) : (
                      <div
                        className="
                      rounded-xl
                      border
                      border-dashed
                      px-4
                      py-5
                      text-center
                    "
                        style={{
                          borderColor:
                            `${dayColor}25`,
                          background:
                            theme ===
                              "dark"
                              ? "rgba(255,255,255,0.018)"
                              : "rgba(0,0,0,0.015)",
                        }}
                      >
                        <p
                          className="
                        text-[10px]
                        font-medium
                      "
                          style={{
                            color:
                              t.textFaint,
                          }}
                        >
                          {filtersActive
                            ? "No posts match your filters"
                            : "Nothing scheduled"}
                        </p>
                      </div>
                    )}

                    {userRole ===
                      "EDIT_CALENDAR" && (
                        <button
                          type="button"
                          onClick={() =>
                            setAddingDate(
                              date
                            )
                          }
                          className="
                      flex
                      min-h-11
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      border
                      border-dashed
                      px-4
                      py-3
                      text-xs
                      font-semibold
                      transition-all
                      active:scale-[0.98]
                    "
                          style={{
                            borderColor:
                              `${dayColor}55`,
                            background:
                              theme ===
                                "dark"
                                ? `${dayColor}08`
                                : `${dayColor}06`,
                            color:
                              dayColor,
                          }}
                        >
                          <span className="
                      text-base
                      leading-none
                    ">
                            +
                          </span>

                          <span>
                            Add post to{" "}
                            {date.toLocaleDateString(
                              "en-US",
                              {
                                weekday:
                                  "short",
                              }
                            )}
                          </span>
                        </button>
                      )}
                  </div>
                </section>
              );
            })}
          </div>}
        </>
      )}

      {/* =====================================================
          ADD POST
          ===================================================== */}

      {addingDate && (
        <AddPostPanel
          canUpload={!permissions || permissions.includes("creatives.upload")}
          calendarId={calendarId}
          date={addingDate}
          theme={theme}
          onClose={() =>
            setAddingDate(null)
          }
          onCreated={(newPosts) =>
            setPosts((prev) => mergeSavedCalendarPosts(prev, newPosts.map(normalize)))
          }
        />
      )}

      {/* =====================================================
          POST DETAIL
          ===================================================== */}

      {(isOwner || permissions?.includes("internal_review.manage")) && <BulkApprovalBubble mode="internal" calendarKey={calendarId} posts={posts} hidden={!!selectedPost || !!addingDate} onUpdated={updated => { const safe = normalize(updated); setPosts(previous => previous.map(post => post.id === safe.id ? safe : post)); }} />}

      {selectedPost && (
        <PostDetailPanel
          calendarId={calendarId}
          post={selectedPost}
          posts={posts}
          onOtherPostUpdated={updated => setPosts(previous => previous.map(item => item.id === updated.id ? normalize(updated) : item))}
          userRole={userRole}
          permissions={permissions}
          theme={theme}
          onClose={() =>
            setSelectedPost(null)
          }
          onUpdated={(updated) => {
            const safe =
              normalize(updated);

            setPosts((prev) =>
              prev.map((p) =>
                p.id === safe.id
                  ? safe
                  : p
              )
            );

            setSelectedPost(safe);
          }}
        />
      )}
    </div>
  );
}
