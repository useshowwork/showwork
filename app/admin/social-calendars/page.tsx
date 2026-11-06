import { getLiveRevenueTotals } from "@/lib/livePaymentRevenue";
import UiSymbol from "@/components/ui/UiSymbol";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";
import CalendarRowActions from "@/components/admin/social-calendars/CalendarRowActions";

const PAGE_SIZE = 12;

const COLOR = {
  black: "#0A0A0A",
  charcoal: "#141414",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.48)",
  faint: "rgba(255,255,255,0.28)",
  line: "rgba(255,255,255,0.08)",
  gold: "#F5C842",
  orange: "#E8881A",
  green: "#4ADE80",
  blue: "#60A5FA",
  red: "#F87171",
};

type SearchParams = {
  page?: string;
  q?: string;
  billing?: string;
  plan?: string;
  status?: string;
  account?: string;
  connection?: string;
};

function formatNgn(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";

  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function relativeTime(date: Date | null | undefined) {
  if (!date) return "Never";

  const diff = Date.now() - date.getTime();
  const seconds = Math.max(
    1,
    Math.floor(diff / 1000)
  );

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${months}mo ago`;
  }

  return `${Math.floor(months / 12)}y ago`;
}

function initials(
  name: string | null,
  email: string
) {
  const value = name?.trim() || email;

  const parts = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "?";
  }

  return parts
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function labelize(
  value: string | null | undefined
) {
  if (!value) return "—";

  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function billingMeta(
  status: string | null | undefined
) {
  switch (status) {
    case "ACTIVE":
      return {
        label: "Active",
        color: COLOR.green,
        bg: "rgba(74,222,128,0.12)",
      };

    case "TRIAL":
      return {
        label: "Trial",
        color: COLOR.blue,
        bg: "rgba(96,165,250,0.12)",
      };

    case "OFFLINE":
      return {
        label: "Offline",
        color: COLOR.red,
        bg: "rgba(248,113,113,0.12)",
      };

    case "PENDING_SETUP":
      return {
        label: "Not subscribed",
        color: COLOR.faint,
        bg: "rgba(255,255,255,0.06)",
      };

    default:
      return {
        label: labelize(status),
        color: COLOR.muted,
        bg: "rgba(255,255,255,0.06)",
      };
  }
}

function planMeta(
  plan: string | null | undefined
) {
  switch (plan) {
    case "CREATOR":
      return {
        label: "Creator",
        color: COLOR.blue,
        bg: "rgba(96,165,250,0.12)",
      };

    case "UNLIMITED":
      return { label: "Unlimited", color: COLOR.gold, bg: "rgba(245,200,66,0.12)" };

    case "STUDIO":
      return {
        label: "Studio",
        color: COLOR.gold,
        bg: "rgba(245,200,66,0.12)",
      };

    default:
      return {
        label: "Not selected",
        color: COLOR.faint,
        bg: "rgba(255,255,255,0.06)",
      };
  }
}

function workflowMeta(
  status: string | null | undefined
) {
  switch (status) {
    case "PLAN_APPROVED":
      return {
        label: "Plan approved",
        color: COLOR.green,
        bg: "rgba(74,222,128,0.12)",
      };

    case "AWAITING_APPROVAL":
      return {
        label: "Awaiting approval",
        color: COLOR.gold,
        bg: "rgba(245,200,66,0.12)",
      };

    case "PLAN_NEEDS_CHANGES":
      return {
        label: "Needs changes",
        color: COLOR.orange,
        bg: "rgba(232,136,26,0.12)",
      };

    default:
      return {
        label: "Building",
        color: COLOR.faint,
        bg: "rgba(255,255,255,0.06)",
      };
  }
}

function connectionMeta(
  instagramAccountId: string | null,
  tikTokOpenId: string | null
) {
  if (
    instagramAccountId &&
    tikTokOpenId
  ) {
    return {
      label: "2 connected",
      color: COLOR.green,
      bg: "rgba(74,222,128,0.12)",
    };
  }

  if (
    instagramAccountId ||
    tikTokOpenId
  ) {
    return {
      label: "1 connected",
      color: COLOR.blue,
      bg: "rgba(96,165,250,0.12)",
    };
  }

  return {
    label: "Not connected",
    color: COLOR.faint,
    bg: "rgba(255,255,255,0.06)",
  };
}

function isTrialExpired(
  status: string,
  trialEndsAt: Date | null | undefined
) {
  return (
    status === "TRIAL" &&
    !!trialEndsAt &&
    trialEndsAt.getTime() <= Date.now()
  );
}

export default async function AdminSocialCalendarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const creator = await getCurrentCreator();

  if (!creator) {
    redirect("/login");
  }

  if (!isAdminEmail(creator.email)) {
    notFound();
  }

  const params = await searchParams;

  const query = params.q?.trim() || "";

  const billingFilter =
    params.billing || "ALL";

  const planFilter =
    params.plan || "ALL";

  const statusFilter =
    params.status || "ALL";

  const accountFilter =
    params.account || "ALL";

  const connectionFilter =
    params.connection || "ALL";

  const requestedPage = Number.parseInt(
    params.page || "1",
    10
  );

  const safeRequestedPage =
    Number.isFinite(requestedPage) &&
    requestedPage > 0
      ? requestedPage
      : 1;

  /*
   * IMPORTANT:
   *
   * All Prisma calls below are intentionally sequential.
   *
   * The production database uses a very small
   * connection pool. Running these queries through
   * Promise.all() can cause the admin RSC request
   * to stall and eventually terminate.
   */

  // ------------------------------------------------------------
  // BASIC COUNTS
  // ------------------------------------------------------------

  const totalWorkspaces =
    await db.socialCalendar.count();

  const totalManagers =
    await db.creator.count({
      where: {
        accountType:
          "SOCIAL_MEDIA_MANAGER",
      },
    });

  const totalPosts =
    await db.calendarPost.count();

  const totalCollaborators =
    await db.calendarCollaborator.count();

  const totalClientViews =
    await db.calendarViewerEmail.count();

  const totalDocuments =
    await db.calendarBusinessDocument.count();

  // ------------------------------------------------------------
  // RECENT ACTIVITY
  // ------------------------------------------------------------

  const now = new Date();

  const sevenDaysAgo = new Date(
    now.getTime() -
      7 * 24 * 60 * 60 * 1000
  );

  const thirtyDaysAgo = new Date(
    now.getTime() -
      30 * 24 * 60 * 60 * 1000
  );

  const workspacesCreatedLast7Days =
    await db.socialCalendar.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

  const postsCreatedLast7Days =
    await db.calendarPost.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

  const clientViewsLast7Days =
    await db.calendarViewerEmail.count({
      where: {
        viewedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

  const documentsLast30Days =
    await db.calendarBusinessDocument.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

  // ------------------------------------------------------------
  // WORKSPACE FILTERS
  // ------------------------------------------------------------

  const workspaceFilters: Prisma.SocialCalendarWhereInput[] =
    [];

  if (query) {
    workspaceFilters.push({
      OR: [
        {
          clientName: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          manager: {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          manager: {
            email: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          manager: {
            companyName: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  if (planFilter !== "ALL") {
    workspaceFilters.push({
      manager: {
        contentWorkspacePlan:
          planFilter as "CREATOR" | "GROWTH" | "STUDIO" | "UNLIMITED",
      },
    });
  }

  if (accountFilter !== "ALL") {
    workspaceFilters.push({
      manager: {
        calendarAccountType:
          accountFilter as
            | "INDIVIDUAL"
            | "COMPANY",
      },
    });
  }

  if (statusFilter !== "ALL") {
    workspaceFilters.push({
      manager: {
        OR: [
          {
            contentWorkspaceBillingStatus:
              statusFilter as
                | "PENDING_SETUP"
                | "TRIAL"
                | "ACTIVE"
                | "OFFLINE",
          },
          {
            calendarBillingStatus:
              statusFilter as
                | "PENDING_SETUP"
                | "TRIAL"
                | "ACTIVE"
                | "OFFLINE",
          },
        ],
      },
    });
  }

  if (billingFilter === "PAID") {
    workspaceFilters.push({
      manager: {
        OR: [
          {
            contentWorkspaceBillingStatus:
              "ACTIVE",
          },
          {
            calendarBillingStatus:
              "ACTIVE",
          },
        ],
      },
    });
  }

  if (billingFilter === "TRIAL") {
    workspaceFilters.push({
      manager: {
        OR: [
          {
            contentWorkspaceBillingStatus:
              "TRIAL",
          },
          {
            calendarBillingStatus:
              "TRIAL",
          },
        ],
      },
    });
  }

  if (billingFilter === "OFFLINE") {
    workspaceFilters.push({
      manager: {
        OR: [
          {
            contentWorkspaceBillingStatus:
              "OFFLINE",
          },
          {
            calendarBillingStatus:
              "OFFLINE",
          },
        ],
      },
    });
  }

  if (connectionFilter === "INSTAGRAM") {
    workspaceFilters.push({
      instagramAccountId: {
        not: null,
      },
    });
  }

  if (connectionFilter === "TIKTOK") {
    workspaceFilters.push({
      tikTokOpenId: {
        not: null,
      },
    });
  }

  if (connectionFilter === "CONNECTED") {
    workspaceFilters.push({
      OR: [
        {
          instagramAccountId: {
            not: null,
          },
        },
        {
          tikTokOpenId: {
            not: null,
          },
        },
      ],
    });
  }

  if (connectionFilter === "NONE") {
    workspaceFilters.push({
      AND: [
        {
          instagramAccountId: null,
        },
        {
          tikTokOpenId: null,
        },
      ],
    });
  }

  const workspaceWhere: Prisma.SocialCalendarWhereInput =
    workspaceFilters.length > 0
      ? {
          AND: workspaceFilters,
        }
      : {};

  // ------------------------------------------------------------
  // PAGINATION COUNT
  // ------------------------------------------------------------

  const filteredWorkspaceCount =
    await db.socialCalendar.count({
      where: workspaceWhere,
    });

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredWorkspaceCount /
        PAGE_SIZE
    )
  );

  const currentPage = Math.min(
    safeRequestedPage,
    totalPages
  );

  // ------------------------------------------------------------
  // WORKSPACES
  // ------------------------------------------------------------

  const calendars =
    await db.socialCalendar.findMany({
      where: workspaceWhere,
      orderBy: {
        updatedAt: "desc",
      },
      skip:
        (currentPage - 1) *
        PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        clientName: true,
        logoUrl: true,

        planStatus: true,
        planSubmittedAt: true,
        planApprovedAt: true,

        createdAt: true,
        updatedAt: true,

        instagramAccountId: true,
        instagramUsername: true,
        instagramConnectedAt: true,
        instagramTokenExpiresAt: true,

        tikTokOpenId: true,
        tikTokUsername: true,
        tikTokConnectedAt: true,
        tikTokAccessTokenExpiresAt: true,

        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            companyName: true,
            avatarUrl: true,

            calendarAccountType: true,
            calendarBillingStatus: true,
            calendarTrialEndsAt: true,
            calendarSubscriptionRenewsAt:
              true,

            contentWorkspacePlan: true,
            contentWorkspaceBillingStatus:
              true,
            contentWorkspaceTrialEndsAt:
              true,
            contentWorkspaceSubscriptionRenewsAt:
              true,
          },
        },

        _count: {
          select: {
            posts: true,
            collaborators: true,
            invites: true,
            viewerEmails: true,
            businessDocuments: true,
          },
        },
      },
    });

  // ------------------------------------------------------------
  // PAGE MANAGER REVENUE
  // ------------------------------------------------------------

  const managerIds = Array.from(
    new Set(
      calendars.map(
        (calendar) =>
          calendar.manager.id
      )
    )
  );

  const pageRevenueRows =
    managerIds.length > 0
      ? await db.paymentRecord.findMany({
          where: {
            revenueStatus: "LIVE",
            creatorId: {
              in: managerIds,
            },
            type: {
              in: [
                "CALENDAR_SUBSCRIPTION_INITIAL",
                "CALENDAR_SUBSCRIPTION_RENEWAL",
                "CONTENT_WORKSPACE_SUBSCRIPTION_INITIAL",
                "CONTENT_WORKSPACE_SUBSCRIPTION_RENEWAL",
              ],
            },
          },
          select: {
            creatorId: true,
            amountNgn: true,
          },
        })
      : [];

  const revenueByManager =
    new Map<string, number>();

  for (const payment of pageRevenueRows) {
    revenueByManager.set(
      payment.creatorId,
      (revenueByManager.get(
        payment.creatorId
      ) ?? 0) + payment.amountNgn
    );
  }

  // ------------------------------------------------------------
  // REVENUE SUMMARY
  // ------------------------------------------------------------

  const localMonth = new Date(now.getTime()+3600000).toISOString().slice(0,7);
  const startOfMonth = new Date(`${localMonth}-01T00:00:00+01:00`);
  const startOfYear = new Date(`${localMonth.slice(0,4)}-01-01T00:00:00+01:00`);

  const monthRevenue = await getLiveRevenueTotals({tool:"workspace",from:startOfMonth});
  const yearRevenue = await getLiveRevenueTotals({tool:"workspace",from:startOfYear});

  // ------------------------------------------------------------
  // URL HELPERS
  // ------------------------------------------------------------

  function pageHref(nextPage: number) {
    const search =
      new URLSearchParams();

    if (query) {
      search.set("q", query);
    }

    if (billingFilter !== "ALL") {
      search.set(
        "billing",
        billingFilter
      );
    }

    if (planFilter !== "ALL") {
      search.set(
        "plan",
        planFilter
      );
    }

    if (statusFilter !== "ALL") {
      search.set(
        "status",
        statusFilter
      );
    }

    if (accountFilter !== "ALL") {
      search.set(
        "account",
        accountFilter
      );
    }

    if (connectionFilter !== "ALL") {
      search.set(
        "connection",
        connectionFilter
      );
    }

    search.set(
      "page",
      String(nextPage)
    );

    return `/admin/social-calendars?${search.toString()}`;
  }

  const activeFilterCount = [
    billingFilter !== "ALL",
    planFilter !== "ALL",
    statusFilter !== "ALL",
    accountFilter !== "ALL",
    connectionFilter !== "ALL",
  ].filter(Boolean).length;

  return (
    <main
      className="min-h-screen overflow-x-hidden"
      style={{
        background: COLOR.black,
        color: COLOR.white,
      }}
    >
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* ====================================================
            HEADER
        ===================================================== */}

        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background:
                      COLOR.gold,
                  }}
                />

                <p
                  className="text-[10px] font-bold uppercase"
                  style={{
                    color:
                      COLOR.gold,
                    letterSpacing:
                      "0.16em",
                  }}
                >
                  Admin / Marketing Workspace
                </p>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Calendar operations
              </h1>

              <p
                className="mt-2 max-w-2xl text-sm leading-6"
                style={{
                  color:
                    COLOR.muted,
                }}
              >
                Manage marketing workspaces,
                subscriptions,
                publishing connections,
                collaboration and
                content operations from
                one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin"
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
                style={{
                  borderColor:
                    COLOR.line,
                  color:
                    "rgba(255,255,255,0.72)",
                }}
              ><>{" "}<UiSymbol name="left" />{" Admin overview "}</></Link>

              <Link
                href="/dashboard/calendars"
                className="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                style={{
                  background:
                    COLOR.gold,
                  color:
                    COLOR.black,
                }}
              >
                Workspace manager
              </Link>
            </div>
          </div>
        </header>

        {/* ====================================================
            METRICS
        ===================================================== */}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Managers"
            value={totalManagers}
            detail={`${workspacesCreatedLast7Days} new workspaces this week`}
          />

          <MetricCard
            label="Workspaces"
            value={totalWorkspaces}
            detail={`${postsCreatedLast7Days} posts this week`}
          />

          <MetricCard
            label="Posts"
            value={totalPosts}
            detail={`${totalCollaborators} collaborators`}
          />

          <MetricCard
            label="Client views"
            value={totalClientViews}
            detail={`${clientViewsLast7Days} this week`}
          />
        </section>

        {/* ====================================================
            HEALTH
        ===================================================== */}

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div
            className="rounded-2xl border p-5 sm:p-6"
            style={{
              background:
                COLOR.charcoal,
              borderColor:
                COLOR.line,
            }}
          >
            <div className="mb-5">
              <p
                className="text-[10px] font-bold uppercase"
                style={{
                  color:
                    COLOR.gold,
                  letterSpacing:
                    "0.12em",
                }}
              >
                Operations
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Workspace activity
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HealthMetric
                label="Posts"
                value={totalPosts}
              />

              <HealthMetric
                label="Collaborators"
                value={
                  totalCollaborators
                }
              />

              <HealthMetric
                label="Client views"
                value={
                  totalClientViews
                }
              />

              <HealthMetric
                label="Knowledge"
                value={
                  totalDocuments
                }
              />
            </div>

            <div
              className="mt-4 grid grid-cols-3 gap-3 border-t pt-4"
              style={{
                borderColor:
                  COLOR.line,
              }}
            >
              <HealthMetric
                label="Workspaces / 7d"
                value={
                  workspacesCreatedLast7Days
                }
              />

              <HealthMetric
                label="Posts / 7d"
                value={
                  postsCreatedLast7Days
                }
              />

              <HealthMetric
                label="Docs / 30d"
                value={
                  documentsLast30Days
                }
              />
            </div>
          </div>

          <div
            className="rounded-2xl border p-5 sm:p-6"
            style={{
              background:
                "linear-gradient(145deg, rgba(245,200,66,0.10), rgba(255,255,255,0.025))",
              borderColor:
                "rgba(245,200,66,0.18)",
            }}
          >
            <p
              className="text-[10px] font-bold uppercase"
              style={{
                color:
                  COLOR.gold,
                letterSpacing:
                  "0.12em",
              }}
            >
              Revenue
            </p>

            <h2 className="mt-1 text-lg font-semibold">
              Workspace revenue
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <RevenueMetric
                label="This month"
                value={formatNgn(
                  monthRevenue.amountNgn ?? 0
                )}
              />

              <RevenueMetric
                label="This year"
                value={formatNgn(
                  yearRevenue.amountNgn ?? 0
                )}
              />
            </div>

            <p
              className="mt-4 text-xs leading-5"
              style={{
                color:
                  COLOR.muted,
              }}
            >
              Includes historical
              calendar subscription
              payments and current
              Marketing Workspace
              subscription payments.
            </p>
          </div>
        </section>

        {/* ====================================================
            FILTERS
        ===================================================== */}

        <section
          className="mb-8 rounded-2xl border p-4 sm:p-5"
          style={{
            background:
              COLOR.charcoal,
            borderColor:
              COLOR.line,
          }}
        >
          <form
            method="GET"
            className="space-y-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1">
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Search manager, company, marketing workspace or slug..."
                  className="h-11 w-full rounded-xl border bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/20"
                  style={{
                    borderColor:
                      COLOR.line,
                  }}
                />
              </div>

              <button
                type="submit"
                className="h-11 rounded-xl px-5 text-sm font-semibold"
                style={{
                  background:
                    COLOR.gold,
                  color:
                    COLOR.black,
                }}
              >
                Search
              </button>

              {(query ||
                activeFilterCount >
                  0) && (
                <Link
                  href="/admin/social-calendars"
                  className="flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold"
                  style={{
                    borderColor:
                      COLOR.line,
                    color:
                      COLOR.muted,
                  }}
                >
                  Clear
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <FilterSelect
                name="status"
                label="Status"
                value={
                  statusFilter
                }
                options={[
                  [
                    "ALL",
                    "All statuses",
                  ],
                  [
                    "ACTIVE",
                    "Active",
                  ],
                  [
                    "TRIAL",
                    "Trial",
                  ],
                  [
                    "OFFLINE",
                    "Offline",
                  ],
                  [
                    "PENDING_SETUP",
                    "Not subscribed",
                  ],
                ]}
              />

              <FilterSelect
                name="plan"
                label="Plan"
                value={
                  planFilter
                }
                options={[
                  [
                    "ALL",
                    "All plans",
                  ],
                  [
                    "CREATOR",
                    "Creator",
                  ],
                  ["GROWTH", "Growth"],
                  [
                    "STUDIO",
                    "Studio",
                  ],
                  ["UNLIMITED", "Unlimited"],
                ]}
              />

              <FilterSelect
                name="account"
                label="Account"
                value={
                  accountFilter
                }
                options={[
                  [
                    "ALL",
                    "All accounts",
                  ],
                  [
                    "INDIVIDUAL",
                    "Individual",
                  ],
                  [
                    "COMPANY",
                    "Company",
                  ],
                ]}
              />

              <FilterSelect
                name="connection"
                label="Social"
                value={
                  connectionFilter
                }
                options={[
                  [
                    "ALL",
                    "All connections",
                  ],
                  [
                    "CONNECTED",
                    "Any connected",
                  ],
                  [
                    "INSTAGRAM",
                    "Instagram",
                  ],
                  [
                    "TIKTOK",
                    "TikTok",
                  ],
                  [
                    "NONE",
                    "Not connected",
                  ],
                ]}
              />

              <FilterSelect
                name="billing"
                label="Billing"
                value={
                  billingFilter
                }
                options={[
                  [
                    "ALL",
                    "All billing",
                  ],
                  [
                    "PAID",
                    "Paid",
                  ],
                  [
                    "TRIAL",
                    "Trial",
                  ],
                  [
                    "OFFLINE",
                    "Offline",
                  ],
                ]}
              />
            </div>

            <input
              type="hidden"
              name="page"
              value="1"
            />
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeFilterCount >
              0 && (
              <span
                className="rounded-full px-3 py-1 text-[10px] font-bold"
                style={{
                  background:
                    "rgba(245,200,66,0.10)",
                  color:
                    COLOR.gold,
                }}
              >
                {activeFilterCount} filter
                {activeFilterCount ===
                1
                  ? ""
                  : "s"}{" "}
                active
              </span>
            )}

            <span
              className="text-xs"
              style={{
                color:
                  COLOR.faint,
              }}
            >
              {filteredWorkspaceCount.toLocaleString()}{" "}
              workspace
              {filteredWorkspaceCount ===
              1
                ? ""
                : "s"}{" "}
              found
            </span>
          </div>
        </section>

        {/* ====================================================
            WORKSPACES
        ===================================================== */}

        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p
                className="text-[10px] font-bold uppercase"
                style={{
                  color:
                    COLOR.orange,
                  letterSpacing:
                    "0.12em",
                }}
              >
                Marketing workspaces
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Workspace directory
              </h2>
            </div>

            <p
              className="text-xs"
              style={{
                color:
                  COLOR.faint,
              }}
            >
              Page {currentPage} of{" "}
              {totalPages}
            </p>
          </div>

          {calendars.length ===
          0 ? (
            <div
              className="rounded-2xl border px-6 py-16 text-center"
              style={{
                background:
                  COLOR.charcoal,
                borderColor:
                  COLOR.line,
              }}
            >
              <p className="text-lg font-semibold">
                No workspaces found
              </p>

              <p
                className="mx-auto mt-2 max-w-md text-sm leading-6"
                style={{
                  color:
                    COLOR.muted,
                }}
              >
                Try changing the search
                or filters. No marketing
                workspace matches the
                current criteria.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {calendars.map(
                (calendar) => {
                  const plan =
                    planMeta(
                      calendar.manager
                        .contentWorkspacePlan
                    );

                  const billingStatus =
                    calendar.manager
                      .contentWorkspaceBillingStatus !==
                    "PENDING_SETUP"
                      ? calendar.manager
                          .contentWorkspaceBillingStatus
                      : calendar.manager
                          .calendarBillingStatus;

                  const billing =
                    billingMeta(
                      billingStatus
                    );

                  const workflow =
                    workflowMeta(
                      calendar.planStatus
                    );

                  const connection =
                    connectionMeta(
                      calendar.instagramAccountId,
                      calendar.tikTokOpenId
                    );

                  const trialEndsAt =
                    calendar.manager
                      .contentWorkspaceTrialEndsAt ??
                    calendar.manager
                      .calendarTrialEndsAt;

                  const renewalDate =
                    calendar.manager
                      .contentWorkspaceSubscriptionRenewsAt ??
                    calendar.manager
                      .calendarSubscriptionRenewsAt;

                  const expired =
                    isTrialExpired(
                      billingStatus,
                      trialEndsAt
                    );

                  const managerRevenue =
                    revenueByManager.get(
                      calendar.manager.id
                    ) ?? 0;

                  return (
                    <article
                      key={
                        calendar.id
                      }
                      className="overflow-hidden rounded-2xl border transition hover:border-white/15"
                      style={{
                        background:
                          COLOR.charcoal,
                        borderColor:
                          COLOR.line,
                      }}
                    >
                      {/* HEADER */}

                      <div className="p-5 sm:p-6">
                        <div className="flex items-start gap-4">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border text-sm font-bold"
                            style={{
                              background:
                                "rgba(255,255,255,0.04)",
                              borderColor:
                                COLOR.line,
                            }}
                          >
                            {calendar.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={
                                  calendar.logoUrl
                                }
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              calendar.clientName
                                .slice(0, 1)
                                .toUpperCase()
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/dashboard/calendars/${calendar.id}`}
                                className="min-w-0 truncate text-base font-semibold text-white transition hover:text-white/70"
                              >
                                {
                                  calendar.clientName
                                }
                              </Link>

                              <span
                                className="rounded-full px-2 py-1 text-[9px] font-bold"
                                style={{
                                  background:
                                    billing.bg,
                                  color:
                                    expired
                                      ? COLOR.red
                                      : billing.color,
                                }}
                              >
                                {expired
                                  ? "Trial expired"
                                  : billing.label}
                              </span>
                            </div>

                            <p
                              className="mt-1 truncate text-xs"
                              style={{
                                color:
                                  COLOR.faint,
                              }}
                            >
                              /{
                                calendar.slug
                              }
                            </p>

                            <Link
                              href={`/admin/creators/${calendar.manager.id}`}
                              className="mt-2 block truncate text-xs transition hover:text-white"
                              style={{
                                color:
                                  COLOR.muted,
                              }}
                            >
                              Managed by{" "}
                              <span className="text-white/70">
                                {calendar.manager
                                  .name ||
                                  calendar.manager
                                    .email}
                              </span>
                            </Link>
                          </div>
                        </div>

                        {/* STATUS */}

                        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <InfoPill
                            label="Plan"
                            value={
                              plan.label
                            }
                            color={
                              plan.color
                            }
                            bg={
                              plan.bg
                            }
                          />

                          <InfoPill
                            label="Workflow"
                            value={
                              workflow.label
                            }
                            color={
                              workflow.color
                            }
                            bg={
                              workflow.bg
                            }
                          />

                          <InfoPill
                            label="Account"
                            value={
                              calendar
                                .manager
                                .calendarAccountType
                                ? labelize(
                                    calendar
                                      .manager
                                      .calendarAccountType
                                  )
                                : "Not set"
                            }
                            color={
                              COLOR.muted
                            }
                            bg="rgba(255,255,255,0.05)"
                          />

                          <InfoPill
                            label="Social"
                            value={
                              connection.label
                            }
                            color={
                              connection.color
                            }
                            bg={
                              connection.bg
                            }
                          />
                        </div>

                        {/* METRICS */}

                        <div
                          className="mt-5 grid grid-cols-2 gap-y-4 border-y py-4 sm:grid-cols-5"
                          style={{
                            borderColor:
                              COLOR.line,
                          }}
                        >
                          <DataPoint
                            label="Posts"
                            value={
                              calendar
                                ._count
                                .posts
                            }
                          />

                          <DataPoint
                            label="Collabs"
                            value={
                              calendar
                                ._count
                                .collaborators
                            }
                          />

                          <DataPoint
                            label="Views"
                            value={
                              calendar
                                ._count
                                .viewerEmails
                            }
                          />

                          <DataPoint
                            label="Knowledge"
                            value={
                              calendar
                                ._count
                                .businessDocuments
                            }
                          />

                          <DataPoint
                            label="Revenue"
                            value={formatNgn(
                              managerRevenue
                            )}
                          />
                        </div>

                        {/* SOCIAL CONNECTIONS */}

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <ConnectionRow
                            platform="Instagram"
                            username={
                              calendar
                                .instagramUsername
                            }
                            connected={
                              !!calendar.instagramAccountId
                            }
                            connectedAt={
                              calendar.instagramConnectedAt
                            }
                            expiresAt={
                              calendar.instagramTokenExpiresAt
                            }
                          />

                          <ConnectionRow
                            platform="TikTok"
                            username={
                              calendar.tikTokUsername
                            }
                            connected={
                              !!calendar.tikTokOpenId
                            }
                            connectedAt={
                              calendar.tikTokConnectedAt
                            }
                            expiresAt={
                              calendar.tikTokAccessTokenExpiresAt
                            }
                          />
                        </div>

                        {/* DATES */}

                        <div
                          className="mt-4 grid gap-3 text-xs sm:grid-cols-3"
                          style={{
                            color:
                              COLOR.faint,
                          }}
                        >
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-white/20">
                              Created
                            </span>

                            <span className="mt-1 block text-white/55">
                              {formatDate(
                                calendar.createdAt
                              )}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-white/20">
                              Updated
                            </span>

                            <span className="mt-1 block text-white/55">
                              {relativeTime(
                                calendar.updatedAt
                              )}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-white/20">
                              {billingStatus ===
                              "TRIAL"
                                ? "Trial ends"
                                : "Renewal"}
                            </span>

                            <span
                              className="mt-1 block"
                              style={{
                                color:
                                  expired
                                    ? COLOR.red
                                    : "rgba(255,255,255,0.55)",
                              }}
                            >
                              {billingStatus ===
                              "TRIAL"
                                ? formatDate(
                                    trialEndsAt
                                  )
                                : formatDate(
                                    renewalDate
                                  )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ACTIONS */}

                      <div
                        className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between"
                        style={{
                          borderColor:
                            COLOR.line,
                          background:
                            "rgba(255,255,255,0.015)",
                        }}
                      >
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/dashboard/calendars/${calendar.id}`}
                            className="rounded-lg border px-3 py-2 text-xs font-semibold transition hover:bg-white/5"
                            style={{
                              borderColor:
                                COLOR.line,
                              color:
                                "rgba(255,255,255,0.75)",
                            }}
                          >
                            Open workspace
                          </Link>

                          <Link
                            href={`/admin/creators/${calendar.manager.id}`}
                            className="rounded-lg border px-3 py-2 text-xs font-semibold transition hover:bg-white/5"
                            style={{
                              borderColor:
                                COLOR.line,
                              color:
                                "rgba(255,255,255,0.55)",
                            }}
                          >
                            Manager
                          </Link>
                        </div>

                        <div className="shrink-0">
                          <CalendarRowActions
                            calendarId={
                              calendar.id
                            }
                            billingStatus={
                              calendar
                                .manager
                                .contentWorkspaceBillingStatus
                            }
                          />
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}

          {/* PAGINATION */}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-4">
              <Link
                href={pageHref(
                  Math.max(
                    1,
                    currentPage - 1
                  )
                )}
                aria-disabled={
                  currentPage <= 1
                }
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                style={{
                  borderColor:
                    COLOR.line,
                  color:
                    currentPage <= 1
                      ? COLOR.faint
                      : "rgba(255,255,255,0.75)",
                  pointerEvents:
                    currentPage <= 1
                      ? "none"
                      : undefined,
                }}
              ><>{" "}<UiSymbol name="left" />{" Previous "}</></Link>

              <span
                className="text-xs"
                style={{
                  color:
                    COLOR.faint,
                }}
              >
                {currentPage} /{" "}
                {totalPages}
              </span>

              <Link
                href={pageHref(
                  Math.min(
                    totalPages,
                    currentPage + 1
                  )
                )}
                aria-disabled={
                  currentPage >=
                  totalPages
                }
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                style={{
                  borderColor:
                    COLOR.line,
                  color:
                    currentPage >=
                    totalPages
                      ? COLOR.faint
                      : "rgba(255,255,255,0.75)",
                  pointerEvents:
                    currentPage >=
                    totalPages
                      ? "none"
                      : undefined,
                }}
              ><>{" Next "}<UiSymbol name="right" />{" "}</></Link>
            </div>
          )}
        </section>

        {/* ====================================================
            FOOTER NOTE
        ===================================================== */}

        <section
          className="mt-8 rounded-2xl border p-5"
          style={{
            background:
              "rgba(255,255,255,0.025)",
            borderColor:
              COLOR.line,
          }}
        >
          <div className="flex gap-3">
            <div
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{
                background:
                  COLOR.gold,
              }}
            />

            <div>
              <p className="text-sm font-semibold">
                Account-level billing
              </p>

              <p
                className="mt-1 max-w-4xl text-xs leading-5"
                style={{
                  color:
                    COLOR.muted,
                }}
              >
                Marketing Workspace billing is
                managed at the creator account
                level. A creator can therefore
                manage multiple marketing workspaces
                under the same subscription.
                Workspace activity and billing are
                shown separately so the admin can
                understand both the account and
                individual marketing workspace.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ============================================================
   UI COMPONENTS
============================================================ */

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4 sm:p-5"
      style={{
        background:
          COLOR.charcoal,
        borderColor:
          COLOR.line,
      }}
    >
      <p
        className="text-[10px] font-bold uppercase"
        style={{
          color:
            COLOR.faint,
          letterSpacing:
            "0.12em",
        }}
      >
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {value.toLocaleString()}
      </p>

      <p
        className="mt-1 text-xs"
        style={{
          color:
            COLOR.muted,
        }}
      >
        {detail}
      </p>
    </div>
  );
}

function HealthMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <p
        className="text-[9px] font-bold uppercase"
        style={{
          color:
            COLOR.faint,
          letterSpacing:
            "0.08em",
        }}
      >
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function RevenueMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="min-w-0 rounded-xl border p-3"
      style={{
        background:
          "rgba(255,255,255,0.035)",
        borderColor:
          COLOR.line,
      }}
    >
      <p
        className="text-[9px] font-bold uppercase"
        style={{
          color:
            COLOR.faint,
        }}
      >
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold">
        {value}
      </p>
    </div>
  );
}

function InfoPill({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="min-w-0 rounded-xl px-3 py-2"
      style={{
        background: bg,
      }}
    >
      <p
        className="truncate text-[8px] font-bold uppercase"
        style={{
          color:
            COLOR.faint,
          letterSpacing:
            "0.08em",
        }}
      >
        {label}
      </p>

      <p
        className="mt-1 truncate text-[10px] font-semibold"
        style={{
          color,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function DataPoint({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0">
      <p
        className="truncate text-[8px] font-bold uppercase"
        style={{
          color:
            COLOR.faint,
          letterSpacing:
            "0.08em",
        }}
      >
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-semibold text-white/70">
        {typeof value ===
        "number"
          ? value.toLocaleString()
          : value}
      </p>
    </div>
  );
}

function ConnectionRow({
  platform,
  username,
  connected,
  connectedAt,
  expiresAt,
}: {
  platform: string;
  username: string | null;
  connected: boolean;
  connectedAt: Date | null;
  expiresAt: Date | null;
}) {
  const expired =
    !!expiresAt &&
    expiresAt.getTime() <=
      Date.now();

  return (
    <div
      className="min-w-0 rounded-xl border px-3 py-2.5"
      style={{
        background:
          "rgba(255,255,255,0.025)",
        borderColor:
          COLOR.line,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className="text-[9px] font-bold uppercase"
          style={{
            color:
              COLOR.faint,
            letterSpacing:
              "0.08em",
          }}
        >
          {platform}
        </p>

        <span
          className="rounded-full px-2 py-0.5 text-[8px] font-bold"
          style={{
            color: !connected
              ? COLOR.faint
              : expired
                ? COLOR.red
                : COLOR.green,
            background:
              !connected
                ? "rgba(255,255,255,0.05)"
                : expired
                  ? "rgba(248,113,113,0.10)"
                  : "rgba(74,222,128,0.10)",
          }}
        >
          {!connected
            ? "Not connected"
            : expired
              ? "Token expired"
              : "Connected"}
        </span>
      </div>

      <p
        className="mt-1 truncate text-[10px]"
        style={{
          color:
            "rgba(255,255,255,0.62)",
        }}
      >
        {username
          ? `@${username}`
          : "No account connected"}
      </p>

      {connectedAt && (
        <p
          className="mt-0.5 text-[9px]"
          style={{
            color:
              COLOR.faint,
          }}
        >
          Connected{" "}
          {formatDate(
            connectedAt
          )}
        </p>
      )}
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<
    [string, string]
  >;
}) {
  return (
    <label className="min-w-0">
      <span
        className="mb-1 block text-[8px] font-bold uppercase"
        style={{
          color:
            COLOR.faint,
          letterSpacing:
            "0.08em",
        }}
      >
        {label}
      </span>

      <select
        name={name}
        defaultValue={value}
        className="h-10 w-full min-w-0 rounded-xl border bg-black/20 px-3 text-xs text-white outline-none"
        style={{
          borderColor:
            COLOR.line,
        }}
      >
        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={
                optionValue
              }
              className="bg-[#141414] text-white"
            >
              {optionLabel}
            </option>
          )
        )}
      </select>
    </label>
  );
}