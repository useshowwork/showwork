"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ExternalLink } from "lucide-react";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

export type BillingDetails = { name: string; email: string; address: string; taxId: string };

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#155FC7] px-4 text-sm font-medium text-white hover:bg-[#114f9f] disabled:opacity-60";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-[#155FC7] hover:bg-[#f2f7ff] disabled:opacity-60";
const panel = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
const modal = "w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 p-6 text-[#102A29] shadow-xl backdrop:bg-[#102A29]/40";

export function BillingPaymentMethod({ product, available }: { product: string; available: boolean }) {
  const [card, setCard] = useState<{ brand: string; last4: string; month: string | null; year: string | null } | null>(null);
  const [loading, setLoading] = useState(available);
  const [editing, setEditing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const endpoint = `/api/billing/payment-method?product=${encodeURIComponent(product)}`;

  useEffect(() => {
    if (!available) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    async function load() {
      try {
        const res = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setCard(data.card);
      } catch {
        if (!controller.signal.aborted) setLoadError("Couldn’t load your payment method.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [available, endpoint, retry]);

  async function update() {
    setEditing(true);
    setActionError("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!res.ok || typeof data.url !== "string") throw new Error(data.error || "Couldn’t open Paystack.");
      window.location.assign(data.url);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn’t open Paystack.");
      setEditing(false);
    }
  }

  return (
    <section data-billing-card className="flex min-w-0 scroll-mt-6 flex-col overflow-hidden rounded-[22px] border border-[#d8e7fb] bg-[#e8f1ff]" id="payment-method" aria-labelledby="payment-method-heading">
      <div className="flex flex-1 flex-col p-4 sm:p-5">
      <h2 id="payment-method-heading" className="text-lg font-medium">Payment method</h2>
      <div className="relative mt-3 flex min-h-28 flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-[#d5e5fb] bg-[#f3f8ff] p-3.5">
        <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border-[20px] border-white/45" />
        <div className="relative flex items-center justify-between gap-2 text-[#155FC7]">
          <CreditCard size={22} aria-hidden="true" />
          {available && !loading && !loadError && card && <span className="text-xs font-medium uppercase tracking-wide">{card.brand}</span>}
        </div>
        <div className="relative mt-3 text-sm">
          {available && loading ? <p role="status" className="text-slate-600">Loading payment method…</p> :
            available && loadError ? <><p role="alert">{loadError}</p><button type="button" className="mt-1 min-h-8 text-[#155FC7] underline" onClick={() => setRetry(value => value + 1)}>Try again</button></> :
            available && card ? <><p className="font-medium tabular-nums"><span aria-hidden="true">•••• </span><span className="sr-only">Card ending in </span>{card.last4}</p>{card.month && card.year && <p className="mt-1 text-xs text-slate-600">Expires {card.month}/{card.year}</p>}</> :
            <><p className="font-medium">No saved card for this plan</p><p className="mt-1 text-xs text-slate-600">{available ? "Check available payment options in Paystack." : "A card is saved when you start a paid subscription."}</p></>}
        </div>
      </div>
      </div>
      {available && <div className="border-t border-[#d8e7fb] bg-[#e8f1ff] px-4 py-3 sm:px-5"><button type="button" className={secondary} onClick={() => { setActionError(""); dialog.current?.showModal(); }}>Update payment method</button></div>}
      <dialog ref={dialog} className={modal} aria-labelledby="update-payment-title" onCancel={event => { if (editing) event.preventDefault(); }}>
        <h2 id="update-payment-title" className="text-xl font-medium">Update payment method</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Paystack opens a secure page to update the payment method for this subscription.</p>
        {actionError && <p className="mt-3 text-sm text-red-700" role="alert">{actionError}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={secondary} disabled={editing} onClick={() => dialog.current?.close()}>Back</button>
          <button type="button" className={button} disabled={editing} onClick={() => void update()}>{editing ? "Opening…" : "Open Paystack"} <ExternalLink size={15} aria-hidden="true" /></button>
        </div>
      </dialog>
    </section>
  );
}

const inputs = [
  { field: "name", label: "Billing name or company", limit: 160 },
  { field: "email", label: "Billing email", limit: 254 },
  { field: "address", label: "Billing address", limit: 600 },
  { field: "taxId", label: "Tax ID (optional)", limit: 100 },
] as const;

export function BillingDetailsForm({ initialDetails, available }: { initialDetails: BillingDetails; available: boolean }) {
  const [details, setDetails] = useState(initialDetails);
  const [draft, setDraft] = useState(initialDetails);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/billing/details", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Couldn’t save billing details.");
      setDetails(Object.fromEntries(inputs.map(({ field }) => [field, result.details[field] ?? ""])) as BillingDetails);
      setMessage("Billing details saved.");
      dialog.current?.close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t save billing details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section data-billing-card id="billing-details" className={panel} aria-labelledby="billing-details-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="billing-details-heading" className="text-lg font-medium">Billing details</h2>
        {available && <button type="button" className={secondary} onClick={() => { setDraft(details); setError(""); setMessage(""); dialog.current?.showModal(); }}>Edit details</button>}
      </div>
      {available ? <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        {inputs.map(({ field, label }) => <div className="min-w-0" key={field}><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 whitespace-pre-line break-words">{details[field] || "Not provided"}</dd></div>)}
      </dl> : <p className="mt-3 text-sm text-slate-600">Billing details are temporarily unavailable.</p>}
      {message && <p role="status" className="mt-3 text-sm text-[#155FC7]">{message}</p>}
      <dialog ref={dialog} className={modal} aria-labelledby="edit-billing-details-title" onCancel={event => { if (saving) event.preventDefault(); }}>
        <h2 id="edit-billing-details-title" className="text-xl font-medium">Edit billing details</h2>
        <form onSubmit={save} className="mt-4 space-y-3">
          {inputs.map(({ field, label, limit }) => (
            <label key={field} className="block text-sm">
              {label}
              {field === "address" ? (
                <textarea rows={2} maxLength={limit} value={draft[field]} onChange={event => setDraft({ ...draft, [field]: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-base" />
              ) : (
                <input type={field === "email" ? "email" : "text"} maxLength={limit} value={draft[field]} onChange={event => setDraft({ ...draft, [field]: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-200 px-3 text-base" />
              )}
            </label>
          ))}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" className={secondary} disabled={saving} onClick={() => dialog.current?.close()}>Cancel</button>
            <button type="submit" className={button} disabled={saving}>{saving ? "Saving…" : "Save details"}</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

export function BillingCancellation({ delivery, product }: { delivery: boolean; product: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const response = await calendarMutationFetch(delivery ? "/api/subscription/cancel" : "/api/calendars/cancel-subscription", { method: "POST" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Couldn’t cancel. Try again.");
      }
      dialog.current?.close();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t cancel. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className={secondary} onClick={() => { setError(""); dialog.current?.showModal(); }}>Cancel subscription</button>
    <dialog ref={dialog} className={modal} aria-labelledby="cancel-plan-title" onCancel={event => { if (busy) event.preventDefault(); }}>
      <h2 id="cancel-plan-title" className="text-xl font-medium">Cancel {product}?</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {delivery ? "Recurring payments stop and Project Delivery switches to Free immediately. Published projects stay live." : "Recurring payments and paid access stop immediately."}
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={secondary} disabled={busy} onClick={() => dialog.current?.close()}>Keep subscription</button>
        <button type="button" className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-60" disabled={busy} onClick={() => void cancel()}>{busy ? "Cancelling…" : "Confirm cancellation"}</button>
      </div>
    </dialog>
  </>;
}
