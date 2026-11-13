"use client";
import styles from "./InstagramPreview.module.css";
import { calendarWorkflow } from "@/lib/calendarWorkflow";

import UiSymbol from "@/components/ui/UiSymbol";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type ApprovalStatus = "PENDING" | "APPROVED" | "NEEDS_REVISION";

interface PreviewAsset {
  id: string;
  mediaType: "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";
  contentUrl: string; posterUrl?: string | null;
}

interface PreviewPost {
  internalReviewStatus?: string; publishStatus?: string; instagramPublishStatus?: string; tikTokPublishStatus?: string; isAiDraft?: boolean;
  id: string;
  postDate: string;
  platform: string;
  postType: string | null;
  caption: string | null;
  hashtags: string | null;
  approvalStatus: ApprovalStatus;
  assets: PreviewAsset[];
}

const APPROVAL_DOT: Record<ApprovalStatus, string> = {
  PENDING: "#FFCC00",
  APPROVED: "#4ade80",
  NEEDS_REVISION: "#F97316",
};

/* ─────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────── */

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconThreads({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path
        d="M18.6 10.7c-.4-3.7-2.8-6-6.6-6-3.8 0-6.5 2.3-6.5 5.8 0 3.5 2.7 5.8 6.6 5.8 3.3 0 5.4-1.5 5.4-3.8 0-2.1-1.8-3.4-4.7-3.4-2.8 0-4.4 1.2-4.4 3 0 1.5 1.3 2.5 3.1 2.5 2.4 0 4-1.5 4-4.2 0-3.1-1.9-5.5-5.1-5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.8 10.4c2.5.2 4.3 1.2 5.1 2.9" strokeLinecap="round" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M12 20.5s-7.5-4.6-9.9-9.3C.6 8 2 4.7 5.3 4.1c2-.4 3.9.5 5 2.1a1 1 0 0 0 1.4 0c1.1-1.6 3-2.5 5-2.1 3.3.6 4.7 3.9 3.2 7.1-2.4 4.7-9.9 9.3-9.9 9.3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconComment({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M21 11.5a8.4 8.4 0 0 1-8.9 8.5 9 9 0 0 1-3.5-.7L3 21l1.8-5.2A8.4 8.4 0 0 1 3.5 11 8.5 8.5 0 0 1 12 2.6a8.6 8.6 0 0 1 9 8.9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBookmark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMore({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function IconCamera({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="6" width="15" height="13" rx="2.5" />
      <path d="M17 9.5 22 7v10l-5-2.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function IconReels({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m9 9 6 3-6 3V9Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="9.5" y="3" width="6" height="6" rx="1" />
      <rect x="16" y="3" width="5" height="6" rx="1" />
      <rect x="3" y="9.5" width="6" height="6" rx="1" />
      <rect x="9.5" y="9.5" width="6" height="6" rx="1" />
      <rect x="16" y="9.5" width="5" height="6" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="9.5" y="16" width="6" height="5" rx="1" />
      <rect x="16" y="16" width="5" height="5" rx="1" />
    </svg>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" strokeLinejoin="round" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" strokeLinejoin="round" />
    </svg>
  );
}

function IconBack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="m9 7 8 5-8 5V7Z" />
    </svg>
  );
}

function StatusBarIcons() {
  return (
    <div className="flex items-center gap-1.5">
      <svg viewBox="0 0 18 12" className="h-2.5 w-4" fill="currentColor">
        <rect x="0" y="7" width="3" height="5" rx="0.5" />
        <rect x="5" y="4" width="3" height="8" rx="0.5" />
        <rect x="10" y="1" width="3" height="11" rx="0.5" />
      </svg>
      <span className="text-[9px] font-semibold tracking-tight">5G</span>
      <svg viewBox="0 0 24 12" className="h-2.5 w-5" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="1" y="1.5" width="19" height="9" rx="2.5" />
        <rect x="3" y="3.5" width="14" height="5" rx="1" fill="currentColor" stroke="none" />
        <rect x="21.5" y="4" width="1.5" height="4" rx="0.7" fill="currentColor" />
      </svg>
    </div>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   MEDIA
───────────────────────────────────────────────────────────── */

function PostMedia({
  assets,
  isReel,
}: {
  assets: PreviewAsset[];
  isReel: boolean;
}) {
  const [index, setIndex] = useState(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const swipeHandled = useRef(false);

  const active = assets[index];

  useEffect(() => {
    setIndex(0);
  }, [assets]);

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= assets.length) return;
    setIndex(nextIndex);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (assets.length <= 1) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    swipeHandled.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current || swipeHandled.current || assets.length <= 1) return;

    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;

    if (Math.abs(deltaX) >= 32 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      swipeHandled.current = true;

      if (deltaX < 0 && index < assets.length - 1) {
        goTo(index + 1);
      } else if (deltaX > 0 && index > 0) {
        goTo(index - 1);
      }
    }
  };

  const clearPointer = () => {
    pointerStart.current = null;
    swipeHandled.current = false;
  };

  if (!active) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center bg-[#111]">
        <div className="text-center">
          <IconCamera className="mx-auto mb-2 h-6 w-6 text-white/20" />
          <p className="text-xs text-white/35">No content uploaded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative aspect-[4/5] w-full select-none overflow-hidden bg-black"
      style={{ touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPointer}
      onPointerCancel={clearPointer}
    >
      {active.mediaType === "VIDEO" ? (
        <video preload={active.posterUrl ? "none" : "metadata"}
          key={active.id}
          poster={active.posterUrl ?? undefined} src={active.contentUrl}
          className="h-full w-full object-contain"
          controls
          muted
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={active.id}
          src={active.contentUrl}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />

      {isReel && (
        <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
          <IconReels className="h-3 w-3" />
          Reel
        </span>
      )}

      {assets.length > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              aria-label="Previous carousel item"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                goTo(index - 1);
              }}
              className="absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 focus:opacity-100"
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
          )}

          {index < assets.length - 1 && (
            <button
              type="button"
              aria-label="Next carousel item"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                goTo(index + 1);
              }}
              className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 focus:opacity-100"
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          )}

          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
            {index + 1}/{assets.length}
          </span>

          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {assets.map((asset, assetIndex) => (
              <span
                key={asset.id || assetIndex}
                className="h-1.5 w-1.5 rounded-full transition-all"
                style={{
                  background: assetIndex === index ? "#fff" : "rgba(255,255,255,0.45)",
                  transform: assetIndex === index ? "scale(1.15)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FEED POST
───────────────────────────────────────────────────────────── */

function FeedCard({
  post,
  clientName,
  postRef,
}: {
  post: PreviewPost;
  clientName: string;
  postRef?: (node: HTMLElement | null) => void;
}) {
  const isReel = post.postType === "Reel";

  const handle = useMemo(
    () =>
      clientName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 30) || "yourbrand",
    [clientName]
  );

  const timeLabel = new Date(post.postDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <article ref={postRef} className="border-b border-white/[0.08] pb-6">
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{
              background: "linear-gradient(135deg,#FEDA75,#D62976 60%,#4F5BD5)",
            }}
          >
            {clientName.trim().charAt(0).toUpperCase() || "Y"}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-white">{handle}</p>
            <p className="text-[9px] text-white/35">
              Scheduled · {timeLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: APPROVAL_DOT[post.approvalStatus] }}
          />
          <IconMore className="h-4 w-4 text-white/65" />
        </div>
      </div>

      <PostMedia assets={post.assets} isReel={isReel} />

      <div className="px-3.5">
        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-4">
            <IconHeart className="h-[22px] w-[22px] text-white" />
            <IconComment className="h-[22px] w-[22px] text-white" />
            <IconShare className="h-[21px] w-[21px] text-white" />
          </div>
          <IconBookmark className="h-[22px] w-[22px] text-white" />
        </div>

        <div className="mt-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold"
            style={{
              background: `${APPROVAL_DOT[post.approvalStatus]}15`,
              color: APPROVAL_DOT[post.approvalStatus],
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: APPROVAL_DOT[post.approvalStatus] }}
            />
            {calendarWorkflow(post).label}
          </span>
        </div>

        {post.caption && (
          <p className="pt-2 text-[11px] leading-[1.55] text-white/85">
            <span className="font-semibold">{handle}</span>{" "}
            {post.caption}
          </p>
        )}

        {post.hashtags && (
          <p className="pt-1 text-[11px] leading-[1.55] text-[#6cb2eb]">
            {post.hashtags}
          </p>
        )}
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
   PROFILE GRID TILE
───────────────────────────────────────────────────────────── */

function GridCell({
  post,
  onClick,
}: {
  post: PreviewPost;
  onClick: () => void;
}) {
  const cover = post.assets[0];
  const isReel = post.postType === "Reel";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open Instagram post scheduled for ${new Date(post.postDate).toLocaleDateString()}`}
      className="group relative aspect-[4/5] w-full overflow-hidden bg-[#171717] outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {cover ? (
        cover.mediaType === "VIDEO" ? (
          <video preload={cover.posterUrl ? "none" : "metadata"}
            poster={cover.posterUrl ?? undefined} src={cover.contentUrl}
            muted
            playsInline
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.contentUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 px-3 text-center"><IconCamera className="h-5 w-5 text-white/30"/><span className="text-[10px] font-semibold text-white/70">Awaiting creative</span><span className="text-[9px] leading-relaxed text-white/40">No image or video uploaded</span></div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />

      {(post.assets.length > 1 || isReel) && (
        <span className="pointer-events-none absolute right-2 top-2 text-white drop-shadow-lg">
          {isReel ? <IconReels className="h-4 w-4" /> : <IconLayers className="h-4 w-4" />}
        </span>
      )}

      <span
        className="pointer-events-none absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full shadow"
        style={{ background: APPROVAL_DOT[post.approvalStatus] }}
      />

      {cover?.mediaType === "VIDEO" && !isReel && (
        <span className="pointer-events-none absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <IconPlay className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   INSTAGRAM PREVIEW
───────────────────────────────────────────────────────────── */

export default function InstagramPreview({
  posts,
  clientName,
}: {
  posts: PreviewPost[];
  clientName: string;
}) {
  const instagramPosts = useMemo(
    () =>
      posts
        .filter((post) => post.platform === "INSTAGRAM")
        .sort(
          (a, b) =>
            new Date(a.postDate).getTime() - new Date(b.postDate).getTime()
        ),
    [posts]
  );

  const storyPosts = useMemo(
    () => instagramPosts.filter((post) => post.postType === "Story"),
    [instagramPosts]
  );

  const gridPosts = useMemo(
    () => instagramPosts.filter((post) => post.postType !== "Story"),
    [instagramPosts]
  );

  const safeClientName = clientName?.trim() || "Your brand";

  const handle = useMemo(
    () =>
      safeClientName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 30) || "yourbrand",
    [safeClientName]
  );

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedPostRef = useRef<HTMLElement | null>(null);

  const selectedIndex = gridPosts.findIndex((post) => post.id === selectedPostId);

  useEffect(() => {
    if (!selectedPostId || !feedScrollRef.current || !selectedPostRef.current) return;

    const container = feedScrollRef.current;
    const target = selectedPostRef.current;

    requestAnimationFrame(() => {
      container.scrollTo({
        top: Math.max(0, target.offsetTop - 4),
        behavior: "instant" as ScrollBehavior,
      });
    });
  }, [selectedPostId]);

  const openPost = (postId: string) => {
    setSelectedPostId(postId);
  };

  const closeFeed = () => {
    setSelectedPostId(null);
  };

  return (
    <div className={styles.stage}>
      <div className={styles.heading}><span>INSTAGRAM PREVIEW</span><h3>Your profile, before you publish.</h3><p>Tap a post to preview its creative and caption.</p></div>
      {/* PHONE */}
      <div
        className={styles.phone}
        style={{
          boxShadow:
            "0 24px 60px -20px rgba(24,46,80,0.35), 0 0 0 1px rgba(255,255,255,0.15)",
        }}
      >
        {/* Dynamic island */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-50 h-7 w-[126px] -translate-x-1/2 rounded-b-[18px] bg-black" />

        {/* iPhone status bar */}
        <div className="relative z-40 flex h-9 items-center justify-between px-5 pt-1 text-white">
          <span className="text-[12px] font-semibold tracking-tight">6:10</span>
          <StatusBarIcons />
        </div>

        {selectedPostId ? (
          /* ───────────────────────────────────────────────────
             FEED MODE
          ─────────────────────────────────────────────────── */
          <div className="bg-[#050505]">
            <div className="relative z-30 flex h-[48px] items-center justify-between border-b border-white/[0.07] bg-[#080808]/95 px-3.5 backdrop-blur-xl">
              <button
                type="button"
                onClick={closeFeed}
                aria-label="Back to Instagram profile"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.08]"
              >
                <IconBack className="h-5 w-5" />
              </button>

              <div className="text-center">
                <p className="text-[12px] font-semibold text-white">Posts</p>
                <p className="text-[8px] text-white/35">
                  {selectedIndex >= 0 ? selectedIndex + 1 : 1} of {gridPosts.length}
                </p>
              </div>

              <div className="h-8 w-8" />
            </div>

            <div
              ref={feedScrollRef}
              className={styles.feedViewport}
              style={{
                background: "#050505",
                scrollbarWidth: "none",
              }}
            >
              {gridPosts.map((post) => (
                <FeedCard
                  key={post.id}
                  post={post}
                  clientName={safeClientName}
                  postRef={(node) => {
                    if (post.id === selectedPostId) selectedPostRef.current = node;
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ───────────────────────────────────────────────────
             PROFILE MODE — MATCHES THE REFERENCE INSTAGRAM
          ─────────────────────────────────────────────────── */
          <div
            className={styles.profileViewport}
            style={{
              scrollbarWidth: "none",
            }}
          >
            {/* TOP INSTAGRAM NAV */}
            <header className="sticky top-0 z-40 flex h-[54px] items-center justify-between bg-[#080b0e]/95 px-4 backdrop-blur-xl">
              <button
                type="button"
                aria-label="Create"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white"
              >
                <IconPlus className="h-7 w-7" />
              </button>

              <button
                type="button"
                aria-label="Profile username"
                className="flex min-w-0 items-center justify-center gap-1.5 text-white"
              >
                <span className="max-w-[150px] truncate text-[15px] font-bold tracking-tight">
                  {handle}
                </span>
                <IconChevronDown className="h-4 w-4 flex-shrink-0 text-white/90" />
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#ff1744]" />
              </button>

              <div className="flex items-center gap-4 text-white">
                <button
                  type="button"
                  aria-label="Threads"
                  className="flex h-8 w-8 items-center justify-center"
                >
                  <IconThreads className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  aria-label="Menu"
                  className="flex h-8 w-8 items-center justify-center"
                >
                  <IconMenu className="h-7 w-7" />
                </button>
              </div>
            </header>

            {/* PROFILE HEADER */}
            <section className="px-4 pb-3 pt-3">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div
                    className="flex h-[78px] w-[78px] items-center justify-center rounded-full p-[2.5px]"
                    style={{
                      background:
                        "linear-gradient(135deg,#FEDA75 0%,#FA7E1E 30%,#D62976 58%,#962FBF 78%,#4F5BD5 100%)",
                    }}
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-full border-[2.5px] border-[#080b0e] bg-[#111820] text-[24px] font-bold text-white">
                      {safeClientName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-1 items-center justify-around pt-2">
                  <div className="text-center">
                    <p className="text-[17px] font-bold leading-none text-white">
                      {gridPosts.length}
                    </p>
                    <p className="mt-1.5 text-[12px] text-white/90">posts</p>
                  </div>

                  <div className="text-center">
                    <p className="text-[17px] font-bold leading-none text-white">—</p>
                    <p className="mt-1.5 text-[12px] text-white/90">followers</p>
                  </div>

                  <div className="text-center">
                    <p className="text-[17px] font-bold leading-none text-white">—</p>
                    <p className="mt-1.5 text-[12px] text-white/90">following</p>
                  </div>
                </div>
              </div>

              {/* Name + bio */}
              <div className="mt-3">
                <p className="text-[15px] font-bold leading-5 text-white">
                  {safeClientName}
                </p>

                <p className="mt-1 text-[12px] font-medium text-white/65">
                  Creative Studio
                </p>

                <p className="mt-1 text-[13px] leading-[1.45] text-white">
                  Presenting your work in style.
                  <br />
                  Ideas, stories, and moments — thoughtfully curated.
                </p>
              </div>

              {/* Professional dashboard */}
              <div className="mt-3 rounded-xl bg-[#292e34] px-3.5 py-2.5">
                <p className="text-[13px] font-semibold text-white">
                  Professional dashboard
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/55">
                  <span className="text-[17px] leading-none text-[#1ee56f]"><><UiSymbol name="upRight" /></></span>
                  Previewing your planned content
                </p>
              </div>

              {/* Action buttons */}
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {["Edit profile", "Share profile", "Contact"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="h-9 rounded-[9px] bg-[#292e34] px-2 text-[11px] font-bold text-white transition-colors hover:bg-[#333941]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* STORIES */}
            {storyPosts.length > 0 && (
              <section className="border-y border-white/[0.06] px-3.5 py-3">
                <div className="flex gap-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {storyPosts.map((post) => {
                    const cover = post.assets[0];

                    return (
                      <div
                        key={post.id}
                        className="flex flex-shrink-0 flex-col items-center gap-1.5"
                      >
                        <div
                          className="flex h-[58px] w-[58px] items-center justify-center rounded-full p-[2px]"
                          style={{
                            background:
                              "linear-gradient(135deg,#FEDA75,#D62976,#4F5BD5)",
                          }}
                        >
                          <div className="h-full w-full overflow-hidden rounded-full border-2 border-[#080b0e] bg-neutral-800">
                            {cover ? (
                              cover.mediaType === "VIDEO" ? (
                                <video preload={cover.posterUrl ? "none" : "metadata"}
                                  poster={cover.posterUrl ?? undefined} src={cover.contentUrl}
                                  muted
                                  playsInline
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={cover.contentUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              )
                            ) : null}
                          </div>
                        </div>

                        <span className="max-w-[58px] truncate text-[9px] text-white/55">
                          {new Date(post.postDate).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* PROFILE TABS */}
            <div className="grid grid-cols-4 border-b border-white/[0.06]">
              <button
                type="button"
                aria-label="Posts grid"
                className="relative flex h-[48px] items-center justify-center text-white"
              >
                <IconGrid className="h-[21px] w-[21px]" />
                <span className="absolute inset-x-5 bottom-0 h-[1.5px] rounded-full bg-white" />
              </button>

              <button
                type="button"
                aria-label="Reels"
                className="flex h-[48px] items-center justify-center text-white/55"
              >
                <IconReels className="h-[21px] w-[21px]" />
              </button>

              <button
                type="button"
                aria-label="Tagged posts"
                className="flex h-[48px] items-center justify-center text-white/55"
              >
                <div className="flex h-[21px] w-[21px] items-center justify-center rounded-[5px] border-[1.7px] border-current">
                  <div className="h-[9px] w-[9px] rounded-full border-[1.5px] border-current" />
                </div>
              </button>

              <button
                type="button"
                aria-label="Saved content"
                className="flex h-[48px] items-center justify-center text-white/55"
              >
                <IconBookmark className="h-[21px] w-[21px]" />
              </button>
            </div>

            {/* GRID */}
            {gridPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-8 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10">
                  <IconCamera className="h-6 w-6 text-white/25" />
                </div>
                <p className="pt-2 text-[13px] font-semibold text-white/60">
                  No Instagram posts planned yet
                </p>
                <p className="max-w-[230px] text-[10px] leading-relaxed text-white/30">
                  Content added for Instagram will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-[2px]">
                {gridPosts.map((post) => (
                  <GridCell
                    key={post.id}
                    post={post}
                    onClick={() => openPost(post.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* INSTAGRAM BOTTOM NAV */}
        <nav
          className="relative z-50 flex h-[58px] items-center justify-between border-t border-white/[0.06] bg-[#080b0e] px-6"
          aria-label="Instagram navigation"
        >
          <button type="button" aria-label="Home" className="text-white">
            <IconHome className="h-[23px] w-[23px]" />
          </button>

          <button type="button" aria-label="Search" className="text-white">
            <IconSearch className="h-[23px] w-[23px]" />
          </button>

          <button type="button" aria-label="Reels" className="text-white">
            <IconReels className="h-[23px] w-[23px]" />
          </button>

          <button
            type="button"
            aria-label="Messages"
            className="relative text-white"
          >
            <IconShare className="h-[22px] w-[22px]" />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#ff1744]" />
          </button>

          <button
            type="button"
            aria-label="Profile"
            className="flex h-[25px] w-[25px] items-center justify-center rounded-full p-[1.5px]"
            style={{
              background:
                "linear-gradient(135deg,#FEDA75,#D62976,#4F5BD5)",
            }}
          >
            <span className="flex h-full w-full items-center justify-center rounded-full border border-[#080b0e] bg-[#111820] text-[9px] font-bold text-white">
              {safeClientName.charAt(0).toUpperCase()}
            </span>
          </button>
        </nav>
      </div>

      <p className={styles.caption}>
        {instagramPosts.length} Instagram post
        {instagramPosts.length === 1 ? "" : "s"} planned for this calendar
      </p>
    </div>
  );
}
