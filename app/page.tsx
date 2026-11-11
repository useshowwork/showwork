import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { getCurrentCreator } from "@/lib/auth";
import HomeClient from "./HomeClient";

export const metadata: Metadata = pageMetadata({
  "title": "Marketing Workspace & Social Media Content Calendar | Showwork",
  "description": "Plan content, manage approvals, publish social posts and handle customer conversations with Showwork, the marketing workspace for teams and agencies.",
  "path": "/",
  "keywords": [
    "marketing workspace",
    "social media management software",
    "social media content calendar",
    "content approval workflow",
    "marketing team collaboration"
  ]
});

export default async function HomePage() {
  // No forced redirect — someone might genuinely want to look at
  // their own marketing homepage even while logged in (checking
  // current copy, sharing the link, etc). Instead, just tell the
  // page whether they're logged in, so it can offer a direct
  // "Go to dashboard" option rather than deciding for them.
  const creator = await getCurrentCreator();

  return <HomeClient isLoggedIn={!!creator} />;
}
