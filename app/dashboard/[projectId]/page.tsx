import ShowworkLogo from "@/components/brand/ShowworkLogo";
import DeliveryOverview from "@/components/projects/DeliveryOverview";
import DeliveryWorkStudio from "@/components/projects/DeliveryWorkStudio";
import workspaceStyles from "@/components/projects/DeliveryWorkspace.module.css";
import DeliveryHelpLink from "@/components/help/DeliveryHelpLink";
import { syncVerifiedPayment } from "@/lib/paymentSync";
import { hasDeliveryPaidAccess } from "@/lib/complimentaryAccess";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicUrlFor } from "@/lib/r2";
import { appUrl } from "@/lib/url";
import FileGridItem from "@/components/FileGridItem";
import CopyLinkButton from "@/components/CopyLinkButton";
import AddMoreFilesButton from "@/components/AddMoreFilesButton";
import SectionHeader from "@/components/SectionHeader";
import DeliveryStatusControl from "@/components/DeliveryStatusControl";
import EditableField from "@/components/EditableField";
import CollaboratorsPanel from "@/components/CollaboratorsPanel";
import ResponsiveSidebar from "@/components/navigation/ResponsiveSidebar";
import ProjectTabController from "@/components/ProjectTabController";
import type { CSSProperties, ReactNode } from "react";

const MAX_ADDITIONAL_UPLOAD_BATCHES = 3;

const COLOR = {
  black: "#123EA8",
  gold: "#2563EB",
  goldSoft: "#1D4ED8",
  orange: "#EA580C",
  panel: "#121419",
};

type WorkspaceView = "overview" | "work" | "access" | "team" | "activity";

function IconArrowLeft({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function IconArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

function IconExternal({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function IconDownload({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}

function IconOverview({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function IconGlobe({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-6.5-3.6-9S9.6 5.5 12 3Z" />
    </svg>
  );
}

function IconUsers({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M16 4.5a4 4 0 0 1 0 7.5" />
      <path d="M17 14a6 6 0 0 1 5 6" />
    </svg>
  );
}

function IconFiles({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="12" height="16" rx="2" />
      <path d="M8 7h5M8 11h5M8 15h3" />
      <path d="M16 7h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-1" />
    </svg>
  );
}

function IconActivity({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 15 3-4 3 2 5-7" />
    </svg>
  );
}

function IconPlus({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function IconRevision({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
      <path d="M4 4v4.6h4.6" />
    </svg>
  );
}

function IconLock({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2" />
    </svg>
  );
}

function IconShield({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 20 6v5.5c0 4.7-3.2 7.9-8 9.5-4.8-1.6-8-4.8-8-9.5V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function IconSpark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
      <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
    </svg>
  );
}

function IconChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  icon,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "rgba(37,99,235,0.08)", color: "#2563EB" }}
        >
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]/70">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-900 sm:text-2xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function Stat({
  value,
  label,
  tone = "default",
}: {
  value: string | number;
  label: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-orange-600"
        : "text-slate-900";

  return (
    <div className="showwork-lift rounded-[22px] border border-slate-200 bg-slate-50 p-5">
      <p className={`text-2xl font-semibold tracking-[-0.03em] ${toneClass}`}>{value}</p>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function WorkspaceNavItem({
  href,
  label,
  description,
  active,
  icon,
  badge,
}: {
  href: string;
  label: string;
  description: string;
  active: boolean;
  icon: ReactNode;
  badge?: string | number;
}) {
  return (
   <Link
  href={href}
  scroll={false}
  data-workspace-tab={href.split("view=")[1] ?? "overview"}
  data-workspace-nav={href.split("view=")[1] ?? "overview"}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : "false"}
      className="showwork-nav-link group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-white/72 transition-all"
    >
      <span
        className="showwork-nav-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/75 transition-colors"
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold">{label}</span>
          {badge !== undefined ? (
            <span className="showwork-nav-badge rounded-full bg-white/[0.045] px-2 py-0.5 text-[9px] font-semibold text-white/65">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-white/65">{description}</span>
      </span>
    </Link>
  );
}

function MobileNavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      data-workspace-tab={href.split("view=")[1] ?? "overview"}
      data-workspace-nav={href.split("view=")[1] ?? "overview"}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : "false"}
      className="showwork-mobile-nav shrink-0 rounded-full border border-white/20 bg-white/[0.08] px-4 py-2.5 text-xs font-semibold text-white/65 transition"
    >
      {label}
    </Link>
  );
}

function PaymentReleasePanel({
  projectId,
  status,
}: {
  projectId: string;
  status: "DELIVERED" | "APPROVED" | "PAID";
}) {
  const paid = status === "PAID";
  const approved = status === "APPROVED" || paid;

  return (
    <section
  className={[
    "relative mb-16 mt-10 overflow-hidden rounded-[32px] border bg-white",
    "shadow-[0_28px_80px_-44px_rgba(37,99,235,0.32)]",
    paid
      ? "border-emerald-200/80"
      : "border-blue-100/90",
  ].join(" ")}
>
  {/* Ambient background */}
  <div
    aria-hidden
    className={[
      "pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full blur-3xl",
      paid ? "bg-emerald-300/10" : "bg-blue-400/10",
    ].join(" ")}
  />

  <div
    aria-hidden
    className="pointer-events-none absolute -bottom-32 left-[35%] h-72 w-72 rounded-full bg-indigo-300/10 blur-3xl"
  />

  <div className="relative">
    {/* ─────────────────────────────────────────
        HEADER
    ───────────────────────────────────────── */}
    <div className="border-b border-blue-50/90 px-6 py-6 sm:px-8 sm:py-7 lg:px-9">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {/* Icon */}
          <div
            className={[
              "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              "shadow-[0_10px_30px_-16px_rgba(37,99,235,0.55)]",
              paid
                ? "bg-emerald-50 text-emerald-600"
                : "bg-blue-50 text-blue-600",
            ].join(" ")}
          >
            {paid ? (
              <IconShield className="h-6 w-6" />
            ) : (
              <IconLock className="h-6 w-6" />
            )}

            <span
              className={[
                "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
                paid ? "bg-emerald-500" : "bg-blue-500",
              ].join(" ")}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Delivery & payment
              </p>

              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em]",
                  paid
                    ? "bg-emerald-50 text-emerald-700"
                    : approved
                      ? "bg-amber-50 text-amber-700"
                      : "bg-blue-50 text-blue-700",
                ].join(" ")}
              >
                {paid
                  ? "Downloads unlocked"
                  : approved
                    ? "Payment required"
                    : "Awaiting approval"}
              </span>
            </div>

            <h2 className="mt-2 text-xl font-bold tracking-[-0.035em] text-slate-950 sm:text-2xl">
              {paid
                ? "Your delivery is complete."
                : approved
                  ? "The client has approved the delivery."
                  : "Keep the delivery moving."}
            </h2>

            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              {paid
                ? "Payment has been confirmed and your client can now download the delivered files."
                : approved
                  ? "The work has been approved. Downloads remain locked until you confirm that payment has been received."
                  : "Move the project through delivery, approval and payment. Downloads remain locked until payment is confirmed."}
            </p>
          </div>
        </div>

        {/* Current state */}
        <div
          className={[
            "flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3",
            paid
              ? "border-emerald-100 bg-emerald-50/70"
              : "border-blue-100 bg-blue-50/50",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-9 w-9 items-center justify-center rounded-xl",
              paid
                ? "bg-white text-emerald-600 shadow-sm"
                : "bg-white text-blue-600 shadow-sm",
            ].join(" ")}
          >
            {paid ? (
              <IconShield className="h-4.5 w-4.5" />
            ) : (
              <IconLock className="h-4.5 w-4.5" />
            )}
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Current state
            </p>

            <p
              className={[
                "mt-0.5 text-xs font-bold",
                paid ? "text-emerald-700" : "text-blue-700",
              ].join(" ")}
            >
              {paid
                ? "Paid · Downloads unlocked"
                : status === "APPROVED"
                  ? "Approved · Payment pending"
                  : "Delivered · Awaiting approval"}
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* ─────────────────────────────────────────
        JOURNEY / STEPPER
    ───────────────────────────────────────── */}
    

    {/* ─────────────────────────────────────────
        STATUS CONTROL
    ───────────────────────────────────────── */}
    <div className="border-t border-blue-50/90 bg-slate-50/30 px-6 py-7 sm:px-8 lg:px-9">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Manage delivery
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Update the status as the client moves through the workflow.
          </p>
        </div>

        {!paid && (
          <div className="hidden items-center gap-1.5 rounded-full border border-blue-100 bg-white px-3 py-1.5 sm:flex">
            <IconLock className="h-3 w-3 text-blue-500" />

            <span className="text-[9px] font-semibold text-slate-500">
              Downloads remain locked
            </span>
          </div>
        )}

        {paid && (
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 sm:flex">
            <IconShield className="h-3 w-3 text-emerald-600" />

            <span className="text-[9px] font-semibold text-emerald-700">
              Downloads unlocked
            </span>
          </div>
        )}
      </div>

      <DeliveryStatusControl
        projectId={projectId}
        currentStatus={status}
      />
    </div>
  </div>
</section>
  );
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string; payment?: string; reference?: string; trxref?: string }>;
}) {
  const creator = await getCurrentCreator();

  if (!creator) {
    redirect("/login");
  }

  const { projectId } = await params;
  const { view, payment, reference, trxref } = await searchParams;

  const allowedViews: WorkspaceView[] = ["overview", "work", "access", "team", "activity"];
  const activeView: WorkspaceView = allowedViews.includes(view as WorkspaceView)
    ? (view as WorkspaceView)
    : "overview";

  let project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      media: {
        orderBy: { displayOrder: "asc" },
        include: {
          reviews: { orderBy: { createdAt: "asc" } },
          videoComments: { orderBy: { createdAt: "asc" } },
        },
      },
      sections: {
        orderBy: { displayOrder: "asc" },
        include: {
          media: {
            where: { folderId: null },
            orderBy: { displayOrder: "asc" },
            include: {
              reviews: { orderBy: { createdAt: "asc" } },
              videoComments: { orderBy: { createdAt: "asc" } },
            },
          },
          folders: {
            orderBy: { displayOrder: "asc" },
            include: {
              media: {
                orderBy: { displayOrder: "asc" },
                include: {
                  reviews: { orderBy: { createdAt: "asc" } },
                  videoComments: { orderBy: { createdAt: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project || project.creatorId !== creator.id) {
    notFound();
  }

  const callbackReference=reference??trxref;
  if(payment==="callback"&&callbackReference?.startsWith(`spotlite_${project.id}_`)) {
    const {payment:receipt}=await syncVerifiedPayment(callbackReference,undefined,{expectedCreatorId:creator.id});
    if(receipt.type!=="PROJECT_ONE_TIME")throw new Error("Payment does not belong to this delivery");
    await db.project.update({where:{id:project.id},data:{paid:true,paidAt:receipt.createdAt,badgeVisible:false}});
    redirect(`/dashboard/${project.id}`);
  }

  const viewerEmails = await db.viewerEmail.findMany({
    where: { projectId: project.id },
    orderBy: { viewedAt: "desc" },
  });

  const isLive = true;
  const isPaid = project.deliveryStatus === "PAID";
  const liveUrl = `${appUrl()}/${project.slug}`;
  const totalFiles = project.media.length;
  const approvedCount = project.media.filter((m) => m.approvalStatus === "APPROVED").length;
  const needsRevisionCount = project.media.filter((m) => m.approvalStatus === "NEEDS_REVISION").length;
  const pendingCount = totalFiles - approvedCount - needsRevisionCount;
  const allApproved = totalFiles > 0 && approvedCount === totalFiles;
  const ungroupedMedia = project.media.filter((m) => !m.sectionId);

  const uploadSessionsRemaining =
    hasDeliveryPaidAccess(creator)
      ? Infinity
      : MAX_ADDITIONAL_UPLOAD_BATCHES - project.additionalUploadCount;

  const sectionsWithFiles = project.sections.filter(
    (section) =>
      section.media.length > 0 ||
      section.folders.some((folder) => folder.media.length > 0)
  ).length;

  const progressPercent =
    totalFiles > 0 ? Math.round((approvedCount / totalFiles) * 100) : 0;

  const viewHref = (nextView: WorkspaceView) =>
    `/dashboard/${project.id}?view=${nextView}`;

  const pageMeta: Record<
    WorkspaceView,
    { eyebrow: string; title: string; description: string }
  > = {
    overview: {
      eyebrow: "Project overview",
      title: "Project overview",
      description:
        "See what’s ready, what needs attention, and what to do next.",
    },
    work: {
      eyebrow: "The work",
      title: "Project files",
      description:
        "Upload your work, review client feedback, and manage approvals.",
    },
    access: {
      eyebrow: "Client access",
      title: "Control the client experience.",
      description:
        "Share the live delivery portal and manage the access code your client uses to enter it.",
    },
    team: {
      eyebrow: "Collaboration",
      title: "The people behind the project.",
      description:
        "Manage the teammates and collaborators who can help move this delivery forward.",
    },
    activity: {
      eyebrow: "Client activity",
      title: "See who is showing up.",
      description:
        "Understand who has opened the delivery and when they last visited.",
    },
  };

  return (
    <main className={`${workspaceStyles.frame} min-h-screen overflow-x-clip bg-[#F5F8FD] text-slate-900`} data-theme-root>
      {/* Minimal ambient background */}
      <div aria-hidden className={`${workspaceStyles.ambient} pointer-events-none fixed inset-0 overflow-hidden`}>
        <div className="absolute -left-48 -top-48 h-[520px] w-[520px] rounded-full bg-blue-100/40 blur-[120px]" />
        <div className="absolute right-[-180px] top-[28%] h-[420px] w-[420px] rounded-full bg-sky-100/40 blur-[130px]" />
      </div>

      <style>{`
        .showwork-lift {
          transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s ease, border-color .22s ease, background-color .22s ease;
        }
        .showwork-lift:hover {
          transform: translateY(-3px);
          box-shadow: 0 22px 55px -34px rgba(15,23,42,.42);
        }
        .showwork-nav-link {
          transition: transform .2s ease, background-color .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .showwork-nav-link:hover {
          transform: translateX(3px);
        }
        @keyframes showworkPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(37,99,235,.18); }
          50% { box-shadow: 0 0 0 7px rgba(37,99,235,0); }
        }
        .showwork-live-dot { animation: showworkPulse 2.2s ease-out infinite; }
        .theme-content [class*="border-"] {
          border-color: rgba(37,99,235,.20) !important;
        }
        .theme-content .border-blue-100,
        .theme-content .border-blue-200,
        .theme-content .border-blue-300 {
          border-color: rgba(37,99,235,.28) !important;
        }
        .showwork-nav-link[data-active="true"] {
          border-color: rgba(255,255,255,.22) !important;
          background: #1768e8 !important;
          color: #fff !important;
          box-shadow: 0 14px 34px -22px rgba(0,0,0,.5);
        }
        .showwork-nav-link[data-active="true"] .showwork-nav-icon {
          background: transparent;
          color: #fff;
          box-shadow: none;
        }
        .showwork-nav-link[data-active="true"] .showwork-nav-badge {
          background: rgba(255,255,255,.18);
          color: #fff;
        }
        .showwork-nav-link:not([data-active="true"]):hover {
          transform: translateX(3px);
          border-color: rgba(255,255,255,.16);
          background: rgba(255,255,255,.09);
          color: #fff;
        }
        .showwork-mobile-nav[data-active="true"] {
          border-color: rgba(255,255,255,.35);
          background: rgba(255,255,255,.18);
          color: #fff;
          box-shadow: 0 10px 25px -18px rgba(0,0,0,.55);
        }
        [data-workspace-panel][hidden],
        [data-workspace-title][hidden] {
          display: none !important;
        }

        [data-theme-root]:has(#theme-toggle:checked) .theme-content {
          background: #080b12;
          color: #f8fafc;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .bg-white {
          background-color: #101722 !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .bg-slate-50 {
          background-color: #141c28 !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .bg-slate-100 {
          background-color: #1a2432 !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content [class*="border-slate-"] {
          border-color: rgba(96,165,250,.28) !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content [class*="text-slate-900"] {
          color: #f8fafc !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content [class*="text-slate-700"],
        [data-theme-root]:has(#theme-toggle:checked) .theme-content [class*="text-slate-600"],
        [data-theme-root]:has(#theme-toggle:checked) .theme-content [class*="text-slate-500"] {
          color: #94a3b8 !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content [class*="text-slate-400"] {
          color: #64748b !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .text-blue-700 {
          color: #93c5fd !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .bg-blue-50 {
          background-color: rgba(37,99,235,.16) !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .border-blue-200 {
          border-color: rgba(96,165,250,.25) !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .text-emerald-600 {
          color: #6ee7b7 !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .text-orange-600 {
          color: #fdba74 !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .divide-slate-200 > :not([hidden]) ~ :not([hidden]) {
          border-color: rgba(96,165,250,.28) !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .bg-blue-50 {
          background-color: rgba(37,99,235,.14) !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .bg-emerald-100 {
          background-color: rgba(16,185,129,.14) !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .bg-amber-100 {
          background-color: rgba(245,158,11,.14) !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .bg-slate-100 {
          background-color: #1a2432 !important;
        }
        [data-theme-root]:has(#theme-toggle:checked) .theme-content .bg-white\/75 {
          background-color: rgba(16,23,34,.75) !important;
        }
      `}</style>

      <ProjectTabController initialView={activeView} />

      {/* Top bar */}
      <header className={`${workspaceStyles.toolbar} fixed inset-x-0 top-0 z-[100] border-b border-white/15 bg-gradient-to-r from-[#123EA8] via-[#2563EB] to-[#4F8CFF] shadow-[0_18px_55px_-28px_rgba(20,68,180,.9)]`}>
        <div className={`${workspaceStyles.toolbarInner} mx-auto flex h-[68px] max-w-[1600px] items-center justify-between pl-16 pr-4 sm:pl-16 sm:pr-6 lg:px-8`}>
          <Link
            href="/dashboard/projects"
            className="group inline-flex items-center gap-2.5 text-sm text-white/80 transition hover:text-white"
          >
            <IconArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">All projects</span>
            <span className="sm:hidden">Projects</span>
          </Link>

          <div className="flex min-w-0 items-center gap-3"><DeliveryHelpLink className="max-sm:px-2 max-sm:text-[10px]"/>
            <div className="hidden min-w-0 items-center gap-3 md:flex">
              <span className="max-w-[260px] truncate text-xs font-medium text-white/90">
                {project.clientName}
              </span>
              <span className="h-3 w-px bg-white/25" />
            </div>

            <span data-live={isLive} className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-100">
              <span className="showwork-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {isLive ? "Live" : "Offline"}
            </span>

            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-white/15 sm:inline-flex"
            >
              Client view
              <IconExternal className="h-3.5 w-3.5" />
            </a>

            <label
              htmlFor="theme-toggle"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
              title="Toggle dark mode"
            >
              <input id="theme-toggle" type="checkbox" className="sr-only" />
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            </label>
          </div>
        </div>
      </header>

      {/* Mobile project identity */}
      <div className="relative z-20 border-b border-blue-800 bg-[#2563EB] px-4 pb-4 pt-[88px] text-white lg:hidden sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/65">
              Project workspace
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-[-0.03em]">
              {project.clientName}
            </h1>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold text-white">{progressPercent}%</p>
            <p className="text-[9px] uppercase tracking-[0.1em] text-slate-400">approved</p>
          </div>
        </div>

        <div className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            <MobileNavItem href={viewHref("overview")} label="Overview" active={activeView === "overview"} />
            <MobileNavItem href={viewHref("work")} label={`Work · ${totalFiles}`} active={activeView === "work"} />
            <MobileNavItem href={viewHref("access")} label="Client access" active={activeView === "access"} />
            <MobileNavItem href={viewHref("team")} label="Team" active={activeView === "team"} />
            <MobileNavItem href={viewHref("activity")} label={`Activity · ${viewerEmails.length}`} active={activeView === "activity"} />
          </div>
        </div>
      </div>

      <div className={`${workspaceStyles.layout} relative z-10 min-h-screen lg:pl-[292px]`}>
        {/* Desktop sidebar — fixed independently from the document scroll */}
        <ResponsiveSidebar label="Project navigation" drawerClassName="bg-gradient-to-b from-[#123EA8] via-[#2563EB] to-[#17398F] text-white" desktopClassName={`${workspaceStyles.rail} fixed bottom-0 left-0 top-[68px] z-[90] hidden w-[292px] border-r border-white/15 bg-gradient-to-b from-[#123EA8] via-[#2563EB] to-[#17398F] text-white shadow-[22px_0_60px_-36px_rgba(18,62,168,.9)] lg:flex lg:flex-col`}>
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="absolute -right-20 bottom-16 h-72 w-72 rounded-full bg-indigo-950/25 blur-3xl" />
          </div>
          <div className={`${workspaceStyles.railIdentity} relative border-b border-white/15 p-5`}>
            <Link href="/dashboard" className={workspaceStyles.brand}><ShowworkLogo tone="white"/></Link>
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[white]">
              Project workspace
            </p>

            <div className="mt-3 min-w-0">
              <EditableField
                projectId={project.id}
                field="clientName"
                value={project.clientName}
                displayClassName="block max-w-full truncate text-xl font-semibold tracking-[-0.03em] text-white"
                inputClassName="w-full rounded-xl bg-white/10 px-3 py-2 text-base font-semibold text-white"
                confirmMessage="Renaming this project will also change its link. Any link you've already sent your client will stop working. Continue?"
              />
            </div>

            <div className={`${workspaceStyles.progressCard} mt-5 rounded-2xl border border-white/20 bg-white/[0.12] p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-white/65">Approval progress</span>
                <span className="text-xs font-semibold text-white">{progressPercent}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progressPercent}%`, background: COLOR.gold }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[9px] text-white/50">
                <span>{approvedCount} approved</span>
                <span>{totalFiles} files</span>
              </div>
            </div>
          </div>

          <nav className="relative flex-1 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <p className="px-3 pb-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Workspace
            </p>

            <div className="space-y-1">
              <WorkspaceNavItem
                href={viewHref("overview")}
                label="Overview"
                description="Status and project health"
                active={activeView === "overview"}
                icon={<IconOverview className="h-[17px] w-[17px]" />}
              />
              <WorkspaceNavItem
                href={viewHref("work")}
                label="Work"
                description="Files, feedback and approvals"
                active={activeView === "work"}
                icon={<IconFiles className="h-[17px] w-[17px]" />}
                badge={totalFiles}
              />
            </div>

            <p className="px-3 pb-2 pt-6 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Client
            </p>

            <div className="space-y-1">
              <WorkspaceNavItem
                href={viewHref("access")}
                label="Client access"
                description="Portal link and access code"
                active={activeView === "access"}
                icon={<IconGlobe className="h-[17px] w-[17px]" />}
              />
              <WorkspaceNavItem
                href={viewHref("activity")}
                label="Activity"
                description="Who has viewed the project"
                active={activeView === "activity"}
                icon={<IconActivity className="h-[17px] w-[17px]" />}
                badge={viewerEmails.length}
              />
            </div>

            <p className="px-3 pb-2 pt-6 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Collaboration
            </p>

            <WorkspaceNavItem
              href={viewHref("team")}
              label="Team"
              description="People working on delivery"
              active={activeView === "team"}
              icon={<IconUsers className="h-[17px] w-[17px]" />}
            />
          </nav>

          <div className="relative border-t border-white/15 p-3">
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-semibold text-white transition hover:bg-white/15"
            >
              <span>Open client portal</span>
              <IconExternal className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>

            <a
              href={`/api/projects/${project.id}/report`}
              download
              className="mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <IconDownload className="h-3.5 w-3.5" />
              Download project report
            </a>
          </div>
        </ResponsiveSidebar>

        {/* Main content */}
        <section className={`${workspaceStyles.content} theme-content min-h-screen min-w-0 lg:pt-[68px]`}>
          <div className={`${workspaceStyles.contentInner} mx-auto max-w-[1120px] px-4 pb-24 pt-8 sm:px-6 md:pt-10 lg:px-10 lg:pb-28 lg:pt-12`}>
            {/* Page title */}
            <div className={`${workspaceStyles.contentHeading} mb-9 border-b border-blue-200/70 pb-8`}>
              {(Object.keys(pageMeta) as WorkspaceView[]).map((viewKey) => {
                const meta = pageMeta[viewKey];
                return (
                  <div key={viewKey} data-workspace-title={viewKey} hidden={viewKey !== activeView}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#1D4ED8]/70">
                      {meta.eyebrow}
                    </p>
                    <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-slate-900 sm:text-4xl md:text-[46px]">
                      {meta.title}
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
                      {meta.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* =====================================================
                OVERVIEW
            ====================================================== */}
            <div data-workspace-panel="overview" hidden={activeView !== "overview"}>
              <DeliveryOverview projectId={project.id} totalFiles={totalFiles} approvedCount={approvedCount} revisionCount={needsRevisionCount} pendingCount={pendingCount} visits={viewerEmails.length} status={project.deliveryStatus} liveUrl={liveUrl}/>
            </div>

            {/* =====================================================
                WORK
            ====================================================== */}
            <div data-workspace-panel="work" hidden={activeView !== "work"}>
              <DeliveryWorkStudio
                sections={[
                  ...project.sections.map(section => {
                    const media = [...section.media, ...section.folders.flatMap(folder => folder.media)];
                    return { id: section.id, name: section.name, count: media.length,
                      pending: media.filter(file => file.approvalStatus === "PENDING").length,
                      revisions: media.filter(file => file.approvalStatus === "NEEDS_REVISION").length,
                      approved: media.filter(file => file.approvalStatus === "APPROVED").length };
                  }),
                  ...(ungroupedMedia.length ? [{ id: "ungrouped", name: "Other files", count: ungroupedMedia.length,
                    pending: ungroupedMedia.filter(file => file.approvalStatus === "PENDING").length,
                    revisions: ungroupedMedia.filter(file => file.approvalStatus === "NEEDS_REVISION").length,
                    approved: ungroupedMedia.filter(file => file.approvalStatus === "APPROVED").length }] : []),
                ]}
                uploadAction={<AddMoreFilesButton projectId={project.id} remaining={uploadSessionsRemaining} />}
                releasePanel={<PaymentReleasePanel projectId={project.id} status={project.deliveryStatus} />}
              >
                    {project.sections.map((section) => (
                      <div key={section.id} data-delivery-section={section.id}>
                        <SectionHeader
                          projectId={project.id}
                          sectionId={section.id}
                          name={section.name}
                          mediaType={section.mediaType}
                          fileCount={
                            section.media.length +
                            section.folders.reduce(
                              (sum, folder) => sum + folder.media.length,
                              0
                            )
                          }
                          uploadSessionsRemaining={uploadSessionsRemaining}
                        />

                        {section.media.length > 0 && (
                          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                            {section.media.map((m) => (
                              <FileGridItem
                                key={m.id}
                                mediaId={m.id}
                                url={publicUrlFor(m.fileKey)} posterUrl={m.posterFileKey ? publicUrlFor(m.posterFileKey) : null}
                                filename={m.fileKey.split("/").pop() ?? "file"}
                                caption={m.caption}
                                type={m.type}
                                approvalStatus={m.approvalStatus}
                                approvalNote={m.approvalNote}
                                reviews={m.reviews.map((r) => ({
                                  reviewerName: r.reviewerName,
                                  reviewerEmail: r.reviewerEmail,
                                  status: r.status as "APPROVED" | "NEEDS_REVISION",
                                  note: r.note,
                                  createdAt: r.createdAt.toISOString(),
                                }))}
                                comments={m.videoComments.map((c) => ({
                                  id: c.id,
                                  reviewerName: c.reviewerName,
                                  reviewerEmail: c.reviewerEmail,
                                  note: c.note,
                                  videoTimestampSeconds: c.videoTimestampSeconds,
                                  createdAt: c.createdAt.toISOString(),
                                }))}
                              />
                            ))}
                          </div>
                        )}

                        {section.folders.map((folder) => (
                          <div
                            key={folder.id}
                            data-delivery-folder="true"
                            className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-5 sm:p-6"
                          >
                            <div className="mb-5 flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">
                                  {folder.name}
                                </p>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">
                                  {folder.media.length} file{folder.media.length === 1 ? "" : "s"}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                              {folder.media.map((m) => (
                                <FileGridItem
                                  key={m.id}
                                  mediaId={m.id}
                                  url={publicUrlFor(m.fileKey)} posterUrl={m.posterFileKey ? publicUrlFor(m.posterFileKey) : null}
                                  filename={m.fileKey.split("/").pop() ?? "file"}
                                  caption={m.caption}
                                  type={m.type}
                                  approvalStatus={m.approvalStatus}
                                  approvalNote={m.approvalNote}
                                  reviews={m.reviews.map((r) => ({
                                    reviewerName: r.reviewerName,
                                    reviewerEmail: r.reviewerEmail,
                                    status: r.status as "APPROVED" | "NEEDS_REVISION",
                                    note: r.note,
                                    createdAt: r.createdAt.toISOString(),
                                  }))}
                                  comments={m.videoComments.map((c) => ({
                                    id: c.id,
                                    reviewerName: c.reviewerName,
                                    reviewerEmail: c.reviewerEmail,
                                    note: c.note,
                                    videoTimestampSeconds: c.videoTimestampSeconds,
                                    createdAt: c.createdAt.toISOString(),
                                  }))}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}

                    {ungroupedMedia.length > 0 && (
                      <div data-delivery-section="ungrouped">
                        <div className="mb-5">
                          <p className="text-sm font-semibold text-slate-700">Other files</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">
                            {ungroupedMedia.length} file{ungroupedMedia.length === 1 ? "" : "s"}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                          {ungroupedMedia.map((m) => (
                            <FileGridItem
                              key={m.id}
                              mediaId={m.id}
                              url={publicUrlFor(m.fileKey)} posterUrl={m.posterFileKey ? publicUrlFor(m.posterFileKey) : null}
                              filename={m.fileKey.split("/").pop() ?? "file"}
                              caption={m.caption}
                              type={m.type}
                              approvalStatus={m.approvalStatus}
                              approvalNote={m.approvalNote}
                              reviews={m.reviews.map((r) => ({
                                reviewerName: r.reviewerName,
                                reviewerEmail: r.reviewerEmail,
                                status: r.status as "APPROVED" | "NEEDS_REVISION",
                                note: r.note,
                                createdAt: r.createdAt.toISOString(),
                              }))}
                              comments={m.videoComments.map((c) => ({
                                id: c.id,
                                reviewerName: c.reviewerName,
                                reviewerEmail: c.reviewerEmail,
                                note: c.note,
                                videoTimestampSeconds: c.videoTimestampSeconds,
                                createdAt: c.createdAt.toISOString(),
                              }))}
                            />
                          ))}
                        </div>
                      </div>
                    )}
              </DeliveryWorkStudio>
            </div>

            {/* =====================================================
                CLIENT ACCESS
            ====================================================== */}
            <div data-workspace-panel="access" hidden={activeView !== "access"}>
              <div>
                <SectionIntro
                  eyebrow="Client portal"
                  title="Give the client one clear way in."
                  description="Everything your client needs to access this delivery lives here."
                  icon={<IconGlobe className="h-5 w-5" />}
                />

                <DeliveryStatusControl projectId={project.id} currentStatus={project.deliveryStatus} compact />

                <div className="showwork-lift overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_22px_65px_-42px_rgba(15,23,42,.34)]">
                  <div className="border-b border-slate-200 p-6 sm:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">Client portal</span>
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Live
                          </span>
                        </div>
                        <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
                          Share this link with your client. It opens the polished,
                          client-facing version of this delivery.
                        </p>

                        <div className="mt-5 flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <a
                            href={liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 truncate text-xs font-medium text-[#1D4ED8]"
                          >
                            {liveUrl}
                          </a>
                          <CopyLinkButton url={liveUrl} appearance="light" label="Copy client portal link" />
                        </div>
                      </div>

                      <a
                        href={liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,.7)] transition hover:bg-[#1D4ED8]"
                      >
                        Open client portal
                        <IconExternal className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8">
                    <div className="showwork-lift rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Client access code
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            Your client uses this code to unlock the delivery.
                          </p>
                        </div>

                        {project.accessCode ? (
                          <div className="flex items-center gap-3">
                            <EditableField
                              projectId={project.id}
                              field="accessCode"
                              value={project.accessCode}
                              displayClassName="rounded-xl bg-white/[0.06] px-4 py-2.5 font-mono text-sm font-semibold tracking-[0.12em] text-slate-900"
                              displayStyle={{ background: "rgba(255,255,255,0.06)" }}
                              inputClassName="rounded-xl px-4 py-2.5 font-mono text-sm font-semibold text-slate-900"
                              monospace
                            />
                            <CopyLinkButton url={project.accessCode} appearance="light" label="Copy client access code" />
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs text-slate-500">No access code set</span>
                            <EditableField
                              projectId={project.id}
                              field="accessCode"
                              value=""
                              displayClassName="rounded-xl bg-[#2563EB]/10 px-4 py-2.5 text-xs font-semibold text-[#2563EB]"
                              displayStyle={{ background: "rgba(245,200,66,0.10)", color: COLOR.gold }}
                              inputClassName="rounded-xl px-4 py-2.5 font-mono text-sm font-semibold text-slate-900"
                              monospace
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5 sm:p-6">
                  <p className="text-xs font-semibold text-slate-700">A cleaner client experience</p>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                    The client portal is intentionally separate from this workspace.
                    Your team gets the controls; your client gets only the presentation,
                    review and approval experience they need.
                  </p>
                </div>
              </div>
            </div>

            {/* =====================================================
                TEAM
            ====================================================== */}
            <div data-workspace-panel="team" hidden={activeView !== "team"}>
              <div>
                <SectionIntro
                  eyebrow="Team"
                  title="People on this project"
                  description="Manage who can collaborate on this delivery."
                  icon={<IconUsers className="h-5 w-5" />}
                />

                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-1">
                  <CollaboratorsPanel projectId={project.id} />
                </div>
              </div>
            </div>

            {/* =====================================================
                ACTIVITY
            ====================================================== */}
            <div data-workspace-panel="activity" hidden={activeView !== "activity"}>
              <div>
                <SectionIntro
                  eyebrow="Client activity"
                  title="Who's viewing"
                  description="See who has accessed this delivery and when."
                  icon={<IconActivity className="h-5 w-5" />}
                />

                {viewerEmails.length === 0 ? (
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-6 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                      <IconActivity className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-500">
                      No client activity yet.
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-400">
                      Once someone opens the delivery, their visit will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-600">
                          Recent visitors
                        </p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-semibold text-slate-500">
                          {viewerEmails.length}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200">
                      {viewerEmails.map((viewer) => (
                        <div
                          key={viewer.id}
                          className="flex flex-col gap-2 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                        >
                          <div className="min-w-0">
                            {viewer.name ? (
                              <p className="truncate text-sm font-medium text-slate-700">
                                {viewer.name}
                              </p>
                            ) : null}
                            <p
                              className={`truncate text-xs ${
                                viewer.name ? "mt-0.5 text-slate-500" : "text-slate-900/65"
                              }`}
                            >
                              {viewer.email}
                            </p>
                          </div>

                          <span className="shrink-0 text-[10px] text-slate-400">
                            {new Date(viewer.viewedAt).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-7 text-center sm:flex-row sm:text-left">
              <p className="text-xs text-slate-400">{project.clientName} · Showwork</p>
              <Link
                href="/dashboard/projects"
                className="text-xs text-slate-400 transition hover:text-slate-600"
              >
                Back to all projects
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
