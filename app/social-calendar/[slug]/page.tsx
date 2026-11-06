import { complimentaryAccessSelect } from "@/lib/complimentaryAccess";
import { requirePostPlatform } from "@/lib/calendarPosts";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { publicUrlFor } from "@/lib/r2";
import { verifyViewerToken } from "@/lib/auth";
import { canAccessCalendar } from "@/lib/calendarPermissions";
import CalendarPasswordGate from "@/components/calendars/CalendarPasswordGate";
import ClientCalendarWorkspace from "@/components/calendars/ClientCalendarWorkspace";
import Image from "next/image";

export const dynamic = "force-dynamic";

type WorkspaceView =
  | "overview"
  | "calendar"
  | "instagram"
  | "tiktok"
  | "review";

function cookieNameFor(calendarId: string) {
  return `calendar_viewer_${calendarId}`;
}

function Icon({
  name,
  className = "",
}: {
  name:
    | "grid"
    | "calendar"
    | "instagram"
    | "tiktok"
    | "review"
    | "check"
    | "clock"
    | "message"
    | "lock"
    | "arrow"
    | "spark";
  className?: string;
}) {
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

    case "tiktok":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          aria-hidden="true"
        >
          <path d="M16.6 2h-3.3v13.8c0 1.5-1.2 2.7-2.7 2.7a2.7 2.7 0 1 1 0-5.4c.3 0 .5 0 .8.1V9.8a6.1 6.1 0 0 0-.8 0A6.1 6.1 0 1 0 16.6 15.9V8.5a8 8 0 0 0 4.6 1.5V6.7a4.8 4.8 0 0 1-4.6-4.7Z" />
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
          <path d="M5 12h13" />
          <path d="m13 6 6 6-6 6" />
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

function getView(value?: string): WorkspaceView {
  if (
    value === "overview" ||
    value === "calendar" ||
    value === "instagram" ||
    value === "tiktok" ||
    value === "review"
  ) {
    return value;
  }

  return "calendar";
}

function SidebarLink({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: ComponentProps<typeof Icon>["name"];
  label: string;
  count?: number;
}) {
  return (
    <a
      href={href}
      className={[
        "group flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-medium transition-all duration-200",
        active
          ? "bg-[#2478FF] text-white shadow-[0_10px_24px_rgba(36,120,255,0.22)]"
          : "text-white/45 hover:bg-white/[0.055] hover:text-white",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-white/12 text-white"
            : "bg-white/[0.035] text-white/40 group-hover:text-white/75",
        ].join(" ")}
      >
        <Icon name={icon} className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1 truncate">{label}</span>

      {typeof count === "number" && count > 0 && (
        <span
          className={[
            "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-bold",
            active
              ? "bg-white/15 text-white"
              : "bg-[#F7B742]/10 text-[#F7B742]",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </a>
  );
}

export default async function SocialCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeView = getView(resolvedSearchParams.view);

  const calendar = await db.socialCalendar.findUnique({
    where: { slug },
    include: {
      manager: {
  select: {
    id: true,
    contentWorkspacePlan: true,
    contentWorkspaceBillingStatus: true,
    contentWorkspaceBillingCycle: true,
    contentWorkspaceTrialEndsAt: true,
    ...complimentaryAccessSelect, isComped: true,
    compedUntil: true,
  },
},
      posts: {
        where: { deletedAt: null, isAiDraft: false, internalReviewStatus: "APPROVED" },
        orderBy: { postDate: "asc" },
        include: {
          assets: { orderBy: { displayOrder: "asc" } },
          videoComments: { orderBy: { videoTimestampSeconds: "asc" } },
          customFields: true,
        },
      },
    },
  });

  if (!calendar) notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get(cookieNameFor(calendar.id))?.value;
  const viewer = token ? verifyViewerToken(token, calendar.id) : null;

  if (!viewer) {
    return (
      <CalendarPasswordGate
        slug={slug}
        clientName={calendar.clientName}
      />
    );
  }

  if (!canAccessCalendar(calendar.manager)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08090B] px-6 text-white">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/15 bg-red-400/10">
            <Icon name="lock" className="h-6 w-6 text-white/60" />
          </div>
          <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Workspace unavailable
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            This workspace isn&apos;t active yet.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-white/45">
            Your content is safe. Check back once your manager has completed
            the workspace setup.
          </p>
        </div>
      </main>
    );
  }

  const desktopBannerUrl = calendar.headerBannerDesktopUrl
    ? publicUrlFor(calendar.headerBannerDesktopUrl)
    : null;

  const mobileBannerUrl = calendar.headerBannerMobileUrl
    ? publicUrlFor(calendar.headerBannerMobileUrl)
    : null;

  const displayTitle =
    calendar.headerTitle ||
    `${calendar.clientName}'s Content Calendar`;

  const displayDescription =
    calendar.headerDescription ||
    "Your marketing workspace — everything planned, presented and ready for review.";

  const totalPosts = calendar.posts.length;
  const approvedPosts = calendar.posts.filter(
    (p) => p.approvalStatus === "APPROVED",
  ).length;
  const pendingPosts = calendar.posts.filter(
    (p) => p.approvalStatus === "PENDING",
  ).length;
  const revisionPosts = calendar.posts.filter(
    (p) => p.approvalStatus === "NEEDS_REVISION",
  ).length;
  const totalAssets = calendar.posts.reduce(
    (sum, p) => sum + p.assets.length,
    0,
  );

  const approvalPercentage =
    totalPosts > 0 ? Math.round((approvedPosts / totalPosts) * 100) : 0;

  const reviewCount = pendingPosts + revisionPosts;


  type SerializedAssetMediaType = "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";

  const normalizeAssetMediaType = (
    mediaType: string,
  ): SerializedAssetMediaType => {
    switch (mediaType) {
      case "VIDEO":
        return "VIDEO";
      case "DOCUMENT":
        return "DOCUMENT";
      case "PDF":
        return "PDF";
      case "PHOTO":
      case "IMAGE":
      default:
        return "PHOTO";
    }
  };

  const serializedPosts = calendar.posts.map((p) => ({
    id: p.id,
    postDate: p.postDate.toISOString(),
    platform: requirePostPlatform(p.platform),
    postType: p.postType,
    category: p.category,
    caption: p.caption,
    contentIdea: p.contentIdea,
    cta: p.cta,
    hashtags: p.hashtags,
    taggedAccounts: p.taggedAccounts,
    linkUrl: p.linkUrl,
    approvalStatus: p.approvalStatus,
    approvalNote: p.approvalNote,
    assets: p.assets.map((a) => ({
      id: a.id,
      mediaType: normalizeAssetMediaType(String(a.mediaType)),
      contentUrl: publicUrlFor(a.fileKey),
        posterUrl: a.posterFileKey ? publicUrlFor(a.posterFileKey) : null,
    })),
    videoComments: p.videoComments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      note: c.note,
      videoTimestampSeconds: c.videoTimestampSeconds,
    })),
    customFields: p.customFields.map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value,
    })),
  }));

  return (
    <ClientCalendarWorkspace
      slug={slug}
      clientName={calendar.clientName}
      planStatus={calendar.planStatus}
      displayTitle={displayTitle}
      displayDescription={displayDescription}
      desktopBannerUrl={desktopBannerUrl}
      mobileBannerUrl={mobileBannerUrl}
      posts={serializedPosts}
      stats={{
        totalPosts,
        approvedPosts,
        pendingPosts,
        revisionPosts,
        totalAssets,
        approvalPercentage,
      }}
    />
  );
}
