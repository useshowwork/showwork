import { pageMetadata } from "@/lib/seo";
import { Metadata } from "next";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { portfolioUrl } from "@/lib/portfolioUrl";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/landing/SiteFooter";
import SpotlightHero from "@/components/spotlight/SpotlightHero";
import SpotlightSubmissionForm from "@/components/spotlight/SpotlightSubmissionForm";
import SpotlightLeaderboardSection from "@/components/spotlight/SpotlightLeaderboardSection";

const COLOR = { offWhite: "#F7F4EC" };

const DEFAULT_HEADLINE = "Great work deserves to be seen.";
const DEFAULT_DESCRIPTION =
  "Every month, we spotlight the strongest client work submitted by creators — real projects, judged on real craft. Submit yours for a shot at the monthly Top 3.";

export const metadata: Metadata = pageMetadata({
  "title": "Monthly Creator Spotlight & Portfolio Competition | Showwork",
  "description": "Submit your best creative project to the Showwork Monthly Spotlight. Discover featured photography, video and design work from the Creativo community.",
  "path": "/spotlight",
  "keywords": [
    "creator spotlight",
    "creative portfolio competition",
    "photography showcase",
    "videography showcase"
  ]
});

// Same reasoning as /creativo: no cookies()/headers() call of its own
// to otherwise force dynamic rendering, and it reads admin-managed
// data (cycle activation, deadlines) that changes regularly — without
// this it risks being cached as a static snapshot that never reflects
// those changes.
export const dynamic = "force-dynamic";

// Pure submission intake — hero and form only. Results live on the
// existing Creativo leaderboard (/creativo), not a second, separate
// one here; ranking a submission in the admin creates a real entry
// on that same leaderboard directly.
export default async function SpotlightPage() {
  const [activeCycle, loggedInCreator, leaderboardEntries] = await Promise.all([
    db.spotlightCycle.findFirst({ where: { isActive: true } }),
    getCurrentCreator(),
    db.creativoLeaderboardEntry.findMany({ orderBy: [{ periodDate: "desc" }, { points: "desc" }] }),
  ]);

  const now = new Date();
  const isOpen = !!activeCycle && now >= activeCycle.submissionOpensAt && now <= activeCycle.submissionDeadline;

  let creatorPortfolioUrl: string | null = null;
  if (loggedInCreator) {
    const portfolio = await db.portfolio.findFirst({ where: { creatorId: loggedInCreator.id }, select: { slug: true } });
    if (portfolio) creatorPortfolioUrl = portfolioUrl(portfolio.slug);
  }

  return (
    <main style={{ background: COLOR.offWhite }}>
      <div style={{ background: "#080808" }}>
        <Navbar />
      </div>

      <SpotlightHero
        heroImageUrl={activeCycle?.heroImageUrl ?? null}
        headline={activeCycle?.heroHeadline || DEFAULT_HEADLINE}
        description={activeCycle?.heroDescription || DEFAULT_DESCRIPTION}
        isOpen={isOpen}
      />

      <section className="px-6 py-20 md:px-16">
        <SpotlightSubmissionForm
          isOpen={isOpen}
          defaultName={loggedInCreator?.name ?? ""}
          defaultEmail={loggedInCreator?.email ?? ""}
          
        />
      </section>

      <SpotlightLeaderboardSection
        entries={leaderboardEntries.map((e) => ({ ...e, periodDate: e.periodDate.toISOString() }))}
      />
      <SiteFooter />
    </main>
  );
}
