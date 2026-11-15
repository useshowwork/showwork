"use client";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CalendarPaymentCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<
    "checking" | "done" | "failed" | null
  >(null);

  useEffect(() => {
    const isSubscriptionCallback =
      searchParams.get("subscriptionPayment") === "callback";

    if (!isSubscriptionCallback) {
      return;
    }

    setStatus("checking");

    calendarMutationFetch("/api/calendars/verify-subscription", {
      method: "POST",
    })
      .then((res) =>
        res.json().then((data) => ({
          ok: res.ok,
          data,
        }))
      )
      .then(({ ok }) => {
        setStatus(ok ? "done" : "failed");

        if (ok) {
          router.refresh();
        }
      })
      .catch(() => {
        setStatus("failed");
      });

    // The callback should only be processed once when the component mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!status) {
    return null;
  }

  return (
    <div
      className="mb-6 rounded-xl p-4 text-sm"
      style={{
        background:
          status === "failed"
            ? "rgba(239,68,68,0.1)"
            : "rgba(74,222,128,0.1)",
        color:
          status === "failed"
            ? "#F87171"
            : "#4ade80",
      }}
    >
      {status === "checking" &&
        "Confirming your payment..."}

      {status === "done" &&
        "Payment confirmed — your subscription is now active."}

      {status === "failed" &&
        "We couldn't confirm this payment yet. If it went through, refresh this page in a moment."}
    </div>
  );
}