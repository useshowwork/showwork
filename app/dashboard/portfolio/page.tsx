import ShowworkLogo from "@/components/brand/ShowworkLogo";
import PortfolioHelpLink from "@/components/help/PortfolioHelpLink";
import UiSymbol from "@/components/ui/UiSymbol";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import CreatePortfolioForm from "@/components/portfolio/CreatePortfolioForm";
import AgencyPortfolioList from "@/components/portfolio/AgencyPortfolioList";

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 2.8 13.7 9l6.2 1.7-6.2 1.7-1.7 6.2-1.7-6.2-6.2-1.7L10.3 9 12 2.8Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M5 12h14M14 7l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PortfolioMark() {
  return (
    <div className="relative h-[88px] w-[88px]">
      <div className="absolute inset-0 rounded-[28px] border border-[#DCE5F5] bg-white shadow-[0_15px_40px_rgba(36,120,255,0.08)]" />

      <div className="absolute left-[17px] top-[18px] h-[53px] w-[53px] overflow-hidden rounded-[17px] bg-[#F0F5FF]">
        <div className="absolute left-[10px] top-[11px] h-[34px] w-[34px] rounded-full border border-[#2478FF]/20" />
        <div className="absolute left-[17px] top-[18px] h-[20px] w-[20px] rounded-full border border-[#2478FF]/25" />
        <div className="absolute bottom-[8px] left-[8px] h-[2px] w-[23px] rounded-full bg-[#2478FF]" />
      </div>
    </div>
  );
}

export default async function PortfolioEntryPage() {
  const creator = await getCurrentCreator();

  if (!creator) redirect("/login");

  /*
   * AGENCY
   * ---------------------------------------------------------
   * Agencies see all of their portfolios.
   * Existing billing and database behaviour is preserved.
   */
  if (creator.accountType === "AGENCY") {
    const portfolios = await db.portfolio.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        companyName: true,
        slug: true,
        billingStatus: true,
      },
    });

    return (
      <Suspense
        fallback={
          <main className="min-h-screen bg-[#F7F8FA]">
            <div className="flex min-h-screen items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#E1E5EB] border-t-[#2478FF]" />
                <p className="text-sm text-[#858A92]">
                  Loading your portfolios...
                </p>
              </div>
            </div>
          </main>
        }
      >
        <div className="min-h-screen bg-[#F7F8FA]">
          {/* subtle page atmosphere */}
          <div
            className="pointer-events-none fixed inset-0 opacity-70"
            aria-hidden
            style={{
              background:
                "radial-gradient(circle at 85% 0%, rgba(36,120,255,0.10), transparent 30%), radial-gradient(circle at 0% 30%, rgba(100,80,255,0.05), transparent 28%)",
            }}
          />

          <div className="relative">
            {/* top bar */}
            <header className="border-b border-[#E5E8ED] bg-white/85 backdrop-blur-xl">
              <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-5 sm:px-7 lg:px-10">
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center gap-2 text-xs font-semibold text-[#747982] transition-colors hover:text-[#0A0A0A]"
                >
                  <span className="transition-transform duration-300 group-hover:-translate-x-0.5"><UiSymbol name="left" /></span>
                  All apps
                </Link>

                <ShowworkLogo width={96}/>

                <div className="w-[55px]" />
              </div>
            </header>

            {/* hero */}
            <section className="relative overflow-hidden border-b border-[#E5E8ED] bg-white">
              <div
                className="pointer-events-none absolute -right-24 -top-40 h-[520px] w-[520px] rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(36,120,255,0.15), rgba(36,120,255,0.04) 40%, transparent 70%)",
                }}
              />

              <div
                className="pointer-events-none absolute right-[8%] top-[20%] h-[260px] w-[260px] rounded-full border border-[#2478FF]/10"
                aria-hidden
              >
                <div className="absolute inset-[30px] rounded-full border border-[#2478FF]/[0.07]" />
                <div className="absolute inset-[60px] rounded-full border border-[#2478FF]/[0.05]" />
              </div>

              <div className="relative mx-auto max-w-[1400px] px-5 pb-16 pt-14 sm:px-7 md:pb-20 md:pt-20 lg:px-10 lg:pt-24">
                <div className="max-w-[850px]">
                  <div className="mb-7 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2478FF]">
                      <SparkIcon className="h-4 w-4" />
                    </span>

                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2478FF]">
                      Portfolio studio
                    </span>
                  </div>

                  <h1 className="text-[50px] font-semibold leading-[0.95] tracking-[-0.06em] text-[#090A0C] sm:text-[64px] md:text-[78px]">
                    The work speaks.
                    <br />
                    <span className="text-[#A0A5AD]">
                      Make sure it looks the part.
                    </span>
                  </h1>

                  <p className="mt-7 max-w-[650px] text-[15px] leading-7 text-[#71767F] sm:text-[17px]">
                    Build a beautiful public home for your work. Curate your
                    best projects, tell your story, collect testimonials and
                    give potential clients a reason to get in touch.
                  </p>
                </div>

                <div className="mt-12 flex items-center gap-8 border-t border-[#E7E9ED] pt-5">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">
                      {portfolios.length}
                    </p>
                    <p className="mt-0.5 text-xs text-[#858A92]">
                      {portfolios.length === 1
                        ? "portfolio"
                        : "portfolios"}
                    </p>
                  </div>

                  <div className="h-8 w-px bg-[#E1E4E9]" />

                  <div>
                    <p className="text-sm font-semibold text-[#24262A]">
                      Client-ready presentation
                    </p>
                    <p className="mt-0.5 text-xs text-[#858A92]">
                      Designed to make your work the focus.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* portfolio content */}
            <section className="relative mx-auto max-w-[1400px] px-5 py-12 sm:px-7 md:py-16 lg:px-10 lg:py-20">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2478FF]">
                    Your portfolio collection
                  </p>

                  <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[#0A0A0A]">
                    Your portfolios
                  </h2>
                </div>

                <div className="hidden text-right sm:block">
                  <p className="text-xs text-[#92969E]">
                    {portfolios.length === 0
                      ? "Start your first portfolio"
                      : "Choose a portfolio to continue"}
                  </p>
                </div>
              </div>

              {/* Existing agency component remains responsible for
                  portfolio creation, billing and interaction. */}
              <div className="mb-4 flex justify-end"><PortfolioHelpLink/></div><AgencyPortfolioList initialPortfolios={portfolios} />
            </section>
          </div>
        </div>
      </Suspense>
    );
  }

  /*
   * REGULAR CREATOR
   * ---------------------------------------------------------
   */
  const portfolio = await db.portfolio.findFirst({
    where: { creatorId: creator.id },
    select: { id: true },
  });

  if (!portfolio) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#F7F8FA]">
        {/* atmospheric background */}
        <div
          className="pointer-events-none fixed inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 82% 5%, rgba(36,120,255,0.12), transparent 30%), radial-gradient(circle at 5% 45%, rgba(100,80,255,0.05), transparent 28%)",
          }}
        />

        {/* navigation */}
        <header className="relative z-10 border-b border-[#E5E8ED] bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-5 sm:px-7 lg:px-10">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 text-xs font-semibold text-[#747982] transition-colors hover:text-[#0A0A0A]"
            >
              <span className="transition-transform duration-300 group-hover:-translate-x-0.5"><UiSymbol name="left" /></span>
              All apps
            </Link>

            <ShowworkLogo width={96}/>

            <div className="w-[55px]" />
          </div>
        </header>

        <section className="relative">
          <div
            className="pointer-events-none absolute right-[4%] top-[-100px] hidden h-[430px] w-[430px] rounded-full border border-[#2478FF]/10 lg:block"
            aria-hidden
          >
            <div className="absolute inset-[40px] rounded-full border border-[#2478FF]/[0.07]" />
            <div className="absolute inset-[85px] rounded-full border border-[#2478FF]/[0.05]" />
          </div>

          <div className="relative mx-auto max-w-[1400px] px-5 pb-20 pt-14 sm:px-7 md:pb-28 md:pt-20 lg:px-10 lg:pt-24">
            <div className="grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
              {/* visual */}
              <div className="hidden lg:block">
                <PortfolioMark />

                <div className="mt-8 max-w-[360px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2478FF]">
                    Your public presence
                  </p>

                  <p className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.04em] text-[#111317]">
                    Turn your body of work into an experience.
                  </p>

                  <p className="mt-4 text-sm leading-6 text-[#858A92]">
                    Your portfolio is more than a gallery. It is the first
                    impression of your creative business.
                  </p>
                </div>
              </div>

              {/* form */}
              <div>
                <div className="mb-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2478FF]">
                    Create your portfolio
                  </p>

                  <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[#090A0C] sm:text-5xl">
                    Let&apos;s build your
                    <br />
                    <span className="text-[#9DA2AA]">best first impression.</span>
                  </h1>

                  <p className="mt-5 max-w-[560px] text-sm leading-6 text-[#777C84]">
                    Start with the essentials. You can refine the design,
                    upload your work, add testimonials and shape the entire
                    experience after your portfolio is created.
                  </p>
                </div>

                <div className="rounded-[30px] border border-[#E1E5EB] bg-white p-5 shadow-[0_25px_80px_rgba(20,30,50,0.07)] sm:p-8">
                  <div className="mb-4 flex justify-end"><PortfolioHelpLink/></div><CreatePortfolioForm />
                </div>

                <div className="mt-6 flex items-center gap-2 text-xs text-[#969AA2]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EDF3FF] text-[#2478FF]">
                    <ArrowIcon className="h-3 w-3 -rotate-45" />
                  </span>

                  You can change everything later.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  redirect(`/dashboard/portfolio/${portfolio.id}`);
}