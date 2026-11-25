import { getAdminPaymentHistory } from "@/lib/adminPaymentHistory";
import { getLiveRevenueTotals } from "@/lib/livePaymentRevenue";
import PartnerTag from "@/components/admin/PartnerTag";
import UiSymbol from "@/components/ui/UiSymbol";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";
import CreatorRowActions from "@/components/admin/CreatorRowActions";
import DeleteCreatorButton from "@/components/admin/DeleteCreatorButton";
import { whatsappLinkFor } from "@/lib/phone";

const COLOR = {
  black: "#08090B",
  panel: "#111317",
  panelSoft: "#15171C",
  border: "rgba(255,255,255,0.08)",
  gold: "#F5C842",
  orange: "#E8881A",
  green: "#35D07F",
  blue: "#5B8CFF",
  red: "#FF5C5C",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.55)",
  subtle: "rgba(255,255,255,0.32)",
};

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";

  return date.toLocaleDateString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "—";

  return date.toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function getBillingLabel(status: string | null | undefined) {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "TRIAL":
      return "Trial";
    case "OFFLINE":
      return "Offline";
    case "PENDING_SETUP":
      return "Pending setup";
    default:
      return status || "Not set";
  }
}

function billingTone(status: string | null | undefined) {
  switch (status) {
    case "ACTIVE":
      return {
        color: COLOR.green,
        background: "rgba(53,208,127,0.10)",
      };
    case "TRIAL":
      return {
        color: COLOR.gold,
        background: "rgba(245,200,66,0.10)",
      };
    case "OFFLINE":
      return {
        color: COLOR.red,
        background: "rgba(255,92,92,0.10)",
      };
    default:
      return {
        color: COLOR.muted,
        background: "rgba(255,255,255,0.06)",
      };
  }
}

function StatusBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "green" | "gold" | "red" | "blue" | "default";
}) {
  const styles = {
    green: {
      color: COLOR.green,
      background: "rgba(53,208,127,0.10)",
    },
    gold: {
      color: COLOR.gold,
      background: "rgba(245,200,66,0.10)",
    },
    red: {
      color: COLOR.red,
      background: "rgba(255,92,92,0.10)",
    },
    blue: {
      color: COLOR.blue,
      background: "rgba(91,140,255,0.10)",
    },
    default: {
      color: COLOR.muted,
      background: "rgba(255,255,255,0.06)",
    },
  }[tone];

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={styles}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: string | number;
  description?: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: COLOR.panel,
        borderColor: COLOR.border,
      }}
    >
      <div
        className="mb-3 h-1 w-8 rounded-full"
        style={{ background: accent || COLOR.gold }}
      />

      <p
        className="text-[11px] font-semibold uppercase"
        style={{
          color: COLOR.subtle,
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-white">
        {value}
      </p>

      {description && (
        <p className="mt-1 text-xs" style={{ color: COLOR.subtle }}>
          {description}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        background: COLOR.panel,
        borderColor: COLOR.border,
      }}
    >
      <div
        className="border-b px-5 py-4 sm:px-6"
        style={{ borderColor: COLOR.border }}
      >
        <h2 className="text-sm font-semibold text-white">{title}</h2>

        {description && (
          <p className="mt-1 text-xs" style={{ color: COLOR.subtle }}>
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentCreator();

  if (!admin) {
    redirect("/login");
  }

  if (!isAdminEmail(admin.email)) {
    notFound();
  }

  const { id } = await params;

  /*
   * Keep the creator query intentionally focused.
   *
   * The generated Prisma client in this project has previously differed
   * from fields present in the pasted schema, so this page only selects
   * fields that are already established in the current Creator model and
   * existing admin UI.
   */
  const creator = await db.creator.findUnique({
    where: { id },
    include: {
      partnerProfile: { select: { status: true, isActive: true } },
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              media: true,
              viewerEmails: true,
            },
          },
        },
      },
    },
  });

  if (!creator) {
    notFound();
  }

  /*
   * Keep these queries sequential.
   *
   * The project's database connection pool has previously been configured
   * with connection_limit=1, so firing multiple Prisma queries concurrently
   * can cause connection-pool timeouts.
   */

  const viewerEmails = await db.viewerEmail.findMany({
    where: {
      project: {
        creatorId: creator.id,
      },
    },
    include: {
      project: {
        select: {
          clientName: true,
          slug: true,
        },
      },
    },
    orderBy: {
      viewedAt: "desc",
    },
  });

  const portfolioCount = await db.portfolio.count({
    where: {
      creatorId: creator.id,
    },
  });

  const portfolios = await db.portfolio.findMany({
    where: { creatorId: creator.id },
    select: { id: true, slug: true, companyName: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const calendarCount = await db.socialCalendar.count({
    where: {
      managerId: creator.id,
    },
  });

  const calendars = await db.socialCalendar.findMany({
    where: { managerId: creator.id },
    select: { id: true, slug: true, clientName: true, planStatus: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const contentWorkspaceUsage = await db.contentWorkspaceUsage.findUnique({
    where: {
      creatorId: creator.id,
    },
    select: {
      storageBytes: true,
      storageReservedBytes: true,
      aiGenerationsUsed: true,
      aiRegenerationsUsed: true,
    },
  });

  const paymentRecords = await getAdminPaymentHistory({creatorId:creator.id,limit:50});

  const deliveryRevenue = await getLiveRevenueTotals({creatorId:creator.id,tool:"delivery"});
  const workspaceRevenue = await getLiveRevenueTotals({creatorId:creator.id,tool:"workspace"});
  const portfolioTotals = await getLiveRevenueTotals({creatorId:creator.id,tool:"portfolio"});
  const allRevenue = await getLiveRevenueTotals({creatorId:creator.id});
  const projectRevenue = deliveryRevenue.amountNgn;
  const contentWorkspaceRevenue = workspaceRevenue.amountNgn;
  const portfolioRevenue = portfolioTotals.amountNgn;
  const totalRevenue = allRevenue.amountNgn;

  const latestPayment = paymentRecords[0] || null;

  const totalProjectMedia = creator.projects.reduce(
    (total, project) => total + project._count.media,
    0
  );

  const totalProjectViews = creator.projects.reduce(
    (total, project) => total + project._count.viewerEmails,
    0
  );

  const activeProjectCount = creator.projects.filter(
    (project) => project.deliveryStatus !== "PAID"
  ).length;

  const paidProjectCount = creator.projects.filter(
    (project) => project.deliveryStatus === "PAID"
  ).length;

  const workspaceStatus = creator.contentWorkspaceBillingStatus;
  const workspaceTone = billingTone(workspaceStatus);

  return (
    <main
      className="min-h-screen text-white"
      style={{ background: COLOR.black }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="mb-6 inline-flex items-center gap-2 text-sm transition-colors hover:text-white"
            style={{ color: COLOR.subtle }}
          >
            <span aria-hidden="true"><><UiSymbol name="left" /></></span>
            Back to admin
          </Link>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase"
                  style={{
                    background: "rgba(245,200,66,0.10)",
                    color: COLOR.gold,
                    letterSpacing: "0.12em",
                  }}
                >
                  Creator account
                </span>

                {creator.isComped && (
                  <StatusBadge label="Comped" tone="gold" />
                )}

                {creator.isDeactivated && (
                  <StatusBadge label="Deactivated" tone="red" />
                )}
              </div>

              <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">
                {creator.name || creator.email}
              </h1>

              <div className="mt-3 flex flex-col gap-1 text-sm">
                <p style={{ color: COLOR.muted }}>{creator.email}</p>
                <PartnerTag profile={creator.partnerProfile} />

                {creator.phone && (
                  <p style={{ color: COLOR.subtle }}>{creator.phone}</p>
                )}

                {creator.companyName && (
                  <p style={{ color: COLOR.subtle }}>
                    {creator.companyName}
                  </p>
                )}
              </div>

              <p className="mt-3 text-xs" style={{ color: COLOR.subtle }}>
                Joined{" "}
                {creator.createdAt.toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {creator.lastLoginAt
                  ? ` · Last login ${formatDateTime(creator.lastLoginAt)}`
                  : " · No login recorded"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {creator.phone && (
                <a
                  href={whatsappLinkFor(creator.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85"
                  style={{
                    background: "rgba(53,208,127,0.10)",
                    color: COLOR.green,
                    border: "1px solid rgba(53,208,127,0.15)",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.71.45 3.38 1.3 4.85L2.05 22l5.36-1.4a9.9 9.9 0 0 0 4.63 1.18h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.13-2.9-7C17 3.03 14.53 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.25 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.22-.73-.66-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.12.17 1.73 2.64 4.2 3.7.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
                  </svg>
                  WhatsApp
                </a>
              )}

              <DeleteCreatorButton
                creatorId={creator.id}
                creatorLabel={creator.name || creator.email}
              />
            </div>
          </div>
        </div>

        {/* Account overview */}
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Projects"
            value={creator.projects.length}
            description={`${activeProjectCount} active · ${paidProjectCount} paid`}
            accent={COLOR.blue}
          />

          <StatCard
            label="Portfolio"
            value={portfolioCount}
            description={
              portfolioCount === 1
                ? "Portfolio created"
                : "Portfolios created"
            }
            accent={COLOR.gold}
          />

          <StatCard
            label="Workspaces"
            value={calendarCount}
            description="Marketing Workspace accounts"
            accent={COLOR.orange}
          />

          <StatCard
            label="Total revenue"
            value={formatMoney(totalRevenue)}
            description={`${paymentRecords.length} recent payment records`}
            accent={COLOR.green}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {/* Plan & access */}
            <Section
              title="Plan & access"
              description="Manage this creator's commercial access and usage overrides."
            >
              <div className="p-5 sm:p-6">
                <div className="mb-6 grid gap-4 sm:grid-cols-3">
                  <div
                    className="rounded-xl border p-4"
                    style={{
                      background: COLOR.panelSoft,
                      borderColor: COLOR.border,
                    }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase"
                      style={{
                        color: COLOR.subtle,
                        letterSpacing: "0.1em",
                      }}
                    >
                      Account type
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {creator.accountType.replaceAll("_", " ")}
                    </p>
                  </div>

                  <div
                    className="rounded-xl border p-4"
                    style={{
                      background: COLOR.panelSoft,
                      borderColor: COLOR.border,
                    }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase"
                      style={{
                        color: COLOR.subtle,
                        letterSpacing: "0.1em",
                      }}
                    >
                      Project plan
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {creator.subscriptionTier}
                    </p>
                  </div>

                  <div
                    className="rounded-xl border p-4"
                    style={{
                      background: COLOR.panelSoft,
                      borderColor: COLOR.border,
                    }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase"
                      style={{
                        color: COLOR.subtle,
                        letterSpacing: "0.1em",
                      }}
                    >
                      Account status
                    </p>

                    <div className="mt-2">
                      {creator.isDeactivated ? (
                        <StatusBadge label="Deactivated" tone="red" />
                      ) : (
                        <StatusBadge label="Active" tone="green" />
                      )}
                    </div>
                  </div>
                </div>

                <CreatorRowActions
                  creatorId={creator.id}
                  isComped={creator.isComped}
                  discountPercent={creator.discountPercent}
                  freeTierLimitOverride={creator.freeTierLimitOverride}
                  expanded
                />
              </div>
            </Section>

            {/* Marketing Workspace */}
            <Section
              title="Marketing Workspace"
              description="Account-level workspace subscription and usage."
            >
              <div className="p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div
                    className="rounded-xl border p-4"
                    style={{
                      background: COLOR.panelSoft,
                      borderColor: COLOR.border,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className="text-[10px] font-semibold uppercase"
                          style={{
                            color: COLOR.subtle,
                            letterSpacing: "0.1em",
                          }}
                        >
                          Workspace plan
                        </p>

                        <p className="mt-2 text-lg font-bold text-white">
                          {creator.contentWorkspacePlan || "Not subscribed"}
                        </p>
                      </div>

                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                        style={{
                          color: workspaceTone.color,
                          background: workspaceTone.background,
                        }}
                      >
                        {getBillingLabel(workspaceStatus)}
                      </span>
                    </div>
                  </div>

                  <div
                    className="rounded-xl border p-4"
                    style={{
                      background: COLOR.panelSoft,
                      borderColor: COLOR.border,
                    }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase"
                      style={{
                        color: COLOR.subtle,
                        letterSpacing: "0.1em",
                      }}
                    >
                      Workspace usage
                    </p>

                    <div className="mt-2 flex items-end gap-2">
                      <p className="text-lg font-bold text-white">
                        {contentWorkspaceUsage
                          ? Number(contentWorkspaceUsage.storageBytes).toLocaleString(
                              "en-NG"
                            )
                          : "0"}
                      </p>

                      <p
                        className="pb-0.5 text-xs"
                        style={{ color: COLOR.subtle }}
                      >
                        storage bytes
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
                >
                  <div
                    className="rounded-xl p-4"
                    style={{ background: COLOR.panelSoft }}
                  >
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: COLOR.subtle }}
                    >
                      AI generations
                    </p>
                    <p className="mt-2 text-lg font-bold">
                      {contentWorkspaceUsage?.aiGenerationsUsed ?? 0}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-4"
                    style={{ background: COLOR.panelSoft }}
                  >
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: COLOR.subtle }}
                    >
                      AI regenerations
                    </p>
                    <p className="mt-2 text-lg font-bold">
                      {contentWorkspaceUsage?.aiRegenerationsUsed ?? 0}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-4"
                    style={{ background: COLOR.panelSoft }}
                  >
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: COLOR.subtle }}
                    >
                      Storage reserved
                    </p>
                    <p className="mt-2 text-lg font-bold">
                      {contentWorkspaceUsage
                        ? Number(
                            contentWorkspaceUsage.storageReservedBytes
                          ).toLocaleString("en-NG")
                        : "0"}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-4"
                    style={{ background: COLOR.panelSoft }}
                  >
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: COLOR.subtle }}
                    >
                      Workspaces
                    </p>
                    <p className="mt-2 text-lg font-bold">{calendarCount}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLOR.subtle }}>Creator workspaces</p>
                  {calendars.length ? calendars.map((calendar) => (
                    <Link key={calendar.id} href={`/dashboard/calendars/${calendar.id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:bg-white/[0.04]" style={{ borderColor: COLOR.border, background: COLOR.panelSoft }}>
                      <span className="min-w-0 truncate text-sm font-medium text-white">{calendar.clientName} <span className="ml-1 text-xs text-white/40">/{calendar.slug}</span></span>
                      <span className="shrink-0 text-xs text-white/50"><>{"Open "}<UiSymbol name="right" /></></span>
                    </Link>
                  )) : <p className="text-xs" style={{ color: COLOR.subtle }}>No workspaces created.</p>}
                </div>
              </div>
            </Section>

            <Section title={`Portfolios · ${portfolios.length}`} description="Public portfolio pages created by this account.">
              <div className="space-y-2 p-5">
                {portfolios.length ? portfolios.map((portfolio) => (
                  <a key={portfolio.id} href={`/portfolio/${portfolio.slug}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:bg-white/[0.04]" style={{ borderColor: COLOR.border, background: COLOR.panelSoft }}>
                    <span className="min-w-0 truncate text-sm font-medium text-white">{portfolio.companyName} <span className="ml-1 text-xs text-white/40">/portfolio/{portfolio.slug}</span></span>
                    <span className="shrink-0 text-xs text-white/50"><>{"Visit "}<UiSymbol name="upRight" /></></span>
                  </a>
                )) : <p className="text-xs" style={{ color: COLOR.subtle }}>No portfolios created.</p>}
              </div>
            </Section>

            {/* Projects */}
            <Section
              title={`Project Delivery · ${creator.projects.length}`}
              description="Projects owned by this creator."
            >
              {creator.projects.length === 0 ? (
                <div className="px-5 py-10 text-center sm:px-6">
                  <p className="text-sm" style={{ color: COLOR.subtle }}>
                    No projects yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: COLOR.border }}>
                  {creator.projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/${project.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group block px-5 py-4 transition-colors hover:bg-white/[0.025] sm:px-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">
                              {project.clientName}
                            </p>

                            <StatusBadge
                              label={project.deliveryStatus}
                              tone={
                                project.deliveryStatus === "PAID"
                                  ? "green"
                                  : project.deliveryStatus === "APPROVED"
                                    ? "blue"
                                    : "default"
                              }
                            />
                          </div>

                          <p
                            className="mt-1 truncate text-xs"
                            style={{ color: COLOR.subtle }}
                          >
                            Project link: /{project.slug}
                          </p>
                          <p className="mt-1 truncate text-xs" style={{ color: COLOR.subtle }}>
                            Access code: <span className="font-mono text-white/80">{project.accessCode || "Unavailable for this older project"}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-left sm:flex sm:items-center sm:gap-6 sm:text-right">
                          <div>
                            <p
                              className="text-[10px] uppercase"
                              style={{ color: COLOR.subtle }}
                            >
                              Files
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {project._count.media}
                            </p>
                          </div>

                          <div>
                            <p
                              className="text-[10px] uppercase"
                              style={{ color: COLOR.subtle }}
                            >
                              Client views
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {project._count.viewerEmails}
                            </p>
                          </div>

                          <div>
                            <p
                              className="text-[10px] uppercase"
                              style={{ color: COLOR.subtle }}
                            >
                              Created
                            </p>
                            <p className="mt-1 text-xs text-white/70">
                              {formatDate(project.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            {/* Client emails */}
            <Section
              title={`Client contacts · ${viewerEmails.length}`}
              description="Email addresses captured when clients accessed this creator's project deliveries."
            >
              {viewerEmails.length === 0 ? (
                <div className="px-5 py-10 text-center sm:px-6">
                  <p className="text-sm" style={{ color: COLOR.subtle }}>
                    No client has entered their email yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: COLOR.border }}>
                  {viewerEmails.map((viewer) => (
                    <div
                      key={viewer.id}
                      className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/90">
                          {viewer.email}
                        </p>

                        <p
                          className="mt-1 truncate text-xs"
                          style={{ color: COLOR.subtle }}
                        >
                          {viewer.project.clientName}
                        </p>
                      </div>

                      <div className="shrink-0 text-xs sm:text-right">
                        <p style={{ color: COLOR.muted }}>
                          {formatDateTime(viewer.viewedAt)}
                        </p>

                        <p
                          className="mt-1"
                          style={{ color: COLOR.subtle }}
                        >
                          /{viewer.project.slug}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Payments */}
            <Section
              title="Billing history"
              description="Recent payment records associated with this account."
            >
              {paymentRecords.length === 0 ? (
                <div className="px-5 py-10 text-center sm:px-6">
                  <p className="text-sm" style={{ color: COLOR.subtle }}>
                    No payment records found.
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: COLOR.border }}>
                  {paymentRecords.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">
                            {formatMoney(payment.amountNgn)}
                          </p>

                          <StatusBadge
                            label={payment.type.replaceAll("_", " ")}
                            tone={
                              payment.type.includes("CONTENT_WORKSPACE")
                                ? "blue"
                                : payment.type.includes("PORTFOLIO")
                                  ? "gold"
                                  : "default"
                            }
                          />
                        </div>

                        <p
                          className="mt-1 text-xs"
                          style={{ color: COLOR.subtle }}
                        >
                          {payment.tier || "—"}
                          {payment.cycle
                            ? ` · ${payment.cycle}`
                            : ""}
                        </p>
                      </div>

                      <p
                        className="shrink-0 text-xs"
                        style={{ color: COLOR.subtle }}
                      >
                        {formatDateTime(payment.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Right rail */}
          <aside className="min-w-0 space-y-6">
            {/* Account snapshot */}
            <Section title="Account snapshot">
              <div className="divide-y" style={{ borderColor: COLOR.border }}>
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="text-xs" style={{ color: COLOR.subtle }}>
                    Email verified
                  </span>

                  <StatusBadge
                    label={creator.emailVerified ? "Yes" : "No"}
                    tone={creator.emailVerified ? "green" : "red"}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="text-xs" style={{ color: COLOR.subtle }}>
                    Account type
                  </span>

                  <span className="text-right text-xs font-semibold text-white">
                    {creator.accountType.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="text-xs" style={{ color: COLOR.subtle }}>
                    Comped
                  </span>

                  <StatusBadge
                    label={creator.isComped ? "Yes" : "No"}
                    tone={creator.isComped ? "gold" : "default"}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="text-xs" style={{ color: COLOR.subtle }}>
                    Discount
                  </span>

                  <span className="text-sm font-semibold text-white">
                    {creator.discountPercent}%
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="text-xs" style={{ color: COLOR.subtle }}>
                    View notifications
                  </span>

                  <StatusBadge
                    label={creator.notifyOnView ? "On" : "Off"}
                    tone={creator.notifyOnView ? "green" : "default"}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="text-xs" style={{ color: COLOR.subtle }}>
                    Last login
                  </span>

                  <span className="text-right text-xs font-medium text-white/80">
                    {formatDateTime(creator.lastLoginAt)}
                  </span>
                </div>
              </div>
            </Section>

            {/* Product footprint */}
            <Section title="Product footprint">
              <div className="space-y-2 p-4">
                <Link
                  href="/admin"
                  className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-white/[0.035]"
                  style={{ background: COLOR.panelSoft }}
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Project Delivery
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: COLOR.subtle }}
                    >
                      {creator.projects.length} projects
                    </p>
                  </div>

                  <span
                    className="text-lg"
                    style={{ color: COLOR.subtle }}
                  ><UiSymbol name="right" /></span>
                </Link>

                <Link
                  href="/dashboard/portfolio"
                  className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-white/[0.035]"
                  style={{ background: COLOR.panelSoft }}
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Portfolio
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: COLOR.subtle }}
                    >
                      {portfolioCount} portfolio
                      {portfolioCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <span
                    className="text-lg"
                    style={{ color: COLOR.subtle }}
                  ><UiSymbol name="right" /></span>
                </Link>

                <Link
                  href="/dashboard/calendars"
                  className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-white/[0.035]"
                  style={{ background: COLOR.panelSoft }}
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Marketing Workspace
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: COLOR.subtle }}
                    >
                      {calendarCount} workspace
                      {calendarCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <span
                    className="text-lg"
                    style={{ color: COLOR.subtle }}
                  ><UiSymbol name="right" /></span>
                </Link>
              </div>
            </Section>

            {/* Revenue */}
            <Section title="Revenue">
              <div className="space-y-2 p-4">
                <div
                  className="rounded-xl p-4"
                  style={{ background: COLOR.panelSoft }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase"
                    style={{
                      color: COLOR.subtle,
                      letterSpacing: "0.1em",
                    }}
                  >
                    Total
                  </p>

                  <p className="mt-2 text-2xl font-bold text-white">
                    {formatMoney(totalRevenue)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="rounded-xl p-4"
                    style={{ background: COLOR.panelSoft }}
                  >
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: COLOR.subtle }}
                    >
                      Delivery
                    </p>
                    <p className="mt-2 text-sm font-bold text-white">
                      {formatMoney(projectRevenue)}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-4"
                    style={{ background: COLOR.panelSoft }}
                  >
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: COLOR.subtle }}
                    >
                      Workspace
                    </p>
                    <p className="mt-2 text-sm font-bold text-white">
                      {formatMoney(contentWorkspaceRevenue)}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-4"
                    style={{ background: COLOR.panelSoft }}
                  >
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: COLOR.subtle }}
                    >
                      Portfolio
                    </p>
                    <p className="mt-2 text-sm font-bold text-white">
                      {formatMoney(portfolioRevenue)}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-4"
                    style={{ background: COLOR.panelSoft }}
                  >
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: COLOR.subtle }}
                    >
                      Payments
                    </p>
                    <p className="mt-2 text-sm font-bold text-white">
                      {paymentRecords.length}
                    </p>
                  </div>
                </div>

                {latestPayment && (
                  <div
                    className="mt-2 rounded-xl border p-4"
                    style={{
                      borderColor: COLOR.border,
                      background: "rgba(245,200,66,0.035)",
                    }}
                  >
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: COLOR.subtle }}
                    >
                      Latest payment
                    </p>

                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatMoney(latestPayment.amountNgn)}
                    </p>

                    <p
                      className="mt-1 text-xs"
                      style={{ color: COLOR.subtle }}
                    >
                      {formatDateTime(latestPayment.createdAt)}
                    </p>
                  </div>
                )}
              </div>
            </Section>

            {/* Activity snapshot */}
            <Section title="Activity snapshot">
              <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
                <div className="bg-[#111317] p-4">
                  <p
                    className="text-[10px] uppercase"
                    style={{ color: COLOR.subtle }}
                  >
                    Files
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {totalProjectMedia}
                  </p>
                </div>

                <div className="bg-[#111317] p-4">
                  <p
                    className="text-[10px] uppercase"
                    style={{ color: COLOR.subtle }}
                  >
                    Views
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {totalProjectViews}
                  </p>
                </div>

                <div className="bg-[#111317] p-4">
                  <p
                    className="text-[10px] uppercase"
                    style={{ color: COLOR.subtle }}
                  >
                    Client emails
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {viewerEmails.length}
                  </p>
                </div>

                <div className="bg-[#111317] p-4">
                  <p
                    className="text-[10px] uppercase"
                    style={{ color: COLOR.subtle }}
                  >
                    Payments
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {paymentRecords.length}
                  </p>
                </div>
              </div>
            </Section>

            {/* Admin navigation */}
            <div
              className="rounded-2xl border p-5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(245,200,66,0.08), rgba(255,255,255,0.02))",
                borderColor: "rgba(245,200,66,0.14)",
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase"
                style={{
                  color: COLOR.gold,
                  letterSpacing: "0.12em",
                }}
              >
                Admin
              </p>

              <p className="mt-2 text-sm font-semibold text-white">
                Full account activity
              </p>

              <p
                className="mt-1 text-xs leading-5"
                style={{ color: COLOR.subtle }}
              >
                Review this creator alongside the wider platform activity
                trail.
              </p>

              <Link
                href="/admin/activity"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                style={{ color: COLOR.gold }}
              >
                Open activity trail
                <span aria-hidden="true"><><UiSymbol name="right" /></></span>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
