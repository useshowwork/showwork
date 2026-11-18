import Link from "next/link";
import { Download, ReceiptText } from "lucide-react";
import { db } from "@/lib/db";
import { billingPaymentDescription } from "@/lib/billingHistory";
import styles from "./BillingHistory.module.css";

const pageSize = 8;

export default async function BillingHistory({ creatorId, page, href }: {
  creatorId: string;
  page: number;
  href: string;
}) {
  const totals = { count: 0, page: 1 };
  const where = { creatorId, revenueStatus: { in: ["LIVE", "UNVERIFIED"] } };
  let records;
  try {
    totals.count = await db.paymentRecord.count({ where });
    totals.page = Math.min(page, Math.max(1, Math.ceil(totals.count / pageSize)));
    records = await db.paymentRecord.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (totals.page - 1) * pageSize,
      take: pageSize,
      select: { id: true, paystackReference: true, amountNgn: true, createdAt: true, type: true, tier: true, contentWorkspacePlan: true, revenueStatus: true },
    });
  } catch {
    return <section data-billing-card id="billing-history" className="rounded-[22px] border border-slate-200 bg-white p-5"><h2 className="text-lg font-medium">Billing history</h2><p role="alert" className="mt-2 text-sm text-slate-600">Billing history is temporarily unavailable.</p></section>;
  }

  return (
    <section data-billing-card id="billing-history" aria-labelledby="billing-history-heading" className="scroll-mt-6 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <h2 id="billing-history-heading" className="text-lg font-medium">Billing history</h2>
        {totals.count > 0 && <span className="rounded-full bg-[#edf4ff] px-2 py-1 text-xs text-[#155FC7]">{totals.count.toLocaleString("en-NG")} {totals.count === 1 ? "payment" : "payments"}</span>}
      </div>
      {records.length === 0 ? (
        <div className="grid justify-items-center gap-2 px-5 py-8 text-center">
          <ReceiptText size={22} className="text-[#155FC7]" aria-hidden="true" />
          <p className="text-sm font-medium">No payments yet</p>
          <p className="text-sm text-slate-600">Your payments and receipts will appear here.</p>
        </div>
      ) : <>
        <div className="mt-4 overflow-x-auto">
          <table className={`${styles.history} w-full text-left text-sm`}>
            <thead className="bg-[#f6f8fa] text-xs font-medium text-slate-600">
              <tr>{["Reference", "Date", "Description", "Amount", "Payment status", "Receipt"].map(label => <th key={label} className="px-4 py-3 font-medium" scope="col">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(record => (
                <tr key={record.id}>
                  <td data-label="Reference" className="max-w-44 break-all px-4 py-3 text-xs text-slate-600">{record.paystackReference ?? "—"}</td>
                  <td data-label="Date" className="whitespace-nowrap px-4 py-3">{record.createdAt.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium" })}</td>
                  <td data-label="Description" className="px-4 py-3">{billingPaymentDescription(record)}</td>
                  <td data-label="Amount" className="whitespace-nowrap px-4 py-3 tabular-nums">₦{record.amountNgn.toLocaleString("en-NG")}</td>
                  <td data-label="Payment status" className="px-4 py-3"><span className={record.revenueStatus === "LIVE" ? "rounded-full bg-[#eaf5dc] px-2 py-1 text-xs text-[#102A29]" : "rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"}>{record.revenueStatus === "LIVE" ? "Paid" : "Unverified"}</span></td>
                  <td data-label="Receipt" className="px-4 py-3">{record.revenueStatus === "LIVE" && record.paystackReference ?
                    <a href={`/api/billing/receipts/${encodeURIComponent(record.id)}`} className="inline-flex min-h-11 items-center gap-1.5 text-[#155FC7] hover:underline"><Download size={15} aria-hidden="true" /> Download</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totals.count > pageSize && <nav aria-label="Payment history pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-sm">
          <span>Page {totals.page} of {Math.ceil(totals.count / pageSize)}</span>
          <div className="flex gap-2">
            {totals.page > 1 && <Link href={`${href}&historyPage=${totals.page - 1}#billing-history`} className="inline-flex min-h-11 items-center px-2 text-[#155FC7]">Previous</Link>}
            {totals.page * pageSize < totals.count && <Link href={`${href}&historyPage=${totals.page + 1}#billing-history`} className="inline-flex min-h-11 items-center px-2 text-[#155FC7]">Next</Link>}
          </div>
        </nav>}
      </>}
    </section>
  );
}
