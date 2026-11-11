import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  "title": "Portfolio Builder for Photographers & Creators | Showwork",
  "description": "Create a professional portfolio website for photography, video and design. Showcase projects, services and testimonials, and share your work with clients.",
  "path": "/portfolio",
  "keywords": [
    "photographer portfolio builder",
    "videographer portfolio website",
    "online portfolio for creatives",
    "designer portfolio website",
    "creative agency portfolio"
  ]
});

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
