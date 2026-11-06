"use client";
import styles from "./ClientContentCalendar.module.css";
import { ArrowUpRight, FileText, Layers, Play } from "lucide-react";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import CalendarVideoComments, { type CalendarVideoCommentData } from "@/components/calendars/CalendarVideoComments";
import SocialFeedPreview from "@/components/calendars/SocialFeedPreview";
import InstagramPreview from "@/components/calendars/InstagramPreview";
import TikTokPreview from "@/components/calendars/TikTokPreview";
import SocialLeadInbox from "@/components/calendars/SocialLeadInbox";

type Platform = "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "FACEBOOK" | "X" | "LINKEDIN";
type ApprovalStatus = "PENDING" | "APPROVED" | "NEEDS_REVISION";
type Theme = "dark" | "light";

interface CalendarPostAssetData {
  id: string;
  mediaType: "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";
  contentUrl: string; posterUrl?: string | null;
}

interface CalendarPostCustomFieldData {
  id: string;
  label: string;
  value: string;
}

interface CalendarPostData {
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
  assets: CalendarPostAssetData[];
  videoComments: CalendarVideoCommentData[];
  customFields: CalendarPostCustomFieldData[];
}

const THEME_STORAGE_KEY = "showwork-calendar-theme";

const THEMES: Record<
  Theme,
  {
    pageBg: string;
    cardBg: string;
    cardBorder: string;
    modalBg: string;
    text: string;
    textMuted: string;
    textFaint: string;
    inputBg: string;
    inputBorder: string;
    pillBg: string;
  }
> = {
  dark: {
    pageBg: "#101b2b",
    cardBg: "#142237",
    cardBorder: "#293c55",
    modalBg: "#1b2d47",
    text: "#deebff",
    textMuted: "#a3b9d6",
    textFaint: "#8ea7c7",
    inputBg: "#172940",
    inputBorder: "#304663",
    pillBg: "#1b2d47",
  },
  light: {
    pageBg: "#FFFFFF",
    cardBg: "rgba(0,0,0,0.025)",
    cardBorder: "rgba(0,0,0,0.09)",
    modalBg: "#FFFFFF",
    text: "#0A0A0A",
    textMuted: "rgba(0,0,0,0.5)",
    textFaint: "rgba(0,0,0,0.35)",
    inputBg: "rgba(0,0,0,0.03)",
    inputBorder: "rgba(0,0,0,0.14)",
    pillBg: "rgba(0,0,0,0.05)",
  },
};

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.2 15.1A8.7 8.7 0 0 1 8.9 3.8 8.8 8.8 0 1 0 20.2 15.1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" strokeLinecap="round" />
    </svg>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300 active:scale-95"
      style={{
        background: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
        borderColor: theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)",
        color: theme === "dark" ? "#F5C842" : "#F59E0B",
      }}
    >
      {theme === "dark" ? <IconMoon className="h-4 w-4" /> : <IconSun className="h-4 w-4" />}
    </button>
  );
}

const PLATFORM_META: Record<Platform, { label: string; color: string }> = {
  INSTAGRAM: { label: "Instagram", color: "#E1306C" },
  TIKTOK: { label: "TikTok", color: "#00F2EA" },
  YOUTUBE: { label: "YouTube", color: "#FF0000" },
  FACEBOOK: { label: "Facebook", color: "#1877F2" },
  X: { label: "X", color: "#FFFFFF" },
  LINKEDIN: { label: "LinkedIn", color: "#0A66C2" },
};

const APPROVAL_META: Record<ApprovalStatus, { text: string; color: string; bg: string }> = {
  PENDING: { text: "Awaiting your review", color: "#FFCC00", bg: "rgba(255,204,0,0.12)" },
  APPROVED: { text: "You approved this", color: "#4ade80", bg: "rgba(74,222,128,0.15)" },
  NEEDS_REVISION: { text: "You requested changes", color: "#F97316", bg: "rgba(249,115,22,0.15)" },
};

// Same day-of-week color family as the manager's own view — anchored
// by Showwork's blue (Monday) and gold (Wednesday) — so the calendar
// looks and feels identical on both sides.

function PlatformIcon({ platform, className, style }: { platform: Platform; className?: string; style?: React.CSSProperties }) {
  switch (platform) {
    case "INSTAGRAM":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "TIKTOK":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.6 2h-3.3v13.8c0 1.5-1.2 2.7-2.7 2.7a2.7 2.7 0 0 1 0-5.4c.3 0 .5 0 .8.1V9.8a6.1 6.1 0 0 0-.8 0A6.1 6.1 0 1 0 16.6 15.9V8.5a8 8 0 0 0 4.6 1.5V6.7a4.8 4.8 0 0 1-4.6-4.7Z" />
        </svg>
      );
    case "YOUTUBE":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 12s0-3.1-.4-4.6a3 3 0 0 0-2.1-2.1C17.9 5 12 5 12 5s-5.9 0-7.5.3a3 3 0 0 0-2.1 2.1C2 8.9 2 12 2 12s0 3.1.4 4.6a3 3 0 0 0 2.1 2.1C6.1 19 12 19 12 19s5.9 0 7.5-.3a3 3 0 0 0 2.1-2.1c.4-1.5.4-4.6.4-4.6Zm-11.9 3V9l5.2 3-5.2 3Z" />
        </svg>
      );
    case "FACEBOOK":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.57 14.2 3.57c-2.4 0-4.05 1.47-4.05 4.16v2.16H7.4V13h2.75v8h3.35Z" />
        </svg>
      );
    case "X":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.9 2H22l-7.2 8.2L23.3 22h-6.6l-5.2-6.8L5.5 22H2.4l7.7-8.8L1.7 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20Z" />
        </svg>
      );
    case "LINKEDIN":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5ZM3 9.75h4v11H3v-11Zm7 0h3.83v1.5h.05c.53-1 1.84-2.06 3.79-2.06 4.06 0 4.81 2.67 4.81 6.14v6.42h-4v-5.7c0-1.36-.02-3.1-1.89-3.1-1.9 0-2.19 1.48-2.19 3v5.8h-4v-11Z" />
        </svg>
      );
  }
}

function IconPin({ color, className }: { color: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="7" fill={color} />
      <circle cx="9.5" cy="7.5" r="2" fill="rgba(255,255,255,0.55)" />
      <path d="M12 16.5 L12 21" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" strokeLinejoin="round" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" strokeLinejoin="round" />
    </svg>
  );
}

function VideoThumbnail({ src, posterUrl, className }: { src: string; posterUrl?: string | null; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  if (posterUrl && !failed) return <img src={posterUrl} alt="Video preview" loading="lazy" className={className} onError={() => setFailed(true)}/>;
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
        if (vid) vid.currentTime = 0.1;
      }}
    />
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PostTile({ post, onClick }: { post: CalendarPostData; index?: number; onClick: () => void }) {
  const meta = PLATFORM_META[post.platform];
  const cover = post.assets[0];
  const title = post.contentIdea || post.caption || `${meta.label} post`;
  const timeLabel = new Date(post.postDate).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
  const statusLabel = post.approvalStatus === 'APPROVED' ? 'Approved' : post.approvalStatus === 'NEEDS_REVISION' ? 'Changes requested' : 'Awaiting review';
  return <button type="button" className={styles.postCard} onClick={onClick} aria-haspopup="dialog" aria-label={`Open ${meta.label} post: ${title}`}>
    <span className={styles.cardHeader}><span className={styles.platform} style={{color:post.platform==='X'?'var(--cc-ink)':meta.color}}><PlatformIcon platform={post.platform} className="h-3.5 w-3.5"/><span>{meta.label}</span></span><span className={styles.time}>{timeLabel}</span></span>
    <span className={styles.media}>
      {cover?.mediaType === 'VIDEO' ? <><VideoThumbnail posterUrl={cover.posterUrl} src={cover.contentUrl} className={styles.fullMedia}/><span className={styles.playBadge}><Play size={20} fill="currentColor"/></span></> : cover?.mediaType === 'PHOTO' ? <img src={cover.contentUrl} alt="" loading="lazy" className={styles.fullMedia}/> : <span className={styles.mediaPlaceholder}>{cover?<FileText size={30}/>:<PlatformIcon platform={post.platform} className="h-8 w-8"/>}<span>{cover?'Document attached':'Content is being prepared'}</span></span>}
    </span>
    <span className={styles.cardBody}><span className={styles.approval} data-status={post.approvalStatus}>{statusLabel}</span><span className={styles.postTitle}>{title}</span>{post.contentIdea&&post.caption&&<span className={styles.caption}>{post.caption}</span>}</span>
    <span className={styles.cardFooter}><span className={styles.assetCount}>{post.assets.length>1?<><Layers size={12}/>{post.assets.length} files</>:cover?.mediaType==='VIDEO'?'Video':cover?.mediaType==='PHOTO'?'Photo':cover?'Document':'Post details'}</span><span className={styles.openPost}>{post.approvalStatus==='PENDING'?'Review post':'Open post'}<ArrowUpRight size={14}/></span></span>
  </button>;
}

function PostDetailPanel({
  slug,
  post,
  onClose,
  onUpdated,
}: {
  slug: string;
  post: CalendarPostData;
  onClose: () => void;
  onUpdated: (post: CalendarPostData) => void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const meta = PLATFORM_META[post.platform];
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      dialog?.close();
      previousFocus?.focus();
    };
  }, []);
const [activeAssetIdx, setActiveAssetIdx] = useState(0);
const [requestingRevision, setRequestingRevision] = useState(false);
const [note, setNote] = useState("");
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
const [comments, setComments] = useState(post.videoComments);
const [reviewStatus, setReviewStatus] = useState<ApprovalStatus>(
  post.approvalStatus
);

useEffect(() => {
  setReviewStatus(post.approvalStatus);
}, [post.approvalStatus]);
  const activeAsset = post.assets[activeAssetIdx] ?? post.assets[0] ?? null;

  const addComment = async (commentNote: string, timestampSeconds: number) => {
    const res = await calendarMutationFetch(`/api/social-calendar/${slug}/posts/${post.id}/video-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: commentNote, videoTimestampSeconds: timestampSeconds }),
    });
    const data = await res.json();
    if (res.ok) {
      setComments((prev) => [...prev, data.comment]);
      router.refresh();
    }
  };

  const respond = async (
  action: "approve" | "request_revision"
) => {
  setSubmitting(true);
  setError(null);

  try {
    const res = await calendarMutationFetch(
      `/api/social-calendar/${slug}/posts/${post.id}/review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          note,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      setError(
        data.error ?? "Something went wrong"
      );
      return;
    }

    const updatedPost = data.post as CalendarPostData;

    const nextStatus: ApprovalStatus =
      action === "approve"
        ? "APPROVED"
        : "NEEDS_REVISION";

    // Update the review state immediately so the client
    // never remains looking at the old action buttons while
    // the page refreshes.
    setReviewStatus(nextStatus);

    onUpdated({
      ...updatedPost,
      assets: updatedPost.assets ?? [],
      videoComments:
        updatedPost.videoComments ?? [],
      customFields:
        updatedPost.customFields ?? [],
    });

    setRequestingRevision(false);
    setNote("");

    router.refresh();
  } catch {
    setError(
      "Unable to submit your response. Please try again."
    );
  } finally {
    setSubmitting(false);
  }
};

  const canReview = post.assets.length > 0 || (["FACEBOOK", "LINKEDIN", "X"].includes(post.platform) && !!post.caption?.trim());
  return (
    <dialog ref={dialogRef} className={styles.reviewDialog} aria-labelledby="post-review-title" aria-busy={submitting}
      onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !submitting) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
      <header className={styles.reviewHeader}>
        <div className={styles.reviewHeading}><span className={styles.reviewPlatform}><PlatformIcon platform={post.platform} className="h-5 w-5" /></span><div><p>CONTENT REVIEW</p><h2 id="post-review-title">{meta.label} <span>· {post.postType || "Post"}</span></h2><div className={styles.reviewDate}>{new Date(post.postDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {new Date(post.postDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div></div></div>
        <button type="button" autoFocus className={styles.reviewClose} onClick={onClose} disabled={submitting} aria-label="Close content review">×</button>
      </header>
      <div className={styles.reviewBody}>
        <section className={styles.reviewCreative} aria-label="Content preview">
          <div className={styles.reviewSectionHeading}><h3>Content preview</h3><span>{post.assets.length} {post.assets.length === 1 ? "asset" : "assets"}</span></div>
          <div className={styles.reviewStage}>
            {activeAsset?.mediaType === "VIDEO" ? <video key={activeAsset.id} ref={videoRef} src={activeAsset.contentUrl} poster={activeAsset.posterUrl ?? undefined} controls playsInline preload="metadata" />
              : activeAsset?.mediaType === "PHOTO" ? <img src={activeAsset.contentUrl} alt={post.contentIdea || "Post creative"} />
              : activeAsset ? <div className={styles.reviewEmpty}><FileText size={36} /><h3>Document preview</h3><a href={activeAsset.contentUrl} target="_blank" rel="noopener noreferrer">Open document <ArrowUpRight size={16} /></a></div>
              : <div className={styles.reviewEmpty}><FileText size={36} /><h3>{post.caption ? "Text post" : "Your creative is on its way"}</h3><p>{post.caption || "The preview will appear here when your team uploads it."}</p></div>}
          </div>
          {post.assets.length > 1 && <div className={styles.reviewThumbnails} aria-label="Choose an asset">{post.assets.map((asset, index) => <button key={asset.id} type="button" aria-label={`View asset ${index + 1}`} aria-pressed={index === activeAssetIdx} onClick={() => setActiveAssetIdx(index)}>{asset.mediaType === "PHOTO" ? <img src={asset.contentUrl} alt="" /> : asset.mediaType === "VIDEO" ? <Play size={20} /> : <FileText size={20} />}<span>{index + 1}</span></button>)}</div>}
          {activeAsset?.mediaType === "VIDEO" && <div className={styles.reviewVideoComments}><CalendarVideoComments comments={comments} readOnly={false} getCurrentTime={() => videoRef.current?.currentTime ?? 0} onSeekTo={(time) => { if (videoRef.current) { videoRef.current.currentTime = time; void videoRef.current.play(); } }} onAddComment={addComment} /></div>}
        </section>
        <aside className={styles.reviewDetails} aria-label="Post details">
          <div className={styles.reviewSectionHeading}><h3>Post details</h3><span className={styles.approval} data-status={reviewStatus}>{APPROVAL_META[reviewStatus].text}</span></div>
          {post.caption && <section><h4>Caption</h4><p>{post.caption}</p></section>}
          {post.contentIdea && <section><h4>Content idea</h4><p>{post.contentIdea}</p></section>}
          {post.category && <section><h4>Category</h4><p>{post.category}</p></section>}
          {post.cta && <section><h4>Call to action</h4><p>{post.cta}</p></section>}
          {post.hashtags && <section><h4>Hashtags</h4><p>{post.hashtags}</p></section>}
          {post.taggedAccounts && <section><h4>Tagged accounts</h4><p>{post.taggedAccounts}</p></section>}
          {post.linkUrl && <section><h4>Link</h4><a href={post.linkUrl} target="_blank" rel="noopener noreferrer">{post.linkUrl} ↗</a></section>}
          {post.customFields.map(field => <section key={field.id}><h4>{field.label}</h4><p>{field.value}</p></section>)}
          {!post.caption && !post.contentIdea && <p>Your team has not added a caption yet.</p>}
          {reviewStatus === "NEEDS_REVISION" && post.approvalNote && <section><h4>Your feedback</h4><p>{post.approvalNote}</p></section>}
        </aside>
      </div>
      <footer className={styles.reviewFooter}>
        {error && <p role="alert" className={styles.reviewError}>{error}</p>}
        {canReview && reviewStatus === "PENDING" ? requestingRevision ? <div className={styles.reviewFeedback}><label htmlFor="review-feedback">What would you like to change?</label><textarea id="review-feedback" autoFocus value={note} onChange={event => setNote(event.target.value)} rows={3} placeholder="Share a little detail so your team can get it right." disabled={submitting} /><div className={styles.reviewActions}><button type="button" onClick={() => { setRequestingRevision(false); setError(null); }} disabled={submitting}>Cancel</button><button type="button" className={styles.reviewPrimary} onClick={() => respond("request_revision")} disabled={submitting || !note.trim()}>{submitting ? "Sending…" : "Send feedback"}</button></div></div> : <><div className={styles.reviewFooterMessage}><strong>Ready to go?</strong><p>Approve this post or let your team know what to change.</p></div><div className={styles.reviewActions}><button type="button" onClick={() => setRequestingRevision(true)} disabled={submitting}>Request changes</button><button type="button" className={styles.reviewPrimary} onClick={() => respond("approve")} disabled={submitting}><IconCheck className="h-4 w-4" />{submitting ? "Approving…" : "Approve post"}</button></div></> : <><div className={styles.reviewFooterMessage}><strong>{reviewStatus === "APPROVED" ? "✓ You approved this post" : reviewStatus === "NEEDS_REVISION" ? "Feedback sent to your team" : "Not ready for review yet"}</strong><p>{reviewStatus === "APPROVED" ? "You’re all set. Your team can take it from here." : reviewStatus === "NEEDS_REVISION" ? "Your team will update the post for another look." : "Check back once your team has added the content."}</p></div><div className={styles.reviewActions}><button type="button" onClick={onClose}>Done</button></div></>}
      </footer>
    </dialog>
  );
}
export default function ClientCalendarView({
  slug,
  planStatus,
  posts: initialPosts,
  clientName,
  initialPostId,
  controlledTheme,
  onThemeChange,
}: {
  slug: string;
  planStatus: string;
  posts: CalendarPostData[];
  clientName: string;
  initialMonth?: string;
  initialPostId?: string;
  controlledTheme?: Theme;
  onThemeChange?: () => void;
}) {
  const router = useRouter();
  const [localTheme, setTheme] = useState<Theme>("light");
  const theme = controlledTheme ?? localTheme;
  const [viewMode, setViewMode] = useState<"calendar" | "instagram" | "tiktok" | "linkedin" | "facebook" | "x" | "inbox">("calendar");
  const [currentPlanStatus, setCurrentPlanStatus] = useState(planStatus);

  useEffect(() => {
    if (controlledTheme !== undefined) return;
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
  }, [controlledTheme]);

  const toggleTheme = () => {
    if (onThemeChange) { onThemeChange(); return; }
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
      return next;
    });
  };

  const t = THEMES[theme];

  const monthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [posts, setPosts] = useState<CalendarPostData[]>(
    initialPosts.map((p) => ({
      ...p,
      assets: p.assets ?? [],
      videoComments: p.videoComments ?? [],
      customFields: p.customFields ?? [],
    })),
  );

  const [selectedPost, setSelectedPost] = useState<CalendarPostData | null>(() => initialPosts.find((post) => post.id === initialPostId) ?? null);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [planNote, setPlanNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side discovery controls. These stay on the same page so the
  // client can jump directly to what matters instead of paging through
  // months or posts one by one.
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<Platform | "ALL">("ALL");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalStatus | "ALL">("ALL");
  const [contentFilter, setContentFilter] = useState<"ALL" | "WITH_CONTENT" | "WITHOUT_CONTENT">("ALL");

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthOptions = useMemo(() => {
    const values = new Set(posts.map((post) => monthKey(new Date(post.postDate))));
    values.add(monthKey(new Date()));
    values.add(monthKey(currentMonth));

    return Array.from(values)
      .sort()
      .map((value) => {
        const [y, m] = value.split("-").map(Number);
        return {
          value,
          label: new Date(y, m - 1, 1).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }),
        };
      });
  }, [posts, currentMonth]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesMonth =
        monthKey(new Date(post.postDate)) === monthKey(currentMonth);

      const searchable = [
        post.caption,
        post.contentIdea,
        post.cta,
        post.hashtags,
        post.taggedAccounts,
        post.category,
        post.postType,
        post.linkUrl,
        PLATFORM_META[post.platform].label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesPlatform =
        platformFilter === "ALL" || post.platform === platformFilter;
      const matchesApproval =
        approvalFilter === "ALL" || post.approvalStatus === approvalFilter;

      const hasContent = post.assets.length > 0 || (["FACEBOOK", "LINKEDIN", "X"].includes(post.platform) && !!post.caption?.trim());
      const matchesContent =
        contentFilter === "ALL" ||
        (contentFilter === "WITH_CONTENT" && hasContent) ||
        (contentFilter === "WITHOUT_CONTENT" && !hasContent);

      return (
        matchesMonth &&
        matchesSearch &&
        matchesPlatform &&
        matchesApproval &&
        matchesContent
      );
    });
  }, [
    posts,
    currentMonth,
    searchQuery,
    platformFilter,
    approvalFilter,
    contentFilter,
  ]);

  const activeFilterCount =
    Number(Boolean(searchQuery.trim())) +
    Number(platformFilter !== "ALL") +
    Number(approvalFilter !== "ALL") +
    Number(contentFilter !== "ALL");

  const clearFilters = () => {
    setSearchQuery("");
    setPlatformFilter("ALL");
    setApprovalFilter("ALL");
    setContentFilter("ALL");
  };

  const postsForDate = (date: Date) =>
    filteredPosts.filter((p) => {
      const pd = new Date(p.postDate);
      return (
        pd.getFullYear() === date.getFullYear() &&
        pd.getMonth() === date.getMonth() &&
        pd.getDate() === date.getDate()
      );
    });

  // The month is the primary scope; the other controls refine that month.
  const monthPosts = posts.filter(post => monthKey(new Date(post.postDate)) === monthKey(currentMonth));
  const postsInMonth = filteredPosts;
  const activeDates = Array.from(
    new Set(postsInMonth.map((p) => new Date(p.postDate).getDate()))
  )
    .sort((a, b) => a - b)
    .map((day) => new Date(year, month, day));

  const respondToPlan = async (action: "approve" | "request_changes") => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await calendarMutationFetch(`/api/social-calendar/${slug}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: planNote }),
      });

      if (res.ok) {
        setCurrentPlanStatus(
          action === "approve"
            ? "PLAN_APPROVED"
            : "PLAN_NEEDS_CHANGES"
        );
        setRequestingChanges(false);
        setPlanNote("");
        setSubmitting(false);
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong");
    } catch {
      setError("Unable to submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-calendar-theme={theme}
      className={`${styles.calendarRoot} min-w-0 transition-colors duration-300`}
      style={{
        background: t.pageBg,
        color: t.text,
      }}
    >
      {/* SOCIAL VIEW SWITCHER */}
      <div className={styles.intro}><div><h2>Your content calendar</h2><p>Your next post, ready for a closer look.</p></div><span>Click any card to review <ArrowUpRight size={14}/></span></div>
      <div
        className={`${styles.viewSwitcher} mb-6 overflow-hidden rounded-[14px] border p-1.5 transition-colors duration-300`}
        style={{
          background: t.cardBg,
          borderColor: t.cardBorder,
          boxShadow: theme === "dark"
            ? "0 18px 60px rgba(0,0,0,0.18)"
            : "0 18px 60px rgba(0,0,0,0.07)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-1 pb-1.5">
          <div className="hidden min-w-0 items-center gap-2 pl-2 sm:flex">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "#2478FF", boxShadow: "0 0 10px rgba(36,120,255,0.55)" }}
            />
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: t.textFaint }}>
              Explore channel previews
            </span>
          </div>
          {controlledTheme === undefined && <div className="ml-auto">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>}
        </div>
        <div role="group" aria-label="Calendar and channel previews" className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap">
          {[
            { key: "calendar" as const, label: "Calendar", icon: "calendar" },
            { key: "instagram" as const, label: "Instagram", icon: "instagram" },
            { key: "tiktok" as const, label: "TikTok", icon: "tiktok" },
            { key: "linkedin" as const, label: "LinkedIn", icon: "linkedin" },
            { key: "facebook" as const, label: "Facebook", icon: "facebook" },
            { key: "x" as const, label: "X", icon: "x" },
            { key: "inbox" as const, label: "Inbox", icon: "inbox" },
          ].map((tab) => {
            const active = viewMode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={active}
                onClick={() => { setViewMode(tab.key); setPlatformFilter("ALL"); }}
                className="relative flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[16px] px-3 py-2.5 text-xs font-semibold transition-all duration-300 active:scale-[0.98] sm:text-sm"
                style={{
                  background: active ? "#1768e8" : "transparent",
                  color: active ? "#fff" : t.textMuted,
                  boxShadow: active
                    ? theme === "dark"
                      ? "0 8px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.08)"
                      : "0 8px 28px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.8)"
                    : "none",
                }}
              >
                {tab.icon === "calendar" && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="3" y="4" width="18" height="17" rx="3" />
                    <path d="M8 2.5v4M16 2.5v4M3 9h18" strokeLinecap="round" />
                  </svg>
                )}
                {tab.icon === "instagram" && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
                  </svg>
                )}
                {tab.icon === "tiktok" && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M16.6 2h-3.3v13.8c0 1.5-1.2 2.7-2.7 2.7a2.7 2.7 0 1 1 0-5.4c.3 0 .5 0 .8.1V9.8a6.1 6.1 0 0 0-.8 0A6.1 6.1 0 1 0 16.6 15.9V8.5a8 8 0 0 0 4.6 1.5V6.7a4.8 4.8 0 0 1-4.6-4.7Z" />
                  </svg>
                )}
                {tab.icon === "inbox" && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M4 5.5h16v13H4z" />
                    <path d="M4 13h4l1.5 2h5L16 13h4M8 9h8" />
                  </svg>
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {viewMode === "instagram" && (
        <section className="relative overflow-hidden rounded-[28px] border px-3 py-8 transition-colors duration-300 sm:px-6 sm:py-10"
          style={{
            background: theme === "dark" ? "#142237" : "#F7F7F8",
            borderColor: t.cardBorder,
            boxShadow: theme === "dark" ? "0 30px 100px rgba(0,0,0,0.28)" : "0 30px 100px rgba(0,0,0,0.08)",
          }}>
          <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#E1306C]/10 blur-[100px]" />
          <div className="pointer-events-none absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-[#7C3AED]/10 blur-[100px]" />
          <div className="relative z-10">
            <div className="mb-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: t.textFaint }}>Social preview</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: t.text }}>Instagram Preview</h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 sm:text-sm" style={{ color: t.textMuted }}>Present your brand the right way — see how your Instagram content comes together before it goes live.</p>
            </div>
            <InstagramPreview posts={filteredPosts} clientName={clientName?.trim() || "Your brand"} />
          </div>
        </section>
      )}

      {viewMode === "tiktok" && (
        <section className="relative overflow-hidden rounded-[28px] border px-3 py-8 transition-colors duration-300 sm:px-6 sm:py-10"
          style={{
            background: theme === "dark" ? "#142237" : "#F7F7F8",
            borderColor: t.cardBorder,
            boxShadow: theme === "dark" ? "0 30px 100px rgba(0,0,0,0.28)" : "0 30px 100px rgba(0,0,0,0.08)",
          }}>
          <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-[#25F4EE]/10 blur-[100px]" />
          <div className="pointer-events-none absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-[#FE2C55]/10 blur-[100px]" />
          <div className="relative z-10">
            <div className="mb-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: t.textFaint }}>Social preview</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: t.text }}>TikTok experience</h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 sm:text-sm" style={{ color: t.textMuted }}>Experience the complete vertical sequence exactly as a viewer would scroll through it.</p>
            </div>
            <TikTokPreview posts={filteredPosts} clientName={clientName?.trim() || "Your brand"} />
          </div>
        </section>
      )}

      {(viewMode === "linkedin" || viewMode === "facebook" || viewMode === "x") && (
        <SocialFeedPreview posts={filteredPosts} clientName={clientName?.trim() || "Your brand"}
          channel={viewMode} onOpen={setSelectedPost} filtersActive={activeFilterCount > 0 || Boolean(searchQuery.trim())} onClearFilters={clearFilters} />
      )}

      {viewMode === "inbox" && (
        <div className="relative z-10">
          <SocialLeadInbox slug={slug} clientMode />
        </div>
      )}

      {viewMode === "calendar" && (
        <>
      <div
        className={`${styles.calendarToolbar} mb-7 overflow-hidden rounded-[18px] border transition-colors duration-300`}
        style={{
          background:
            theme === "dark"
              ? "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))"
              : "linear-gradient(145deg, #FFFFFF, #F7F9FC)",
          borderColor: t.cardBorder,
          boxShadow:
            theme === "dark"
              ? "0 20px 70px rgba(0,0,0,0.20)"
              : "0 20px 70px rgba(15,23,42,0.06)",
        }}
      >
        <div className="relative overflow-hidden p-4 sm:p-5">
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full blur-3xl"
            style={{ background: "rgba(36,120,255,0.13)" }}
          />

          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: "#2478FF",
                      boxShadow: "0 0 14px rgba(36,120,255,0.7)",
                    }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: t.textFaint }}
                  >
                    YOUR SCHEDULE
                  </span>
                </div>
                <h2
                  className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
                  style={{ color: t.text }}
                >
                  {currentMonth.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <p className="mt-1 text-xs sm:text-sm" style={{ color: t.textMuted }}>
                  {filteredPosts.length}{" "}
                  {filteredPosts.length === 1 ? "post" : "posts"} in this view
                  {activeFilterCount > 0 ? " · filtered" : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={monthKey(currentMonth)}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split("-").map(Number);
                    setCurrentMonth(new Date(y, m - 1, 1));
                  }}
                  aria-label="Select month"
                  className="h-11 min-w-[175px] rounded-xl border px-3.5 text-sm font-semibold outline-none transition-all"
                  style={{
                    background: t.inputBg,
                    borderColor: t.inputBorder,
                    color: t.text,
                  }}
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  className="h-11 rounded-xl border px-4 text-xs font-semibold transition-all hover:-translate-y-0.5"
                  style={{
                    background: t.pillBg,
                    borderColor: t.cardBorder,
                    color: t.textMuted,
                  }}
                >
                  This month
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
                  aria-label="Previous month"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border text-lg transition-all hover:-translate-y-0.5"
                  style={{
                    background: t.pillBg,
                    borderColor: t.cardBorder,
                    color: t.textMuted,
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
                  aria-label="Next month"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border text-lg transition-all hover:-translate-y-0.5"
                  style={{
                    background: t.pillBg,
                    borderColor: t.cardBorder,
                    color: t.textMuted,
                  }}
                >
                  ›
                </button>
              </div>
            </div>

            <div className={styles.scheduleSummary} aria-label="Review status shortcuts">
              {([
                { value: "ALL", label: "All posts", count: monthPosts.length },
                { value: "PENDING", label: "To review", count: monthPosts.filter(post => post.approvalStatus === "PENDING").length },
                { value: "APPROVED", label: "Approved", count: monthPosts.filter(post => post.approvalStatus === "APPROVED").length },
                { value: "NEEDS_REVISION", label: "Changes requested", count: monthPosts.filter(post => post.approvalStatus === "NEEDS_REVISION").length },
              ] as const).map(item => <button key={item.value} type="button" aria-pressed={approvalFilter === item.value} onClick={() => setApprovalFilter(item.value)}><span>{item.label}</span><strong>{item.count}</strong></button>)}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.8fr))]">
              <div className="relative">
                <svg
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  style={{ color: t.textFaint }}
                >
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" strokeLinecap="round" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find a post…"
                  aria-label="Search content"
                  className="h-11 w-full rounded-xl border pl-10 pr-4 text-sm outline-none transition-all placeholder:opacity-50 focus:ring-4 focus:ring-[#2478FF]/10"
                  style={{
                    background: t.inputBg,
                    borderColor: t.inputBorder,
                    color: t.text,
                  }}
                />
              </div>

              <select
                value={platformFilter}
                onChange={(e) =>
                  setPlatformFilter(e.target.value as Platform | "ALL")
                }
                aria-label="Filter by platform"
                className="h-11 rounded-xl border px-3 text-sm outline-none"
                style={{
                  background: t.inputBg,
                  borderColor: t.inputBorder,
                  color: t.text,
                }}
              >
                <option value="ALL">All channels</option>
                {Object.entries(PLATFORM_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>

              <select
                value={contentFilter}
                onChange={(e) =>
                  setContentFilter(
                    e.target.value as
                      | "ALL"
                      | "WITH_CONTENT"
                      | "WITHOUT_CONTENT",
                  )
                }
                aria-label="Filter by content availability"
                className="h-11 rounded-xl border px-3 text-sm outline-none"
                style={{
                  background: t.inputBg,
                  borderColor: t.inputBorder,
                  color: t.text,
                }}
              >
                <option value="ALL">All content</option>
                <option value="WITH_CONTENT">Has content</option>
                <option value="WITHOUT_CONTENT">Needs content</option>
              </select>
            </div>

            {(activeFilterCount > 0 || searchQuery.trim()) && (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    background: "rgba(36,120,255,0.10)",
                    borderColor: "rgba(36,120,255,0.20)",
                    color: "#68B2FF",
                  }}
                >
                  {activeFilterCount} active{" "}
                  {activeFilterCount === 1 ? "filter" : "filters"}
                </span>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-semibold underline underline-offset-4"
                  style={{ color: t.textMuted }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeDates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center" style={{ borderColor: t.cardBorder }}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: t.pillBg }}>
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/30" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="17" rx="3" />
              <path d="M8 2.5v4M16 2.5v4M3 9h18" strokeLinecap="round" />
            </svg>
          </span>
          <p className="text-sm font-semibold" style={{ color: t.textMuted }}>{monthPosts.length ? "No posts match your filters" : "A fresh month, ready for ideas"}</p>
          <p className="max-w-xs text-xs" style={{ color: t.textFaint }}>{monthPosts.length ? "Try another channel or clear your filters to see the full schedule." : "Your team’s planned posts will appear here. You can also browse another month."}</p>
          {monthPosts.length > 0 && <button type="button" className={styles.clearSchedule} onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <div className={styles.scheduleDays}>
          {activeDates.map((date) => {
            const dayColor = theme === "dark" ? "#9cc4ff" : "#1768e8";
            const dayPosts = postsForDate(date);
            return (
              <div key={date.toISOString()} className={styles.dayRow}>
                <div className={styles.dateRail}>
                  <div
                    className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl sm:h-14 sm:w-14"
                    style={{ background: `${dayColor}1f`, border: `1.5px solid ${dayColor}55` }}
                  >
                    <span className="text-base font-black leading-none sm:text-lg" style={{ color: dayColor }}>
                      {date.getDate()}
                    </span>
                    <span className="mt-0.5 text-[9px] font-bold uppercase" style={{ color: dayColor, letterSpacing: "0.04em" }}>
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                  </div>
                  <div className="mt-2 w-px flex-1" style={{ background: t.cardBorder }} />
                </div>

                <div className={styles.dayGrid}>
                  {dayPosts.map((post, postIndex) => (
                    <PostTile key={post.id} post={post} index={postIndex} onClick={() => setSelectedPost(post)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

        </>
      )}

      {selectedPost && (
        <PostDetailPanel
          slug={slug}
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onUpdated={(updated) => {
            const safe = { ...updated, assets: updated.assets ?? [], videoComments: updated.videoComments ?? [], customFields: updated.customFields ?? [] };
            setPosts((prev) => prev.map((p) => (p.id === safe.id ? safe : p)));
            setSelectedPost(safe);
          }}
        />
      )}

      {currentPlanStatus === "AWAITING_APPROVAL" && (
        <div className="mt-8 rounded-xl border p-6 transition-colors duration-300"
          style={{ background: t.cardBg, borderColor: t.cardBorder }}>
          <p className="mb-4 text-sm font-semibold" style={{ color: t.text }}>Does this plan work for you?</p>

          {requestingChanges ? (
            <div className="flex flex-col gap-3">
              <textarea
  value={planNote}
  onChange={(e) => setPlanNote(e.target.value)}
  rows={3}
  placeholder="What would you like changed?"
  style={{
    fontSize: "16px",
    background: t.inputBg,
    borderColor: t.inputBorder,
    color: t.text,
  }}
  className="w-full resize-none rounded-lg border px-3 py-2.5 text-sm outline-none"
/>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => respondToPlan("request_changes")}
                  disabled={submitting || !planNote.trim()}
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "#F97316" }}
                >
                  {submitting ? "Sending..." : "Send feedback"}
                </button>
                <button onClick={() => setRequestingChanges(false)} className="text-xs underline" style={{ color: t.textFaint }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => respondToPlan("approve")}
                disabled={submitting}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)" }}
              >
                {submitting ? "Approving..." : "Approve this plan"}
              </button>
              <button
                onClick={() => setRequestingChanges(true)}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white/70"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                Request changes
              </button>
            </div>
          )}
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>
      )}

      {currentPlanStatus === "PLAN_APPROVED" && (
        <div className="mt-8 rounded-xl border p-5 text-sm"
          style={{ background: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.18)", color: "#4ade80" }}>
          You&apos;ve approved this plan — click any post below to review its actual content as it gets uploaded.
        </div>
      )}
    </div>
  );
}
