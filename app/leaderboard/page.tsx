import { pageMetadata } from "@/lib/seo";
import { Metadata } from "next";
import { db } from "@/lib/db";
import Navbar from "@/components/Navbar";
import BlogFooter from "@/components/blog/BlogFooter";
import LeaderboardPageContent from "@/components/leaderboard/LeaderboardPageContent";

export const metadata: Metadata = pageMetadata({
  "title": "Creativo Leaderboard & Monthly Spotlight Winners | Showwork",
  "description": "Discover Creativo Spotlight winners and ranked creative projects. Browse photographers, videographers and designers by category and month.",
  "path": "/leaderboard",
  "keywords": [
    "Creativo leaderboard",
    "creator spotlight winners",
    "creative community rankings"
  ]
});

// Same reasoning as /creativo and /spotlight: reads admin-managed
// data that changes regularly (new rankings), with no cookies()/
// headers() call of its own to otherwise force dynamic rendering.
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const entries = await db.creativoLeaderboardEntry.findMany({
    orderBy: [{ periodDate: "desc" }, { points: "desc" }],
  });

  return (
    <main>
      <Navbar />
      <LeaderboardPageContent entries={entries.map((e) => ({ ...e, periodDate: e.periodDate.toISOString() }))} />
      <BlogFooter />
    </main>
  );
}
