"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  HandCoins,
  UsersRound,
  WalletCards,
} from "lucide-react";

type ReferralStatus =
  | "PENDING"
  | "ACTIVE"
  | "EXPIRED"
  | "DISQUALIFIED";

type CommissionStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "VOIDED";

type Commission = {
  id: string;
  referralId: string | null;
  paymentRecordId: string;
  paymentAmountNgn: number;
  commissionPercent: number;
  commissionAmountNgn: number;
  status: CommissionStatus;
  earnedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  payoutReference: string | null;
};

type PayoutStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "REJECTED";

type Payout = {
  id: string;
  amountNgn: number;
  status: PayoutStatus;
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  payoutReference: string | null;
  adminNote: string | null;
  commissionCount: number;
};

type DashboardData = {
  enrolled: boolean;
  partner?: {
    id: string;
    referralCode: string;
    commissionPercent: number; commissionMonths: number; discountPercent: number; discountMonths: number;
    isActive: boolean;
    createdAt: string;
  };
  referralLink?: string;
  referrals?: {
    total: number;
    pending: number;
    active: number;
    expired: number;
    disqualified: number;
  };
  commissions?: {
    totalEarnedNgn: number;
    pendingNgn: number;
    approvedNgn: number;
    paidNgn: number;
    voidedNgn: number;
    totalCount: number;
  };
  commissionHistory?: Commission[];
payout?: {
  minimumPayoutNgn: number; recoveryDueNgn?: number; paymentUnderReview?: boolean;
  availableNgn: number;
  canRequestPayout: boolean;
  activePayout: Payout | null;
  payoutHistory: Payout[];
};

    payoutAccount?: {
    id: string;
    bankName: string; bankCode: string | null; verifiedAt: string | null;
    accountNumber: string;
    accountName: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};



function formatNgn(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status: CommissionStatus) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "PAID":
      return "Paid";
    case "VOIDED":
      return "Voided";
    default:
      return status;
  }
}

function statusClasses(status: CommissionStatus) {
  switch (status) {
    case "PAID":
      return "border-[#CDEBD8] bg-[#F0FAF4] text-[#20864B]";

    case "APPROVED":
      return "border-[#D8E6FF] bg-[#F1F6FF] text-[#2478FF]";

    case "VOIDED":
      return "border-[#E8D9D9] bg-[#FAF3F3] text-[#A54B4B]";

    case "PENDING":
    default:
      return "border-[#E9E1C8] bg-[#FBF8EE] text-[#8B722F]";
  }
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof UsersRound;
}) {
  return (
    <div className="rounded-[22px] border border-[#E2E5E9] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.025)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#969CA5]">
            {label}
          </p>

          <p className="mt-3 text-[27px] font-semibold tracking-[-0.045em] text-[#101114]">
            {value}
          </p>

          <p className="mt-1 text-[11px] text-[#8A9099]">
            {detail}
          </p>
        </div>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F6FF] text-[#2478FF]">
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[24px] border border-[#E2E5E9] bg-white px-6 py-12 text-center shadow-[0_4px_18px_rgba(15,23,42,0.025)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F6FF] text-[#2478FF]">
        <HandCoins className="h-5 w-5" strokeWidth={1.8} />
      </div>

      <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#101114]">
        No commissions yet
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#737A84]">
        When someone joins Showwork through your referral and makes a
        qualifying payment, your commission will appear here.
      </p>
    </div>
  );
}

export default function PartnerDashboardPage() {
const [data, setData] = useState<DashboardData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [copied, setCopied] = useState(false);
const [enrolling, setEnrolling] = useState(false);
const [applicationSubmitted, setApplicationSubmitted] = useState(false);
const [requestingPayout, setRequestingPayout] = useState(false);
const [payoutMessage, setPayoutMessage] = useState("");
const [payoutError, setPayoutError] = useState("");

  const [payoutAccount, setPayoutAccount] = useState<
    DashboardData["payoutAccount"]
  >(null);
  const [payoutAccountLoading, setPayoutAccountLoading] = useState(true);
  const [savingPayoutAccount, setSavingPayoutAccount] = useState(false);

  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [banksError, setBanksError] = useState("");
  useEffect(() => { fetch("/api/partners/banks").then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); setBanks(result.banks); }).catch(() => setBanksError("Could not load banks. Reload this page to retry.")); }, []);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [payoutAccountMessage, setPayoutAccountMessage] = useState("");
  const [payoutAccountError, setPayoutAccountError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/partners/dashboard", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error || "Failed to load partner dashboard"
          );
        }

        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        console.error("Failed to load partner dashboard:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load partner dashboard"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

        async function loadPayoutAccount() {
      try {
        setPayoutAccountLoading(true);
        setPayoutAccountError("");

        const response = await fetch(
          "/api/partners/payout-account",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error || "Failed to load payout account"
          );
        }

        if (!cancelled) {
          const account = result?.payoutAccount ?? null;

          setPayoutAccount(account);

          if (account) {
            setBankName(account.bankName);
            setBankCode(account.bankCode ?? "");
            setAccountNumber(account.accountNumber);
            setAccountName(account.accountName);
          }
        }
      } catch (err) {
        console.error(
          "Failed to load payout account:",
          err
        );

        if (!cancelled) {
          setPayoutAccountError(
            err instanceof Error
              ? err.message
              : "Failed to load payout account"
          );
        }
      } finally {
        if (!cancelled) {
          setPayoutAccountLoading(false);
        }
      }
    }

    loadDashboard();
loadPayoutAccount();

    return () => {
      cancelled = true;
    };
  }, []);

  const referralUrl = useMemo(() => {
    if (!data?.referralLink) {
      return "";
    }

    if (typeof window === "undefined") {
      return data.referralLink;
    }

    return `${window.location.origin}${data.referralLink}`;
  }, [data?.referralLink]);

  async function copyReferralLink() {
    if (!referralUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (err) {
      console.error("Failed to copy referral link:", err);
    }
  }

  async function handleEnroll() {
  try {
    setEnrolling(true);
    setError("");

    const response = await fetch("/api/partners/enroll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error || "Failed to join the Partner Program"
      );
    }

    setApplicationSubmitted(true);
  } catch (err) {
    console.error("Failed to enroll as partner:", err);

    setError(
      err instanceof Error
        ? err.message
        : "Failed to join the Partner Program"
    );
  } finally {
    setEnrolling(false);
  }
}

  async function handleSavePayoutAccount() {
    try {
      setSavingPayoutAccount(true);
      setPayoutAccountMessage("");
      setPayoutAccountError("");

      const response = await fetch(
        "/api/partners/payout-account",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bankCode,
            accountNumber,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Failed to save payout account"
        );
      }

      const account = result.payoutAccount;

      setPayoutAccount(account);
      setBankName(account.bankName);
            setBankCode(account.bankCode ?? "");
      setAccountNumber(account.accountNumber);
      setAccountName(account.accountName);

      setPayoutAccountMessage(
        "Your bank account has been verified and saved."
      );
      const refreshed = await fetch("/api/partners/dashboard", { cache: "no-store" });
      if (refreshed.ok) setData(await refreshed.json());
    } catch (err) {
      console.error(
        "Failed to save payout account:",
        err
      );

      setPayoutAccountError(
        err instanceof Error
          ? err.message
          : "Failed to save payout account"
      );
    } finally {
      setSavingPayoutAccount(false);
    }
  }

  async function handleRequestPayout() {
  if (!data?.payout?.canRequestPayout) {
    return;
  }

  if (!payoutAccount) {
    setPayoutError(
      "Please add your payout account before requesting a payout."
    );
    return;
  }

  const confirmed = window.confirm(
    `Request a payout of ${formatNgn(
      data.payout.availableNgn
    )} to your saved bank account?`
  );

  if (!confirmed) {
    return;
  }

  try {
    setRequestingPayout(true);
    setPayoutMessage("");
    setPayoutError("");

    const response = await fetch("/api/partners/payouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error || "Failed to request payout"
      );
    }

    setPayoutMessage(
      `Your payout request for ${formatNgn(
        result.amountNgn
      )} has been submitted.`
    );

    const dashboardResponse = await fetch(
      "/api/partners/dashboard",
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const dashboardResult =
      await dashboardResponse.json();

    if (!dashboardResponse.ok) {
      throw new Error(
        dashboardResult?.error ||
          "Payout was requested, but the dashboard could not be refreshed."
      );
    }

    setData(dashboardResult);
  } catch (err) {
    console.error(
      "Failed to request partner payout:",
      err
    );

    setPayoutError(
      err instanceof Error
        ? err.message
        : "Failed to request payout"
    );
  } finally {
    setRequestingPayout(false);
  }
}

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F8FA] text-[#101114]">
        <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          <div className="animate-pulse pt-4 sm:pt-8">
            <div className="h-4 w-28 rounded-full bg-[#E6E9EE]" />
            <div className="mt-6 h-12 w-72 rounded-xl bg-[#E6E9EE]" />
            <div className="mt-3 h-5 w-[420px] max-w-full rounded-full bg-[#ECEEF2]" />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[150px] rounded-[22px] border border-[#E8EAEE] bg-white"
                />
              ))}
            </div>

            <div className="mt-6 h-[180px] rounded-[24px] border border-[#E8EAEE] bg-white" />
            <div className="mt-6 h-[400px] rounded-[24px] border border-[#E8EAEE] bg-white" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#F7F8FA] text-[#101114]">
        <div className="mx-auto flex min-h-screen max-w-[700px] items-center justify-center px-5">
          <div className="w-full rounded-[24px] border border-[#E2E5E9] bg-white p-7 text-center shadow-[0_4px_18px_rgba(15,23,42,0.025)]">
            <h1 className="text-xl font-semibold tracking-[-0.035em]">
              We couldn&apos;t load your partner dashboard
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#737A84]">
              Please refresh the page and try again.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-full bg-[#2478FF] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#0052FF]"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!data?.enrolled) {
  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#101114]">
      <div className="mx-auto max-w-[900px] px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#747B85] transition-colors hover:text-[#101114]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>

        <section className="mt-10 overflow-hidden rounded-[30px] border border-[#CFE0FF] bg-[#EEF5FF]">
          <div className="relative p-7 sm:p-10 lg:p-14">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(36,120,255,.20),transparent_68%)]" />

            <div className="relative max-w-2xl">
              {applicationSubmitted ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#2478FF] shadow-sm">
                    <Check className="h-5 w-5" strokeWidth={2} />
                  </div>

                  <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#2478FF]">
                    <Clock3 className="h-3.5 w-3.5" />
                    Application under review
                  </div>

                  <h1 className="mt-6 text-[38px] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-[52px]">
                    Application received.
                  </h1>

                  <p className="mt-5 max-w-xl text-sm leading-6 text-[#617087] sm:text-[16px]">
                    Thanks for your interest in the Showwork Partner Program.
                    Your application has been received and is now being reviewed
                    by our team.
                  </p>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-[#617087] sm:text-[16px]">
                    We&apos;ll send you an email once a decision has been made.
                    You don&apos;t need to do anything else for now.
                  </p>

                  <div className="mt-8 rounded-[20px] border border-white bg-white/80 p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F6FF] text-[#2478FF]">
                        <Clock3 className="h-4 w-4" strokeWidth={1.8} />
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#969CA5]">
                          Status
                        </p>

                        <p className="mt-1.5 text-sm font-semibold text-[#101114]">
                          Application under review
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-[#737A84]">
                          Our team will review your application and contact you
                          by email with the outcome.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white px-5 py-3 text-xs font-bold text-[#2478FF] transition-colors hover:border-[#BFD4FF] hover:bg-[#F8FBFF]"
                  >
                    Back to dashboard
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#2478FF]">
                    <HandCoins className="h-3.5 w-3.5" />
                    Partner Program
                  </div>

                  <h1 className="mt-6 text-[42px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[58px]">
                    Grow with Showwork.
                  </h1>

                  <p className="mt-5 max-w-xl text-sm leading-6 text-[#617087] sm:text-[16px]">
                    Share Showwork with people in your network and earn
                    Your agreed commission on verified Delivery and Marketing Workspace subscription payments
                    made by customers who sign up through your referral link, for
                    the duration agreed during onboarding, starting with their first qualifying payment. Commissions are
                    based on the amount paid, including any annual discount.
                    Approved earnings can be withdrawn from ₦5,000.
                  </p>

                  <button
                    type="button"
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#2478FF] px-5 py-3 text-xs font-bold text-white shadow-[0_12px_30px_-15px_rgba(36,120,255,0.65)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#0052FF] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {enrolling ? "Submitting..." : "Become a partner"}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
  const referrals = data.referrals!;
  const commissions = data.commissions!;
  const history = data.commissionHistory ?? [];

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#101114]">
      {/* ------------------------------------------------------------------ */}
      {/*                              HEADER                                */}
      {/* ------------------------------------------------------------------ */}

      <header className="sticky top-0 z-50 border-b border-[#E8EAEE] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between sm:h-[70px]">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5"
              aria-label="Back to dashboard"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F1F6FF] text-[#2478FF]">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              </span>

              <span className="hidden text-[12px] font-semibold text-[#555B65] sm:block">
                Dashboard
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                  data.partner?.isActive
                    ? "border-[#CDEBD8] bg-[#F0FAF4] text-[#20864B]"
                    : "border-[#E4E6EA] bg-[#F6F7F8] text-[#858B94]"
                }`}
              >
                {data.partner?.isActive ? "Active partner" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/*                              CONTENT                               */}
      {/* ------------------------------------------------------------------ */}

      <div className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6 lg:px-8">
        <section className="pt-10 sm:pt-14 lg:pt-16">
          {(data.payout?.paymentUnderReview || !!data.payout?.recoveryDueNgn) && <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{data.payout.paymentUnderReview ? "A referred payment is being reviewed. Payouts are temporarily paused." : `A refunded commission of ₦${data.payout.recoveryDueNgn?.toLocaleString()} needs reconciliation. Contact your partner manager before requesting another payout.`}</p>}
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-slate-700"><strong>Your partner agreement</strong><p>{data.partner?.commissionPercent}% commission for {data.partner?.commissionMonths} months per referred customer.</p><p>{data.partner?.discountPercent ? `${data.partner.discountPercent}% customer discount for ${data.partner.discountMonths} months on eligible subscriptions.` : "No customer discount is included."}</p></div>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-[#F1F6FF] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#2478FF]">
                <HandCoins className="h-3.5 w-3.5" />
                Partner Program
              </div>

              <h1 className="mt-5 text-[42px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[58px]">
                Turn your network
                <br className="hidden sm:block" /> into something valuable.
              </h1>

              <p className="mt-4 max-w-xl text-[14px] leading-6 text-[#69717D] sm:text-[16px]">
                Share your referral link, bring new creators to Showwork and
                earn from their qualifying payments.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#7B828D]">
              <span className="h-2 w-2 rounded-full bg-[#2478FF]" />
              <span>
                {referrals.total}{" "}
                {referrals.total === 1 ? "referral" : "referrals"}
              </span>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*                         REFERRAL LINK                            */}
        {/* ---------------------------------------------------------------- */}

        <section className="mt-10 overflow-hidden rounded-[26px] border border-[#CFE0FF] bg-[#EEF5FF] shadow-[0_18px_55px_rgba(36,120,255,0.07)]">
          <div className="relative p-6 sm:p-8">
            <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(36,120,255,.20),transparent_68%)]" />

            <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#2478FF]">
                  Your referral link
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <div className="min-w-0 flex-1 rounded-2xl border border-white bg-white/80 px-4 py-3">
                    <p className="truncate text-[12px] font-semibold text-[#34435A]">
                      {referralUrl}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={copyReferralLink}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#2478FF] px-5 py-3 text-xs font-bold text-white shadow-[0_10px_25px_rgba(36,120,255,.18)] transition-transform hover:-translate-y-0.5"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy link
                      </>
                    )}
                  </button>
                </div>

                <p className="mt-3 text-[11px] text-[#71819A]">
                  Anyone who signs up through this link can be attributed to
                  your partner account.
                </p>
              </div>

              <div className="rounded-[20px] border border-white bg-white/75 px-5 py-4 lg:min-w-[190px]">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A98AC]">
                  Referral code
                </p>

                <p className="mt-1.5 text-xl font-semibold tracking-[0.06em] text-[#1B2B42]">
                  {data.partner?.referralCode}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*                            STATS                                  */}
        {/* ---------------------------------------------------------------- */}

        <section className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total earned"
              value={formatNgn(commissions.totalEarnedNgn)}
              detail="Earnings excluding voided commissions"
              icon={WalletCards}
            />

            <StatCard
              label="Pending"
              value={formatNgn(commissions.pendingNgn)}
              detail="Awaiting approval"
              icon={Clock3}
            />

            <StatCard
              label="Paid"
              value={formatNgn(commissions.paidNgn)}
              detail="Already paid to you"
              icon={Check}
            />

            <StatCard
              label="Active referrals"
              value={String(referrals.active)}
              detail={`${referrals.total} total referrals`}
              icon={UsersRound}
            />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
{/*                              PAYOUT                               */}
{/* ---------------------------------------------------------------- */}

<section className="mt-6">
  <div className="overflow-hidden rounded-[24px] border border-[#E2E5E9] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.025)]">
    <div className="border-b border-[#ECEEF1] px-6 py-6 sm:px-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#969CA5]">
            Partner earnings
          </p>

          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#101114]">
            Your payout
          </h2>

          <p className="mt-2 max-w-xl text-[12px] leading-5 text-[#737A84]">
            Withdraw your approved commissions once they reach the
            minimum payout amount.
          </p>
        </div>

        {data.payout?.activePayout && (
          <span className="inline-flex w-fit items-center rounded-full border border-[#D8E6FF] bg-[#F1F6FF] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#2478FF]">
            {data.payout.activePayout.status === "PENDING"
              ? "Payout pending"
              : "Payout approved"}
          </span>
        )}
      </div>
    </div>

    <div className="p-6 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-[20px] bg-[#F7F8FA] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#969CA5]">
            Available to withdraw
          </p>

          <p className="mt-3 text-[32px] font-semibold tracking-[-0.05em] text-[#101114]">
            {formatNgn(data.payout?.availableNgn ?? 0)}
          </p>

          <p className="mt-1 text-[11px] text-[#8A9099]">
            Minimum payout:{" "}
            {formatNgn(
              data.payout?.minimumPayoutNgn ?? 5000
            )}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-[20px] border border-[#E7E9ED] p-5 sm:min-w-[250px]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#969CA5]">
              Payout destination
            </p>

            {payoutAccount ? (
              <>
                <p className="mt-3 text-[12px] font-semibold text-[#25282D]">
                  {payoutAccount.bankName}
                </p>

                <p className="mt-1 text-[11px] text-[#737A84]">
                  ••••••{payoutAccount.accountNumber.slice(-4)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-[11px] leading-5 text-[#A54B4B]">
                Add a payout account below before requesting
                your earnings.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleRequestPayout}
            disabled={
              requestingPayout ||
              !data.payout?.canRequestPayout ||
              !payoutAccount ||
              !!data.payout?.activePayout
            }
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#2478FF] px-5 py-3 text-xs font-bold text-white shadow-[0_10px_25px_rgba(36,120,255,.18)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#0052FF] disabled:cursor-not-allowed disabled:bg-[#E8EAEE] disabled:text-[#9AA0A8] disabled:shadow-none disabled:hover:translate-y-0"
          >
            {requestingPayout
              ? "Requesting..."
              : data.payout?.activePayout
                ? "Payout already requested"
                : data.payout?.canRequestPayout
                  ? "Request payout"
                  : `Need ${formatNgn(
                      Math.max(
                        0,
                        (data.payout?.minimumPayoutNgn ?? 5000) -
                          (data.payout?.availableNgn ?? 0)
                      )
                    )} more`}
          </button>
        </div>
      </div>

      {payoutError && (
        <div className="mt-4 rounded-2xl border border-[#F0D4D4] bg-[#FFF7F7] px-4 py-3 text-[11px] leading-5 text-[#A54B4B]">
          {payoutError}
        </div>
      )}

      {payoutMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#CDEBD8] bg-[#F0FAF4] px-4 py-3 text-[11px] leading-5 text-[#20864B]">
          <Check className="h-3.5 w-3.5 shrink-0" />
          {payoutMessage}
        </div>
      )}

      {data.payout?.activePayout && (
        <div className="mt-5 rounded-[20px] border border-[#E7E9ED] bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#969CA5]">
                Current payout request
              </p>

              <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#101114]">
                {formatNgn(
                  data.payout.activePayout.amountNgn
                )}
              </p>

              <p className="mt-1 text-[10px] text-[#969CA5]">
                Requested{" "}
                {formatDate(
                  data.payout.activePayout.requestedAt
                )}
                {" · "}
                {data.payout.activePayout.commissionCount}{" "}
                {data.payout.activePayout.commissionCount === 1
                  ? "commission"
                  : "commissions"}
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
                data.payout.activePayout.status === "APPROVED"
                  ? "border-[#D8E6FF] bg-[#F1F6FF] text-[#2478FF]"
                  : "border-[#E9E1C8] bg-[#FBF8EE] text-[#8B722F]"
              }`}
            >
              {data.payout.activePayout.status === "APPROVED"
                ? "Approved"
                : "Pending review"}
            </span>
          </div>
        </div>
      )}

      {data.payout?.payoutHistory &&
        data.payout.payoutHistory.length > 0 && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#969CA5]">
                  History
                </p>

                <h3 className="mt-1 text-sm font-semibold tracking-[-0.02em] text-[#101114]">
                  Payout history
                </h3>
              </div>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-[#E7E9ED]">
              <div className="divide-y divide-[#ECEEF1]">
                {data.payout.payoutHistory.map(
                  (payout) => (
                    <div
                      key={payout.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                      <div>
                        <p className="text-[12px] font-semibold text-[#25282D]">
                          {formatNgn(payout.amountNgn)}
                        </p>

                        <p className="mt-1 text-[10px] text-[#969CA5]">
                          {formatDate(
                            payout.requestedAt
                          )}
                          {" · "}
                          {payout.commissionCount}{" "}
                          {payout.commissionCount === 1
                            ? "commission"
                            : "commissions"}
                        </p>

                        {payout.payoutReference && (
                          <p className="mt-1 text-[9px] text-[#A0A5AD]">
                            Ref: {payout.payoutReference}
                          </p>
                        )}

                        {payout.adminNote && (
                          <p className="mt-1 text-[9px] text-[#A0A5AD]">
                            {payout.adminNote}
                          </p>
                        )}
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${
                          payout.status === "PAID"
                            ? "border-[#CDEBD8] bg-[#F0FAF4] text-[#20864B]"
                            : payout.status === "APPROVED"
                              ? "border-[#D8E6FF] bg-[#F1F6FF] text-[#2478FF]"
                              : payout.status === "REJECTED"
                                ? "border-[#E8D9D9] bg-[#FAF3F3] text-[#A54B4B]"
                                : "border-[#E9E1C8] bg-[#FBF8EE] text-[#8B722F]"
                        }`}
                      >
                        {payout.status === "PENDING"
                          ? "Pending"
                          : payout.status === "APPROVED"
                            ? "Approved"
                            : payout.status === "PAID"
                              ? "Paid"
                              : "Rejected"}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

      <p className="mt-5 text-[10px] leading-5 text-[#969CA5]">
        Payouts are reviewed and processed to your saved Nigerian
        bank account. Approved commissions become available for
        withdrawal once they reach the minimum payout amount.
      </p>
    </div>
  </div>
</section>

                {/* ---------------------------------------------------------------- */}
        {/*                         PAYOUT ACCOUNT                            */}
        {/* ---------------------------------------------------------------- */}

        <section className="mt-6">
          <div className="overflow-hidden rounded-[24px] border border-[#E2E5E9] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.025)]">
            <div className="border-b border-[#ECEEF1] px-6 py-6 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#969CA5]">
                    Payout account
                  </p>

                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#101114]">
                    Where should we send your earnings?
                  </h2>

                  <p className="mt-2 max-w-xl text-[12px] leading-5 text-[#737A84]">
                    Add the Nigerian bank account you want to use when
                    withdrawing your approved partner commissions.
                  </p>
                </div>

                {payoutAccount && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#CDEBD8] bg-[#F0FAF4] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#20864B]">
                    <Check className="h-3 w-3" />
                    {payoutAccount.verifiedAt ? "Account verified" : "Verification required"}
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 sm:p-7">
              {payoutAccountLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="h-[58px] animate-pulse rounded-2xl bg-[#F3F4F6]" />
                  <div className="h-[58px] animate-pulse rounded-2xl bg-[#F3F4F6]" />
                  <div className="h-[58px] animate-pulse rounded-2xl bg-[#F3F4F6]" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9099]">
                        Bank name
                      </span>

                      <select value={bankCode} onChange={event => { setBankCode(event.target.value); setAccountName(""); }} className="w-full rounded-2xl border border-[#E1E4E8] bg-white px-4 py-3.5 text-sm"><option value="">Select your bank</option>{banks.map(bank => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select>
                      {banksError && <p role="alert" className="mt-2 text-xs text-red-600">{banksError}</p>}
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9099]">
                        Account number
                      </span>

                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={accountNumber}
                        onChange={(event) =>
                          setAccountNumber(
                            event.target.value.replace(/\D/g, "")
                          )
                        }
                        placeholder="10-digit account number"
                        className="w-full rounded-2xl border border-[#E1E4E8] bg-white px-4 py-3.5 text-[13px] font-medium tracking-[0.03em] text-[#101114] outline-none transition-colors placeholder:text-[#B0B4BA] focus:border-[#2478FF] focus:ring-4 focus:ring-[#2478FF]/10"
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#8A9099]">
                        Account name
                      </span>

                      <input
                        type="text"
                        value={accountName}
                        readOnly
                        placeholder="Resolved automatically when you verify and save"
                        className="w-full rounded-2xl border border-[#E1E4E8] bg-white px-4 py-3.5 text-[13px] font-medium text-[#101114] outline-none transition-colors placeholder:text-[#B0B4BA] focus:border-[#2478FF] focus:ring-4 focus:ring-[#2478FF]/10"
                      />
                    </label>
                  </div>

                  {payoutAccountError && (
                    <div className="mt-4 rounded-2xl border border-[#F0D4D4] bg-[#FFF7F7] px-4 py-3 text-[11px] leading-5 text-[#A54B4B]">
                      {payoutAccountError}
                    </div>
                  )}

                  {payoutAccountMessage && (
                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#CDEBD8] bg-[#F0FAF4] px-4 py-3 text-[11px] leading-5 text-[#20864B]">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      {payoutAccountMessage}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] leading-5 text-[#969CA5]">
                      Make sure the account belongs to you and that the
                      details are correct before requesting a payout.
                    </p>

                    <button
                      type="button"
                      onClick={handleSavePayoutAccount}
                      disabled={savingPayoutAccount || !bankCode || accountNumber.length !== 10}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#2478FF] px-5 py-3 text-xs font-bold text-white shadow-[0_10px_25px_rgba(36,120,255,.18)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#0052FF] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      {savingPayoutAccount
                        ? "Verifying…"
                        : payoutAccount
                          ? "Verify & update account"
                          : "Verify & save account"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*                         REFERRAL BREAKDOWN                        */}
        {/* ---------------------------------------------------------------- */}

        <section className="mt-6">
          <div className="rounded-[24px] border border-[#E2E5E9] bg-white p-6 shadow-[0_4px_18px_rgba(15,23,42,0.025)] sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#969CA5]">
                  Referral activity
                </p>

                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                  People you&apos;ve brought to Showwork
                </h2>
              </div>

              <span className="text-[11px] text-[#969CA5]">
                {referrals.total} total
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-[#F7F8FA] p-4">
                <p className="text-[10px] font-semibold text-[#8A9099]">
                  Pending
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {referrals.pending}
                </p>
              </div>

              <div className="rounded-2xl bg-[#F1F6FF] p-4">
                <p className="text-[10px] font-semibold text-[#2478FF]">
                  Active
                </p>
                <p className="mt-2 text-xl font-semibold text-[#2478FF]">
                  {referrals.active}
                </p>
              </div>

              <div className="rounded-2xl bg-[#F7F8FA] p-4">
                <p className="text-[10px] font-semibold text-[#8A9099]">
                  Expired
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {referrals.expired}
                </p>
              </div>

              <div className="rounded-2xl bg-[#F7F8FA] p-4">
                <p className="text-[10px] font-semibold text-[#8A9099]">
                  Disqualified
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {referrals.disqualified}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*                       COMMISSION HISTORY                          */}
        {/* ---------------------------------------------------------------- */}

        <section className="mt-6">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#969CA5]">
                Earnings
              </p>

              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                Commission history
              </h2>
            </div>

            <span className="hidden text-[11px] text-[#969CA5] sm:block">
              {commissions.totalCount}{" "}
              {commissions.totalCount === 1 ? "commission" : "commissions"}
            </span>
          </div>

          {history.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-[#E2E5E9] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.025)]">
              <div className="hidden grid-cols-[1fr_150px_130px_110px] gap-4 border-b border-[#ECEEF1] px-6 py-3.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#9AA0A8] sm:grid">
                <span>Payment</span>
                <span>Commission</span>
                <span>Date</span>
                <span>Status</span>
              </div>

              <div className="divide-y divide-[#ECEEF1]">
                {history.map((commission) => (
                  <div
                    key={commission.id}
                    className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_150px_130px_110px] sm:items-center sm:px-6"
                  >
                    <div>
                      <p className="text-[12px] font-semibold text-[#25282D]">
                        {formatNgn(commission.paymentAmountNgn)}
                      </p>

                      <p className="mt-1 text-[10px] text-[#969CA5]">
                        {commission.commissionPercent}% partner commission
                      </p>
                    </div>

                    <div>
                      <p className="text-[13px] font-semibold text-[#101114]">
                        {formatNgn(commission.commissionAmountNgn)}
                      </p>

                      <p className="mt-1 text-[9px] text-[#9AA0A8]">
                        Earned
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-[#555B65]">
                        {formatDate(commission.earnedAt)}
                      </p>
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${statusClasses(
                          commission.status
                        )}`}
                      >
                        {statusLabel(commission.status)}
                      </span>

                      {commission.payoutReference && (
                        <p className="mt-1 truncate text-[8px] text-[#A0A5AD]">
                          {commission.payoutReference}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*                           FOOTER NOTE                             */}
        {/* ---------------------------------------------------------------- */}

        <section className="mt-6">
          <div className="flex flex-col gap-3 rounded-[20px] border border-[#E2E5E9] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[10px] font-semibold text-[#555B65]">
                Partner commissions
              </p>

              <p className="mt-1 text-[10px] leading-5 text-[#969CA5]">
                Commissions are generated from qualifying payments made by
                your referred customers.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-[#2478FF] transition-colors hover:text-[#0052FF]"
            >
              Back to dashboard
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}