import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  "title": "Client Project Delivery & File Review Portal | Showwork",
  "description": "Deliver photos, videos and creative files in a branded client portal. Manage feedback, revisions, approvals and downloads with Showwork Project Delivery.",
  "path": "/delivery",
  "keywords": [
    "client project delivery",
    "creative client portal",
    "photo and video delivery",
    "client file review",
    "project approval workflow"
  ]
});

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
