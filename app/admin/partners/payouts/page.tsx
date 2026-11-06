"use client";

import UiSymbol from "@/components/ui/UiSymbol";
import { useEffect, useState } from "react";
import Link from "next/link";

type PayoutStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "REJECTED";

type PayoutCommission = {
  id: string;
  commissionId: string;
  amountNgn: number;
  commission: {
    id: string;
    paymentRecordId: string;
    paymentAmountNgn: number;
    commissionAmountNgn: number;
    earnedAt: string;
  };
};

type Payout = {
  id: string;
  partnerId: string;
  amountNgn: number;
  status: PayoutStatus;
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  payoutReference: string | null;
  adminNote: string | null;
partner: {
  id: string;
  referralCode: string;
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
  payoutAccount: {
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
};
  payoutCommissions: PayoutCommission[];
};

type ApiResponse =
  | {
      payouts: Payout[];
    }
  | {
      error: string;
    };

export default function AdminPartnerPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(
    null
  );

  async function loadPayouts() {
    try {
      setLoading(true);
      setError("");

     const response = await fetch(
  "/api/admin/partners/payouts",
  {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  }
);

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || "error" in result) {
        throw new Error(
          "error" in result
            ? result.error
            : "Failed to load payouts."
        );
      }

      setPayouts(result.payouts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load payouts."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayouts();
  }, []);

  async function reviewPayout(
  payoutId: string,
  action: "APPROVE" | "REJECT" | "MARK_PAID"
) {
  if (action === "APPROVE") {
    if (!window.confirm("Approve this payout request?")) {
      return;
    }
  }

  if (action === "REJECT") {
    if (!window.confirm("Reject this payout request?")) {
      return;
    }
  }

  let adminNote = "";
  let payoutReference = "";

  if (action === "REJECT") {
    const note = window.prompt(
      "Optional reason for rejecting this payout:"
    );

    if (note !== null) {
      adminNote = note.trim();
    }
  }

  if (action === "MARK_PAID") {
    const reference = window.prompt(
      "Enter the payment or transfer reference:"
    );

    if (reference === null) {
      return;
    }

    payoutReference = reference.trim();

    if (!payoutReference) {
      setError("A payment reference is required.");
      return;
    }

    if (
      !window.confirm(
        `Mark this payout as paid using reference "${payoutReference}"?`
      )
    ) {
      return;
    }
  }

  try {
    setProcessingId(payoutId);
    setError("");

    const response = await fetch(
      "/api/admin/partners/payouts",
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payoutId,
          action,
          adminNote,
          payoutReference,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error ||
          "Failed to update payout."
      );
    }

    await loadPayouts();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to update payout."
    );
  } finally {
    setProcessingId(null);
  }
}
  const pendingPayouts = payouts.filter(
    (payout) => payout.status === "PENDING"
  );

  const approvedPayouts = payouts.filter(
    (payout) => payout.status === "APPROVED"
  );

  const paidPayouts = payouts.filter(
    (payout) => payout.status === "PAID"
  );

  const rejectedPayouts = payouts.filter(
    (payout) => payout.status === "REJECTED"
  );

  const pendingAmount = pendingPayouts.reduce(
    (total, payout) => total + payout.amountNgn,
    0
  );

  const approvedAmount = approvedPayouts.reduce(
    (total, payout) => total + payout.amountNgn,
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

          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Payout Management
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Review partner payout requests and manage settlement
            status.
          </p>
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
              label="Pending"
              value={
                loading
                  ? "—"
                  : formatNumber(pendingPayouts.length)
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
                  : formatNumber(approvedPayouts.length)
              }
              description={
                loading
                  ? "Loading..."
                  : formatNgn(approvedAmount)
              }
            />

            <SummaryCard
              label="Paid"
              value={
                loading
                  ? "—"
                  : formatNumber(paidPayouts.length)
              }
              description="Completed payouts"
            />

            <SummaryCard
              label="Rejected"
              value={
                loading
                  ? "—"
                  : formatNumber(rejectedPayouts.length)
              }
              description="Rejected requests"
            />
          </div>
        </section>

        {/* Payout requests */}
        <section className="mt-10">
          <div className="mb-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
              Requests
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              Payout requests
            </h2>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#E4E7EC] bg-white shadow-[0_5px_24px_rgba(16,24,40,0.025)]">
            {loading ? (
              <div className="px-5 py-14 text-center text-sm text-[#98A2B3]">
                Loading payout requests...
              </div>
            ) : payouts.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <p className="text-sm font-semibold text-[#101828]">
                  No payout requests yet
                </p>

                <p className="mt-1 text-xs leading-5 text-[#667085]">
                  Partner payout requests will appear here once
                  they are submitted.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px] text-left">
                  <thead>
                    <tr className="border-b border-[#EAECF0] bg-[#FCFCFD]">
                      <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Partner
                      </th>

                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Amount
                      </th>

                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Commissions
                      </th>

                      <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Status
                      </th>

                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Requested
                      </th>

                      <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {payouts.map((payout) => (
                      <PayoutRow
                        key={payout.id}
                        payout={payout}
                        processing={
                          processingId === payout.id
                        }
                        onReview={reviewPayout}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Processing note */}
        <section className="mt-8">
          <div className="rounded-[20px] border border-[#E4E7EC] bg-white p-5">
            <p className="text-xs font-semibold text-[#101828]">
              Payout processing
            </p>

            <p className="mt-2 max-w-3xl text-xs leading-5 text-[#667085]">
              Approving a payout confirms that the request has passed
              administrative review. Payment is recorded separately
              so the actual transfer reference can be captured when
              the partner is paid.
            </p>
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

function PayoutRow({
  payout,
  processing,
  onReview,
}: {
  payout: Payout;
  processing: boolean;
  onReview: (
  payoutId: string,
  action: "APPROVE" | "REJECT" | "MARK_PAID"
) => void;
}) {
  const partnerName =
    payout.partner.creator.name?.trim() ||
    payout.partner.creator.email;

  return (
    <tr className="border-b border-[#F2F4F7] last:border-b-0">
      <td className="px-5 py-4">
        <div className="min-w-0">
          <p className="max-w-[220px] truncate text-sm font-semibold text-[#101828]">
            {partnerName}
          </p>

          <p className="mt-1 text-xs text-[#98A2B3]">
            {payout.partner.referralCode}
          </p>

          <p className="mt-1 max-w-[220px] truncate text-xs text-[#98A2B3]">
            {payout.partner.creator.email}
          </p>
          {payout.partner.payoutAccount ? (
  <div className="mt-3 rounded-xl border border-[#E4E7EC] bg-[#F8FAFC] px-3 py-2.5">
    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#98A2B3]">
      Payout account
    </p>

    <p className="mt-1 text-xs font-semibold text-[#101828]">
      {payout.partner.payoutAccount.bankName}
    </p>

    <p className="mt-0.5 text-xs text-[#475467]">
      {payout.partner.payoutAccount.accountName}
    </p>

    <p className="mt-0.5 font-mono text-xs font-semibold tracking-[0.04em] text-[#101828]">
      {payout.partner.payoutAccount.accountNumber}
    </p>
  </div>
) : (
  <div className="mt-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5">
    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#B42318]">
      Payout account
    </p>

    <p className="mt-1 text-xs font-medium text-[#B42318]">
      Bank snapshot unavailable (legacy request)
    </p>
  </div>
)}
        </div>
      </td>

      <td className="px-5 py-4 text-right">
        <span className="text-sm font-semibold text-[#101828]">
          {formatNgn(payout.amountNgn)}
        </span>
      </td>

      <td className="px-5 py-4 text-right">
        <span className="text-sm font-medium text-[#101828]">
          {formatNumber(
            payout.payoutCommissions.length
          )}
        </span>
      </td>

      <td className="px-5 py-4">
        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge status={payout.status} />

          {payout.payoutReference && (
            <span className="max-w-[180px] truncate text-[10px] text-[#667085]">
              Ref: {payout.payoutReference}
            </span>
          )}
        </div>
      </td>

      <td className="px-5 py-4 text-right">
        <span className="whitespace-nowrap text-xs text-[#667085]">
          {formatDate(payout.requestedAt)}
        </span>
      </td>

      <td className="px-5 py-4 text-right">
        {payout.status === "PENDING" ? (
  <div className="flex justify-end gap-2">
    <button
      type="button"
      disabled={processing}
      onClick={() =>
        onReview(payout.id, "APPROVE")
      }
      className="rounded-lg bg-[#101828] px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-[#1D2939] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {processing ? "..." : "Approve"}
    </button>

    <button
      type="button"
      disabled={processing}
      onClick={() =>
        onReview(payout.id, "REJECT")
      }
      className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-[10px] font-semibold text-[#475467] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
    >
      Reject
    </button>
  </div>
) : payout.status === "APPROVED" ? (
  <div className="flex flex-wrap justify-end gap-2"><button disabled={processing} type="button" onClick={() => onReview(payout.id, "REJECT")} className="rounded-lg border px-3 py-2 text-xs">Cancel unpaid request</button>
  <button
    type="button"
    disabled={processing}
    onClick={() =>
      onReview(payout.id, "MARK_PAID")
    }
    className="rounded-lg bg-[#101828] px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-[#1D2939] disabled:cursor-not-allowed disabled:opacity-50"
  >
    {processing ? "..." : "Mark as paid"}
  </button></div>
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
  status: PayoutStatus;
}) {
  const styles: Record<PayoutStatus, string> = {
    PENDING: "bg-[#FFF7ED] text-[#C2410C]",
    APPROVED: "bg-[#ECFDF3] text-[#027A48]",
    PAID: "bg-[#EFF6FF] text-[#175CD3]",
    REJECTED: "bg-[#F2F4F7] text-[#667085]",
  };

  const labels: Record<PayoutStatus, string> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    PAID: "Paid",
    REJECTED: "Rejected",
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