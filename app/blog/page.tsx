import { pageMetadata } from "@/lib/seo";
import { Metadata } from "next";
import { db } from "@/lib/db";
import Navbar from "@/components/Navbar";
import BlogListClient from "@/components/blog/BlogListClient";
import BlogFooter from "@/components/blog/BlogFooter";

const COLOR = { black: "#080808", offWhite: "#F7F4EC", blue: "#2478FF" };

export const metadata: Metadata = pageMetadata({
  "title": "Marketing & Creative Business Blog | Showwork",
  "description": "Explore practical guides to content planning, social media workflows, creative business pricing, client delivery and building a professional portfolio.",
  "path": "/blog",
  "keywords": [
    "content marketing guides",
    "social media workflow",
    "creative business advice",
    "photography business pricing",
    "portfolio tips"
  ]
});

// Without this, Next.js can treat this page as fully static (no
// cookies()/headers() call to otherwise force it dynamic) and serve
// a cached HTML snapshot from the very first time it rendered —
// meaning a newly published post would never show up here, no matter
// how correctly it saved on the admin side.
export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const posts = await db.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, category: true, publishedAt: true },
  });

  // Unique, non-empty categories, in the order they first appear —
  // no separate category model needed for a filter bar this simple.
  const categories = Array.from(
    new Set(posts.map((p) => p.category).filter((c): c is string => Boolean(c)))
  );

  return (
    <main>
      {/* ── FIXED HERO — a real position:fixed layer, not
          background-attachment:fixed. That CSS property is
          unreliable on iOS Safari specifically, so a fixed div
          behind the scrolling content is the technique that actually
          holds the image in place across every device. ── */}
      <div className="fixed inset-0 z-0 h-screen w-full overflow-hidden" style={{ background: COLOR.black }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero1.png" alt="" className="h-full w-full object-cover opacity-45" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(8,8,8,0.55) 0%, rgba(8,8,8,0.75) 55%, #F7F4EC 100%)" }}
        />
      </div>

      {/* Spacer content sitting over the fixed background — the hero
          copy itself, tall enough that the background reads as a
          real hero section before the page content scrolls over it. */}
      <div className="relative min-h-screen">
        <Navbar />
        <div className="flex min-h-screen flex-col justify-end px-6 pb-20 pt-40 md:px-16 md:pb-28">
          <p className="text-xs font-bold uppercase" style={{ color: COLOR.blue, letterSpacing: "0.24em" }}>Showwork blog</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[0.95] tracking-[-0.05em] text-white md:text-7xl">
            Pricing, positioning, and getting paid what you&apos;re worth.
          </h1>
        </div>
      </div>

      {/* Actual scrolling content — sits above the fixed background
          via its own opaque surface, since the fixed layer is behind
          everything at -z-10. */}
      <div className="relative" style={{ background: COLOR.offWhite }}>
        <div className="mx-auto max-w-5xl px-6 py-16 md:px-16 md:py-24">
          {posts.length === 0 ? (
            <p className="text-sm text-black/40">No posts published yet — check back soon.</p>
          ) : (
            <BlogListClient posts={posts.map((p) => ({ ...p, publishedAt: p.publishedAt?.toISOString() ?? null }))} categories={categories} />
          )}
        </div>

        <BlogFooter />
      </div>
    </main>
  );
}
