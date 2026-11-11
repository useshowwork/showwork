import { pageMetadata } from "@/lib/seo";
import { Metadata } from "next";
import { db } from "@/lib/db";
import CreativoContent from "@/components/creativo/CreativoContent";

export const metadata: Metadata = pageMetadata({
  "title": "Creativo: Community for Photographers & Creators | Showwork",
  "description": "Connect with photographers, videographers and designers in Creativo. Explore creative challenges, peer feedback, referrals and business webinars.",
  "path": "/creativo",
  "keywords": [
    "creative community Nigeria",
    "photographer community",
    "videographer community",
    "creative networking",
    "Creativo"
  ]
});

export const dynamic = "force-dynamic";



export default async function CreativoPage() {
  const [settings, entries, webinars] = await Promise.all([
    db.platformSettings.findUnique({ where: { id: "singleton" } }),
    // Recent entries only — the public page only ever shows "this
    // month" / "last month," so there's no need to pull the entire
    // history down to the client.
    db.creativoLeaderboardEntry.findMany({
      orderBy: [{ periodDate: "desc" }, { points: "desc" }],
      take: 100,
    }),
        db.creativoWebinar.findMany({ orderBy: { startsAt: "desc" }, include: { speakers: { orderBy: { displayOrder: "asc" }, take: 1 } } }),
  ]);

  return (
    <CreativoContent
      memberCountLabel={settings?.creativoMemberCountLabel ?? null}
      entries={entries.map((e) => ({ ...e, periodDate: e.periodDate.toISOString() }))}
      webinars={webinars.map((w) => ({ ...w, startsAt: w.startsAt.toISOString() }))}
    />
  );
}
