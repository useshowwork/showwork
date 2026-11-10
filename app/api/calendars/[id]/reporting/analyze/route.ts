import { getBusinessKnowledgeContext } from "@/lib/knowledge/context";
import { consumeCalendarAiGeneration } from "@/lib/contentWorkspaceUsage";
import { calendarFeatureGate } from "@/lib/calendarPermissions";
import { Prisma, type SocialPlatform } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission, canAccessCalendarById } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { generateReportingInsights } from "@/lib/openai";
import { getCalendarReportingData, reportingPeriod } from "@/lib/reporting/data";

const PLATFORMS = new Set(["INSTAGRAM", "TIKTOK", "FACEBOOK", "LINKEDIN", "X", "YOUTUBE"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: calendarId } = await params;
  if (!(await hasCalendarPermission(creator.id, calendarId, "analytics.manage"))) {
    return NextResponse.json({ error: "You don’t have permission to analyze this workspace." }, { status: 403 });
  }
  if (!(await canAccessCalendarById(calendarId))) {
    return NextResponse.json({ error: "This workspace isn’t active." }, { status: 403 });
  }

  const featureLock = await calendarFeatureGate(calendarId, "performanceRecommendations");
  if (featureLock) return featureLock;

  try {
    const body = await req.json().catch(() => null) as { from?: unknown; to?: unknown; platform?: unknown } | null;
    if (!body || typeof body.from !== "string" || typeof body.to !== "string") {
      return NextResponse.json({ error: "Choose a valid reporting date range." }, { status: 400 });
    }
    const params = new URLSearchParams({ from: body.from, to: body.to });
    if (typeof body.platform === "string" && body.platform) {
      if (body.platform.split(",").some(value => !PLATFORMS.has(value))) return NextResponse.json({ error: "Choose a supported platform." }, { status: 400 });
      params.set("platform", body.platform);
    }
    const { start, end } = reportingPeriod(params);
    const [calendar, report] = await Promise.all([
      db.socialCalendar.findUnique({ where: { id: calendarId }, select: { clientName: true, aiBusinessSummary: true } }),
      getCalendarReportingData(calendarId, params, true, await hasCalendarPermission(creator.id, calendarId, "leads.view")),
    ]);
    if (!calendar) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    const showworkPosts = report.posts.map((post) => {
      const snapshots = [...post.metricSnapshots].sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());
      const selectedSnapshots = snapshots.length > 1 ? [snapshots[0], snapshots[snapshots.length - 1]] : snapshots;
      return {
        platform: post.platform,
        platformPostId: post.platformPostId,
        publishedAt: post.publishedAt,
        caption: post.calendarPost.caption,
        postType: post.calendarPost.postType,
        category: post.calendarPost.category,
        snapshots: selectedSnapshots.map((snapshot) => ({
          date: snapshot.snapshotDate,
          reach: snapshot.reach,
          views: snapshot.views,
          engagement: snapshot.engagement,
          engagementRate: snapshot.engagementRate,
          likes: snapshot.likes,
          comments: snapshot.comments,
          shares: snapshot.shares,
          saves: snapshot.saves,
        })),
      };
    });
    const linkedIds = new Set(showworkPosts.map((post) => `${post.platform}:${post.platformPostId ?? ""}`));
    const platformPosts = report.accountPosts
      .filter((post) => !linkedIds.has(`${post.platform}:${post.platformPostId}`))
      .map((post) => ({
        platform: post.platform,
        publishedAt: post.publishedAt,
        caption: post.caption,
        postType: post.postType,
        category: null,
        snapshots: [{
          date: post.metricsUpdatedAt ?? post.publishedAt,
          reach: post.reach,
          views: post.views,
          engagement: post.engagement,
          engagementRate: null,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          saves: post.saves,
        }],
      }));
    const allPosts = [...showworkPosts, ...platformPosts]
      .sort((a, b) => (b.publishedAt ? new Date(b.publishedAt).getTime() : 0) - (a.publishedAt ? new Date(a.publishedAt).getTime() : 0));
    const posts = allPosts.slice(0, 100);
    const accounts = report.connections.map((connection) => ({
      platform: connection.platform,
      username: connection.username,
      status: connection.status,
      snapshots: (connection.accountMetricSnapshots.length > 1
        ? [connection.accountMetricSnapshots.at(-1), connection.accountMetricSnapshots[0]]
        : connection.accountMetricSnapshots).filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot != null).map((snapshot) => ({
        date: snapshot.snapshotDate,
        followers: snapshot.followers,
        followerGrowth: snapshot.followerGrowth,
        reach: snapshot.reach,
        engagement: snapshot.engagement,
      })),
    }));
    const hasMetrics = posts.some((post) => post.snapshots.some((snapshot) =>
      [snapshot.reach, snapshot.views, snapshot.engagement, snapshot.likes, snapshot.comments, snapshot.shares, snapshot.saves].some((value) => value != null),
    )) || accounts.some((account) => account.snapshots.some((snapshot) =>
      [snapshot.followers, snapshot.followerGrowth, snapshot.reach, snapshot.engagement].some((value) => value != null),
    ));
    if (!hasMetrics) {
      return NextResponse.json({ error: "There isn’t enough synced social performance data for this period yet. Connect an account and wait for its first reporting sync." }, { status: 409 });
    }

    const quota = await consumeCalendarAiGeneration(calendarId);
    if (!quota.allowed) return NextResponse.json({ error: `Your monthly AI allowance of ${quota.limit} is unavailable or used up. Upgrade your plan or wait for your next monthly allowance.`, code: "AI_GENERATION_LIMIT_REACHED" }, { status: 403 });
    const generated = await generateReportingInsights({
      clientName: calendar.clientName,
      businessSummary: await getBusinessKnowledgeContext(calendarId, "Audience marketing objectives positioning content strategy engagement performance", "analytics"),
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      sampledPostCount: posts.length,
      totalPostCount: allPosts.length,
      accounts: [...accounts, {
        scope: "Selected-period comparison; use these computed deltas for period trends. Null deltas mean history is insufficient. Read each metric basis: observed daily totals may have missing days, rolling totals are not selected-period activity, and post counters are lifetime totals for publication cohorts. Daily reach counts can repeat people across days. Native post metrics are current lifetime counters, not activity earned during the period. Lead stages reflect current state, not historical conversions.",
        comparisonPeriod: report.comparisonPeriod,
        performance: report.performance,
        leads: report.leads ? { total: report.leads.total, acquired: report.leads.acquired, hotOpen: report.leads.hotCount, currentCustomersAmongNewLeads: report.leads.customers } : null,
      }],
      posts,
    });
    const selectedPlatform = typeof body.platform === "string" && body.platform ? { in: body.platform.split(",") as SocialPlatform[] } : undefined;
    await db.$transaction(async (tx) => {
      await tx.reportingInsight.deleteMany({
        where: {
          calendarId,
          periodStart: start,
          periodEnd: end,
          ...(selectedPlatform ? { OR: [{ platform: selectedPlatform }, { platform: null }] } : {}),
        },
      });
      await tx.reportingInsight.createMany({
        data: generated.map((insight) => ({
          calendarId,
          platform: insight.platform === "ALL" ? null : insight.platform as SocialPlatform,
          periodStart: start,
          periodEnd: end,
          type: insight.type,
          title: insight.title,
          description: insight.description,
          recommendation: insight.recommendation,
          supportingData: { evidence: insight.evidence, connectionIds: report.connections.map(connection => connection.id) } as Prisma.InputJsonValue,
        })),
      });
    });
    return NextResponse.json({ generated: generated.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not analyze social performance.";
    const status = message.includes("date range") || message.includes("exceed") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
