import crypto from "crypto";
import {nativeBillingFetch as fetch} from './publishing/nativeApplicationContext';

function paystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY");
  return key;
}
const PAYSTACK_BASE_URL = "https://api.paystack.co";

// Flat ₦5,000 per project. Paystack amounts are in kobo (smallest unit),
// so ₦5,000 = 500,000 kobo.
export const PROJECT_PRICE_NGN = 5000;
export const PROJECT_PRICE_KOBO = PROJECT_PRICE_NGN * 100;

// Explicit whitelist of payment methods shown at checkout. Paystack's
// OPay option has been causing a stuck "please close this page"
// dead-end for customers on mobile (a known app-switch + browser
// redirect issue, not specific to this integration). OPay isn't a
// documented standalone channel type — it's shown either under "bank"
// or "mobile_money" depending on Paystack's current checkout version —
// so rather than guess which one to exclude, we whitelist only the
// channels we actually want. Anything not listed here simply won't
// appear as an option.
const ALLOWED_CHANNELS = ["card", "bank_transfer", "ussd", "qr"];

// Subscriptions (any Paystack plan-based checkout) can only ever
// renew automatically off a saved card authorization — transfer,
// USSD, and QR are one-time payment methods with nothing for
// Paystack to charge again next cycle. Allowing them here would let
// someone pay the first month successfully, then silently never be
// charged again with no error surfaced anywhere. Used only by
// initializeSubscription below; one-time charges above keep every
// channel, since there's no renewal to protect there.
const SUBSCRIPTION_ALLOWED_CHANNELS = ["card"];

interface InitializeTransactionParams {
  email: string;       // the creator's email — Paystack requires this
  reference: string;   // a unique reference we generate, tied to the project
  callbackUrl: string; // where Paystack redirects after payment
  metadata?: Record<string, unknown>;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

/**
 * Starts a Paystack transaction. Call this from your /api/payments/initialize
 * route, then redirect the creator's browser to `authorization_url`.
 */
export async function initializeTransaction({
  email,
  reference,
  callbackUrl,
  metadata,
}: InitializeTransactionParams): Promise<PaystackInitializeResponse> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: PROJECT_PRICE_KOBO,
      reference,
      callback_url: callbackUrl,
      currency: "NGN",
      channels: ALLOWED_CHANNELS,
      metadata,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Paystack initialize failed: ${errText}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────
// SUBSCRIPTIONS
// ─────────────────────────────────────────────
// Each tier's plan is created once, manually, in the Paystack dashboard —
// not something the app creates repeatedly. Their codes are stored as
// env vars and looked up via lib/subscriptionTiers.ts. Each tier now has
// TWO plans (monthly and annual), since Paystack bills a fixed amount
// at a fixed interval per plan — "the same plan, billed yearly instead"
// isn't a toggle on their side, it's a genuinely separate plan.

/**
 * Starts a subscription checkout for a specific tier's plan. Passing
 * `plan` determines what actually gets charged (the plan's own
 * configured price) — but Paystack's API still requires a valid,
 * non-zero `amount` field to be present for the request to validate at
 * all, even though it isn't what the customer ends up being charged.
 */
export async function initializeSubscription({
  email,
  reference,
  callbackUrl,
  planCode,
  amount,
  metadata,
}: {
  email: string;
  reference: string;
  callbackUrl: string;
  planCode: string;
  amount: number;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitializeResponse> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount,
      reference,
      callback_url: callbackUrl,
      currency: "NGN",
      channels: SUBSCRIPTION_ALLOWED_CHANNELS,
      plan: planCode,
      metadata,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Paystack subscription initialize failed: ${errText}`);
  }

  const result = await res.json();
  if (!result?.status || !result.data?.authorization_url) throw new Error("Paystack did not create a subscription checkout");
  return result;
}

/**
 * Creates a new Paystack Plan on the fly. Used specifically for
 * discounts — Paystack's recurring billing charges whatever a plan's
 * own configured price is, so giving one specific creator (or everyone,
 * for a platform-wide discount) a genuinely discounted recurring price
 * means creating a real plan at that discounted amount rather than just
 * showing a different number on screen.
 *
 * `interval` defaults to "monthly" to match existing callers, but now
 * accepts "annually" too — needed to create the new annual-billing
 * plans for each tier (or an annual discount plan) the same way the
 * monthly ones were originally created.
 */
export async function createPlan({
  name,
  amountNgn,
  interval = "monthly",
}: {
  name: string;
  amountNgn: number;
  interval?: "monthly" | "annually";
}): Promise<{ status: boolean; data: { plan_code: string } }> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      amount: amountNgn * 100,
      interval,
      currency: "NGN",
    }),
  });

  if (!res.ok) {
    throw new Error(`Paystack create plan failed: ${await res.text()}`);
  }

  return res.json();
}
 /* fallback right after checkout — the webhook is the normal path for
 * getting subscription_code/email_token, but webhooks can't reach
 * localhost during local development, and can occasionally be delayed
 * even in production. This lets us confirm and store everything
 * immediately instead of waiting.
 */
export async function fetchCustomerSubscriptions(customerCode: string) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/subscription?customer=${encodeURIComponent(customerCode)}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${paystackSecretKey()}` },
  });
  if (!res.ok) {
    throw new Error(`Paystack fetch subscriptions failed: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Cancels a subscription. Requires both the subscription_code and the
 * email_token Paystack returned when the subscription was created —
 * both get saved on the Creator row from the `subscription.create`
 * webhook, specifically so this can be called later without needing to
 * look anything up from Paystack first.
 */
export async function cancelSubscription(subscriptionCode: string, emailToken: string) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/subscription/disable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
  });

  if (!res.ok) {
    throw new Error(`Paystack cancel subscription failed: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Verifies that a webhook request actually came from Paystack, not
 * an attacker forging a "payment succeeded" call to your endpoint.
 * Paystack signs every webhook body with your secret key using HMAC-SHA512,
 * sent in the `x-paystack-signature` header.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader||!/^[a-f0-9]{128}$/.test(signatureHeader)) return false;

  const hash = crypto
    .createHmac("sha512", paystackSecretKey())
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(signatureHeader,'hex'));
}

/**
 * Optional but recommended: re-confirm a transaction directly with Paystack's
 * API (rather than trusting the webhook payload alone) before marking a
 * project as paid. Cheap insurance against a spoofed or replayed webhook.
 */
export async function verifyTransaction(reference: string) {
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${paystackSecretKey()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    }
  );
  const result = await res.json();
  if (!res.ok && result?.code !== "transaction_not_found") {
    throw new Error(`Paystack verify failed (${res.status})`);
  }
  return result;
}

/** Updates a private offer plan; never call this with a shared catalogue plan. */
export async function updatePrivatePlanPrice(planCode: string, amountNgn: number) {
  if (!Number.isSafeInteger(amountNgn) || amountNgn <= 0) throw new Error("Invalid recurring price");
  const response = await fetch(`${PAYSTACK_BASE_URL}/plan/${encodeURIComponent(planCode)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${paystackSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountNgn * 100, update_existing_subscriptions: true }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result?.status) throw new Error("Could not restore the standard subscription price");
  return result;
}

/** Page through actual successful transactions; subscriptions are not payment receipts. */
export async function listSuccessfulTransactions(params: {page:number;perPage:number;from?:Date;to?:Date}) {
  const query = new URLSearchParams({status:"success",page:String(params.page),perPage:String(params.perPage)});
  if (params.from) query.set("from",params.from.toISOString());
  if (params.to) query.set("to",params.to.toISOString());
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction?${query}`,{
    headers:{Authorization:`Bearer ${paystackSecretKey()}`},cache:"no-store",signal:AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Paystack transaction listing failed (${response.status})`);
  const result = await response.json();
  if (!result.status || !Array.isArray(result.data)) throw new Error("Invalid Paystack transaction list");
  return result as {status:boolean;data:{reference:string;domain:string;status:string;amount:number;currency:string}[];meta?:{total?:number;pageCount?:number}};
}

/** Bank data is resolved server-side; never trust a typed account holder name. */
export async function listNigerianBanks(): Promise<{ name: string; code: string }[]> {
  const banks = new Map<string, { name: string; code: string }>();
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({ country: "nigeria", currency: "NGN", perPage: "100", use_cursor: "true" });
    if (cursor) query.set("next", cursor);
    const res = await fetch(`${PAYSTACK_BASE_URL}/bank?${query}`, { headers: { Authorization: `Bearer ${paystackSecretKey()}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
    const body = await res.json();
    if (!res.ok || !body.status || !Array.isArray(body.data)) throw new Error("Bank list is temporarily unavailable. Try again.");
    for (const bank of body.data) if (bank.active !== false && !bank.is_deleted && typeof bank.name === "string" && typeof bank.code === "string") banks.set(bank.code, { name: bank.name, code: bank.code });
    const next = body.meta?.next;
    if (!next) return [...banks.values()].sort((a,b)=>a.name.localeCompare(b.name));
    if (typeof next !== "string" || next === cursor) throw new Error("Bank pagination failed. Try again.");
    cursor = next;
  }
  throw new Error("Could not load the complete bank list. Try again.");
}
export async function resolveNigerianAccount(bankCode: string, accountNumber: string) {
  const banks = await listNigerianBanks();
  const bank = banks.find(item => item.code === bankCode);
  if (!bank) throw new Error("Select a supported Nigerian bank.");
  const query = new URLSearchParams({ bank_code: bankCode, account_number: accountNumber });
  const res = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve?${query}`, { headers: { Authorization: `Bearer ${paystackSecretKey()}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
  const body = await res.json();
  if (!res.ok || !body.status || body.data?.account_number !== accountNumber || !body.data?.account_name?.trim()) throw new Error("Could not verify this bank account. Check the bank and account number.");
  return { bankName: bank.name, bankCode, accountNumber, accountName: body.data.account_name.trim() as string, verifiedAt: new Date() };
}
export async function fetchPartnerPaymentIssue(kind: "refund" | "dispute", id: string) {
  if (!/^\d+$/.test(id)) throw new Error("Invalid payment issue ID");
  const res = await fetch(`${PAYSTACK_BASE_URL}/${kind}/${id}`, { headers: { Authorization: `Bearer ${paystackSecretKey()}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
  const body = await res.json();
  if (!res.ok || !body.status || !body.data || String(body.data.id) !== id) throw new Error("Could not verify payment issue");
  if (typeof body.data.transaction === "number") {
    const transaction = await fetch(`${PAYSTACK_BASE_URL}/transaction/${body.data.transaction}`, { headers: { Authorization: `Bearer ${paystackSecretKey()}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
    const details = await transaction.json();
    if (!transaction.ok || !details.status || String(details.data?.id) !== String(body.data.transaction)) throw new Error("Could not verify issue transaction");
    body.data.transaction = details.data;
  }
  return body.data;
}
