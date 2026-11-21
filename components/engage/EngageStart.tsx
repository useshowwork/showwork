"use client";

import styles from "./EngagePlan.module.css";
import SubscriptionCheckoutButton from "@/components/billing/SubscriptionCheckoutButton";
import { useState } from "react";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

export default function EngageStart({
  active,
  canStartTrial = false,
  existingSubscription,
  billingCycle = "MONTHLY",
}: {
  billingCycle?: "MONTHLY" | "ANNUAL";
  active: boolean;
  canStartTrial?: boolean;
  existingSubscription: boolean;
}) {
  const [cycle, setCycle] = useState<"MONTHLY" | "ANNUAL">(billingCycle);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await calendarMutationFetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: name.trim(), plan: "ENGAGE" }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Please try again.");
      const destination = result.calendarId
        ? `/dashboard/calendars/${result.calendarId}?view=inbox`
        : null;
      if (!destination)
        throw Error("Could not open your business. Please try again.");
      window.location.assign(destination);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
      setBusy(false);
    }
  }
  if (existingSubscription)
    return (
      <p className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        Your Marketing Workspace subscription already includes conversations.
      </p>
    );
  return (
    <div className={styles.start}>
      {active || canStartTrial ? (
        <label className={styles.formLabel}>
          Business name
          <input
            autoComplete="organization"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your business"
            className={styles.nameInput}
          />
        </label>
      ) : (
        <>
          <div className={styles.cycleToggle} aria-label="Billing cycle">
            {(["MONTHLY", "ANNUAL"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={cycle === value}
                onClick={() => setCycle(value)}
              >
                {value === "MONTHLY" ? "Monthly" : "Yearly · 2 months free"}
              </button>
            ))}
          </div>
          <p className={styles.price}>
            {cycle === "MONTHLY" ? "₦14,900" : "₦149,000"}
            <span className={styles.pricePeriod}>
              /{cycle === "MONTHLY" ? "month" : "year"}
            </span>
          </p>
        </>
      )}
      {active || canStartTrial ? (
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={start}
          className={`${styles.primary} ${styles.checkout}`}
        >
          {busy
            ? "Please wait…"
            : canStartTrial
              ? "Start my 3-day free trial →"
              : "Create business →"}
        </button>
      ) : (
        <div className={styles.checkout}>
          <SubscriptionCheckoutButton
            product="CONTENT_WORKSPACE"
            plan="ENGAGE"
            cycle={cycle}
            label="Subscribe to Engage →"
            className={styles.primary}
          />
        </div>
      )}
      {canStartTrial && (
        <p className={styles.note}>
          No card required. Your trial starts when you create your business.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
