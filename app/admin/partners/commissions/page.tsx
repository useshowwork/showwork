"use client";

import UiSymbol from "@/components/ui/UiSymbol";
import { useEffect, useState } from "react";
import Link from "next/link";

type Commission = {
  id: string;
  paymentRecordId: string;
  paymentAmountNgn: number;
  commissionPercent: number;
  commissionAmountNgn: number; reversedAmountNgn: number; onHold: boolean; recoverySettledNgn: number;
  status: "PENDING" | "APPROVED" | "PAID" | "VOIDED";
  earnedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  payoutReference: string | null;
  referral: {
    id: string;
    status: string;
    partner: {
      id: string;
      referralCode: string;
      creator: {
        id: string;
        name: string | null;
        email: string;
      };
    };
    referredCreator: {
      id: string;
      name: string | null;
      email: string;
    };
  };
  payoutAllocation: {
    id: string;
    payoutId: string;
    amountNgn: number;
  } | null;
};

type ApiResponse =
  | {
      commissions: Commission[];
    }
  | {
      error: string;
    };

export default function AdminPartnerCommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadCommissions() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/partners/commissions",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || "error" in result) {
        throw new Error(
          "error" in result
            ? result.error
            : "Failed to load commissions."
        );
      }

      setCommissions(result.commissions);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load commissions."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCommissions();
  }, []);

  async function reviewCommission(
    commissionId: string,
    action: "APPROVE" | "VOID"
  ) {
    const message =
      action === "APPROVE"
        ? "Approve this commission?"
        : "Void this commission? This action cannot be undone.";

    if (!window.confirm(message)) {
      return;
    }

    try {
      setProcessingId(commissionId);
      setError("");

      const response = await fetch(
        "/api/admin/partners/commissions",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            commissionId,
            action,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Failed to update commission."
        );
      }

      await loadCommissions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update commission."
      );
    } finally {
      setProcessingId(null);
    }
  }

  const pendingCount = commissions.filter(
    (commission) => commission.status === "PENDING"
  ).length;

  const pendingAmount = commissions
    .filter((commission) => commission.status === "PENDING")
    .reduce(
      (total, commission) =>
        total + (commission.status === "VOIDED" ? 0 : Math.max(0, commission.commissionAmountNgn - commission.reversedAmountNgn)),
      0
    );

  const approvedCount = commissions.filter(
    (commission) => commission.status === "APPROVED"
  ).length;

  const approvedAmount = commissions
    .filter((commission) => commission.status === "APPROVED")
    .reduce(
      (total, commission) =>
        total + (commission.status === "VOIDED" ? 0 : Math.max(0, commission.commissionAmountNgn - commission.reversedAmountNgn)),
      0
    );

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-8 text-[#101828] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div>
          <Link
            href="/admin/partners"
            className="text-xs font-medium text-[#667085] transition hover:text-[#2478FF]"
          ><>{" "}<UiSymbol name="left" />{" Back to Partner Program "}</></Link>

          <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
            Partner Program
          </p>

          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                Commission Management
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Review commissions generated from qualifying partner
                referrals.
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-[18px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm text-[#B42318]">
            {error}
          </div>
        )}

        {/* Summary */}
        <section className="mt-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Commission records"
              value={loading ? "—" : formatNumber(commissions.length)}
              description="All statuses; amounts below reflect reversals"
            />

            <SummaryCard
              label="Pending Review"
              value={
                loading
                  ? "—"
                  : formatNumber(pendingCount)
              }
              description={
                loading
                  ? "Loading..."
                  : formatNgn(pendingAmount)
              }
            />

            <SummaryCard
              label="Approved"
              value={
                loading
                  ? "—"
                  : formatNumber(approvedCount)
              }
              description={
                loading
                  ? "Loading..."
                  : formatNgn(approvedAmount)
              }
            />

            <SummaryCard
              label="Already Allocated"
              value={
                loading
                  ? "—"
                  : formatNumber(
                      commissions.filter(
                        (commission) =>
                          commission.payoutAllocation !== null
                      ).length
                    )
              }
              description="Attached to a payout"
            />
          </div>
        </section>

        {/* Commissions */}
        <section className="mt-10">
          <div className="mb-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
              Review
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              Commission history
            </h2>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#E4E7EC] bg-white shadow-[0_5px_24px_rgba(16,24,40,0.025)]">
            {loading ? (
              <div className="px-5 py-14 text-center text-sm text-[#98A2B3]">
                Loading commissions...
              </div>
            ) : commissions.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <p className="text-sm font-semibold text-[#101828]">
                  No commissions yet
                </p>

                <p className="mt-1 text-xs leading-5 text-[#667085]">
                  Commissions will appear here when referred customers
                  make qualifying payments.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left">
                  <thead>
                    <tr className="border-b border-[#EAECF0] bg-[#FCFCFD]">
                      <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Partner
                      </th>

                      <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Referred Customer
                      </th>

                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Payment
                      </th>

                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Commission
                      </th>

                      <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Status
                      </th>

                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Earned
                      </th>

                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {commissions.map((commission) => (
                      <CommissionRow
                        key={commission.id}
                        commission={commission}
                        processing={
                          processingId === commission.id
                        }
                        onReview={reviewCommission}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#E4E7EC] bg-white p-5 shadow-[0_5px_24px_rgba(16,24,40,0.025)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
        {label}
      </p>

      <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#101828]">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-[#667085]">
        {description}
      </p>
    </div>
  );
}

function CommissionRow({
  commission,
  processing,
  onReview,
}: {
  commission: Commission;
  processing: boolean;
  onReview: (
    commissionId: string,
    action: "APPROVE" | "VOID"
  ) => void;
}) {
  const partnerName =
    commission.referral.partner.creator.name?.trim() ||
    commission.referral.partner.creator.email;

  const customerName =
    commission.referral.referredCreator.name?.trim() ||
    commission.referral.referredCreator.email;

  const allocated = commission.payoutAllocation !== null;

  return (
    <tr className="border-b border-[#F2F4F7] last:border-b-0">
      <td className="px-5 py-4">
        <div className="min-w-0">
          <p className="max-w-[180px] truncate text-sm font-semibold text-[#101828]">
            {partnerName}
          </p>

          <p className="mt-1 text-xs text-[#98A2B3]">
            {commission.referral.partner.referralCode}
          </p>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="min-w-0">
          <p className="max-w-[190px] truncate text-sm font-medium text-[#101828]">
            {customerName}
          </p>

          <p className="mt-1 max-w-[190px] truncate text-xs text-[#98A2B3]">
            {commission.referral.referredCreator.email}
          </p>
        </div>
      </td>

      <td className="px-5 py-4 text-right">
        <span className="text-sm font-medium text-[#101828]">
          {formatNgn(commission.paymentAmountNgn)}
        </span>
      </td>

      <td className="px-5 py-4 text-right">
        <p className="text-sm font-semibold text-[#101828]">
          {formatNgn(Math.max(0, commission.commissionAmountNgn - commission.reversedAmountNgn))}
          {commission.reversedAmountNgn > 0 && <p className="mt-1 text-xs text-amber-700">₦{commission.reversedAmountNgn.toLocaleString()} reversed{commission.status === "PAID" ? " · recovery tracked separately" : ""}</p>}
          {commission.onHold && <p className="mt-1 text-xs text-amber-700">Payment under review</p>}
        </p>

        <p className="mt-1 text-[10px] text-[#98A2B3]">
          {commission.commissionPercent}%
        </p>
      </td>

      <td className="px-5 py-4">
        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge status={commission.status} />

          {allocated && (
            <span className="text-[10px] font-medium text-[#667085]">
              Allocated to payout
            </span>
          )}
        </div>
      </td>

      <td className="px-5 py-4 text-right">
        <span className="whitespace-nowrap text-xs text-[#667085]">
          {formatDate(commission.earnedAt)}
        </span>
      </td>

      <td className="px-5 py-4 text-right">
        {commission.status === "PENDING" ? (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={processing}
              onClick={() =>
                onReview(commission.id, "APPROVE")
              }
              className="rounded-lg bg-[#101828] px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-[#1D2939] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? "..." : "Approve"}
            </button>

            <button
              type="button"
              disabled={processing}
              onClick={() =>
                onReview(commission.id, "VOID")
              }
              className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-[10px] font-semibold text-[#475467] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Void
            </button>
          </div>
        ) : (
          <span className="text-xs text-[#98A2B3]">
            —
          </span>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({
  status,
}: {
  status: Commission["status"];
}) {
  const styles: Record<
    Commission["status"],
    string
  > = {
    PENDING: "bg-[#FFF7ED] text-[#C2410C]",
    APPROVED: "bg-[#ECFDF3] text-[#027A48]",
    PAID: "bg-[#EFF6FF] text-[#175CD3]",
    VOIDED: "bg-[#F2F4F7] text-[#667085]",
  };

  const labels: Record<
    Commission["status"],
    string
  > = {
    PENDING: "Pending",
    APPROVED: "Approved",
    PAID: "Paid",
    VOIDED: "Voided",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG").format(value);
}

function formatNgn(value: number) {
  return `₦${new Intl.NumberFormat("en-NG").format(value)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}