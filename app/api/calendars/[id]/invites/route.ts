import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCreator } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamAccess, inviteTeammate, teamErrorResponse } from '@/lib/calendarTeamService';
import { effectiveTeamPermissions, normalizeTeamRole, canManageTeamRole } from '@/lib/calendarTeamPolicy';
import { getContentWorkspacePlan, canUseContentWorkspaceFeature } from '@/lib/contentWorkspaceUsage';
import { CONTENT_WORKSPACE_PLANS } from '@/lib/contentWorkspaceEntitlements';
import { canAccessCalendarById } from '@/lib/calendarPermissions';

type Context = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, { params }: Context) {
  const actor = await getCurrentCreator();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const access = await teamAccess(actor.id, id);
    const calendar = await db.socialCalendar.findUniqueOrThrow({ where: { id }, include: { manager: true } });
    const eventCount = await db.calendarTeamActivity.count({ where: { calendarId: id } });
    const activityPages = Math.max(1, Math.ceil(eventCount / 50));
    const requestedActivityPage = Number(_req.nextUrl.searchParams.get('activityPage') || 1);
    const activityPage = Math.min(activityPages, Math.max(1, Number.isFinite(requestedActivityPage) ? Math.floor(requestedActivityPage) : 1));
    const [collaborators, pendingInvites, activity, memberCount, pendingCount, active] = await Promise.all([
      db.calendarCollaborator.findMany({ where: { calendarId: id }, orderBy: { addedAt: 'desc' }, include: { creator: { select: { name: true, email: true, avatarUrl: true } } } }),
      db.calendarInvite.findMany({ where: { calendarId: id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
      db.calendarTeamActivity.findMany({ where: { calendarId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, skip: (activityPage - 1) * 50, select: { id: true, actorName: true, action: true, targetEmail: true, details: true, createdAt: true } }),
      db.calendarCollaborator.count({ where: { calendar: { managerId: calendar.managerId } } }),
      db.calendarInvite.count({ where: { calendar: { managerId: calendar.managerId }, status: 'PENDING', expiresAt: { gt: new Date() } } }),
      canAccessCalendarById(id),
    ]);
    const plan = getContentWorkspacePlan(calendar.manager);
    const limit = plan ? CONTENT_WORKSPACE_PLANS[plan].collaborators : 0;
    return NextResponse.json({
      owner: { id: calendar.manager.id, name: calendar.manager.name, email: calendar.manager.email, avatarUrl: calendar.manager.avatarUrl, role: 'OWNER' },
      actorRole: access.role, actorPermissions: access.permissions, canManage: access.permissions.includes('people.manage'), active,
      advancedPermissionsAccess: canUseContentWorkspaceFeature(calendar.manager, 'advancedTeamPermissions'),
      usage: { members: memberCount, pending: pendingCount, limit, remaining: Math.max(0, limit - memberCount - pendingCount) },
      collaborators: collaborators.map(member => ({ id: member.id, creatorId: member.creatorId, name: member.creator.name, email: member.creator.email, avatarUrl: member.creator.avatarUrl,
        role: normalizeTeamRole(member.role), permissions: effectiveTeamPermissions(member.role, member.permissions, member.customPermissions), customPermissions: member.customPermissions,
        canEdit: access.permissions.includes("people.manage") && member.creatorId !== actor.id && canManageTeamRole(access.role, member.role) && (access.role === "OWNER" || effectiveTeamPermissions(member.role, member.permissions, member.customPermissions).every(permission => access.permissions.includes(permission))),
        canManage: access.permissions.includes('people.manage') && member.creatorId !== actor.id && canManageTeamRole(access.role, member.role) })),
      pendingInvites: pendingInvites.map(invite => ({ id: invite.id, email: invite.email, role: normalizeTeamRole(invite.role), permissions: effectiveTeamPermissions(invite.role, invite.permissions, invite.customPermissions), customPermissions: invite.customPermissions,
        canResend: access.permissions.includes("people.manage") && canManageTeamRole(access.role, invite.role) && (access.role === "OWNER" || effectiveTeamPermissions(invite.role, invite.permissions, invite.customPermissions).every(permission => access.permissions.includes(permission))),
        expiresAt: invite.expiresAt, expired: invite.expiresAt <= new Date(), deliveryStatus: invite.deliveryStatus, canManage: access.permissions.includes('people.manage') && canManageTeamRole(access.role, invite.role) })),
      activity, activityPage, activityPages, activityTotal: eventCount,
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { const result = teamErrorResponse(error); return NextResponse.json({ error: result.error }, { status: result.status }); }
}
export async function POST(req: NextRequest, { params }: Context) {
  const actor = await getCurrentCreator();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const { id } = await params; return NextResponse.json(await inviteTeammate(id, actor, await req.json().catch(() => null))); }
  catch (error) { const result = teamErrorResponse(error); return NextResponse.json({ error: result.error }, { status: result.status }); }
}
