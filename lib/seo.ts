import type { Metadata } from "next";

export const socialPreviewImage = {
  url: "/images/bans.webp",
  width: 1672,
  height: 941,
  alt: "Showwork marketing workspace, content calendar, project delivery and portfolios",
};

/** Keep search snippets and social previews aligned for each public page. */
export function pageMetadata({ title, description, path, keywords = [] }: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website", siteName: "Showwork", locale: "en_NG",
      title, description, url: path, images: [socialPreviewImage],
    },
    twitter: { card: "summary_large_image", title, description, images: [socialPreviewImage.url] },
  };
}
