"use client";
import {calendarMutationFetch} from "@/lib/publishing/clientRequests";
import PartnerTag from "@/components/admin/PartnerTag";
import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { TIERS, type PaidTier } from "@/lib/subscriptionTiers";
import { addCalendarMonths } from "@/lib/billingOfferRules";
import { CONTENT_WORKSPACE_PLANS, type ContentWorkspacePlan } from "@/lib/contentWorkspaceEntitlements";

type Account = { id: string; name: string | null; email: string; partnerProfile?: { status: string; isActive: boolean } | null; hasComplimentaryAccess?: boolean };
type EmailState = { offerId: string | null; status: string; _count: { _all: number } };
type Offer = { id: string; title: string; product: string; deliveryTier: string | null; workspacePlan: string | null; billingCycle: string | null; percent: number; durationMonths: number; audience: string; availableUntil: string | null; createdAt: string; createdBy: string; revokedAt: string | null; revokedBy: string | null; _count: { recipients: number; subscriptions: number }; recipients: { creator: Account }[] };
type Attention = { id: string; title: string; product: string; lastError: string; creator: { email: string } };
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const money = (n: number) => `₦${n.toLocaleString("en-NG")}`;
function planLabel(product: string, plan: string | null) {
  if (!plan) return "All paid plans";
  return product === "DELIVERY" ? TIERS[plan as PaidTier]?.name : CONTENT_WORKSPACE_PLANS[plan as ContentWorkspacePlan]?.name;
}
function date(value: string) { return new Date(value).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }); }
export default function BillingOfferManager() {
  const params = useSearchParams();
  const targetCreator = params.get("creator");
  const preselected = useRef(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [attention, setAttention] = useState<Attention[]>([]);
  const [selected, setSelected] = useState<Account[]>([]);
  const [recipientFilter, setRecipientFilter] = useState(params.get("recipients") === "PARTNERS" ? "PARTNERS" : "ALL");
  const [emailStates, setEmailStates] = useState<EmailState[]>([]);
  const [stoppingUser, setStoppingUser] = useState<Account | null>(null);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [product, setProduct] = useState("BOTH");
  const [deliveryTier, setDeliveryTier] = useState("");
  const [workspacePlan, setWorkspacePlan] = useState("");
  const [cycle, setCycle] = useState("MONTHLY");
  const [audience, setAudience] = useState(params.get("creator") || params.get("recipients") === "PARTNERS" ? "SELECTED" : "ALL");
  const [kind, setKind] = useState("DISCOUNT");
  const [percent, setPercent] = useState("20");
  const [months, setMonths] = useState("3");
  const [deadline, setDeadline] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmStop, setConfirmStop] = useState<string | null>(null);
  const load = useCallback(async (search = "", signal?: AbortSignal) => {
    const response = await calendarMutationFetch(`/api/admin/billing-offers?q=${encodeURIComponent(search)}&recipients=${recipientFilter}${targetCreator ? `&creator=${encodeURIComponent(targetCreator)}` : ""}`, { cache: "no-store", signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load offers");
    setOffers(result.offers); setAccounts(result.creators); setAttention(result.needsAttention); setEmailStates(result.emailStates ?? []); setLoaded(true);
    if (result.selectedCreator && !preselected.current) { setSelected([result.selectedCreator]); preselected.current = true; }
  }, [targetCreator, recipientFilter]);
  useEffect(() => { setRequestId(crypto.randomUUID()); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { load(query, controller.signal).catch(e => { if (e.name !== "AbortError") setError(e.message); }); }, 200);
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [query, load]);
  // A failed submission retains its id, so retrying cannot create duplicate grants.
  function changed() { setRequestId(crypto.randomUUID()); setMessage(""); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy("create"); setError(""); setMessage("");
    try {
      const response = await calendarMutationFetch("/api/admin/billing-offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        requestId, recipientFilter: audience === "SELECTED" || kind === "COMPLIMENTARY" ? recipientFilter : "ALL", title, product, deliveryTier, workspacePlan, billingCycle: kind === "COMPLIMENTARY" ? "ANY" : cycle,
        audience: kind === "COMPLIMENTARY" ? "SELECTED" : audience, percent: kind === "COMPLIMENTARY" ? 100 : Number(percent),
        durationMonths: Number(months), creatorIds: selected.map(a => a.id),
        availableUntil: deadline ? new Date(`${deadline}T23:59:59+01:00`).toISOString() : null,
        acknowledgeExistingBilling: acknowledged,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create offer");
      setMessage(kind === "COMPLIMENTARY" ? "Complimentary access is active. Users can see their plan and end date on their dashboard. Notification emails have been queued." : "Offer published. Eligible users can see it on their dashboard and activate it through checkout. Notification emails have been queued.");
      setTitle(""); setSelected([]); setRequestId(crypto.randomUUID()); await load(query);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save offer"); }
    finally { setBusy(null); }
  }
  async function stop(id: string) {
    setBusy(id); setError("");
    try {
      const response = await calendarMutationFetch("/api/admin/billing-offers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not stop offer");
      setConfirmStop(null); await load(query);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not stop offer"); }
    finally { setBusy(null); }
  }
  async function stopUser(account: Account) {
    setBusy(`user-${account.id}`); setError("");
    try {
      const response = await calendarMutationFetch(`/api/admin/creators/${account.id}/complimentary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID() }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not stop access");
      setStoppingUser(null); setMessage(result.stopped || result.legacyStopped ? `Complimentary access ended for ${account.email}. An email notification has been queued.` : `Complimentary access is already inactive for ${account.email}.`); await load(query);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not stop access"); }
    finally { setBusy(null); }
  }
  async function retryEmails(offerId: string) {
    setBusy(`email-${offerId}`);
    try {
      const response = await calendarMutationFetch("/api/admin/billing-offers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not retry emails");
      setMessage("Email delivery has been scheduled. Refresh to see updated delivery status."); await load(query);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not retry emails"); }
    finally { setBusy(null); }
  }
  function partnerPreset() {
    changed(); setRecipientFilter("PARTNERS"); setAudience("SELECTED"); setKind("COMPLIMENTARY");
    setSelected(v => v.filter(a => a.partnerProfile?.status === "ACTIVE"));
    setProduct("CONTENT_WORKSPACE"); setWorkspacePlan("STUDIO"); setTitle("Partner complimentary access");
    setMonths("1"); setCycle("MONTHLY"); setDeadline(""); setAcknowledged(false);
  }
  const percentValue = kind === "COMPLIMENTARY" ? 100 : Number(percent);
  const products = product === "BOTH" ? ["DELIVERY", "CONTENT_WORKSPACE"] : [product];
  const offerAvailable = (o: Offer) => !o.revokedAt && (o.percent === 100 ? addCalendarMonths(new Date(o.createdAt), o.durationMonths) > new Date() : !o.availableUntil || new Date(o.availableUntil) > new Date());
  const liveCount = offers.filter(offerAvailable).length;
  return <main className="min-h-screen bg-[#F6F8FC] px-4 py-8 text-slate-950 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-8">
      <Link href="/admin" className="text-sm font-medium text-slate-500 hover:text-blue-600">← Admin overview</Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-600">Billing benefits</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Discounts & complimentary access</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Choose who gets a benefit, which subscription it covers, and exactly how long it lasts. Every grant keeps a record of its terms.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3"><span className="text-2xl font-semibold">{loaded ? liveCount : "—"}</span><span className="ml-2 text-sm text-slate-500">available offers</span></div>
      </header>
      <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={partnerPreset} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700">Manage accepted partner benefits</button><p className="text-xs text-slate-500">Grant or stop individual partners’ complimentary access using their tagged account below.</p></div>
      {stoppingUser && <section role="alertdialog" aria-label="Stop complimentary access" className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-semibold">End complimentary access for {stoppingUser.email}?</p><p className="mt-2 text-sm text-amber-900">This stops this user’s complimentary grants, including their partner welcome access. Other users’ grants and this user’s paid subscriptions stay active. They will receive an email.</p><div className="mt-4 flex gap-3"><button type="button" disabled={!!busy} onClick={() => stopUser(stoppingUser)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">{busy ? "Stopping…" : "Confirm stop"}</button><button type="button" onClick={() => setStoppingUser(null)} className="text-sm text-slate-600">Keep access</button></div></section>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={() => { setError(""); void load(query).catch(e => setError(e.message)); }} className="ml-3 font-semibold underline">Refresh offers</button></div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
      {attention.length > 0 && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-semibold">Price restoration needs attention</h2><p className="mt-2 text-sm">{attention.length} subscription(s) are waiting for the standard price to be restored. The billing scheduler retries automatically.</p><ul className="mt-3 space-y-1 text-sm">{attention.map(a => <li key={a.id}>{a.creator.email} · {a.title} · {a.lastError}</li>)}</ul></section>}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <form onSubmit={submit} onChange={changed} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div><h2 className="text-lg font-semibold">Create a benefit</h2><p className="mt-1 text-sm text-slate-500">The offer name and terms will appear on the user’s dashboard.</p></div>
          <label className="block text-sm font-medium">Offer name<input required minLength={3} maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Creator community welcome offer" className={`${inputClass} mt-2`} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Benefit type<select value={kind} onChange={e => { setKind(e.target.value); if (e.target.value === "COMPLIMENTARY") setAudience("SELECTED"); }} className={`${inputClass} mt-2`}><option value="DISCOUNT">Percentage discount</option><option value="COMPLIMENTARY">Complimentary access (100% free)</option></select></label>
            <label className="text-sm font-medium">Product<select value={product} onChange={e => setProduct(e.target.value)} className={`${inputClass} mt-2`}><option value="BOTH">Both products</option><option value="DELIVERY">Project Delivery</option><option value="CONTENT_WORKSPACE">Marketing Workspace</option></select></label>
            {product !== "CONTENT_WORKSPACE" && <label className="text-sm font-medium">Delivery subscription<select required={kind === "COMPLIMENTARY"} value={deliveryTier} onChange={e => setDeliveryTier(e.target.value)} className={`${inputClass} mt-2`}><option value="">{kind === "COMPLIMENTARY" ? "Choose a plan" : "All paid Delivery plans"}</option>{Object.entries(TIERS).map(([id,p]) => <option key={id} value={id}>{p.name}</option>)}</select></label>}
            {product !== "DELIVERY" && <label className="text-sm font-medium">Workspace subscription<select required={kind === "COMPLIMENTARY"} value={workspacePlan} onChange={e => setWorkspacePlan(e.target.value)} className={`${inputClass} mt-2`}><option value="">{kind === "COMPLIMENTARY" ? "Choose a plan" : "All paid Workspace plans"}</option>{Object.entries(CONTENT_WORKSPACE_PLANS).filter(([id]) => id !== "ENGAGE").map(([id,p]) => <option key={id} value={id}>{p.name}</option>)}</select></label>}
            {kind === "DISCOUNT" && <label className="text-sm font-medium">Discount percentage<div className="relative mt-2"><input required type="number" min={1} max={99} step={1} value={percent} onChange={e => setPercent(e.target.value)} className={inputClass} /><span className="pointer-events-none absolute right-3 top-2.5 text-slate-500">%</span></div></label>}
            <label className="text-sm font-medium">Duration in months<input required type="number" min={1} max={36} step={1} value={months} onChange={e => setMonths(e.target.value)} className={`${inputClass} mt-2`} /></label>
            {kind === "DISCOUNT" && <label className="text-sm font-medium">Billing cycle<select value={cycle} onChange={e => setCycle(e.target.value)} className={`${inputClass} mt-2`}><option value="MONTHLY">Monthly subscriptions</option><option value="ANNUAL">Annual subscriptions</option><option value="ANY">Monthly & annual (when eligible)</option></select></label>}
            <label className="text-sm font-medium">Who receives it?<select value={audience} disabled={kind === "COMPLIMENTARY"} onChange={e => setAudience(e.target.value)} className={`${inputClass} mt-2`}><option value="ALL">Everyone, including new users</option><option value="SELECTED">Selected users</option></select></label>
          </div>
          {kind === "DISCOUNT" && <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">Duration starts with the first verified payment. Annual offers require 12, 24 or 36 months. An offer is used once per user and product; switching plans does not restart it. Discounts apply to catalogue prices, including the existing annual saving.</div>}
          {(audience === "SELECTED" || kind === "COMPLIMENTARY") && <fieldset className="space-y-3"><legend className="text-sm font-medium">Select users <span className="text-slate-500">({selected.length}/500)</span></legend>
            {selected.length > 0 && <div className="flex flex-wrap gap-2">{selected.map(a => <button type="button" key={a.id} onClick={() => { changed(); setSelected(v => v.filter(x => x.id !== a.id)); }} aria-label={`Remove ${a.email}`} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800">{a.email}{a.partnerProfile?.status === "ACTIVE" ? " · Partner" : ""} ×</button>)}</div>}
            <label className="block text-sm font-medium">Account filter<select value={recipientFilter} onChange={e => { setRecipientFilter(e.target.value); if (e.target.value === "PARTNERS") setSelected(v => v.filter(a => a.partnerProfile?.status === "ACTIVE")); }} className={`${inputClass} mt-2`}><option value="ALL">All active users</option><option value="PARTNERS">Accepted partners only</option></select></label>
            <button type="button" disabled={!accounts.length || !!busy} onClick={() => { changed(); setSelected(previous => [...new Map([...previous, ...accounts].map(a => [a.id, a])).values()].slice(0, 500)); }} className="text-xs font-semibold text-blue-600 disabled:opacity-50">Select all {accounts.length} matching {recipientFilter === "PARTNERS" ? "partners" : "users"} shown</button>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email" aria-label="Search users" className={inputClass} />
            <div className="max-h-52 overflow-auto rounded-xl border border-slate-200">{accounts.length === 0 ? <p className="p-4 text-sm text-slate-500">No accounts match your search.</p> : accounts.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"><label className="flex min-w-0 cursor-pointer items-center gap-3"><input type="checkbox" checked={selected.some(x => x.id === a.id)} onChange={e => { changed(); setSelected(v => e.target.checked ? [...v, a] : v.filter(x => x.id !== a.id)); }} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{a.name || a.email}</span><span className="block truncate text-xs text-slate-500">{a.email}</span><PartnerTag profile={a.partnerProfile} /></span></label><div className="flex items-center gap-2"><button type="button" onClick={() => { changed(); setSelected([a]); setKind("COMPLIMENTARY"); setAudience("SELECTED"); if (!title) setTitle(a.partnerProfile?.status === "ACTIVE" ? "Partner complimentary access" : "Complimentary access"); }} className="rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-700">Grant complimentary</button>{a.hasComplimentaryAccess && <button type="button" disabled={!!busy} onClick={() => setStoppingUser(a)} className="rounded-lg border border-red-200 px-2.5 py-2 text-xs font-semibold text-red-600">Stop complimentary</button>}</div></div>)}</div><p className="text-xs text-slate-500">Showing up to 50 matches. Search to find other accounts; your selection is preserved.</p>
          </fieldset>}
          {kind === "DISCOUNT" && <label className="block text-sm font-medium">Activation deadline <span className="font-normal text-slate-500">(optional)</span><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={`${inputClass} mt-2`} /><span className="mt-2 block text-xs font-normal leading-5 text-slate-500">Last day to start checkout, at 23:59 Lagos time. Already activated discounts keep their promised duration.</span></label>}
          {kind === "COMPLIMENTARY" && <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><input required type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-1.5" /><span>I understand this grants access immediately and does not cancel or refund existing paid subscriptions. The user must cancel paid renewal separately to stop charges.</span></label>}
          <button disabled={!!busy || !requestId || !loaded} className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">{busy === "create" ? "Saving benefit…" : kind === "COMPLIMENTARY" ? `Grant access to ${selected.length} user${selected.length === 1 ? "" : "s"}` : "Publish discount offer"}</button>
        </form>
        <aside className="space-y-5 rounded-3xl border border-blue-100 bg-[#EEF4FF] p-6 lg:sticky lg:top-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Benefit preview</p><h2 className="break-words text-xl font-semibold">{title || "Your new offer"}</h2>
          <div><p className="text-4xl font-semibold tracking-tight text-blue-700">{kind === "COMPLIMENTARY" ? "Free access" : `${percentValue || 0}% off`}</p><p className="mt-2 text-sm text-slate-600">For {months || "0"} month(s) · {audience === "ALL" && kind !== "COMPLIMENTARY" ? "Everyone" : `${selected.length} selected user(s)`}</p></div>
          {products.map(p => {
            const chosen = p === "DELIVERY" ? deliveryTier : workspacePlan;
            const configs = p === "DELIVERY" ? TIERS : CONTENT_WORKSPACE_PLANS;
            const entries = Object.entries(configs).filter(([id]) => !chosen || id === chosen);
            return <div key={p} className="rounded-2xl bg-white/80 p-4"><p className="text-sm font-semibold">{p === "DELIVERY" ? "Project Delivery" : "Marketing Workspace"}</p><p className="mt-1 text-xs text-slate-500">{planLabel(p, chosen)}</p><div className="mt-3 space-y-2">{entries.map(([id,config]) => {
              const base = cycle === "ANNUAL" ? config.priceNgnAnnual : config.priceNgnMonthly;
              return <div key={id} className="flex items-center justify-between gap-2 text-xs"><span>{config.name}</span><span>{kind === "COMPLIMENTARY" ? "Included" : <><span className="mr-2 text-slate-400 line-through">{money(base)}</span><strong>{money(Math.round(base * (100 - percentValue) / 100))}</strong></>}</span></div>;
            })}</div></div>;
          })}
          {kind === "COMPLIMENTARY" && Number.isInteger(Number(months)) && Number(months) >= 1 && Number(months) <= 36 && <p className="text-xs font-medium text-blue-700">Starts today · Ends {date(addCalendarMonths(new Date(), Number(months)).toISOString())}</p>}
          <p className="text-xs leading-5 text-slate-600">{kind === "COMPLIMENTARY" ? "Starts now. Access returns to the user’s paid plan or free/read-only limits when this grant ends." : "Preview per billing cycle. Existing subscriptions keep their current price until an offer checkout succeeds. Selected-user and product/plan-specific offers take priority; discounts never stack."}</p>
        </aside>
      </div>
      <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Offer history</h2><span className="text-xs text-slate-500">Latest 100 offers</span></div>
        {!loaded ? <p className="text-sm text-slate-500">Loading offers…</p> : offers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No offers yet. Create a benefit above to get started.</div> : offers.map(o => <article key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{o.title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${o.revokedAt ? "bg-slate-100 text-slate-500" : o.availableUntil && new Date(o.availableUntil) <= new Date() ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{o.revokedAt ? "Stopped" : !offerAvailable(o) ? (o.percent === 100 ? "Grant ended" : "Activation closed") : o.percent === 100 ? "Access granted" : "Available"}</span></div><p className="mt-2 text-sm text-slate-600">{o.percent === 100 ? "Complimentary access" : `${o.percent}% off`} · {o.durationMonths} months · {o.billingCycle ?? (o.percent === 100 ? "Access grant" : "Eligible billing cycles")} · {o.audience === "ALL" ? "Everyone" : `${o._count.recipients} selected users`}</p><p className="mt-1 text-xs text-slate-500">{o.product !== "CONTENT_WORKSPACE" && `Delivery: ${planLabel("DELIVERY", o.deliveryTier)}`}{o.product === "BOTH" && " · "}{o.product !== "DELIVERY" && `Workspace: ${planLabel("CONTENT_WORKSPACE", o.workspacePlan)}`}</p>{o.recipients.length > 0 && <p className="mt-2 break-words text-xs text-slate-500">{o.recipients.map(r => r.creator.email).join(", ")}{o._count.recipients > 5 ? ` +${o._count.recipients - 5} more` : ""}</p>}<div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span>Email delivery: {emailStates.filter(s => s.offerId === o.id && s.status === "SENT").reduce((n,s) => n + s._count._all, 0)} sent · {emailStates.filter(s => s.offerId === o.id && ["PENDING", "SENDING"].includes(s.status)).reduce((n,s) => n + s._count._all, 0)} queued · {emailStates.filter(s => s.offerId === o.id && s.status === "FAILED").reduce((n,s) => n + s._count._all, 0)} failed</span>{emailStates.some(s => s.offerId === o.id && s.status === "FAILED") && <button disabled={!!busy} onClick={() => retryEmails(o.id)} className="font-semibold text-blue-600 underline">Retry failed emails</button>}</div><p className="mt-2 text-xs text-slate-400">Created {date(o.createdAt)} by {o.createdBy} · {o._count.subscriptions} checkout(s)/grant(s){o.availableUntil && ` · Activate by ${date(o.availableUntil)}`}{o.percent === 100 && ` · Grant ends ${date(addCalendarMonths(new Date(o.createdAt), o.durationMonths).toISOString())}`}{o.revokedAt && ` · Stopped ${date(o.revokedAt)}${o.revokedBy ? ` by ${o.revokedBy}` : ""}`}</p></div>
          {!o.revokedAt && <div className="self-start">{confirmStop === o.id ? <div className="max-w-xs space-y-2"><p className="text-xs leading-5 text-slate-600">{o.percent === 100 ? "End complimentary access now? Existing paid subscriptions will remain active." : "Stop new activations? Discounts already activated keep their agreed terms."}</p><div className="flex gap-3"><button disabled={!!busy} onClick={() => stop(o.id)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">{busy === o.id ? "Stopping…" : "Confirm stop"}</button><button onClick={() => setConfirmStop(null)} className="text-xs text-slate-500">Keep offer</button></div></div> : <button onClick={() => setConfirmStop(o.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-red-300 hover:text-red-600">Stop offer</button>}</div>}
        </div></article>)}
      </section>
    </div>
  </main>;
}
