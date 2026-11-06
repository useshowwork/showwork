import type { Metadata } from "next";
import { getCurrentCreator } from "@/lib/auth";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Showwork | Intelligent Marketing Workspace for Modern Teams",
  description:
    "Bring business knowledge, content workflows, team coordination and customer conversations into a more connected marketing workspace with Showwork.",
  keywords: [
    "marketing operations platform",
    "marketing team collaboration",
    "business knowledge",
    "content planning",
    "content approval workflow",
    "Marketing Workspace",
    "Showwork",
  ],
  openGraph: {
    title: "Showwork | Intelligent Marketing Workspace for Modern Teams",
    description:
      "Bring business knowledge, content workflows, team coordination and customer conversations into a more connected marketing workspace with Showwork.",
    url: "/",
    siteName: "Showwork",
    locale: "en_NG",
    type: "website",
    images: [
      {
        url: "/images/landing/1.webp",
        width: 1672,
        height: 941,
        alt: "Showwork marketing operations platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Showwork | Intelligent Marketing Workspace for Modern Teams",
    description:
      "Bring business knowledge, content workflows, team coordination and customer conversations into a more connected marketing workspace with Showwork.",
    images: ["/images/landing/1.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function HomePage() {
  // No forced redirect — someone might genuinely want to look at
  // their own marketing homepage even while logged in (checking
  // current copy, sharing the link, etc). Instead, just tell the
  // page whether they're logged in, so it can offer a direct
  // "Go to dashboard" option rather than deciding for them.
  const creator = await getCurrentCreator();

  return <HomeClient isLoggedIn={!!creator} />;
}
