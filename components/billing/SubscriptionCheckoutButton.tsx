"use client";
import {calendarMutationFetch} from "@/lib/publishing/clientRequests";
import { useEffect, useId, useRef, useState } from "react";
import { TIERS, type PaidTier, type BillingCycle } from "@/lib/subscriptionTiers";
import { CONTENT_WORKSPACE_PLANS, type ContentWorkspacePlan } from "@/lib/contentWorkspaceEntitlements";
import type { BillingProduct } from "@/lib/billingOfferRules";
type Quote = { amountNgn: number; standardPriceNgn: number; offer: { id: string; title: string; percent: number; durationMonths: number; remainingCycles: number } | null };
const money = (n: number) => `₦${n.toLocaleString("en-NG")}`;
export default function SubscriptionCheckoutButton({ product, plan, cycle, label = "Subscribe", className }: { className?: string; product: BillingProduct; plan: string; cycle: BillingCycle; label?: string }) {
  const planName = product === "DELIVERY" ? TIERS[plan as PaidTier].name : CONTENT_WORKSPACE_PLANS[plan as ContentWorkspacePlan].name;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => { if (quote && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [quote]);
  async function preview() {
    setLoading(true); setError(null);
    try {
      const response = await calendarMutationFetch(`/api/billing/quote?product=${product}&plan=${plan}&cycle=${cycle}`, { cache: "no-store" });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not confirm your price");
      setQuote(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not confirm your price"); }
    finally { setLoading(false); }
  }
  async function checkout() {
    if (!quote) return;
    setLoading(true); setError(null);
    try {
      const response = await calendarMutationFetch(product === "DELIVERY" ? "/api/subscription/initialize" : "/api/calendars/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(product === "DELIVERY" ? { tier: plan, cycle } : { plan, billingCycle: cycle, activateOffer: !!quote.offer }), expectedQuote: { amountNgn: quote.amountNgn, offerId: quote.offer?.id ?? null } }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Failed to start subscription");
      window.location.href = result.authorizationUrl;
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to start subscription"); setLoading(false); }
  }
  function close() { if (loading) return; dialog.current?.close(); setQuote(null); }
  return <div>
    <button onClick={preview} disabled={loading} className={className ?? "w-full rounded-lg bg-[#155FC7] py-2.5 text-xs font-medium text-white transition hover:brightness-95 disabled:opacity-50"}>{loading ? "Confirming price…" : label}</button>
    {error && !quote && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    <dialog ref={dialog} onCancel={e => { if (loading) e.preventDefault(); else setQuote(null); }} aria-labelledby={headingId} className="w-[calc(100%-2rem)] max-w-md rounded-3xl border-0 p-6 text-slate-950 shadow-2xl backdrop:bg-slate-950/50">
      {quote && <><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Confirm your subscription</p><h2 id={headingId} className="mt-3 text-2xl font-semibold">{plan === "ENGAGE" ? "Showwork Engage" : `${product === "DELIVERY" ? "Delivery" : "Marketing Workspace"} · ${planName}`}</h2><p className="mt-2 text-sm text-slate-500">{cycle === "ANNUAL" ? "Annual" : "Monthly"} billing</p><p className="mt-5 text-3xl font-semibold">{money(quote.amountNgn)}<span className="ml-1 text-sm font-normal text-slate-500">/{cycle === "ANNUAL" ? "year" : "month"}</span></p>
        {quote.offer ? <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900"><strong>{quote.offer.title} · {quote.offer.percent}% off</strong><p>{quote.offer.remainingCycles} discounted payment(s), then automatically renews at {money(quote.standardPriceNgn)} per {cycle === "ANNUAL" ? "year" : "month"}.</p><p className="mt-2">The {quote.offer.durationMonths}-month benefit starts with your first successful payment. Switching plans does not restart an activated offer.</p></div> : <p className="mt-4 text-sm leading-6 text-slate-600">Automatically renews at {money(quote.standardPriceNgn)} per {cycle === "ANNUAL" ? "year" : "month"}. You can cancel renewal from billing.</p>}
        <p className="mt-4 text-xs leading-5 text-slate-500">Payment starts a new billing period immediately. A successful switch cancels the previous renewal; unused prepaid time is not credited automatically.</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}<div className="mt-6 flex gap-3"><button disabled={loading} onClick={close} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium disabled:opacity-50">Go back</button><button disabled={loading} onClick={checkout} className="flex-1 rounded-xl bg-[#155FC7] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Starting checkout…" : "Continue to payment"}</button></div>
      </>}
    </dialog>
  </div>;
}
