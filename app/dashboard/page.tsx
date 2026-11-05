import { TOOL_COPY } from "@/components/dashboard/toolCopy";
import WorkspaceCard from "@/components/dashboard/WorkspaceCard";
import workspaceStyles from "@/components/dashboard/WorkspaceCard.module.css";
import BillingBenefits from "@/components/billing/BillingBenefits";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import { isAdminEmail } from "@/lib/admin";

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);

  return (
    (parts[0]?.[0] ?? "").toUpperCase() +
    (parts[1]?.[0] ?? "").toUpperCase()
  );
}

/* -------------------------------------------------------------------------- */
/*                                   ICONS                                    */
/* -------------------------------------------------------------------------- */

function ArrowUpRightIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7 17 17 7M9 7h8v8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PortfolioIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />

      <circle
        cx="8.5"
        cy="9"
        r="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />

      <path
        d="M3 16l5-5 4 4 3-3 6 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeliveryIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />

      <path
        d="M8 9h8M8 13h5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      <path
        d="m15.5 16.5 2.5-2.5 2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorkspaceIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />

      <path
        d="M3 9.5h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      <path
        d="M7 13h3M14 13h3M7 16.5h3M14 16.5h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   LOGO                                     */
/* -------------------------------------------------------------------------- */

function Logo() {
  return (
    <div
      role="img"
      aria-label="Showwork"
      className="h-[20px] w-[80px]"
      style={{
        backgroundColor: "#090A0C",
        WebkitMaskImage: "url(/images/logo/sw.svg)",
        maskImage: "url(/images/logo/sw.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                              DASHBOARD PAGE                                */
/* -------------------------------------------------------------------------- */

export default async function DashboardPage() {
  const creator = await getCurrentCreator();

  if (!creator) {
    redirect("/login");
  }

  const [portfolio, calendar, projectCount] = await Promise.all([
    db.portfolio.findFirst({
      where: {
        creatorId: creator.id,
      },
      select: {
        id: true,
      },
    }),

    db.socialCalendar.findFirst({
      where: {
        managerId: creator.id,
      },
      select: {
        id: true,
      },
    }),

    db.project.count({
      where: {
        creatorId: creator.id,
        deletedAt: null,
      },
    }),
  ]);

  const firstName = creator.name?.trim().split(" ")[0];
  const admin = isAdminEmail(creator.email);

  return (
    <main className={`${workspaceStyles.page} min-h-screen text-[#101114] [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-[#175CD3]`}>
      {/* ------------------------------------------------------------------ */}
      {/*                              NAVBAR                                */}
      {/* ------------------------------------------------------------------ */}

      <header className="sticky top-0 z-50 border-b border-[#DCE4F0] bg-[#F3F6FB]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between sm:h-[70px]">
            {/* Logo */}
            <Link
              href="/dashboard"
              aria-label="Showwork dashboard"
              className="flex shrink-0 items-center gap-5"
            >
              <Logo />
              <span className="hidden border-l border-[#CCD8EA] pl-5 text-xs font-medium text-[#526780] sm:block">Your creative HQ</span>
            </Link>

            {/* ------------------------------------------------------------ */}
            {/*                        DESKTOP NAV                            */}
            {/* ------------------------------------------------------------ */}

            <div className="hidden items-center gap-2 lg:flex">
              <Link
  href="/dashboard/profile"
  className="rounded-full px-3.5 py-2 text-sm font-semibold text-[#555B65] transition-colors duration-150 hover:bg-[#F5F6F8] hover:text-[#101114]"
>
  Profile
</Link>

<Link
  href="/dashboard/partners"
  className="rounded-full px-3.5 py-2 text-sm font-semibold text-[#555B65] transition-colors duration-150 hover:bg-[#F5F6F8] hover:text-[#101114]"
>
  Partner Program
</Link>

{admin && (
                <Link
                  href="/admin"
                  className="rounded-full px-3.5 py-2 text-sm font-semibold text-[#555B65] transition-colors duration-150 hover:bg-[#F5F6F8] hover:text-[#101114]"
                >
                  Admin
                </Link>
              )}

              <Link
                href="/dashboard/billing?product=delivery#project-delivery-plans"
                className="rounded-full border border-[#E1E4E9] bg-white px-3.5 py-2 text-sm font-semibold text-[#555B65] transition-colors duration-150 hover:border-[#CBD1DA] hover:bg-[#F9FAFB] hover:text-[#101114]"
              >
                Billing
              </Link>

              {/* Avatar */}
              <Link
                href="/dashboard/profile"
                className="ml-1 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#EDF3FF] text-sm font-bold text-[#2478FF] ring-1 ring-[#D8E6FF]"
                aria-label="Profile"
              >
                {creator.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creator.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(creator.name, creator.email)
                )}
              </Link>

              <div className="ml-1">
                <LogoutButton />
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/*                         MOBILE NAV                            */}
            {/* ------------------------------------------------------------ */}

            <div className="flex items-center gap-2 lg:hidden">
              {/* Mobile avatar */}
              <Link
                href="/dashboard/profile"
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#EDF3FF] text-sm font-bold text-[#2478FF] ring-1 ring-[#D8E6FF]"
                aria-label="Profile"
              >
                {creator.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creator.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(creator.name, creator.email)
                )}
              </Link>

              {/* Native mobile menu */}
              <details className="relative">
                <summary
                  aria-label="Open navigation menu"
                  className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-[#E1E4E9] bg-white text-[#555B65] transition-colors duration-150 hover:bg-[#F5F6F8] [&::-webkit-details-marker]:hidden"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-[18px] w-[18px]"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 7h16M4 12h16M4 17h16"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </summary>

                <div className="absolute right-0 top-[calc(100%+10px)] w-[230px] overflow-hidden rounded-[20px] border border-[#E2E5E9] bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                  {/* Account */}
                  <div className="border-b border-[#ECEEF1] px-3 pb-3 pt-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#A0A5AD]">
                      Account
                    </p>

                    <p className="mt-1 truncate text-sm font-semibold text-[#25282D]">
                      {creator.name?.trim() || creator.email}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-[#9298A1]">
                      {creator.email}
                    </p>
                  </div>

                  {/* Navigation */}
                  <div className="py-1">
                    <Link
  href="/dashboard/profile"
  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-[#555B65] transition-colors duration-150 hover:bg-[#F5F6F8] hover:text-[#101114]"
>
  <span>Profile</span>

  <ArrowUpRightIcon className="h-3.5 w-3.5 text-[#A0A5AD]" />
</Link>

<Link
  href="/dashboard/partners"
  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-[#555B65] transition-colors duration-150 hover:bg-[#F5F6F8] hover:text-[#101114]"
>
  <span>Partner Program</span>

  <ArrowUpRightIcon className="h-3.5 w-3.5 text-[#A0A5AD]" />
</Link>

{admin && (
                      <Link
                        href="/admin"
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-[#555B65] transition-colors duration-150 hover:bg-[#F5F6F8] hover:text-[#101114]"
                      >
                        <span>Admin</span>

                        <ArrowUpRightIcon className="h-3.5 w-3.5 text-[#A0A5AD]" />
                      </Link>
                    )}

                    <Link
                      href="/dashboard/billing?product=delivery#project-delivery-plans"
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-[#555B65] transition-colors duration-150 hover:bg-[#F5F6F8] hover:text-[#101114]"
                    >
                      <span>Billing</span>

                      <ArrowUpRightIcon className="h-3.5 w-3.5 text-[#A0A5AD]" />
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-[#ECEEF1] px-2 pb-1 pt-2">
                    <div className="flex justify-center">
                      <LogoutButton />
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/*                              CONTENT                               */}
      {/* ------------------------------------------------------------------ */}

      <div className={workspaceStyles.shell}>
        <div className={workspaceStyles.topGreeting}>
          <h1>{firstName ? `Good to see you, ${firstName}.` : "Good to see you."}</h1>
        </div>
        <section aria-labelledby="workspace-actions" className="scroll-mt-24">
          <div className={workspaceStyles.sectionHeading}>
            <div><h2 id="workspace-actions">Choose the right tool for your work</h2><p>Click a tool to get started.</p></div>
          </div>
          <div className={workspaceStyles.grid}>
            <WorkspaceCard variant="workspace" product={TOOL_COPY.workspace.product} description={TOOL_COPY.workspace.description} href="/dashboard/calendars" action={calendar ? TOOL_COPY.workspace.openAction : TOOL_COPY.workspace.createAction} icon={<WorkspaceIcon />} />
            <WorkspaceCard variant="delivery" product={TOOL_COPY.delivery.product} description={TOOL_COPY.delivery.description} href={projectCount > 0 ? "/dashboard/projects" : "/dashboard/start"} action={projectCount > 0 ? TOOL_COPY.delivery.openAction : TOOL_COPY.delivery.createAction} icon={<DeliveryIcon />} />
            <WorkspaceCard variant="portfolio" product={TOOL_COPY.portfolio.product} description={TOOL_COPY.portfolio.description} href="/dashboard/portfolio" action={portfolio ? TOOL_COPY.portfolio.openAction : TOOL_COPY.portfolio.createAction} icon={<PortfolioIcon />} />
          </div>
        </section>
        <section className={`${workspaceStyles.hero} mt-7`} aria-labelledby="dashboard-welcome">
          <svg className={workspaceStyles.heroLines} viewBox="0 0 800 600" fill="none" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${170 + i * 26} -50 C${-160 + i * 30} 260 ${850 + i * 18} 90 ${420 + i * 35} 680`} stroke="#8fb8ff" strokeWidth="1" />)}
          </svg>
          <div>
            <p className={workspaceStyles.eyebrow}>The creative business, connected</p>
            <h2 id="dashboard-welcome" className={workspaceStyles.heroTitle}>Less back and forth.<br /><em>More great work.</em></h2>
            <p className={workspaceStyles.heroDescription}>Your clients, content, and creative projects. One thoughtful space to bring it all together.</p>
            <div className={workspaceStyles.heroLinks}>
              <a href="#workspace-actions" className={workspaceStyles.heroLink}>Explore your tools <ArrowUpRightIcon /></a>
              <Link href="/dashboard/profile" className={`${workspaceStyles.heroLink} ${workspaceStyles.heroLinkSecondary}`}>Your profile <ArrowUpRightIcon /></Link>
            </div>
          </div>
          <div className={workspaceStyles.heroAside}>
            <p className={workspaceStyles.asideLabel}>Your workspace at a glance</p>
            <div className={workspaceStyles.statusRow}><span>Marketing Workspace</span><b>{calendar ? "Ready to open" : "Ready to create"}</b></div>
            <div className={workspaceStyles.statusRow}><span>Project Delivery</span><b>{projectCount} {projectCount === 1 ? "project" : "projects"}</b></div>
            <div className={workspaceStyles.statusRow}><span>Portfolio</span><b>{portfolio ? "Created" : "Free to create"}</b></div>
            <p className={workspaceStyles.asideFoot}>Start where you need us.<br />The rest is here when you’re ready.</p>
          </div>
        </section>
        <BillingBenefits creator={creator} />
        <footer className={workspaceStyles.footer}>
          <div className="flex items-center gap-4"><Logo /><span>A little more room to create.</span></div>
          <div className={workspaceStyles.footerLinks}><Link href="/dashboard/profile">Account</Link><Link href="/dashboard/billing">Billing</Link><Link href="/help/workspace">Help &amp; guides</Link><a href="mailto:hello@useshowwork.com">Support</a></div>
        </footer>
      </div>
    </main>
  );
}
