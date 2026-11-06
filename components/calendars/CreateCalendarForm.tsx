"use client";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Plus, ShieldCheck, X } from "lucide-react";
import {
  CONTENT_WORKSPACE_PLANS as PLAN_CONFIG,
  CONTENT_WORKSPACE_PLAN_ORDER,
  formatWorkspaceLimit,
} from "@/lib/contentWorkspaceEntitlements";

type ContentWorkspacePlan = "CREATOR" | "GROWTH" | "STUDIO" | "UNLIMITED";
type Step = "closed" | "choose-plan" | "form";

export default function CreateCalendarForm({
  contentWorkspacePlan,
}: {
  contentWorkspacePlan: ContentWorkspacePlan | null;
}) {
  const [step, setStep] = useState<Step>("closed");
  const [chosenPlan, setChosenPlan] = useState(contentWorkspacePlan);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingBlocked, setBillingBlocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasExistingPlan = Boolean(contentWorkspacePlan);
  const emit = (name: string, detail?: Record<string, unknown>) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));
  const close = () => {
    if (loading) return;
    setStep("closed");
    setError(null);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  useEffect(() => {
    if (step === "form") inputRef.current?.focus();
  }, [step]);

  const submit = async () => {
    if (loading) return;
    if (!clientName.trim()) {
      setError("Enter the client’s name.");
      inputRef.current?.focus();
      return;
    }
    if (!chosenPlan) {
      setError("Choose a Marketing Workspace plan.");
      return;
    }
    setLoading(true);
    setError(null);
    setBillingBlocked(false);
    try {
      const res = await calendarMutationFetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          plan: chosenPlan,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        emit("showwork:workspace-created");
        window.location.href =
          data.authorizationUrl ?? `/dashboard/calendars/${data.calendarId}`;
      } else {
        setBillingBlocked(res.status === 402 || (res.status === 403 && /subscription|allowance|limit|upgrade|trial/i.test(data.error || "")));
        setError(
          data.error ?? "Couldn’t create the workspace. Please try again.",
        );
        setLoading(false);
      }
    } catch {
      setError("Couldn’t connect. Please try again.");
      setLoading(false);
    }
  };

  if (step === "closed")
    return (
      <button
        ref={triggerRef}
        type="button"
        data-onboarding="create-trigger"
        aria-expanded="false"
        onClick={() => {
          const stage = hasExistingPlan ? "form" : "choose-plan";
          setStep(stage);
          window.dispatchEvent(
            new Event("showwork:workspace-dashboard-tour-dismiss"),
          );
          emit("showwork:workspace-form-opened", { stage });
        }}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1768E8] px-4 py-3 text-sm font-semibold text-white hover:bg-[#125CCF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1768E8] sm:w-auto"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Create workspace
      </button>
    );

  return (
    <section
      aria-label="New marketing workspace"
      className="rounded-2xl border border-[#E4E7EC] bg-white p-4 sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#101828]">
            {step === "choose-plan" ? "Choose a plan" : "Add your client"}
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            {step === "choose-plan"
              ? "Pick the space and tools you need. Start with 7 days of full Agency feature access."
              : "Enter a client name to create their workspace."}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          disabled={loading}
          aria-label="Cancel workspace setup"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#667085] hover:bg-slate-50 disabled:opacity-50"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      {step === "choose-plan" ? (
        <div data-onboarding="plan" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CONTENT_WORKSPACE_PLAN_ORDER.map((value) => {
            const plan = PLAN_CONFIG[value];
            const benefits = [
              `${formatWorkspaceLimit(plan.activeWorkspaces)} active workspaces`,
              `${formatWorkspaceLimit(plan.collaborators)} collaborators`,
              `${plan.storageBytes / 1_000_000_000} GB storage`,
              `${plan.aiGenerations.toLocaleString("en-NG")} AI generations/month`,
            ];
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setChosenPlan(value);
                  setStep("form");
                  emit("showwork:workspace-plan-selected");
                }}
                className="rounded-xl border border-[#D0D5DD] p-4 text-left transition hover:border-[#1768E8] hover:bg-blue-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1768E8]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-[#101828]">{plan.name}</h3>
                  <p className="text-sm font-semibold text-[#1768E8]">
                    ₦{plan.priceNgnMonthly.toLocaleString("en-NG")}
                    <span className="font-normal text-[#667085]">/mo</span>
                  </p>
                </div>
                <ul className="my-3 space-y-1.5">
                  {benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-center gap-2 text-xs leading-5 text-[#667085]"
                    >
                      <Check
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-[#1768E8]"
                      />
                      {benefit}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#1768E8]">
                  Choose {plan.name}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="max-w-xl"
        >
          <label
            htmlFor="new-workspace-client"
            className="mb-2 block text-sm font-medium text-[#344054]"
          >
            Client name
          </label>
          <input
            ref={inputRef}
            id="new-workspace-client"
            data-onboarding="client-name"
            value={clientName}
            onChange={(event) => {
              setClientName(event.target.value);
              setError(null);
              emit("showwork:client-name-changed", {
                hasValue: Boolean(event.target.value.trim()),
              });
            }}
            disabled={loading}
            type="text"
            autoComplete="organization"
            placeholder="e.g. MTN"
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? "new-workspace-error" : "workspace-access-note"
            }
            className="min-h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-3 text-base text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-[#1768E8] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
          />
          <p
            id="workspace-access-note"
            className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#667085]"
          >
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            A secure client password is created automatically.
          </p>
          <p className="mt-2 text-xs text-[#667085]">
            {hasExistingPlan
              ? `${PLAN_CONFIG[contentWorkspacePlan!].name} plan · covered by your existing subscription`
              : `${PLAN_CONFIG[chosenPlan!].name} plan · your 7-day Agency trial starts when you create this workspace`}
          </p>
          {error && (
            <p
              id="new-workspace-error"
              role="alert"
              className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {billingBlocked && <WorkspaceFeatureNotice compact message="Your subscription or workspace allowance does not cover another workspace. Upgrade to add more; your existing work is preserved." />}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              data-onboarding="submit"
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1768E8] px-4 text-sm font-semibold text-white hover:bg-[#125CCF] disabled:opacity-60"
            >
              {loading ? "Creating workspace…" : "Create workspace"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
            {!hasExistingPlan && (
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep("choose-plan")}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-[#475467] hover:bg-slate-50"
              >
                Change plan
              </button>
            )}
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-[#475467] hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
