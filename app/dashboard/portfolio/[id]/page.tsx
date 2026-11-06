import ShowworkLogo from "@/components/brand/ShowworkLogo";
import studioStyles from "@/components/portfolio/PortfolioStudio.module.css";
import PortfolioHelpLink from "@/components/help/PortfolioHelpLink";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ResponsiveSidebar from "@/components/navigation/ResponsiveSidebar";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicUrlFor } from "@/lib/r2";
import { portfolioUrl } from "@/lib/portfolioUrl";
import PortfolioWorkStudio from "@/components/portfolio/PortfolioWorkStudio";
import PortfolioDetailsForm from "@/components/portfolio/PortfolioDetailsForm";
import PortfolioTestimonialsManager from "@/components/portfolio/PortfolioTestimonialsManager";
import type { CSSProperties, ReactNode } from "react";

type WorkspaceView = "overview" | "identity" | "work" | "testimonials";

const BLUE = "#2478FF";

function ArrowIcon({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 2.8 13.7 9l6.2 1.7-6.2 1.7-1.7 6.2-1.7-6.2-6.2-1.7L10.3 9 12 2.8Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M14 5h5v5M19 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.7" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.7" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.7" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IdentityIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 20c.8-3.6 3.1-5.5 7-5.5s6.2 1.9 7 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WorkIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h18M8 4v5M16 4v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function QuoteIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7.5 17.5H5.7A2.7 2.7 0 0 1 3 14.8v-2.3A5.5 5.5 0 0 1 8.5 7H10v3H8.7a2.7 2.7 0 0 0-2.7 2.7v.1h1.5a2.7 2.7 0 0 1 0 5.4Zm9 0h-1.8a2.7 2.7 0 0 1-2.7-2.7v-2.3A5.5 5.5 0 0 1 17.5 7H19v3h-1.3a2.7 2.7 0 0 0-2.7 2.7v.1h1.5a2.7 2.7 0 0 1 0 5.4Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SidebarItem({
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
      aria-current={active ? "page" : undefined}
      className={`${studioStyles.navItem} group flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all ${
        active
          ? "border-[#2478FF]/15 bg-[#2478FF]/[0.08] text-[#111]"
          : "border-transparent text-[#69717C] hover:border-[#E7EBF1] hover:bg-[#F7F9FC] hover:text-[#1D232B]"
      }`}
    >
      <span
        className={`${studioStyles.navIcon} flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
          active
            ? "bg-[#2478FF]/10 text-[#2478FF]"
            : "bg-[#F4F6F9] text-[#9AA1AB] group-hover:text-[#59616D]"
        }`}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold">{label}</span>
          {badge !== undefined ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                active
                  ? "bg-[#2478FF]/10 text-[#2478FF]"
                  : "bg-[#F1F3F6] text-[#9AA0A9]"
              }`}
            >
              {badge}
            </span>
          ) : null}
        </span>
        <span className={`${studioStyles.navDescription} mt-0.5 block truncate text-[10px] text-[#A2A8B0]`}>
          {description}
        </span>
      </span>
    </Link>
  );
}

function MobileItem({
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
      className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold transition ${
        active
          ? "border-[#2478FF]/15 bg-[#2478FF]/[0.09] text-[#2478FF]"
          : "border-[#E6EAF0] bg-white text-[#7C838D]"
      }`}
    >
      {label}
    </Link>
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
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2478FF]/[0.08] text-[#2478FF]">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2478FF]">
            {eyebrow}
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-[#0A0A0A] sm:text-[30px]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#858A92]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function StatCard({
  value,
  label,
  detail,
}: {
  value: string | number;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#E9EDF2] bg-white p-5 shadow-[0_14px_50px_rgba(20,30,50,.035)]">
      <p className="text-3xl font-semibold tracking-[-0.05em] text-[#111317]">{value}</p>
      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8D949D]">
        {label}
      </p>
      <p className="mt-3 text-xs leading-5 text-[#A0A6AE]">{detail}</p>
    </div>
  );
}

export default async function PortfolioDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const creator = await getCurrentCreator();

  if (!creator) redirect("/login");

  const { id } = await params;
  const { view } = await searchParams;

  const allowedViews: WorkspaceView[] = [
    "overview",
    "identity",
    "work",
    "testimonials",
  ];

  const activeView: WorkspaceView = allowedViews.includes(view as WorkspaceView)
    ? (view as WorkspaceView)
    : "overview";

  const portfolio = await db.portfolio.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { displayOrder: "asc" },
        include: {
          media: {
            orderBy: { displayOrder: "asc" },
          },
        },
      },
      media: true,
      testimonials: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!portfolio || portfolio.creatorId !== creator.id) {
    notFound();
  }

  if (portfolio.billingStatus === "PENDING_SETUP") {
    redirect("/dashboard/portfolio");
  }

  const liveUrl = portfolioUrl(portfolio.slug);
  const testimonialLink = `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "")}/testimonial/${portfolio.slug}`;

  const ungroupedMedia = portfolio.media.filter((m) => !m.sectionId);

  const bannerCandidates = portfolio.sections
    .filter((s) => s.mediaType === "PHOTO" || s.mediaType === "VIDEO")
    .flatMap((s) => s.media)
    .concat(
      ungroupedMedia.filter(
        (m) => m.type === "PHOTO" || m.type === "VIDEO"
      )
    )
    .map((m) => ({
      id: m.id,
      url: publicUrlFor(m.fileKey),
      type: m.type as "PHOTO" | "VIDEO",
    }));

  const photoCount = portfolio.media.filter((m) => m.type === "PHOTO").length;
  const videoCount = portfolio.media.filter((m) => m.type === "VIDEO").length;
  const documentCount = portfolio.media.filter(
    (m) => m.type === "PDF" || m.type === "DOCUMENT"
  ).length;

  const totalSections = portfolio.sections.length;
  const totalFiles = portfolio.media.length;
  const testimonialCount = portfolio.testimonials.length;

  const viewHref = (nextView: WorkspaceView) =>
    `/dashboard/portfolio/${portfolio.id}?view=${nextView}`;

  const pageMeta: Record<
    WorkspaceView,
    { eyebrow: string; title: string; description: string }
  > = {
    overview: {
      eyebrow: "Portfolio command center",
      title: "Your public presence, at a glance.",
      description:
        "See what is live, understand the shape of your portfolio and jump directly into the part you want to improve.",
    },
    identity: {
      eyebrow: "Portfolio studio",
      title: "Portfolio identity",
      description: "Your story, your visuals, and how clients reach you.",
    },
    work: {
      eyebrow: "Portfolio studio",
      title: "Your work",
      description: "A home for the projects you’re proud of. Organise them into sections and make each one count.",
    },
    testimonials: {
      eyebrow: "Portfolio studio",
      title: "Client testimonials",
      description: "Collect feedback, review it, and let your clients speak for your work.",
    },
  };

  return (
    <main data-portfolio-studio="true" className={`${studioStyles.frame} min-h-screen overflow-x-hidden bg-[#F5F7FA] text-[#0A0A0A]`}>
      {/* Top bar */}
      <header className={`${studioStyles.toolbar} sticky top-0 z-50 border-b border-white/10 bg-[#07090D]/90 text-white backdrop-blur-2xl`}>
        <div className={`${studioStyles.toolbarInner} mx-auto flex h-[68px] max-w-[1600px] items-center justify-between pl-16 pr-4 sm:pl-16 sm:pr-6 lg:px-8`}>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2.5 rounded-full bg-white/[0.055] px-3.5 py-2.5 text-xs font-semibold text-white/55 transition hover:bg-white/[0.09] hover:text-white"
          >
            <ArrowIcon className="h-3.5 w-3.5 -rotate-180 transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">All tools</span>
            <span className="sm:hidden">Apps</span>
          </Link>

          <div className="flex min-w-0 items-center gap-3"><PortfolioHelpLink className="max-sm:px-2 max-sm:text-[10px]"/>
            <div className="hidden min-w-0 items-center gap-3 md:flex">
              <span className="max-w-[260px] truncate text-xs font-medium text-white/55">
                {portfolio.companyName}
              </span>
              <span className="h-3 w-px bg-white/[0.08]" />
            </div>

            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                portfolio.billingStatus === "ACTIVE"
                  ? "bg-emerald-400/[0.06] text-emerald-300"
                  : "bg-red-400/[0.07] text-red-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  portfolio.billingStatus === "ACTIVE"
                    ? "bg-emerald-400"
                    : "bg-red-400"
                }`}
              />
              {portfolio.billingStatus === "ACTIVE" ? "Live" : "Offline"}
            </span>

            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:bg-white/[0.11] hover:text-white sm:flex"
            >
              Preview live site
              <ExternalIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Mobile identity + navigation */}
      <div className="border-b border-[#E6EAF0] bg-white px-4 pb-4 pt-5 lg:hidden sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#2478FF]">
              Portfolio studio
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-[-0.035em] text-[#101318]">
              {portfolio.companyName}
            </h1>
          </div>

          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-2 rounded-full bg-[#0A0C10] px-3.5 py-2.5 text-[10px] font-semibold text-white"
          >
            View live
            <ExternalIcon className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            <MobileItem href={viewHref("overview")} label="Overview" active={activeView === "overview"} />
            <MobileItem href={viewHref("identity")} label="Identity" active={activeView === "identity"} />
            <MobileItem href={viewHref("work")} label={`Work · ${totalFiles}`} active={activeView === "work"} />
            <MobileItem href={viewHref("testimonials")} label={`Testimonials · ${testimonialCount}`} active={activeView === "testimonials"} />
          </div>
        </div>
      </div>

      <div className={`${studioStyles.layout} mx-auto flex max-w-[1600px]`}>
        {/* Desktop sidebar */}
        <ResponsiveSidebar label="Portfolio navigation" drawerClassName="bg-white text-[#101318]" desktopClassName={`${studioStyles.rail} sticky top-[68px] hidden h-[calc(100dvh-68px)] w-[290px] shrink-0 border-r border-[#E4E8EE] bg-white lg:flex lg:flex-col`}>
          <div className={studioStyles.identity}>
            <Link href="/dashboard" className={studioStyles.brand}><ShowworkLogo tone="white"/></Link>
            <p className={studioStyles.toolLabel}>Portfolio studio</p>
            <h1 title={portfolio.companyName}>{portfolio.companyName}</h1>
            <p className={studioStyles.slug}>{portfolio.slug}</p>
            <span className={studioStyles.status} data-live={portfolio.billingStatus === "ACTIVE"}>
              <span aria-hidden="true" />{portfolio.billingStatus === "ACTIVE" ? "Live and visible" : "Currently offline"}
            </span>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            <p className="px-3 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#B1B6BD]">
              Build
            </p>

            <div className="space-y-1">
              <SidebarItem
                href={viewHref("overview")}
                label="Overview"
                description="Portfolio health and shortcuts"
                active={activeView === "overview"}
                icon={<GridIcon className="h-[17px] w-[17px]" />}
              />
              <SidebarItem
                href={viewHref("identity")}
                label="Identity"
                description="Story, hero and contact details"
                active={activeView === "identity"}
                icon={<IdentityIcon className="h-[17px] w-[17px]" />}
              />
              <SidebarItem
                href={viewHref("work")}
                label="Work"
                description="Sections, projects and media"
                active={activeView === "work"}
                icon={<WorkIcon className="h-[17px] w-[17px]" />}
                badge={totalFiles}
              />
            </div>

            <p className="px-3 pb-2 pt-6 text-[9px] font-bold uppercase tracking-[0.14em] text-[#B1B6BD]">
              Social proof
            </p>

            <SidebarItem
              href={viewHref("testimonials")}
              label="Testimonials"
              description="Collect and publish client stories"
              active={activeView === "testimonials"}
              icon={<QuoteIcon className="h-[17px] w-[17px]" />}
              badge={testimonialCount}
            />
          </nav>

          <div className="border-t border-[#E9EDF2] p-3">
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-2xl bg-[#0A0C10] px-4 py-3.5 text-xs font-semibold text-white transition hover:bg-[#15181E]"
            >
              <span>Open live portfolio</span>
              <ArrowUpRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>

            <Link
              href="/dashboard"
              className="mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-medium text-[#8D949D] transition hover:bg-[#F7F9FC] hover:text-[#30363D]"
            >
              <ArrowIcon className="h-3.5 w-3.5 -rotate-180" />
              Back to all tools
            </Link>
          </div>
        </ResponsiveSidebar>

        {/* Main workspace */}
        <section className={`${studioStyles.content} min-w-0 flex-1`}>
          <div className={`${studioStyles.contentInner} mx-auto max-w-[1160px] px-4 pb-24 pt-8 sm:px-6 md:pt-10 lg:px-10 lg:pb-28 lg:pt-12`}>
            {/* Workspace title */}
            <div className={`${studioStyles.contentHeading} mb-9 border-b border-[#E2E7ED] pb-8`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2478FF]">
                {pageMeta[activeView].eyebrow}
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-[1.04] tracking-[-0.05em] text-[#090B0E] sm:text-4xl md:text-[46px]">
                {pageMeta[activeView].title}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#858A92]">
                {pageMeta[activeView].description}
              </p>
            </div>

            {/* OFFLINE */}
            {portfolio.billingStatus === "OFFLINE" && (
              <div className="mb-8 rounded-[24px] border border-red-100 bg-red-50 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      This portfolio is currently offline
                    </p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-red-600/70">
                      The monthly payment for this portfolio failed. It will not be
                      publicly visible until the billing issue is resolved.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/portfolio"
                    className="w-fit rounded-full bg-red-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    Resolve billing
                  </Link>
                </div>
              </div>
            )}

            {/* OVERVIEW */}
            {activeView === "overview" && (
              <div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatCard
                    value={totalFiles}
                    label="Files"
                    detail={`${photoCount} photos · ${videoCount} videos`}
                  />
                  <StatCard
                    value={totalSections}
                    label="Sections"
                    detail="Organised areas of your portfolio"
                  />
                  <StatCard
                    value={documentCount}
                    label="Documents"
                    detail="PDFs and documents in your library"
                  />
                  <StatCard
                    value={testimonialCount}
                    label="Testimonials"
                    detail="Client stories collected"
                  />
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
                  <div className="overflow-hidden rounded-[30px] bg-[#0A0C10] text-white shadow-[0_24px_80px_rgba(20,30,50,.10)]">
                    <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -right-28 -top-36 h-[420px] w-[420px] rounded-full blur-[100px]"
                        style={{
                          background:
                            "radial-gradient(circle, rgba(36,120,255,.34), transparent 68%)",
                        }}
                      />

                      <div className="relative">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.07] text-[#6EA5FF]">
                            <SparkIcon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6EA5FF]">
                              Your public presence
                            </p>
                            <p className="mt-0.5 text-xs text-white/30">
                              Built for people discovering your work.
                            </p>
                          </div>
                        </div>

                        <h3 className="mt-8 max-w-2xl text-3xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-4xl">
                          Your work deserves a
                          <span className="text-[#6EA5FF]"> memorable room.</span>
                        </h3>

                        <p className="mt-4 max-w-xl text-sm leading-6 text-white/35">
                          Keep the story sharp, the work organised and the social
                          proof close to the experience.
                        </p>

                        <div className="mt-7 flex flex-wrap gap-3">
                          <Link
                            href={viewHref("identity")}
                            scroll={false}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3.5 text-xs font-bold text-[#090A0C] transition hover:-translate-y-0.5 hover:bg-white/90"
                          >
                            Refine identity
                            <ArrowIcon className="h-3.5 w-3.5" />
                          </Link>

                          <a
                            href={liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-5 py-3.5 text-xs font-semibold text-white/65 transition hover:bg-white/[0.11] hover:text-white"
                          >
                            View live
                            <ExternalIcon className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[30px] border border-[#E8ECF1] bg-white p-6 shadow-[0_20px_70px_rgba(20,30,50,.045)] sm:p-7">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA1AA]">
                      Build checklist
                    </p>

                    <div className="mt-5 space-y-2">
                      {[
                        {
                          label: "Portfolio identity",
                          done: Boolean(portfolio.companyName && portfolio.heroTagline),
                          href: viewHref("identity"),
                        },
                        {
                          label: "First work section",
                          done: totalSections > 0 && totalFiles > 0,
                          href: viewHref("work"),
                        },
                        {
                          label: "Client social proof",
                          done: testimonialCount > 0,
                          href: viewHref("testimonials"),
                        },
                        {
                          label: "Portfolio is live",
                          done: portfolio.billingStatus === "ACTIVE",
                          href: liveUrl,
                          external: true,
                        },
                      ].map((item) => (
                        <Link
                          key={item.label}
                          href={item.external ? "#" : item.href}
                          onClick={undefined}
                          className="group flex items-center gap-3 rounded-2xl border border-[#EEF1F4] px-4 py-3.5 transition hover:border-[#DCE3EC] hover:bg-[#FAFBFC]"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              item.done
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-[#F3F6FA] text-[#A1A8B0]"
                            }`}
                          >
                            {item.done ? (
                              <CheckIcon className="h-4 w-4" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-[#343A42]">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-[#A0A6AE]">
                              {item.done ? "Ready" : "Needs attention"}
                            </span>
                          </span>

                          <ArrowIcon className="h-3.5 w-3.5 text-[#B0B6BE] transition group-hover:translate-x-0.5 group-hover:text-[#2478FF]" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <Link
                    href={viewHref("identity")}
                    scroll={false}
                    className="group rounded-[24px] border border-[#E8ECF1] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#DCE3EC] hover:shadow-[0_20px_55px_rgba(20,30,50,.05)]"
                  >
                    <IdentityIcon className="h-5 w-5 text-[#2478FF]" />
                    <p className="mt-5 text-sm font-semibold text-[#191D22]">Shape identity</p>
                    <p className="mt-1.5 text-xs leading-5 text-[#8C939C]">
                      Make your story, hero and contact details feel unmistakably yours.
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold text-[#2478FF]">
                      Edit identity
                      <ArrowIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>

                  <Link
                    href={viewHref("work")}
                    scroll={false}
                    className="group rounded-[24px] border border-[#E8ECF1] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#DCE3EC] hover:shadow-[0_20px_55px_rgba(20,30,50,.05)]"
                  >
                    <WorkIcon className="h-5 w-5 text-[#2478FF]" />
                    <p className="mt-5 text-sm font-semibold text-[#191D22]">Curate work</p>
                    <p className="mt-1.5 text-xs leading-5 text-[#8C939C]">
                      Organise your strongest projects into a visual story.
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold text-[#2478FF]">
                      Manage work
                      <ArrowIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>

                  <Link
                    href={viewHref("testimonials")}
                    scroll={false}
                    className="group rounded-[24px] border border-[#E8ECF1] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#DCE3EC] hover:shadow-[0_20px_55px_rgba(20,30,50,.05)]"
                  >
                    <QuoteIcon className="h-5 w-5 text-[#2478FF]" />
                    <p className="mt-5 text-sm font-semibold text-[#191D22]">Add social proof</p>
                    <p className="mt-1.5 text-xs leading-5 text-[#8C939C]">
                      Turn great client experiences into visible trust.
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold text-[#2478FF]">
                      Manage testimonials
                      <ArrowIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </div>
              </div>
            )}

            {/* IDENTITY */}
            {activeView === "identity" && (
              <div>
                <div>
                  <PortfolioDetailsForm
                    companyName={portfolio.companyName}
                    heroTagline={portfolio.heroTagline}
                    heroMediaId={portfolio.heroMediaId}
                    heroBannerDesktopUrl={portfolio.heroBannerDesktopUrl}
                    heroBannerDesktopType={portfolio.heroBannerDesktopType}
                    heroBannerMobileUrl={portfolio.heroBannerMobileUrl}
                    heroBannerMobileType={portfolio.heroBannerMobileType}
                    bannerCandidates={bannerCandidates}
                    contactEmail={portfolio.contactEmail}
                    whatsappNumber={portfolio.whatsappNumber}
                    ctaText={portfolio.ctaText}
                    instagramUrl={portfolio.instagramUrl}
                    twitterUrl={portfolio.twitterUrl}
                    linkedinUrl={portfolio.linkedinUrl}
                    tiktokUrl={portfolio.tiktokUrl}
                    facebookUrl={portfolio.facebookUrl}
                    youtubeUrl={portfolio.youtubeUrl}
                    bioText={portfolio.bioText}
                    bioSkills={portfolio.bioSkills}
                    bioStat={portfolio.bioStat}
                    bioPhotoUrl={portfolio.bioPhotoUrl}
                  />
                </div>
              </div>
            )}

            {/* WORK */}
            {activeView === "work" && <PortfolioWorkStudio sections={portfolio.sections.map(section => ({
              id: section.id, name: section.name, mediaType: section.mediaType, coverMediaId: section.coverMediaId,
              media: section.media.map(media => ({
                id: media.id, type: media.type, url: publicUrlFor(media.fileKey),
                posterUrl: media.posterFileKey ? publicUrlFor(media.posterFileKey) : null,
                filename: media.fileKey.split("/").pop() ?? "file",
              })),
            }))} />}

            {/* TESTIMONIALS */}
            {activeView === "testimonials" && <PortfolioTestimonialsManager testimonials={portfolio.testimonials} collectionUrl={testimonialLink} />}

            <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[#E2E7ED] pt-7 text-center sm:flex-row sm:text-left">
              <p className="text-xs text-[#A0A6AE]">
                Portfolio Studio · Showwork
              </p>

              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-full truncate text-xs font-semibold text-[#747982] transition hover:text-[#2478FF]"
              >
                {liveUrl}
              </a>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
