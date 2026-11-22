"use client";
import { buildCaption } from "@/lib/publishing/state";
import { calendarWorkflow } from "@/lib/calendarWorkflow";

import UiSymbol from "@/components/ui/UiSymbol";
import { useEffect, useRef, useState } from "react";

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
  cta?: string | null;
  taggedAccounts?: string | null;
  linkUrl?: string | null;
  approvalStatus: ApprovalStatus;
  assets: PreviewAsset[];
}

const APPROVAL_DOT: Record<ApprovalStatus, string> = {
  PENDING: "#F59E0B",
  APPROVED: "#22C55E",
  NEEDS_REVISION: "#F97316",
};

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (!words.length) return "S";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0][0] + words[words.length - 1][0]
  ).toUpperCase();
}

function getHandle(name: string) {
  return "@" + name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function IconUserPlus({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}

function IconFootprints({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="M7.5 4.5c1.6 0 2.7 1.4 2.7 3.3 0 2.1-1.2 3.8-2.8 3.8S4.5 10.2 4.5 8.2 5.7 4.5 7.5 4.5Z" />
      <path d="M15.7 12.5c1.6 0 2.8 1.5 2.8 3.5 0 2.1-1.2 3.5-2.8 3.5s-2.8-1.5-2.8-3.5 1.2-3.5 2.8-3.5Z" />
      <path d="M6.4 12.8c-1.5.8-2.3 2.2-1.8 3.7.5 1.5 2 2.2 3.5 1.8 1.5-.5 2.2-1.9 1.8-3.4-.5-1.5-2-2.9-3.5-2.1Z" />
      <path d="M16.4 4.1c1.5-.2 2.9.9 3.2 2.8.3 2-.6 3.7-2.1 4-1.5.2-3-1-3.2-3-.3-2 .6-3.6 2.1-3.8Z" />
    </svg>
  );
}

function IconShare({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M12 16V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function IconMenu({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function IconGrid({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <rect x="4" y="4" width="6" height="6" />
      <rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" />
      <rect x="14" y="14" width="6" height="6" />
    </svg>
  );
}

function IconLock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconBookmark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z" />
    </svg>
  );
}

function IconHeart({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 21s-7.2-4.6-9.5-9.2C.7 8.2 2.5 4.5 6.2 4.1 8.4 3.9 10.4 5 12 6.8c1.6-1.8 3.6-2.9 5.8-2.7 3.7.4 5.5 4.1 3.7 7.7C19.2 16.4 12 21 12 21Z" />
    </svg>
  );
}

function IconComment({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.5-.7L4 20l1.2-3.8A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
    </svg>
  );
}

function IconMusicDisc({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`rounded-full bg-[conic-gradient(from_0deg,#111,#444,#111,#777,#111)] ${className}`}
    >
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-3 w-3 rounded-full border border-white/40 bg-black" />
      </div>
    </div>
  );
}

function IconCamera({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1.2-2h4.6l1.2 2h2A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

function IconBack({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconChevronLeft({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      className={className}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconChevronRight({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function IconRepeat({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  );
}

function TikTokTile({
  post,
  clientName,
  onClick,
}: {
  post: PreviewPost;
  clientName: string;
  onClick: () => void;
}) {
  const firstAsset = post.assets[0];
  const handle = getHandle(clientName);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[9/16] overflow-hidden bg-[#151519] text-left"
    >
      {firstAsset ? (
        firstAsset.mediaType === "VIDEO" ? (
          <video
            poster={firstAsset.posterUrl ?? undefined} src={firstAsset.contentUrl}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            muted
            playsInline
            preload={firstAsset.posterUrl ? "none" : "metadata"}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstAsset.contentUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <IconCamera className="h-7 w-7 text-white/20" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      {post.assets.length > 1 && (
        <div className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[8px] font-semibold text-white backdrop-blur-md">
          {post.assets.length}
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2">
        <p className="truncate text-[8px] font-semibold text-white">
          {handle}
        </p>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* TIKTOK FULL FEED SLIDE                                                     */
/* -------------------------------------------------------------------------- */

function TikTokSlide({
  post,
  clientName,
}: {
  post: PreviewPost;
  clientName: string;
}) {
  const [assetIndex, setAssetIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const caption = buildCaption(post);
  const canExpandCaption = caption.length > 90 || caption.split("\n").length > 3;
  const captionOverflow = captionExpanded ? "max-h-40 overflow-y-auto" : canExpandCaption ? "line-clamp-3" : "";

  const active = post.assets[assetIndex];

  const pointerStart = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const swipeHandled = useRef(false);

  const handle = getHandle(clientName);
  const initials = getInitials(clientName);

  const timeLabel = new Date(post.postDate).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    }
  );

  /*
   * THIS IS THE IMPORTANT PART.
   *
   * The carousel has its own index.
   * The arrow buttons call this function directly.
   */
  const goToAsset = (nextIndex: number) => {
    if (
      nextIndex < 0 ||
      nextIndex >= post.assets.length
    ) {
      return;
    }

    setAssetIndex(nextIndex);
  };

  /*
   * Optional touch swipe.
   *
   * Horizontal gesture:
   * LEFT  -> next asset
   * RIGHT -> previous asset
   *
   * Vertical gesture is left alone so TikTok's vertical
   * feed can continue scrolling normally.
   */
  const handlePointerDown = (
    e: React.PointerEvent<HTMLElement>
  ) => {
    if (post.assets.length <= 1) return;

    pointerStart.current = {
      x: e.clientX,
      y: e.clientY,
    };

    swipeHandled.current = false;
  };

  const handlePointerMove = (
    e: React.PointerEvent<HTMLElement>
  ) => {
    if (
      !pointerStart.current ||
      swipeHandled.current ||
      post.assets.length <= 1
    ) {
      return;
    }

    const deltaX =
      e.clientX - pointerStart.current.x;

    const deltaY =
      e.clientY - pointerStart.current.y;

    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    /*
     * Only treat the movement as carousel navigation
     * when horizontal movement is clearly dominant.
     */
    if (
      horizontalDistance >= 32 &&
      horizontalDistance > verticalDistance * 1.2
    ) {
      swipeHandled.current = true;

      if (
        deltaX < 0 &&
        assetIndex < post.assets.length - 1
      ) {
        goToAsset(assetIndex + 1);
      }

      if (
        deltaX > 0 &&
        assetIndex > 0
      ) {
        goToAsset(assetIndex - 1);
      }
    }
  };

  const handlePointerUp = () => {
    pointerStart.current = null;
    swipeHandled.current = false;
  };

  const handlePointerCancel = () => {
    pointerStart.current = null;
    swipeHandled.current = false;
  };

  return (
    <article
      className="relative flex h-full w-full shrink-0 snap-start items-center justify-center overflow-hidden bg-black select-none"
      style={{
        touchAction: "pan-y",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* ------------------------------------------------------------------ */}
      {/* CURRENT CAROUSEL MEDIA                                             */}
      {/* ------------------------------------------------------------------ */}

      {active ? (
        active.mediaType === "VIDEO" ? (
          <video preload={active.posterUrl ? "none" : "metadata"}
            key={active.id}
            poster={active.posterUrl ?? undefined} src={active.contentUrl}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={active.id}
            src={active.contentUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-white/20">
          <IconCamera className="h-8 w-8" />
        </div>
      )}

      {/* TikTok overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/90" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Scheduled badge */}
      <div className="absolute left-3 top-12 z-20 rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 text-[8px] font-semibold text-white/85 backdrop-blur-xl">
        Scheduled · {timeLabel}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CAROUSEL CONTROLS                                                  */}
      {/* ------------------------------------------------------------------ */}

      {post.assets.length > 1 && (
        <>
          {/* ================================================================ */}
          {/* PREVIOUS SLIDE                                                  */}
          {/* ================================================================ */}

          {assetIndex > 0 && (
            <button
              type="button"
              aria-label="Previous carousel item"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                /*
                 * DIRECTLY CHANGE THE CAROUSEL SLIDE.
                 */
                goToAsset(assetIndex - 1);
              }}
              className="
                absolute
                left-3
                top-1/2
                z-[100]
                flex
                h-11
                w-11
                -translate-y-1/2
                items-center
                justify-center
                rounded-full
                border
                border-white/25
                bg-black/65
                text-white
                shadow-2xl
                backdrop-blur-xl
                transition-all
                hover:scale-110
                hover:bg-black/85
                active:scale-95
              "
            >
              <IconChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* ================================================================ */}
          {/* NEXT SLIDE                                                      */}
          {/* ================================================================ */}

          {assetIndex < post.assets.length - 1 && (
            <button
              type="button"
              aria-label="Next carousel item"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                /*
                 * DIRECTLY CHANGE THE CAROUSEL SLIDE.
                 */
                goToAsset(assetIndex + 1);
              }}
              className="
                absolute
                right-16
                top-1/2
                z-[100]
                flex
                h-11
                w-11
                -translate-y-1/2
                items-center
                justify-center
                rounded-full
                border
                border-white/25
                bg-black/65
                text-white
                shadow-2xl
                backdrop-blur-xl
                transition-all
                hover:scale-110
                hover:bg-black/85
                active:scale-95
              "
            >
              <IconChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* ================================================================ */}
          {/* SLIDE INDICATORS                                                */}
          {/* ================================================================ */}

          <div className="absolute right-3 top-12 z-[100] flex items-center gap-1.5">
            {post.assets.map((asset, index) => (
              <button
                key={asset.id}
                type="button"
                aria-label={`Go to carousel slide ${
                  index + 1
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  goToAsset(index);
                }}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width:
                    index === assetIndex ? 18 : 6,
                  background:
                    index === assetIndex
                      ? "#FFFFFF"
                      : "rgba(255,255,255,.4)",
                }}
              />
            ))}
          </div>

          {/* ================================================================ */}
          {/* COUNTER                                                         */}
          {/* ================================================================ */}

          <div className="absolute left-1/2 top-12 z-[100] -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-2.5 py-1.5 text-[9px] font-semibold text-white/90 backdrop-blur-xl">
            {assetIndex + 1} / {post.assets.length}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT-SIDE TIKTOK ACTIONS                                         */}
      {/* ------------------------------------------------------------------ */}

      <div className="absolute bottom-7 right-2.5 z-20 flex flex-col items-center gap-4 text-white">
        <div className="relative mb-1">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-xl"
            style={{
              background:
                "linear-gradient(135deg,#25F4EE,#111,#FE2C55)",
            }}
          >
            {initials}
          </div>

          <span className="absolute -bottom-1.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55] text-[10px] font-bold">
            +
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <IconHeart className="h-7 w-7 drop-shadow-lg" />
          <span className="text-[9px] font-semibold drop-shadow-lg">
            Like
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <IconComment className="h-6 w-6 drop-shadow-lg" />
          <span className="text-[9px] font-semibold drop-shadow-lg">
            0
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <IconShare className="h-6 w-6 drop-shadow-lg" />
          <span className="text-[9px] font-semibold drop-shadow-lg">
            Share
          </span>
        </div>

        <div className="h-9 w-9 overflow-hidden rounded-full border border-white/20 shadow-lg">
          <IconMusicDisc className="h-full w-full" />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CAPTION                                                            */}
      {/* ------------------------------------------------------------------ */}

      <div className="absolute bottom-6 left-3 right-16 z-20">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-white drop-shadow-lg">
            {handle}
          </p>

          <span
            className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
            style={{
              color:
                APPROVAL_DOT[post.approvalStatus],
              background: `${APPROVAL_DOT[post.approvalStatus]}22`,
              border: `1px solid ${APPROVAL_DOT[post.approvalStatus]}45`,
            }}
          >
            {calendarWorkflow(post).label}
          </span>
        </div>

        {caption && (
          <div className="mt-1.5 rounded-lg bg-black/55 px-2 py-1.5">
            <p className={`whitespace-pre-wrap break-words text-[11px] leading-[1.45] text-white ${captionOverflow}`} tabIndex={captionExpanded ? 0 : undefined}>
              {caption}
            </p>
            {canExpandCaption && (
              <button type="button" onClick={() => setCaptionExpanded(expanded => !expanded)} aria-expanded={captionExpanded} className="mt-1 text-xs font-semibold text-white underline">
                {captionExpanded ? "Show less" : "Read full caption"}
              </button>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-white/70">
          <span className="text-xs"><><UiSymbol name="music" /></></span>

          <p className="truncate text-[9px]">
            Original sound · {clientName}
          </p>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN TIKTOK PREVIEW                                                        */
/* -------------------------------------------------------------------------- */

export default function TikTokPreview({
  posts,
  clientName,
}: {
  posts: PreviewPost[];
  clientName: string;
}) {
  const tiktokPosts = posts
    .filter(
      (post) => post.platform === "TIKTOK"
    )
    .sort(
      (a, b) =>
        new Date(a.postDate).getTime() -
        new Date(b.postDate).getTime()
    );

  const [selectedIndex, setSelectedIndex] =
    useState<number | null>(null);

  const feedRef =
    useRef<HTMLDivElement | null>(null);

  const initials = getInitials(clientName);
  const handle = getHandle(clientName);

  /*
   * When opening a TikTok from the profile grid,
   * jump directly to that post in the feed.
   */
  useEffect(() => {
    if (
      selectedIndex === null ||
      !feedRef.current
    ) {
      return;
    }

    const feed = feedRef.current;

    requestAnimationFrame(() => {
      feed.scrollTop =
        selectedIndex * feed.clientHeight;
    });
  }, [selectedIndex]);

  /*
   * Keyboard controls.
   */
  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    const onKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setSelectedIndex(null);
      }

      if (event.key === "ArrowDown") {
        setSelectedIndex((current) =>
          current === null
            ? 0
            : Math.min(
                current + 1,
                tiktokPosts.length - 1
              )
        );
      }

      if (event.key === "ArrowUp") {
        setSelectedIndex((current) =>
          current === null
            ? 0
            : Math.max(current - 1, 0)
        );
      }
    };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, [
    selectedIndex,
    tiktokPosts.length,
  ]);

  return (
    <div className="flex flex-col items-center">
      {/* Preview badge */}
      <div className="mb-4 flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#25F4EE] to-[#FE2C55]" />

        <p className="text-[11px] font-semibold text-white/50">
          Showwork Preview · TikTok
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PHONE                                                               */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="
          relative
          mx-auto
          w-full
          max-w-[390px]
          overflow-hidden
          rounded-[3rem]
          border-[6px]
          border-[#202024]
          bg-[#050507]
          shadow-[0_45px_120px_rgba(0,0,0,.72)]
          ring-1
          ring-white/[0.04]
        "
      >
        {/* Dynamic Island */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-[90] h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-black" />

        <div className="relative h-[720px] w-full overflow-hidden bg-[#08080a]">
          {/* -------------------------------------------------------------- */}
          {/* STATUS BAR                                                       */}
          {/* -------------------------------------------------------------- */}

          <div className="pointer-events-none absolute left-0 right-0 top-0 z-[80] flex items-center justify-between px-5 pt-2 text-[11px] font-semibold text-white">
            <span>5:18</span>

            <div className="flex items-center gap-1.5">
              <span
                className="flex items-end gap-[2px]"
                aria-hidden="true"
              >
                <i className="h-1.5 w-[3px] rounded-[1px] bg-white" />
                <i className="h-2.5 w-[3px] rounded-[1px] bg-white" />
                <i className="h-3.5 w-[3px] rounded-[1px] bg-white" />
                <i className="h-4.5 w-[3px] rounded-[1px] bg-white" />
              </span>

              <span className="text-[10px] font-medium">
                5G
              </span>

              <span className="relative h-3.5 w-6 rounded-[4px] border-[1.5px] border-white">
                <span className="absolute inset-[2px] rounded-[2px] bg-white" />

                <span className="absolute -right-[3px] top-[4px] h-1.5 w-[2px] rounded-r bg-white" />
              </span>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* NO POSTS                                                         */}
          {/* -------------------------------------------------------------- */}

          {tiktokPosts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center bg-[#08080a] px-8 text-center text-white">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
                <IconCamera className="h-7 w-7" />
              </div>

              <p className="text-sm font-bold">
                No TikTok posts planned yet
              </p>

              <p className="mt-2 max-w-[230px] text-[11px] leading-relaxed text-white/40">
                TikTok content added to this calendar
                will appear here.
              </p>
            </div>
          ) : selectedIndex === null ? (
            /* -------------------------------------------------------------- */
            /* PROFILE VIEW                                                    */
            /* -------------------------------------------------------------- */

            <div
              className="h-full overflow-y-auto bg-[#08080a] text-white"
              style={{
                scrollbarWidth: "none",
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(37,244,238,.09),transparent_42%),radial-gradient(circle_at_80%_20%,rgba(254,44,85,.07),transparent_38%)]" />

              <div className="relative px-5 pb-6 pt-12">
                {/* Header */}
                <div className="relative flex items-center justify-between">
                  <IconUserPlus className="h-7 w-7 text-white" />

                  <div className="flex items-center gap-5">
                    <IconFootprints className="h-7 w-7 text-white" />

                    <IconShare className="h-7 w-7 text-white" />

                    <IconMenu className="h-7 w-7 text-white" />
                  </div>
                </div>

                {/* Profile */}
                <div className="mt-7 flex flex-col items-center">
                  <div className="relative">
                    <div
                      className="flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-full border border-white/15 text-xl font-bold text-white shadow-[0_12px_35px_rgba(0,0,0,.4)] ring-4 ring-white/[0.03]"
                      style={{
                        background:
                          "linear-gradient(145deg,#25252b,#0d0d10)",
                      }}
                    >
                      {initials}
                    </div>

                    <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#08080a] bg-[#25BFEF] text-xl font-medium text-white">
                      +
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5">
                    <h1 className="text-[23px] font-bold tracking-[-0.8px] text-white">
                      {clientName}
                    </h1>

                    <span className="h-2 w-2 rounded-full bg-[#FE2C55]" />
                  </div>

                  <p className="mt-1 text-[15px] text-white/45">
                    {handle}
                  </p>

                  <button
                    type="button"
                    className="mt-3 rounded-full border border-white/10 bg-white/[0.08] px-7 py-2.5 text-[13px] font-semibold text-white shadow-sm backdrop-blur-xl"
                  >
                    Edit profile
                  </button>

                  {/* Stats */}
                  <div className="mt-7 flex w-full max-w-[300px] items-start justify-between text-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-[20px] font-bold leading-none">
                        {Math.max(
                          0,
                          tiktokPosts.length * 4
                        )}
                      </p>

                      <p className="mt-1.5 text-[13px] text-white/45">
                        Following
                      </p>
                    </div>

                    <div className="h-9 w-px bg-white/10" />

                    <div className="min-w-0 flex-1">
                      <p className="text-[20px] font-bold leading-none">
                        {tiktokPosts.length * 12}
                      </p>

                      <p className="mt-1.5 text-[13px] text-white/45">
                        Followers
                      </p>
                    </div>

                    <div className="h-9 w-px bg-white/10" />

                    <div className="min-w-0 flex-1">
                      <p className="text-[20px] font-bold leading-none">
                        {tiktokPosts.length * 38}
                      </p>

                      <p className="mt-1.5 text-[13px] text-white/45">
                        Likes
                      </p>
                    </div>
                  </div>

                  {/* TikTok Studio */}
                  <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-5 py-3 text-center">
                    <p className="text-[22px] leading-none"><UiSymbol name="upRight" /></p>

                    <p className="mt-2 flex items-center justify-center gap-1.5 text-[15px] font-semibold">
                      <span className="text-[#FE2C55]"><UiSymbol name="person" /></span>

                      TikTok Studio
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-t border-white/[0.07]">
                <div className="grid grid-cols-5 border-b border-white/[0.07] bg-[#0b0b0e]">
                  <div className="relative flex h-14 items-center justify-center">
                    <IconGrid className="h-6 w-6 text-white" />

                    <span className="absolute bottom-0 left-1/2 h-[2px] w-20 -translate-x-1/2 bg-white" />
                  </div>

                  <div className="flex h-14 items-center justify-center text-white/40">
                    <IconLock className="h-6 w-6" />
                  </div>

                  <div className="flex h-14 items-center justify-center text-white/40">
                    <IconRepeat className="h-7 w-7" />
                  </div>

                  <div className="flex h-14 items-center justify-center text-white/40">
                    <IconBookmark className="h-6 w-6" />
                  </div>

                  <div className="flex h-14 items-center justify-center text-white/40">
                    <IconHeart className="h-7 w-7" />
                  </div>
                </div>

                {/* TikTok grid */}
                <div className="grid grid-cols-3 gap-[2px] bg-[#08080a]">
                  {tiktokPosts.map(
                    (post, index) => (
                      <TikTokTile
                        key={post.id}
                        post={post}
                        clientName={clientName}
                        onClick={() =>
                          setSelectedIndex(index)
                        }
                      />
                    )
                  )}
                </div>

                <div className="py-8 text-center">
                  <p className="text-[12px] text-white/35">
                    {tiktokPosts.length} posts in
                    this preview
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* -------------------------------------------------------------- */
            /* FULL TIKTOK FEED                                                */
            /* -------------------------------------------------------------- */

            <div className="absolute inset-0 z-50 bg-black">
              {/* Top gradient */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-24 bg-gradient-to-b from-black/60 to-transparent" />

              {/* Back button */}
              <button
                type="button"
                onClick={() =>
                  setSelectedIndex(null)
                }
                className="absolute left-3 top-10 z-[110] flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-xl"
                aria-label="Back to TikTok profile"
              >
                <IconBack className="h-5 w-5" />
              </button>

              {/* Feed counter */}
              <div className="absolute right-3 top-10 z-[110] rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[9px] font-semibold text-white/80 backdrop-blur-xl">
                {selectedIndex + 1} /{" "}
                {tiktokPosts.length}
              </div>

              {/* Vertical TikTok feed */}
              <div
                ref={feedRef}
                className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
                style={{
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling:
                    "touch",
                }}
              >
                {tiktokPosts.map((post) => (
                  <TikTokSlide
                    key={post.id}
                    post={post}
                    clientName={clientName}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* -------------------------------------------------------------- */}
        {/* BOTTOM TIKTOK NAV                                               */}
        {/* -------------------------------------------------------------- */}

        {selectedIndex === null && (
          <div className="flex h-[64px] items-center justify-between border-t border-white/[0.07] bg-[#08080a] px-7 text-white">
            <div className="flex flex-col items-center gap-1">
              <div className="h-6 w-6 rounded-[7px] border-[2px] border-white" />

              <span className="text-[8px] font-medium">
                Home
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 text-white/40">
              <IconFootprints className="h-6 w-6" />

              <span className="text-[8px] font-medium">
                Friends
              </span>
            </div>

            <div className="flex h-8 w-10 items-center justify-center rounded-[9px] bg-white text-black shadow-sm">
              <span className="text-xl font-light leading-none">
                +
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 text-white/40">
              <IconComment className="h-6 w-6" />

              <span className="text-[8px] font-medium">
                Inbox
              </span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-[7px] font-bold text-white">
                {initials}
              </div>

              <span className="text-[8px] font-semibold">
                Profile
              </span>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-white/30">
        {tiktokPosts.length} TikTok post
        {tiktokPosts.length === 1 ? "" : "s"} planned
        for this calendar
      </p>
    </div>
  );
}