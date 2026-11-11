import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  "title": "Book a Marketing Workspace Demo | Showwork",
  "description": "Book a Showwork demo to explore AI content planning, social media calendars, team approvals and customer conversations for your marketing team.",
  "path": "/book-demo",
  "keywords": [
    "marketing workspace demo",
    "social media management demo",
    "content calendar software"
  ]
});

export default function BookDemoLayout({ children }: { children: React.ReactNode }) { return children; }
