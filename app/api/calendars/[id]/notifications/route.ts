import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { getCalendarAccess } from "@/lib/calendarPermissions";
import { db } from "@/lib/db";
import { channelNames } from "@/lib/workspaceNotifications";

type NotificationRow = {
  id: string; kind: string; actor: string | null; title: string; description: string | null;
  postId: string | null; focusDate: string | null; createdAt: Date; batch: boolean; count: number;
};
type InboxRow = { id: string; conversationId: string; platform: string; actor: string | null; createdAt: Date };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const access = await getCalendarAccess(creator.id, id);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const content = access.permissions.includes("calendar.view");
  const inbox = access.permissions.includes("inbox.view");
  const channels = access.permissions.includes("channels.view");
  const root = `/dashboard/calendars/${encodeURIComponent(id)}`;
  const [activity, messages, handoffs] = await Promise.all([
    db.$queryRaw<NotificationRow[]>`
      SELECT COALESCE("batchId", "eventKey") AS id, kind, MAX(actor) AS actor,
             MAX(title) AS title, MAX(description) AS description,
             COALESCE(MIN(n."focusDate"), to_char(MIN(p."postDate"), 'YYYY-MM-DD')) AS "focusDate",
             CASE WHEN "batchId" IS NULL THEN MAX(n."postId") END AS "postId",
             MAX(n."createdAt") AS "createdAt", "batchId" IS NOT NULL AS batch, count(*)::int AS count
      FROM "WorkspaceNotification" n
      LEFT JOIN "CalendarPost" p ON p.id = n."postId" AND p."calendarId" = n."calendarId" AND p."deletedAt" IS NULL
      WHERE n."calendarId" = ${id}
        AND ((kind = 'channel' AND ${channels}) OR (kind <> 'channel' AND ${content}))
        AND ("batchId" IS NOT NULL OR n."postId" IS NULL OR p.id IS NOT NULL)
      GROUP BY COALESCE("batchId", "eventKey"), kind, "batchId" IS NOT NULL, "batchId"
      ORDER BY MAX(n."createdAt") DESC, id DESC LIMIT 60
    `,
    inbox ? db.$queryRaw<InboxRow[]>`
      SELECT m.id, c.id AS "conversationId", c.platform::text,
             COALESCE(c."participantName", c."participantUsername") AS actor, m."platformCreatedAt" AS "createdAt"
      FROM "SocialLeadConversation" c
      JOIN "SocialConnection" sc ON sc.id = c."socialConnectionId" AND sc."calendarId" = c."calendarId"
        AND sc.status IN ('CONNECTED', 'NEEDS_REAUTH')
      JOIN LATERAL (
        SELECT id, "platformCreatedAt" FROM "SocialLeadMessage"
        WHERE "conversationId" = c.id AND direction = 'INBOUND'
          AND (c.platform <> 'X' OR ("platformCreatedAt" >= sc."connectedAt" AND c."providerConversationId" NOT LIKE 'xchat:%'))
          AND "platformCreatedAt" >= now() - interval '30 days'
        ORDER BY "platformCreatedAt" DESC LIMIT 60
      ) m ON true
      WHERE c."calendarId" = ${id} AND c."lastMessageAt" >= now() - interval '30 days'
      ORDER BY m."platformCreatedAt" DESC, m.id DESC LIMIT 60
    ` : [],
    inbox ? db.$queryRaw<InboxRow[]>`
      SELECT c.id || ':' || e."eventVersion" AS id, c.id AS "conversationId", c.platform::text,
             COALESCE(c."participantName", c."participantUsername") AS actor, e."createdAt"
      FROM "SocialLeadConversation" c
      JOIN "SocialConnection" sc ON sc.id = c."socialConnectionId" AND sc."calendarId" = c."calendarId"
        AND sc.status IN ('CONNECTED', 'NEEDS_REAUTH')
      JOIN LATERAL (
        SELECT "eventVersion", MIN("createdAt") AS "createdAt" FROM "InboxHandoffNotification"
        WHERE "conversationId" = c.id GROUP BY "eventVersion"
        UNION ALL
        SELECT c."aiControlVersion", c."aiPausedAt"
        WHERE c."aiPausedAt" IS NOT NULL AND c."aiHandoffReason" IS NOT NULL AND c."aiHandoffAcknowledgedAt" IS NULL AND NOT EXISTS (
          SELECT 1 FROM "InboxHandoffNotification" WHERE "conversationId" = c.id AND "eventVersion" = c."aiControlVersion"
        )
      ) e ON true
      WHERE c."calendarId" = ${id} AND (
        c.platform <> 'X' OR (c."providerConversationId" NOT LIKE 'xchat:%' AND EXISTS (
          SELECT 1 FROM "SocialLeadMessage" WHERE "conversationId" = c.id AND direction = 'INBOUND'
            AND "platformCreatedAt" >= sc."connectedAt"
        ))
      )
      ORDER BY e."createdAt" DESC, id DESC LIMIT 60
    ` : [],
  ]);

  const notifications = activity.map(row => {
    const query = new URLSearchParams({ view: row.kind === "channel" ? "channels" : "content" });
    if (row.postId) query.set("post", row.postId);
    if (row.focusDate) query.set("date", row.focusDate);
    if (row.postId && row.kind === "team-feedback") query.set("review", "team");
    if (row.postId && row.kind.startsWith("client-")) query.set("review", "client");
    const title = row.batch
      ? `${row.count} ${row.count === 1 ? "post" : "posts"} approved ${row.kind === "team-approved" ? "for client review" : "by the client"}`
      : row.title;
    return { ...row, id: `${row.kind}:${row.id}`, title, href: `${root}?${query}` };
  });
  function inboxItem(row: InboxRow, kind: "handoff" | "message") {
    const platform = channelNames[row.platform] ?? row.platform;
    return {
      id: `${kind}:${row.id}`, kind, actor: row.actor || "Customer", createdAt: row.createdAt, count: 1,
      title: kind === "handoff" ? "Customer needs a team member" : `New ${platform} message`,
      description: kind === "handoff" ? platform : null,
      href: `${root}?view=inbox&conversation=${encodeURIComponent(row.conversationId)}`,
    };
  }

  const items = [...notifications, ...messages.map(row => inboxItem(row, "message")), ...handoffs.map(row => inboxItem(row, "handoff"))]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)).slice(0, 60)
    .map(({ id: key, kind, actor, title, description, createdAt, href, count }) => ({
      id: key, kind, actor, title, description, createdAt, href, version: `${key}:${count}:${createdAt.toISOString()}`,
    }));
  return NextResponse.json({ items, readScope: creator.id }, { headers: { "Cache-Control": "private, no-store" } });
}
