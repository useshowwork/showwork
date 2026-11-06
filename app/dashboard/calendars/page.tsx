import ShowworkLogo from "@/components/brand/ShowworkLogo";
import HelpLink from "@/components/help/HelpLink";
import { normalizeTeamRole, TEAM_ROLES } from "@/lib/calendarTeamPolicy";
import { retryDatabaseRead } from "@/lib/retryDatabaseRead";
import styles from "@/components/calendars/CalendarDashboard.module.css";
import { complimentaryAccessSelect, workspaceComplimentaryPlan } from "@/lib/complimentaryAccess";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Search,
  Users,
} from "lucide-react";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncContentWorkspaceRenewal } from "@/lib/syncContentWorkspaceRenewal";
import CreateCalendarForm from "@/components/calendars/CreateCalendarForm";
import CalendarCard from "@/components/calendars/CalendarCard";
import CalendarPaymentCallbackHandler from "@/components/calendars/CalendarPaymentCallbackHandler";
import WorkspaceOnboarding, {
  DashboardTourButton,
} from "@/components/calendars/WorkspaceOnboarding";

const PAGE_SIZE = 9;
const BILLING_HREF = "/dashboard/billing?product=content-workspace#content-workspace-plans";

function pageHref(page: number, query: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (query) params.set("q", query);
  return `/dashboard/calendars${params.size ? `?${params}` : ""}`;
}

export default async function CalendarsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; onboarding?: string; q?: string }>;
}) {
  const creator = await getCurrentCreator();
  if (!creator) redirect("/login");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const requestedPage = Number(params.page);
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? Math.floor(requestedPage)
      : 1;
  const where = {
    managerId: creator.id,
    ...(query
      ? { clientName: { contains: query, mode: "insensitive" as const } }
      : {}),
  };
  const [billing, totalCalendars, matchingCalendars, collaboratorMemberships] =
    await retryDatabaseRead(() => Promise.all([
      db.creator.findUnique({
        where: { id: creator.id },
        select: {
          contentWorkspacePlan: true,
          contentWorkspaceBillingStatus: true,
          contentWorkspaceTrialEndsAt: true,
          ...complimentaryAccessSelect, isComped: true,
          compedUntil: true,
        },
      }),
      db.socialCalendar.count({ where: { managerId: creator.id } }),
      db.socialCalendar.count({ where }),
      db.calendarCollaborator.findMany({
        where: {
          creatorId: creator.id,
          ...(query
            ? {
                calendar: {
                  clientName: { contains: query, mode: "insensitive" as const },
                },
              }
            : {}),
        },
        orderBy: { addedAt: "desc" },
        include: {
          calendar: {
            include: {
              manager: { select: { name: true, email: true } },
              _count: { select: { posts: { where: { deletedAt: null } } } },
            },
          },
        },
      }),
    ]));
  if (billing?.contentWorkspaceBillingStatus === "ACTIVE")
    await syncContentWorkspaceRenewal(creator.id);
  const totalPages = Math.max(1, Math.ceil(matchingCalendars / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;
  const calendars = await retryDatabaseRead(() => db.socialCalendar.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
    include: { _count: { select: { posts: { where: { deletedAt: null } }, collaborators: true } } },
  }));
  const trialEnd = billing?.contentWorkspaceTrialEndsAt;
  const complimentary = Boolean(
    billing && workspaceComplimentaryPlan(billing),
  );
  const trialExpired =
    billing?.contentWorkspaceBillingStatus === "TRIAL" &&
    trialEnd &&
    trialEnd <= new Date();
  const needsBilling =
    !complimentary &&
    (billing?.contentWorkspaceBillingStatus === "OFFLINE" || trialExpired);
  const trialDays = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000))
    : null;

  const planName = billing?.contentWorkspacePlan
    ? { CREATOR: "Creator", GROWTH: "Growth", STUDIO: "Studio", UNLIMITED: "Agency" }[
        billing.contentWorkspacePlan
      ]
    : "No plan";
  const billingSummary = complimentary
    ? "Complimentary"
    : billing?.contentWorkspaceBillingStatus === "TRIAL"
      ? trialExpired
        ? "Trial ended"
        : trialDays === null
          ? "Free trial"
          : `Trial · ${trialDays} ${trialDays === 1 ? "day" : "days"} left`
      : billing?.contentWorkspaceBillingStatus === "OFFLINE"
        ? "Access paused"
        : billing?.contentWorkspaceBillingStatus === "ACTIVE"
          ? "Active"
          : null;

  return (
    <main className={`calendar-dashboard ${styles.page}`}>
      <div className={styles.shell}>
        <nav
          aria-label="Dashboard navigation"
          className={styles.nav}
        >
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-[#475467] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1768E8]"
          >
            <ShowworkLogo width={96}/>
            <span className="ml-2 border-l border-[#D0DCEB] pl-3 text-xs">All tools</span>
          </Link>
          <div className="flex items-center gap-1">
            <HelpLink className="px-2 text-xs text-[#607fa5]"/>
            <DashboardTourButton />
            <Link
              href={BILLING_HREF}
              data-dashboard-tour="billing"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-[#475467] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1768E8]"
            >
              <CreditCard
                aria-hidden="true"
                className="hidden h-4 w-4 shrink-0 sm:block"
              />
              <span className="block text-left">
                <span className="flex items-center gap-1.5">
                  Billing
                  <span className="rounded-full bg-[#EEF5FF] px-2 py-0.5 text-[11px] font-medium text-[#175CD3]">
                    {planName}
                  </span>
                </span>
                {billingSummary && (
                  <span
                    className={`mt-0.5 block text-[11px] font-normal ${needsBilling ? "text-amber-700" : "text-[#667085]"}`}
                  >
                    {billingSummary}
                  </span>
                )}
              </span>
            </Link>
          </div>
        </nav>
        <div data-dashboard-tour-slot="billing" />
        <header className={styles.heading}>
          <h1>Marketing workspaces</h1>
          <p>{totalCalendars > 0 || collaboratorMemberships.length > 0
            ? "Open a workspace to continue, or create one for a new client."
            : "Create a workspace for your business or client to get started."}</p>
        </header>
        {billing?.contentWorkspacePlan && needsBilling && (
          <aside
            aria-label="Workspace access"
            className={`my-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-sm ${needsBilling ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-100 bg-blue-50 text-[#175CD3]"}`}
          >
            <p>Subscribe to restore workspace access.</p>
            <Link
              href={BILLING_HREF}
              className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-4"
            >
              Restore access
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </aside>
        )}
        <section
          data-onboarding="create-workspace"
          className={styles.create}
          aria-label="Create a marketing workspace"
        >
          <div className={styles.createIntro}>
            <span className={styles.createIcon}><Users size={20} aria-hidden="true" /></span>
            <div><h2>{totalCalendars > 0 ? "Add another workspace" : "Create your first workspace"}</h2><p>One workspace for each business or client.</p></div>
          </div>
          <div className={styles.createForm}>
            <CreateCalendarForm contentWorkspacePlan={billing?.contentWorkspacePlan ?? null} />
          </div>
          <div data-dashboard-tour-slot="create" />
        </section>
        <Suspense fallback={null}>
          <CalendarPaymentCallbackHandler />
        </Suspense>
        {(totalCalendars > 0 || query) && <section id="your-workspaces" aria-labelledby="your-workspaces-title">
          <div className={styles.workspaceHeading}>
            <h2
              id="your-workspaces-title"
              data-dashboard-tour="workspaces"
              className="text-base font-semibold"
            >
              Your workspaces{" "}
              <span className={styles.count}>
                {totalCalendars}
              </span>
            </h2>
            {(totalCalendars > 0 ||
              collaboratorMemberships.length > 0 ||
              query) && (
              <form
                action="/dashboard/calendars"
                method="get"
                role="search"
                className="flex w-full items-center gap-2 sm:max-w-sm"
              >
                <div className="relative min-w-0 flex-1">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]"
                  />
                  <input
                    aria-label="Search marketing workspaces"
                    name="q"
                    defaultValue={query}
                    placeholder="Search clients"
                    type="search"
                    className="min-h-11 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-base outline-none focus:border-[#1768E8] focus:ring-2 focus:ring-blue-100 sm:text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-11 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm font-medium text-[#344054] hover:bg-slate-50"
                >
                  Search
                </button>
              </form>
            )}
          </div>
          <div data-dashboard-tour-slot="workspaces" />
          {query && (
            <p className="mb-4 text-sm text-[#667085]">
              Results for “{query}”{" "}
              <Link
                href="/dashboard/calendars"
                className="ml-2 inline-flex min-h-11 items-center font-medium text-[#1768E8] underline"
              >
                Clear search
              </Link>
            </p>
          )}
          {calendars.length ? (
            <div className={styles.grid}>
              {calendars.map((cal, index) => (
                <CalendarCard
                  key={cal.id}
                  id={cal.id}
                  clientName={cal.clientName}
                  planStatus={cal.planStatus}
                  postCount={cal._count.posts}
                  createdAt={cal.createdAt.toISOString()}
                  globalIndex={skip + index + 1}
                  collaboratorCount={cal._count.collaborators}
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <h3 className="text-base font-semibold">No matching workspaces</h3>
              <p>Try another client name or clear your search.</p>
            </div>
          )}
          {totalPages > 1 && (
            <nav
              aria-label="Marketing workspace pagination"
              className="mt-5 flex items-center justify-between gap-2 border-t border-[#E4E7EC] pt-4"
            >
              <Link
                href={pageHref(Math.max(1, safePage - 1), query)}
                aria-disabled={safePage === 1}
                tabIndex={safePage === 1 ? -1 : undefined}
                className={`inline-flex min-h-11 items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm ${safePage === 1 ? "pointer-events-none text-[#98A2B3]" : "text-[#344054] hover:bg-slate-50"}`}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Previous
              </Link>
              <span className="text-xs text-[#667085]">
                {safePage} of {totalPages}
              </span>
              <Link
                href={pageHref(Math.min(totalPages, safePage + 1), query)}
                aria-disabled={safePage === totalPages}
                tabIndex={safePage === totalPages ? -1 : undefined}
                className={`inline-flex min-h-11 items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm ${safePage === totalPages ? "pointer-events-none text-[#98A2B3]" : "text-[#344054] hover:bg-slate-50"}`}
              >
                Next
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </nav>
          )}
        </section>}
        {collaboratorMemberships.length > 0 && (
          <section
            id="shared-workspaces"
            aria-labelledby="shared-workspaces-title"
            className="mt-8"
          >
            <h2
              id="shared-workspaces-title"
              className="mb-3 flex items-center gap-2 text-base font-semibold"
            >
              <Users aria-hidden="true" className="h-4 w-4 text-[#667085]" />
              Shared with you
            </h2>
            <div className={styles.grid}>
              {collaboratorMemberships.map(({ calendar: cal, role }) => (
                <Link
                  key={cal.id}
                  href={`/dashboard/calendars/${cal.id}`}
                  className={styles.sharedCard}
                >
                  <h3 className="truncate font-semibold">{cal.clientName}</h3>
                  <p className="mt-1 truncate text-xs text-[#667085]">
                    Managed by {cal.manager.name || cal.manager.email}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#667085]">
                    <span>
                      {TEAM_ROLES[normalizeTeamRole(role) || "VIEWER"].label}
                    </span>
                    <span className="inline-flex min-h-11 items-center gap-1 font-semibold text-[#1768E8]">
                      Open workspace
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        <footer className={styles.footer}><span>Showwork / Marketing Workspace</span><Link href="/dashboard">Back to your dashboard</Link></footer>
        <WorkspaceOnboarding
          isFirstWorkspace={totalCalendars === 0}
          hasExistingPlan={Boolean(billing?.contentWorkspacePlan)}
          testMode={params.onboarding === "test"}
        />
      </div>
    </main>
  );
}
