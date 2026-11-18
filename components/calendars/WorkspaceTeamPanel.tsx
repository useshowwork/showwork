"use client";
import { ENGAGE_PERMISSIONS, packagePermissions } from "@/lib/engagePolicy";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, Eye, Headset, Palette, Search, UserRoundCheck, Check, ChevronLeft, ChevronRight, Clock3, History, LockKeyhole, Mail, Plus, RefreshCw, ShieldCheck, Users, X } from 'lucide-react';
import { INVITABLE_TEAM_ROLES, TEAM_PERMISSIONS, TEAM_ROLES, toggleTeamPermission, type TeamPermission, type TeamRole } from '@/lib/calendarTeamPolicy';
import IdentityImage from "@/components/identity/IdentityImage";
import styles from './WorkspaceTeamPanel.module.css';

type Member = { id: string; name: string | null; email: string; avatarUrl?: string | null; role: TeamRole; permissions: TeamPermission[]; customPermissions: boolean; canEdit: boolean; canManage: boolean };
type Invite = { id: string; email: string; role: TeamRole; permissions: TeamPermission[]; expiresAt: string; expired: boolean; deliveryStatus: string; canResend: boolean; canManage: boolean };
type Activity = { id: string; actorName: string; action: string; targetEmail: string; createdAt: string };
type Team = { owner: { name: string | null; email: string; avatarUrl?: string | null }; actorRole: TeamRole; actorPermissions: TeamPermission[]; canManage: boolean; active: boolean; advancedPermissionsAccess: boolean; usage: { members: number; pending: number; limit: number; remaining: number }; collaborators: Member[]; pendingInvites: Invite[]; activity: Activity[]; activityPage: number; activityPages: number; activityTotal: number };
const ROLE_ICONS = { OWNER: ShieldCheck, MANAGER: BriefcaseBusiness, SOCIAL_MEDIA_MANAGER: Users, CREATIVE_CONTRIBUTOR: Palette, INBOX_AGENT: Headset, VIEWER: Eye };
const ACTIONS: Record<string, string> = { INVITATION_CREATED: 'invited', INVITATION_RESENT: 'resent an invitation to', INVITATION_CANCELLED: 'cancelled the invitation for', ACCESS_CHANGED: 'changed access for', MEMBER_REMOVED: 'removed', MEMBER_JOINED: 'joined as' };

export default function WorkspaceTeamPanel({ calendarId, engage = false }: { calendarId: string; engage?: boolean }) {
  const router = useRouter();
  const roleDefaults = (value: TeamRole): TeamPermission[] => {
    if (engage && value === "VIEWER") return ["inbox.view", "leads.view", "channels.view", "knowledge.view"];
    const permissions = packagePermissions(engage ? "ENGAGE" : null, [...TEAM_ROLES[value].defaults]);
    // Stored role assignments retain this legacy dependency. The package mask
    // still removes calendar access when permissions are evaluated server-side.
    if (engage && permissions.includes("workspace.manage")) permissions.push("calendar.view");
    return permissions;
  };
  const visiblePermission = (value: string) => !engage || ENGAGE_PERMISSIONS.includes(value as TeamPermission);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<TeamRole, 'OWNER'>>('CREATIVE_CONTRIBUTOR');
  const [permissions, setPermissions] = useState<TeamPermission[]>([...TEAM_ROLES.CREATIVE_CONTRIBUTOR.defaults]);
  const [customPermissions, setCustomPermissions] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [confirmation, setConfirmation] = useState<{ id: string; name: string; invite: boolean } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const endpoint = `/api/calendars/${encodeURIComponent(calendarId)}`;
  const load = useCallback(async () => {
    requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller;
    setLoading(true);
    try {
      const response = await calendarMutationFetch(`${endpoint}/invites?activityPage=${activityPage}`, { cache: 'no-store', signal: controller.signal });
      const result = await response.json().catch(() => ({ error: 'Could not load the team. Please try again.' }));
      if (!response.ok || !result.owner || !Array.isArray(result.collaborators)) throw new Error(result.error || 'Could not load the team.');
      if (!controller.signal.aborted) setTeam(result);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load the team.'); }
    finally { if (requestRef.current === controller) setLoading(false); }
  }, [endpoint, activityPage]);
  useEffect(() => { setTeam(null); setFormOpen(false); setQuery(''); setPage(1); setActivityPage(1); }, [endpoint]);
  useEffect(() => { void load(); return () => requestRef.current?.abort(); }, [load]);
  useEffect(() => { if (formOpen) { formRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); formRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }); } }, [formOpen, editing]);

  useEffect(() => {
    if (!confirmation) return;
    confirmationRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [confirmation]);

  async function perform(path: string, method: string, body?: unknown, message?: string) {
    if (busy) return false;
    setBusy(path); setError(''); setNotice('');
    try {
      const response = await calendarMutationFetch(`${endpoint}/${path}`, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'This action could not be completed.');
      setNotice(message || 'Team updated.');
      await load(); router.refresh(); window.dispatchEvent(new CustomEvent('showwork-workspace-team-updated'));
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : 'Connection failed. Please try again.'); await load(); return false; }
    finally { setBusy(''); }
  }
  function openInvite(member?: Member) {
    setEditing(member || null); setEmail(member?.email || '');
    const nextRole = member?.role === 'OWNER' ? 'MANAGER' : member?.role || (engage ? 'INBOX_AGENT' : 'CREATIVE_CONTRIBUTOR');
    const defaults = roleDefaults(nextRole);
    const delegated = team?.actorRole === "OWNER" ? defaults : defaults.filter(permission => team?.actorPermissions.includes(permission));
    setRole(nextRole); setPermissions(member?.permissions || delegated); setCustomPermissions(member?.customPermissions || engage || delegated.length !== defaults.length);
    setError(''); setNotice(''); setFormOpen(true);
  }
  const filtered = (team?.collaborators || []).filter(member => [member.name, member.email, TEAM_ROLES[member.role]?.label].some(value => value?.toLowerCase().includes(query.trim().toLowerCase())));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const members = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const pending = (team?.pendingInvites || []).filter(invite => invite.email.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = [...new Set(Object.values(TEAM_PERMISSIONS).map(item => item.group))];
  return <section className={styles.panel} aria-label="Workspace team and access">
    <header className={styles.header}><div className={styles.headerIdentity}><span className={styles.headerIcon}><Users size={24} aria-hidden="true" /></span><div><p className={styles.eyebrow}>People & permissions</p><h2>Great work.<br/><span>Better together.</span></h2><p>Bring your people together. Give everyone a clear role and the right space to contribute.</p></div></div><div className={styles.headerActions}><button type="button" className={styles.iconButton} disabled={loading || !!busy} aria-label="Refresh team" onClick={() => { setError(''); void load(); }}><RefreshCw size={16} aria-hidden="true" /></button>{team?.canManage && <button type="button" className={styles.primary} disabled={!team.active || !!busy} onClick={() => openInvite()}><Plus size={16} aria-hidden="true" />Invite teammate</button>}</div></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}><Check size={15} aria-hidden="true" />{notice}</p>}
    {loading && !team && <p role="status" className={styles.loading}>Loading your team…</p>}
    {team && <>
      <div className={styles.teamMetrics}>
        <div><Users size={18}/><strong>{team.collaborators.length + 1}</strong><span>People in this workspace</span></div>
        <div><Mail size={18}/><strong>{team.pendingInvites.filter(invite => !invite.expired).length}</strong><span>Invitations awaiting acceptance</span></div>
        {!engage && <div><UserRoundCheck size={18}/><strong>{1 + team.collaborators.filter(member => member.permissions.includes('internal_review.manage')).length}</strong><span>Can review & approve internally</span></div>}
      </div>
      <div className={styles.summary}><div className={styles.owner}><IdentityImage name={team.owner.name || team.owner.email} src={team.owner.avatarUrl} className={styles.ownerIcon} /><div><p>{team.owner.name || team.owner.email}<span className={styles.badge}>Owner</span></p><small>{team.owner.email}</small></div><LockKeyhole size={14} className={styles.ownerLock} aria-label="Ownership stays with this account" /></div><div className={styles.usage}><span>Team slots across all owned workspaces</span><strong>{team.usage.members + team.usage.pending} <small>/ {team.usage.limit === Number.MAX_SAFE_INTEGER ? 'Unlimited' : team.usage.limit}</small></strong><p>{team.usage.pending} active invitations · Each workspace membership uses one slot.</p>{team.actorRole === "OWNER" && <a href={engage ? "/dashboard/billing?product=engage" : "/dashboard/billing?product=content-workspace#content-workspace-plans"} className={styles.textButton}>Manage team allowance <ArrowUpRight size={12} aria-hidden="true"/></a>}</div></div>
      {!team.active && <p className={styles.readOnly}>Workspace access is paused. You can still remove teammates and cancel invitations.</p>}
      {formOpen && <form ref={formRef} onSubmit={async event => { event.preventDefault(); if (await perform(editing ? `collaborators/${editing.id}` : 'invites', editing ? 'PATCH' : 'POST', { email, role, permissions, customPermissions }, editing ? 'Access updated.' : 'Invitation email sent.')) { setFormOpen(false); setEditing(null); } }} className={styles.form}>
        <div className={styles.formHeading}><div><h3>{editing ? 'Shape their access.' : 'Make room for someone great.'}</h3><p>{editing ? editing.email : 'Choose a role, then refine the features they can use.'}</p></div><button type="button" className={styles.iconButton} aria-label="Close access editor" disabled={!!busy} onClick={() => setFormOpen(false)}><X size={17} aria-hidden="true" /></button></div>
        {!editing && <label className={styles.field}>Email address<input type="email" required maxLength={254} value={email} disabled={!!busy} onChange={event => setEmail(event.target.value)} placeholder="teammate@company.com" autoComplete="email" /></label>}
        <fieldset><legend className={styles.legend}>Choose their role</legend><div className={styles.roles}>{INVITABLE_TEAM_ROLES.filter(value => !engage || ["MANAGER", "INBOX_AGENT", "VIEWER"].includes(value)).map(value => {
          const RoleIcon = ROLE_ICONS[value];
          const ownerOnly = value === 'MANAGER' && team.actorRole !== 'OWNER';
          const planLocked = !team.advancedPermissionsAccess && !['CREATIVE_CONTRIBUTOR', 'VIEWER'].includes(value);
          return <button type="button" key={value} disabled={!!busy || ownerOnly || planLocked} aria-pressed={role === value} onClick={() => { const defaults = roleDefaults(value); const delegated = team.actorRole === "OWNER" ? defaults : defaults.filter(permission => team.actorPermissions.includes(permission)); setRole(value); setPermissions(delegated); setCustomPermissions(engage || delegated.length !== defaults.length); }} className={`${styles.role} ${role === value ? styles.roleSelected : ''}`}><span><RoleIcon size={17} aria-hidden="true"/>{TEAM_ROLES[value].label}{role === value ? <Check size={14} aria-hidden="true" /> : ownerOnly || planLocked ? <LockKeyhole size={13} aria-hidden="true" /> : null}</span><p>{engage && value === "INBOX_AGENT" ? "Reads customer messages and sends replies." : engage && value === "MANAGER" ? "Manages conversations, leads, channels, knowledge and the team." : TEAM_ROLES[value].description}</p>{ownerOnly && <small>Owner appoints managers</small>}{planLocked && <small>Studio & Agency</small>}</button>;
        })}</div></fieldset>
        <div className={styles.permissionHeader}><div><h4>Feature access</h4><p>{engage ? "Choose the customer care tools this teammate can use. Managers can delegate only their own access." : "Internal review allows feedback and approval. Owners always have it; managers have it by default. You can deselect it for managers or grant it to other roles except Viewer. Managers can delegate only their own feature access."}</p></div>{customPermissions && <button type="button" className={styles.textButton} disabled={!!busy} onClick={() => { setPermissions(roleDefaults(role)); setCustomPermissions(engage); }}>Reset to role defaults</button>}</div>
        {!team.advancedPermissionsAccess && <p className={styles.hint}>Custom feature access is available on Studio and Agency plans.</p>}
        <div className={styles.permissions}>{groups.filter(group => Object.entries(TEAM_PERMISSIONS).some(([permission, item]) => item.group === group && visiblePermission(permission) && TEAM_ROLES[role].allowed.includes(permission as TeamPermission))).map(group => <fieldset key={group}><legend>{group}</legend>{(Object.entries(TEAM_PERMISSIONS) as [TeamPermission, { label: string; group: string }][]).filter(([permission, item]) => item.group === group && visiblePermission(permission) && TEAM_ROLES[role].allowed.includes(permission)).map(([permission, item]) => {
          const allowed = TEAM_ROLES[role].allowed.includes(permission) && (team.actorRole === "OWNER" || team.actorPermissions.includes(permission));
          return <label key={permission} className={!allowed ? styles.lockedPermission : ''}><input type="checkbox" checked={permissions.includes(permission)} disabled={!!busy || !allowed || !team.advancedPermissionsAccess} onChange={event => { setPermissions(toggleTeamPermission(permissions, permission, event.target.checked)); setCustomPermissions(true); }} /><span>{engage && permission === "workspace.manage" ? "Manage conversation settings" : item.label}</span>{!allowed && <LockKeyhole size={11} aria-hidden="true" />}</label>;
        })}</fieldset>)}</div>
        <div className={styles.formFooter}><p>Billing, ownership, destructive reset, and encrypted X keys stay owner-only.</p><button type="submit" className={styles.primary} disabled={!!busy || !permissions.length}>{busy ? 'Saving…' : editing ? 'Save access' : 'Send invitation'}</button></div>
      </form>}
      <div className={styles.listHeading}><h3>People with access <span>{team.collaborators.length + 1}</span></h3><label className={styles.search}><Search size={16} aria-hidden="true"/><input type="search" aria-label="Search teammates and invitations" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, email, or role" /></label></div>
      <div className={styles.members}>{members.map(member => <div key={member.id} className={styles.member}><IdentityImage name={member.name || member.email} src={member.avatarUrl} className={styles.avatar} /><div className={styles.memberIdentity}><p>{member.name || member.email}</p><small>{member.email}</small><div className={styles.memberBadges}><span data-role={member.role}>{TEAM_ROLES[member.role]?.label}</span>{member.permissions.includes("internal_review.manage") && <span><ShieldCheck size={11} aria-hidden="true"/>Internal reviewer</span>}</div><details><summary>{member.customPermissions ? 'Custom access' : 'Role access'} · {member.permissions.length} permissions</summary><ul>{member.permissions.map(permission => <li key={permission}>{TEAM_PERMISSIONS[permission].label}</li>)}</ul></details></div>{member.canManage && <div className={styles.memberActions}><button type="button" className={styles.secondary} disabled={!!busy || !team.active || !member.canEdit} onClick={() => openInvite(member)}>Edit access</button><button type="button" className={styles.remove} disabled={!!busy} onClick={() => setConfirmation({ id: member.id, name: member.name || member.email, invite: false })}>Remove</button></div>}</div>)}{!filtered.length && <p className={styles.empty}>{query ? 'No teammates match your search.' : 'Your next teammate starts with an invitation.'}</p>}</div>
      {totalPages > 1 && <nav aria-label="Team pagination" className={styles.pagination}><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} aria-hidden="true" />Previous</button><span>{currentPage} of {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight size={15} aria-hidden="true" /></button></nav>}
      {confirmation && <div ref={confirmationRef} role="alert" className={styles.confirmation}><p>{confirmation.invite ? `Cancel the invitation for ${confirmation.name}?` : `Remove ${confirmation.name} from this workspace?`}<small>{confirmation.invite ? 'The invitation link will no longer work.' : 'They will lose access to this workspace. Their account and other workspaces remain available.'}</small></p><div><button type="button" className={styles.secondary} disabled={!!busy} onClick={() => setConfirmation(null)}>Keep access</button><button type="button" className={styles.danger} disabled={!!busy} onClick={async () => { if (await perform(confirmation.invite ? `invites/${confirmation.id}` : `collaborators/${confirmation.id}`, 'DELETE', undefined, confirmation.invite ? 'Invitation cancelled.' : 'Teammate removed.')) setConfirmation(null); }}>{busy ? 'Removing…' : confirmation.invite ? 'Cancel invitation' : 'Remove teammate'}</button></div></div>}
      {pending.length > 0 && <section className={styles.pending}><h3>Invitations <span>{pending.length}</span></h3>{pending.map(invite => <div key={invite.id} className={styles.invite}><Mail size={18} aria-hidden="true" /><div><p>{invite.email}</p><small>{TEAM_ROLES[invite.role]?.label} · {invite.expired ? 'Expired' : invite.deliveryStatus === 'FAILED' ? 'Email failed' : invite.deliveryStatus === 'SENT' ? 'Email sent · Awaiting acceptance' : 'Delivery not confirmed'}</small><small>{invite.expired ? 'Expired' : 'Expires'} {new Date(invite.expiresAt).toLocaleDateString()}</small></div>{invite.canManage && <div className={styles.memberActions}><button type="button" className={styles.secondary} disabled={!!busy || !team.active || !invite.canResend} onClick={() => void perform(`invites/${invite.id}`, 'POST', undefined, 'Invitation email resent.')}>Resend</button><button type="button" className={styles.remove} disabled={!!busy} onClick={() => setConfirmation({ id: invite.id, name: invite.email, invite: true })}>Cancel</button></div>}</div>)}</section>}
      <details className={styles.activity}><summary><History size={17} aria-hidden="true" />Team activity<span>{team.activityTotal} events</span></summary>{team.activity.length ? <ol>{team.activity.map(event => <li key={event.id}><Clock3 size={14} aria-hidden="true" /><div><p><b>{event.actorName}</b> {ACTIONS[event.action] || 'updated access for'} {event.targetEmail}</p><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></div></li>)}</ol> : <p className={styles.empty}>New invitations and access changes will appear here.</p>}{team.activityPages > 1 && <nav aria-label="Team activity pagination" className={styles.pagination}><button type="button" disabled={loading || team.activityPage === 1} onClick={() => setActivityPage(team.activityPage - 1)}>Newer events</button><span>{team.activityPage} of {team.activityPages}</span><button type="button" disabled={loading || team.activityPage === team.activityPages} onClick={() => setActivityPage(team.activityPage + 1)}>Older events</button></nav>}</details>
    </>}
  </section>;
}
