import { socialPreviewImage } from "@/lib/seo";
import UiSymbol from "@/components/ui/UiSymbol";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import Navbar from "@/components/Navbar";
import BlogFooter from "@/components/blog/BlogFooter";
import BlogPromoCTA from "@/components/blog/BlogPromoCTA";

const COLOR = { black: "#080808", offWhite: "#F7F4EC", blue: "#2478FF", ink: "#101010" };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await db.blogPost.findUnique({
    where: { slug },
    select: { title: true, excerpt: true, metaTitle: true, metaDescription: true, coverImageUrl: true, published: true },
  });

  if (!post || !post.published) {
    return { title: "Post not found | Showwork", robots: { index: false, follow: false } };
  }

  const title = (post.metaTitle || `${post.title} | Showwork`).slice(0, 60);
  const rawDescription = post.metaDescription || post.excerpt || "Creative business advice for photographers, videographers and independent creators.";
  const description = rawDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  const image = socialPreviewImage.url;

  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { title, description, url: `/blog/${slug}`, siteName: "Showwork", images: [{ url: image, width: socialPreviewImage.width, height: socialPreviewImage.height, alt: socialPreviewImage.alt }], type: "article" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

// Splits the stored HTML on real </p> boundaries — the safest,
// simplest block tag to split on since it never nests inside itself.
// Used to insert the two promo CTAs at genuine points within the
// article rather than only ever at the very end.
function splitAtParagraph(html: string, index: number): [string, string] {
  const parts = html.split(/(<\/p>)/);
  const cut = Math.min(index * 2, parts.length);
  return [parts.slice(0, cut).join(""), parts.slice(cut).join("")];
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = await db.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) notFound();

  db.blogPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const paragraphCount = (post.bodyHtml.match(/<\/p>/g) || []).length;
  const firstSplit = Math.max(2, Math.floor(paragraphCount / 3));
  const secondSplit = Math.max(firstSplit + 1, Math.floor((paragraphCount * 2) / 3));

  let bodyPart1 = post.bodyHtml;
  let bodyPart2 = "";
  let bodyPart3 = "";

  if (paragraphCount >= 4) {
    const [firstHalf, rest] = splitAtParagraph(post.bodyHtml, firstSplit);
    const [middle, last] = splitAtParagraph(rest, secondSplit - firstSplit);
    bodyPart1 = firstHalf;
    bodyPart2 = middle;
    bodyPart3 = last;
  }

  return (
    <main style={{ background: COLOR.offWhite }}>
      <div style={{ background: COLOR.black }}>
        <Navbar />

        <div className="relative overflow-hidden px-6 pb-16 pt-40 md:px-16 md:pb-24">
          {post.coverImageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(8,8,8,0.5) 0%, rgba(8,8,8,0.85) 100%)" }} />
            </>
          )}
          <div className="relative mx-auto max-w-3xl">
            <Link href="/blog" className="mb-6 inline-flex items-center gap-2 text-sm hover:underline" style={{ color: COLOR.blue }}><>{" "}<UiSymbol name="left" />{" All posts "}</></Link>
            {post.category && (
              <p className="mb-3 text-xs font-bold uppercase" style={{ color: COLOR.blue, letterSpacing: "0.22em" }}>
                {post.category}
              </p>
            )}
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">
              {post.title}
            </h1>
            {post.publishedAt && (
              <p className="mt-5 text-sm text-white/40">
                {post.publishedAt.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-16 md:px-0 md:py-20">
        <div className="blog-body" dangerouslySetInnerHTML={{ __html: bodyPart1 }} />
        {bodyPart2 && (
          <>
            <BlogPromoCTA variant="deliver" postSlug={post.slug} />
            <div className="blog-body" dangerouslySetInnerHTML={{ __html: bodyPart2 }} />
            <BlogPromoCTA variant="portfolio" postSlug={post.slug} />
            <div className="blog-body" dangerouslySetInnerHTML={{ __html: bodyPart3 }} />
          </>
        )}
        {!bodyPart2 && <BlogPromoCTA variant="deliver" postSlug={post.slug} />}
      </article>

      <style>{`
        .blog-body { color: ${COLOR.ink}; }
        .blog-body h2 { font-size: 1.75rem; font-weight: 700; margin: 2rem 0 0.75rem; color: ${COLOR.ink}; }
        .blog-body h3 { font-size: 1.375rem; font-weight: 700; margin: 1.5rem 0 0.5rem; color: ${COLOR.ink}; }
        .blog-body p { margin: 0.75rem 0; line-height: 1.8; font-size: 1.0625rem; }
        .blog-body strong { font-weight: 700; }
        .blog-body em { font-style: italic; }
        .blog-body ul { list-style: disc; padding-left: 1.5rem; margin: 0.75rem 0; }
        .blog-body ol { list-style: decimal; padding-left: 1.5rem; margin: 0.75rem 0; }
        .blog-body li { margin: 0.35rem 0; line-height: 1.7; }
        .blog-body blockquote { border-left: 3px solid ${COLOR.blue}; padding-left: 1.25rem; margin: 1.5rem 0; color: rgba(16,16,16,0.6); font-style: italic; }
        .blog-body a { color: ${COLOR.blue}; text-decoration: underline; }
        .blog-body img { border-radius: 0.75rem; max-width: 100%; margin: 1.5rem 0; }
        .blog-body video { border-radius: 0.75rem; max-width: 100%; margin: 1.5rem 0; }
      `}</style>

      <BlogFooter />
    </main>
  );
}
