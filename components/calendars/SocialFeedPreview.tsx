"use client";
import { buildCaption } from "@/lib/publishing/state";
import { calendarWorkflow } from "@/lib/calendarWorkflow";

import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, FileText, Heart, MessageCircle, Repeat2, Send, ThumbsUp } from "lucide-react";
type PreviewPost = {
  internalReviewStatus?: string; publishStatus?: string; instagramPublishStatus?: string; tikTokPublishStatus?: string; isAiDraft?: boolean;
  id: string; postDate: string; platform: string; caption: string | null; cta?: string | null;
  contentIdea: string | null; hashtags: string | null; taggedAccounts: string | null;
  linkUrl: string | null; approvalStatus: "PENDING" | "APPROVED" | "NEEDS_REVISION";
  assets: { id: string; mediaType: "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF"; contentUrl: string; posterUrl?: string | null }[];
};

type Channel = "linkedin" | "facebook" | "x";
const CHANNELS = {
  linkedin: { name: "LinkedIn", platform: "LINKEDIN", mark: "in", color: "#0A66C2" },
  facebook: { name: "Facebook", platform: "FACEBOOK", mark: "f", color: "#1877F2" },
  x: { name: "X", platform: "X", mark: "𝕏", color: "#171717" },
};
const STATUS = {
  PENDING: { label: "Awaiting review", className: "bg-amber-50 text-amber-800" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-800" },
  NEEDS_REVISION: { label: "Changes requested", className: "bg-orange-50 text-orange-800" },
};

function FeedPost({ post, clientName, channel, onOpen }: { post: PreviewPost; clientName: string; channel: Channel; onOpen: () => void }) {
  const [assetIndex, setAssetIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const asset = post.assets[Math.min(assetIndex, post.assets.length - 1)];
  const caption = buildCaption({ ...post, linkUrl: undefined });
  const status = STATUS[post.approvalStatus];
  const isX = channel === "x";
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center bg-[#2478FF]/10 text-sm font-bold text-[#1768E8] ${channel === "linkedin" ? "rounded-lg" : "rounded-full"}`} aria-hidden="true">{clientName.slice(0, 2).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold">{clientName}</p>
          {isX && <p className="truncate text-xs text-slate-500">@{clientName.toLowerCase().replace(/[^a-z0-9_]/g, "") || "yourbrand"}</p>}
          <time dateTime={post.postDate} className="text-xs text-slate-500">{new Date(post.postDate).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${status.className}`}>{calendarWorkflow(post).label}</span>
      </div>
      <div className="px-4 pb-4 sm:px-5">
        {!caption && <p className="text-sm text-slate-500">{post.contentIdea || "Add a caption in the post editor."}</p>}
        {caption && <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${!expanded && caption.length > 320 ? "line-clamp-5" : ""}`}>{caption}</p>}
        {caption.length > 320 && <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="mt-2 min-h-9 text-xs font-semibold text-[#1768E8] hover:underline">{expanded ? "Show less" : "Read more"}</button>}
        {post.linkUrl && <a href={/^https?:\/\//i.test(post.linkUrl) ? post.linkUrl : `https://${post.linkUrl}`} target="_blank" rel="noopener noreferrer" className="mt-3 block truncate text-sm text-[#1768E8] hover:underline">{post.linkUrl}</a>}
      </div>
      {asset && <div className="relative border-y border-slate-100 bg-slate-50">
        {asset.mediaType === "PHOTO" ? <img src={asset.contentUrl} alt={post.contentIdea || "Post attachment"} loading="lazy" className="max-h-[520px] w-full object-contain" /> : asset.mediaType === "VIDEO" ? <video key={asset.id} poster={asset.posterUrl ?? undefined} src={asset.contentUrl} controls preload={asset.posterUrl ? "none" : "metadata"} playsInline className="max-h-[520px] w-full" /> : <a href={asset.contentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-6 text-sm font-medium text-[#1768E8]"><FileText className="h-6 w-6" />Open attached document<ArrowUpRight className="h-4 w-4" /></a>}
        {post.assets.length > 1 && <div className="flex items-center justify-center gap-4 border-t border-slate-200 bg-white py-2">
          <button type="button" aria-label="Previous attachment" disabled={assetIndex === 0} onClick={() => setAssetIndex(assetIndex - 1)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-xs tabular-nums text-slate-500">{assetIndex + 1} / {post.assets.length}</span>
          <button type="button" aria-label="Next attachment" disabled={assetIndex >= post.assets.length - 1} onClick={() => setAssetIndex(assetIndex + 1)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>}
      </div>}
      <div aria-hidden="true" className="flex flex-wrap items-center justify-around gap-3 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
        <span className="flex items-center gap-2">{isX ? <Heart size={16} /> : <ThumbsUp size={16} />}Like</span>
        <span className="flex items-center gap-2"><MessageCircle size={16} />{isX ? "Reply" : "Comment"}</span>
        <span className="flex items-center gap-2">{channel === "linkedin" || isX ? <Repeat2 size={16} /> : <Send size={16} />}{isX ? "Repost" : "Share"}</span>
      </div>
      <button type="button" onClick={onOpen} className="flex min-h-12 w-full items-center justify-between px-4 text-xs font-semibold text-[#1768E8] transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-blue-600 sm:px-5">Review post<ArrowUpRight className="h-4 w-4" /></button>
    </article>
  );
}

export default function SocialFeedPreview<T extends PreviewPost>({ posts, clientName, channel, onOpen, onClearFilters, filtersActive }: { posts: T[]; clientName: string; channel: Channel; onOpen: (post: T) => void; onClearFilters: () => void; filtersActive: boolean }) {
  const config = CHANNELS[channel];
  const feed = posts.filter((post) => post.platform === config.platform).sort((a, b) => new Date(b.postDate).getTime() - new Date(a.postDate).getTime());
  return (
    <div className="mx-auto max-w-2xl pb-6">
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-current/10 p-4">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-white" style={{ background: config.color }}>{config.mark}</span>
        <div className="min-w-0"><h3 className="text-sm font-semibold">Your {config.name} feed</h3><p className="mt-1 text-xs opacity-60">{feed.length} {feed.length === 1 ? "post" : "posts"} · Layout preview. Published appearance may vary.</p></div>
      </div>
      {feed.length ? <div className="space-y-5">{feed.map((post) => <FeedPost key={post.id} post={post} clientName={clientName} channel={channel} onOpen={() => onOpen(post)} />)}</div> : <div className="rounded-2xl border border-dashed border-current/20 px-6 py-14 text-center"><h3 className="font-semibold">No {config.name} posts to preview</h3><p className="mt-2 text-sm opacity-60">{filtersActive ? "Try clearing your filters to see more content." : `Create or import a ${config.name} post to start shaping your feed.`}</p>{filtersActive && <button type="button" onClick={onClearFilters} className="mt-5 min-h-11 rounded-full bg-[#2478FF] px-5 text-sm font-semibold text-white">Clear filters</button>}</div>}
    </div>
  );
}
