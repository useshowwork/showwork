'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, Camera, Loader2, MessageCircle, Send, ShieldCheck, Users, RefreshCw } from 'lucide-react';
import styles from './selection.module.css';
import { calendarMutationFetch } from '@/lib/publishing/clientRequests';

type Selection = {
  accounts: { accountId: string; pageId: string; name: string }[];
  expectedVersion: number;
  grantedPermissions?: string[];
  diagnostics?: { discoveryStatus?: string; businessDiscovery?: string; pages?: {pageId: string; name: string; instagramRelationship: string}[]; pagesTruncated?: boolean; issues?: {stage: string; code: string; providerCode?: number; providerSubcode?: number}[] };
};
const capabilities = [
  { title: 'Account & profile', description: 'Access your Instagram professional profile and media.', scopes: ['instagram_basic'], icon: Camera },
  { title: 'Content publishing', description: 'Publish scheduled Instagram content from your workspace.', scopes: ['instagram_content_publish'], icon: Send },
  { title: 'Inbox & replies', description: 'Manage Instagram conversations and respond to messages.', scopes: ['instagram_manage_messages'], icon: MessageCircle },
  { title: 'Analytics & reporting', description: 'Read Instagram Insights to measure content and account performance.', scopes: ['instagram_manage_insights'], icon: BarChart3 },
  { title: 'Page access', description: 'Find linked Facebook Pages and read their engagement information.', scopes: ['pages_show_list', 'pages_read_engagement'], icon: Users },
  { title: 'Messaging updates', description: 'Subscribe the linked Page to receive messaging events.', scopes: ['pages_manage_metadata'], icon: RefreshCw },
];

export default function InstagramAccountSelection({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [options, setOptions] = useState<Selection | null>(null);
  const [selected, setSelected] = useState('');
  const [pageId, setPageId] = useState('');
  const [verifiedPageId, setVerifiedPageId] = useState('');
  const [error, setError] = useState('');
  const [failureDetails, setFailureDetails] = useState<Selection['diagnostics']>();
  const diagnostics = options?.diagnostics ?? failureDetails;
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/calendars/${id}/instagram/select-account`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) { if (!controller.signal.aborted && body.diagnostics) setFailureDetails(body.diagnostics); throw Error(body.error); }
        if (!controller.signal.aborted) setOptions(body);
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [id]);
  async function findPage() {
    if (!/^\d{5,30}$/.test(pageId.trim()) || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/calendars/${id}/instagram/select-account?pageId=${encodeURIComponent(pageId.trim())}`, {cache:'no-store'});
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'Could not verify Page access.');
      setOptions(body); setVerifiedPageId(pageId.trim());
      setSelected(body.accounts.length === 1 ? body.accounts[0].accountId : '');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not verify Page access.'); }
    finally { setBusy(false); }
  }
  async function select() {
    if (!options || !selected || busy) return;
    setBusy(true); setError('');
    try {
      const response = await calendarMutationFetch(`/api/calendars/${id}/instagram/select-account${verifiedPageId ? `?pageId=${encodeURIComponent(verifiedPageId)}` : ''}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selected, expectedVersion: options.expectedVersion }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error);
      router.replace(`/dashboard/calendars/${id}?view=channels&instagramConnected=true`);
    } catch (error) { setError(error instanceof Error ? error.message : 'Account selection failed.'); }
    finally { setBusy(false); }
  }
  const granted = new Set(options?.grantedPermissions ?? []);
  const grantedCount = capabilities.filter(capability => capability.scopes.every(scope => granted.has(scope))).length;
  return <main className={styles.page}>
    <div className={styles.container}>
      <a className={styles.back} href={`/dashboard/calendars/${id}?view=channels`}><ArrowLeft size={16} /> Back to channels</a>
      <header className={styles.header}>
        <div className={styles.brand}><Camera size={28} /></div>
        <div><p className={styles.eyebrow}>CONNECT YOUR CHANNEL</p><h1>Bring your Instagram into Showwork</h1>
          <p className={styles.subtitle}>Choose the professional account you want to use in this workspace.</p></div>
      </header>
      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="account-heading">
          <div className={styles.sectionHeading}><span className={styles.step}>1</span><h2 id="account-heading">Choose your account</h2></div>
          <p className={styles.intro}>Select a Facebook Page and its linked Instagram professional account.</p>
          {!options && !error && <p role="status" className={styles.notice}><Loader2 size={18} className={styles.spinner} /> Loading your linked accounts…</p>}
          {options && options.accounts.length === 0 && <p className={styles.notice}>{options.diagnostics?.discoveryStatus === 'DISCOVERY_INCOMPLETE' ? 'Some account checks failed. Meta has not confirmed the complete list of Pages you can use.' : options.diagnostics?.discoveryStatus === 'NO_FACEBOOK_PAGES' ? 'Meta did not list your Pages in this authorization. Assigned Pages may still be accessible. Use the Page ID fallback below if your account is missing.' : options.diagnostics?.discoveryStatus === 'PAGES_PERMISSION_MISSING' ? 'Page access was not granted. Restart authorization and allow access to your Facebook Page.' : 'No linked Instagram professional accounts found. Check your Page-to-Instagram connection and allow access to both assets when reconnecting.'}</p>}
          {!!diagnostics?.pages?.length && (!options || options.accounts.length === 0) && <div className={styles.notice}>
            <strong>Facebook Pages found</strong>
            <p>Check that this is the Page linked to the Instagram account you selected.</p>
            <ul>{diagnostics.pages.map(page => <li key={page.pageId}><strong>{page.name}</strong> · Page ID: {page.pageId}<br/>{page.instagramRelationship === 'NOT_RETURNED' ? 'Meta did not return a linked Instagram professional account.' : page.instagramRelationship === 'CHECK_FAILED' ? 'The Instagram link could not be checked.' : 'Linked Instagram account found.'}</li>)}</ul>
            {diagnostics.pagesTruncated && <p>Showing the first 25 discovered Pages.</p>}
          </div>}
          {!!diagnostics?.issues?.length && <details className={styles.notice}><summary>Connection check details</summary><p>Some accounts could not be checked. You can connect an available account or retry authorization.</p><ul>{diagnostics.issues.map((issue, index) => <li key={index}>{issue.stage.replaceAll('_', ' ')}: {issue.code}{issue.providerCode !== undefined ? ` (Meta ${issue.providerCode}${issue.providerSubcode !== undefined ? ` / ${issue.providerSubcode}` : ''})` : ''}</li>)}</ul></details>}
          {options?.accounts.length === 0 && <p className={styles.footnote}>You do not need to own the Page. Your Facebook profile needs the appropriate assigned access, and the Instagram account must be a linked professional account.</p>}
          {options?.accounts.length === 0 && !diagnostics?.pages?.length && diagnostics?.discoveryStatus === 'NO_FACEBOOK_PAGES' && diagnostics?.businessDiscovery === 'NOT_GRANTED' && <p className={styles.footnote}>Business Portfolio discovery was not included in this authorization. If your assigned assets are correct, contact Showwork support to check the app’s Business access setup.</p>}
          <details className={styles.notice}>
            <summary>Missing your account? Find it by Facebook Page ID</summary>
            <p>Meta sometimes omits assigned Pages. Enter your Page ID to verify access directly.</p>
            <label htmlFor="instagram-page-id">Facebook Page ID</label>
            <input id="instagram-page-id" inputMode="numeric" value={pageId} onChange={event => setPageId(event.target.value)} placeholder="Enter Page ID" disabled={busy} />
            <button type="button" onClick={findPage} disabled={busy || !/^\d{5,30}$/.test(pageId.trim())}>Find account</button>
          </details>
          <fieldset className={styles.accounts} disabled={busy}>
            <legend className="sr-only">Instagram accounts linked to Facebook Pages</legend>
            {options?.accounts.map(account => <label key={account.accountId} className={`${styles.account} ${selected === account.accountId ? styles.selected : ''}`}>
              <input type="radio" name="instagram-account" value={account.accountId} checked={selected === account.accountId} onChange={() => setSelected(account.accountId)} />
              <span className={styles.avatar}><Camera size={23} /></span>
              <span className={styles.accountName}><strong>{account.name}</strong><small>Instagram professional account · Linked Facebook Page</small></span>
              {selected === account.accountId && <CheckCircle2 size={21} className={styles.check} aria-hidden="true" />}
            </label>)}
          </fieldset>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button className={styles.connect} onClick={() => void select()} disabled={busy || !selected || !options}>
            {busy ? <><Loader2 size={18} className={styles.spinner} /> Connecting…</> : <>Connect selected account <ArrowRight size={18} /></>}
          </button>
          <p className={styles.footnote}><ShieldCheck size={16} /> Your account will be connected to this workspace.</p>
          <div className={styles.restart}><span>Missing an account or permission?</span><a href={`/api/calendars/${id}/instagram/connect`}>Restart authorization <RefreshCw size={13} /></a></div>
        </section>
        <section className={`${styles.card} ${styles.permissions}`} aria-labelledby="permissions-heading">
          <div className={styles.permissionHeading}><ShieldCheck size={21} /><h2 id="permissions-heading">Your Meta permissions</h2></div>
          <p className={styles.intro}>Access granted during this authorization, across your Instagram use cases.</p>
          <p role="status" className={styles.summary}>{options ? `${grantedCount} of ${capabilities.length} use cases have all required permissions` : error ? 'Permissions could not be verified.' : 'Checking permissions…'}</p>
          <div className={styles.capabilities}>{capabilities.map(({ title, description, scopes, icon: Icon }) => {
            const enabled = scopes.every(scope => granted.has(scope));
            return <div key={title} className={styles.capability}>
              <span className={styles.capabilityIcon}><Icon size={18} /></span>
              <div><div className={styles.capabilityTitle}><h3>{title}</h3><span className={enabled ? styles.granted : styles.missing}>{!options ? (error ? 'Unknown' : 'Checking') : enabled ? <><Check size={11} /> Granted</> : 'Not granted'}</span></div><p>{description}</p></div>
            </div>;
          })}</div>
          <p className={styles.permissionNote}>Granted permissions apply to this connection. Publishing, messaging, and live metrics also depend on the selected account’s eligibility and setup. Reauthorize to request any missing access.</p>
        </section>
      </div>
    </div>
  </main>;
}
