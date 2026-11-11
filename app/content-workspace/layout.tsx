import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  "title": "Marketing Workspace & AI Content Planning | Showwork",
  "description": "Organize client marketing with an AI content calendar, team approvals, social publishing, a shared inbox, lead management and analytics in Showwork.",
  "path": "/content-workspace",
  "keywords": [
    "marketing workspace",
    "AI content planning",
    "social media content calendar",
    "client content approval software",
    "social media scheduling",
    "shared social inbox",
    "marketing analytics"
  ]
});

export default function ContentWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
