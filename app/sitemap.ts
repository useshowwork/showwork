import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://useshowwork.com";
  const staticRoutes = [
    "",
    "/portfolio",
    "/delivery",
    "/content-workspace",
    "/book-demo",
    "/help/workspace",
    "/help/project-delivery",
    "/help/portfolio",
    "/creativo",
    "/spotlight",
    "/leaderboard",
    "/webinars",
    "/blog",
    "/privacy",
    "/terms",
    "/data-deletion",
  ];
  const pages: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/portfolio" || path === "/delivery" || path === "/content-workspace" ? 0.8 : 0.5,
  }));

  // The project database pool is configured for one connection; keep
  // these reads sequential to avoid pool timeouts during sitemap builds.
  const portfolios = await db.portfolio.findMany({ select: { slug: true, updatedAt: true } });
  const posts = await db.blogPost.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } });
  const webinars = await db.creativoWebinar.findMany({ select: { slug: true, updatedAt: true } });

  pages.push(
    ...portfolios.map((portfolio) => ({ url: `${baseUrl}/portfolio/${portfolio.slug}`, lastModified: portfolio.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...posts.map((post) => ({ url: `${baseUrl}/blog/${post.slug}`, lastModified: post.updatedAt, changeFrequency: "yearly" as const, priority: 0.6 })),
    ...webinars.map((webinar) => ({ url: `${baseUrl}/webinars/${webinar.slug}`, lastModified: webinar.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  );
  return pages;
}
