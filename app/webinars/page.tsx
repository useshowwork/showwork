import { pageMetadata } from "@/lib/seo";
import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import Navbar from "@/components/Navbar";
import BlogFooter from "@/components/blog/BlogFooter";

const COLOR = { black: "#080808", offWhite: "#F7F4EC", blue: "#2478FF", yellow: "#FFCC00" };

export const metadata: Metadata = pageMetadata({
  "title": "Creative Business Webinars | Creativo by Showwork",
  "description": "Join Creativo webinars on pricing, positioning, client relationships and creative business growth for photographers, videographers and designers.",
  "path": "/webinars",
  "keywords": [
    "creative business webinars",
    "photography business training",
    "videography business tips"
  ]
});

// Same reasoning as every other admin-managed public page this
// session: no cookies()/headers() call of its own to otherwise force
// dynamic rendering, so this needs it explicitly or risks serving a
// stale cached snapshot that never reflects new or updated webinars.
export const dynamic = "force-dynamic";

export default async function WebinarsIndexPage() {
  const webinars = await db.creativoWebinar.findMany({
    orderBy: { startsAt: "desc" },
    include: { speakers: { orderBy: { displayOrder: "asc" }, take: 1 } },
  });

  const now = new Date();
  const upcoming = webinars.filter((w) => w.startsAt >= now).sort((a, b) => +a.startsAt - +b.startsAt);
  const past = webinars.filter((w) => w.startsAt < now);

  return (
    <main style={{ background: COLOR.offWhite }}>
      <div style={{ background: COLOR.black }}>
        <Navbar />
        <div className="px-6 pb-16 pt-40 md:px-16">
          <p className="mb-3 text-xs font-bold uppercase" style={{ color: COLOR.blue, letterSpacing: "0.24em" }}>Creativo</p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-6xl">
            Conversations that make your next move smarter.
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-16 md:px-16">
        {upcoming.length > 0 && (
          <div className="mb-16">
            <h2 className="mb-6 text-xs font-bold uppercase text-black/40" style={{ letterSpacing: "0.1em" }}>Upcoming</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {upcoming.map((w) => (
                <Link key={w.id} href={`/webinars/${w.slug}`} className="group overflow-hidden rounded-2xl border border-black/10 bg-white">
                  {w.flyerImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.flyerImageUrl} alt="" className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  )}
                  <div className="p-5">
                    <p className="mb-1.5 text-xs font-bold uppercase" style={{ color: COLOR.blue, letterSpacing: "0.1em" }}>
                      {w.startsAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                                                           <p className="text-lg font-bold text-black">{w.topic}</p>
                    {w.speakers[0] ? (
                      <div className="mt-2 flex items-center gap-2">
                        {w.speakers[0].profileImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={w.speakers[0].profileImageUrl} alt="" className="h-6 w-6 flex-shrink-0 rounded-full object-cover" />
                        )}
                        <p className="truncate text-sm text-black/45">
                          <span className="font-semibold text-black/60">{w.speakers[0].name}</span>
                          {" · "}{w.speakers[0].title}
                          {w.speakers.length > 1 ? ` + ${w.speakers.length - 1} more` : ""}
                        </p>
                      </div>
                    ) : (
                      w.guests && <p className="mt-1 truncate text-sm text-black/45">{w.guests}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <h2 className="mb-6 text-xs font-bold uppercase text-black/40" style={{ letterSpacing: "0.1em" }}>Past sessions</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((w) => (
                <Link key={w.id} href={`/webinars/${w.slug}`} className="group overflow-hidden rounded-2xl border border-black/10 bg-white opacity-75 transition-opacity hover:opacity-100">
                  {w.flyerImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.flyerImageUrl} alt="" className="aspect-[4/5] w-full object-cover" />
                  )}
                  <div className="p-4">
                    <p className="text-sm font-bold text-black">{w.topic}</p>
                    <p className="mt-1 text-xs text-black/40">{w.startsAt.toLocaleDateString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {webinars.length === 0 && <p className="text-sm text-black/40">No webinars yet — check back soon.</p>}
      </div>

      <BlogFooter />
    </main>
  );
}
