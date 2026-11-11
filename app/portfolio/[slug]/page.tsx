import { socialPreviewImage } from "@/lib/seo";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { publicUrlFor } from "@/lib/r2";
import PortfolioContent from "@/components/portfolio/PortfolioContent";
import type { PortfolioMediaItem } from "@/components/portfolio/PortfolioMediaModal";

// A lightweight, separate query — only what's needed for the
// shared-link preview, not the full portfolio with all its
// sections/media/testimonials includes.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
    const portfolio = await db.portfolio.findUnique({
    where: { slug },
    select: {
      companyName: true,
      heroTagline: true,
    },
  });

  if (!portfolio) {
    return { title: "Portfolio not found | Showwork", robots: { index: false, follow: false } };
  }

  const title = `${portfolio.companyName.slice(0, 45)} Portfolio | Showwork`;
  const description = (portfolio.heroTagline
    ? `${portfolio.heroTagline} Explore ${portfolio.companyName}'s creative portfolio, selected work and services.`
    : `Explore ${portfolio.companyName}'s creative portfolio, featured work and services. View projects and get in touch.`).replace(/\s+/g, " ").trim().slice(0, 160);

  const image = socialPreviewImage.url;

  return {
    title,
    description,
    alternates: { canonical: `/portfolio/${slug}` },
    openGraph: { type: "website", title, description, url: `/portfolio/${slug}`, siteName: "Showwork", images: [{ url: image, width: socialPreviewImage.width, height: socialPreviewImage.height, alt: socialPreviewImage.alt }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const portfolio = await db.portfolio.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { displayOrder: "asc" },
        include: { media: { orderBy: { displayOrder: "asc" } } },
      },
      media: true,
      testimonials: { orderBy: { displayOrder: "asc" } },
    },
  });

  if (!portfolio) notFound();

  // No email/password gate on a portfolio at all — the whole point is
  // that it's freely, instantly shareable. Just a view counter.
  await db.portfolio.update({
    where: { id: portfolio.id },
    data: { viewCount: { increment: 1 } },
  });

   const mapMedia = (m: { id: string; type: string; fileKey: string; caption: string | null; aspectRatio: number | null; posterFileKey?: string | null }): PortfolioMediaItem => ({
    id: m.id,
    type: m.type as PortfolioMediaItem["type"],
    url: publicUrlFor(m.fileKey),
    posterUrl: m.posterFileKey ? publicUrlFor(m.posterFileKey) : null,
    caption: m.caption,
    aspectRatio: m.aspectRatio,
  });

  const sections = portfolio.sections
    .filter((s) => s.media.length > 0)
    .map((s) => ({
      id: s.id,
      name: s.name,
      mediaType: s.mediaType,
      media: s.media.map(mapMedia),
      coverMediaId: s.coverMediaId,
    }));

  const ungroupedMedia = portfolio.media.filter((m) => !m.sectionId).map(mapMedia);

  const allMappedMedia = portfolio.media.map(mapMedia);
  const heroMedia = portfolio.heroMediaId
    ? allMappedMedia.find((m) => m.id === portfolio.heroMediaId) ?? allMappedMedia[0] ?? null
    : allMappedMedia.find((m) => m.type === "VIDEO") ?? allMappedMedia[0] ?? null;

  return (
    <PortfolioContent
      companyName={portfolio.companyName}
      logoUrl={portfolio.logoUrl}
      primaryColor={portfolio.primaryColor ?? "#F5C842"}
      bgColor={portfolio.bgColor ?? "#0A0A0A"}
            heroMedia={heroMedia}
            heroBannerDesktopUrl={portfolio.heroBannerDesktopUrl}
      heroBannerDesktopType={portfolio.heroBannerDesktopType}
      heroBannerMobileUrl={portfolio.heroBannerMobileUrl}
      heroBannerMobileType={portfolio.heroBannerMobileType}
      heroTagline={portfolio.heroTagline}
      sections={sections}
      ungroupedMedia={ungroupedMedia}
      contactEmail={portfolio.contactEmail}
      whatsappNumber={portfolio.whatsappNumber}
      ctaText={portfolio.ctaText}
      instagramUrl={portfolio.instagramUrl}
      twitterUrl={portfolio.twitterUrl}
      linkedinUrl={portfolio.linkedinUrl}
      tiktokUrl={portfolio.tiktokUrl}
      facebookUrl={portfolio.facebookUrl}
      youtubeUrl={portfolio.youtubeUrl}
      testimonials={portfolio.testimonials}
      bioText={portfolio.bioText}
      bioSkills={portfolio.bioSkills}
      bioStat={portfolio.bioStat}
      bioPhotoUrl={portfolio.bioPhotoUrl}
    />
  );
}
