"use client";
import ShowworkLogo from "@/components/brand/ShowworkLogo";

import UiSymbol from "@/components/ui/UiSymbol";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface AgencyPortfolio {
  id: string;
  companyName: string;
  slug: string;
  billingStatus: "PENDING_SETUP" | "ACTIVE" | "OFFLINE";
}

function statusLabel(
  portfolio: AgencyPortfolio
): {
  text: string;
  tone: "blue" | "amber" | "red";
} {
  if (portfolio.billingStatus === "PENDING_SETUP") {
    return {
      text: "Payment required",
      tone: "amber",
    };
  }

  if (portfolio.billingStatus === "OFFLINE") {
    return {
      text: "Offline · payment failed",
      tone: "red",
    };
  }

  return {
    text: "Live",
    tone: "blue",
  };
}

function StatusDot({
  tone,
}: {
  tone: "blue" | "amber" | "red";
}) {
  const styles = {
    blue: "bg-[#2478FF] shadow-[0_0_0_4px_rgba(36,120,255,0.10)]",
    amber: "bg-[#F5C842] shadow-[0_0_0_4px_rgba(245,200,66,0.12)]",
    red: "bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.10)]",
  };

  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${styles[tone]}`}
      aria-hidden="true"
    />
  );
}

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 9h10M9.5 4.5 14 9l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PortfolioMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="3"
          width="14"
          height="14"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M6.5 13.5 9 10.5l2 2 2.5-3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function AgencyPortfolioList({
  initialPortfolios,
}: {
  initialPortfolios: AgencyPortfolio[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clientName, setClientName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    const subscriptionPayment = searchParams.get("subscriptionPayment");
    const portfolioId = searchParams.get("portfolioId");

    if (
      subscriptionPayment === "callback" &&
      portfolioId &&
      !verifying
    ) {
      setVerifying(true);

      fetch(`/api/portfolio/${portfolioId}/verify-subscription`, {
        method: "POST",
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.ok) {
            setError(
              data.error ??
                "Couldn't confirm payment. Try again from your portfolio list."
            );
          }
        })
        .catch(() => {
          setError(
            "Couldn't confirm payment. Try again from your portfolio list."
          );
        })
        .finally(() => {
          setVerifying(false);
          router.replace("/dashboard/portfolio");
        });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleCreate = async () => {
    if (!clientName.trim()) {
      setError("Client name is required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/portfolio/create-for-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: clientName.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      setError(
        data.error ?? "Couldn't create this portfolio. Please try again."
      );
      setCreating(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setCreating(false);
    }
  };

  const completePayment = async (portfolioId: string) => {
    setCompletingId(portfolioId);
    setError(null);

    try {
      const res = await fetch(
        `/api/portfolio/${portfolioId}/retry-subscription`,
        {
          method: "POST",
        }
      );

      const data = await res.json();

      if (res.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      setError(
        data.error ?? "Couldn't start payment. Please try again."
      );
      setCompletingId(null);
    } catch {
      setError("Something went wrong. Please try again.");
      setCompletingId(null);
    }
  };

  if (verifying) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F6F7F9] px-6">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative rounded-3xl border border-slate-200 bg-white px-8 py-7 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#2478FF]">
            <svg
              className="h-5 w-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeWidth="2"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <p className="text-sm font-semibold text-slate-950">
            Confirming payment
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Just making sure everything is active.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F6F7F9] px-5 py-8 sm:px-8 lg:px-12">
      {/* Atmospheric background */}
      <div
        className="pointer-events-none absolute -right-40 -top-40 h-[620px] w-[620px] rounded-full bg-blue-400/10 blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -bottom-56 -left-48 h-[600px] w-[600px] rounded-full bg-[#F5C842]/[0.07] blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,1) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,1) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* Top navigation */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
          >
            <span className="transition-transform group-hover:-translate-x-0.5"><UiSymbol name="left" /></span>
            All apps
          </Link>

          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
            <ShowworkLogo width={85}/>
            <span>/</span>
            <span className="font-medium text-slate-700">
              Portfolio Studio
            </span>
          </div>
        </div>

        {/* Header */}
        <section className="mb-10">
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <PortfolioMark />

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2478FF]">
                    Agency workspace
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Portfolio Studio
                  </p>
                </div>
              </div>

              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">
                Your clients deserve a
                <span className="text-[#2478FF]"> great showcase.</span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
                Create and manage permanent portfolio destinations for the
                brands and creatives you represent.
              </p>
            </div>

            <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Client portfolios
              </p>

              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                {initialPortfolios.length}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold">
              !
            </div>
            <p>{error}</p>
          </div>
        )}

        {/* Portfolio list */}
        {initialPortfolios.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Your clients
                </p>

                <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">
                  Portfolio destinations
                </h2>
              </div>

              <span className="text-xs text-slate-400">
                {initialPortfolios.length}{" "}
                {initialPortfolios.length === 1
                  ? "portfolio"
                  : "portfolios"}
              </span>
            </div>

            <div className="grid gap-3">
              {initialPortfolios.map((portfolio) => {
                const status = statusLabel(portfolio);
                const isUsable =
                  portfolio.billingStatus === "ACTIVE";
                const needsPayment =
                  portfolio.billingStatus === "PENDING_SETUP";

                const card = (
                  <div
                    className={[
                      "group relative overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_8px_35px_rgba(15,23,42,0.05)] transition",
                      isUsable
                        ? "border-slate-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_50px_rgba(36,120,255,0.10)]"
                        : "border-slate-200",
                    ].join(" ")}
                  >
                    {isUsable && (
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[#2478FF] opacity-0 transition group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    )}

                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-700">
                          {portfolio.companyName
                            .trim()
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-slate-950">
                              {portfolio.companyName}
                            </h3>

                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                status.tone === "blue"
                                  ? "bg-blue-50 text-[#2478FF]"
                                  : status.tone === "amber"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                              }`}
                            >
                              <StatusDot tone={status.tone} />
                              {status.text}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-slate-400">
                            /portfolio/{portfolio.slug}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        {needsPayment ? (
                          <button
                            onClick={(event) => {
                              event.preventDefault();
                              completePayment(portfolio.id);
                            }}
                            disabled={
                              completingId === portfolio.id
                            }
                            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#2478FF] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {completingId === portfolio.id
                              ? "Starting payment…"
                              : "Complete payment"}
                          </button>
                        ) : isUsable ? (
                          <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition group-hover:border-blue-200 group-hover:text-[#2478FF]">
                            Open portfolio
                            <ArrowIcon />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );

                return isUsable ? (
                  <Link
                    key={portfolio.id}
                    href={`/dashboard/portfolio/${portfolio.id}`}
                  >
                    {card}
                  </Link>
                ) : (
                  <div key={portfolio.id}>{card}</div>
                );
              })}
            </div>
          </section>
        )}

        {/* Create */}
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-[0_30px_100px_rgba(15,23,42,0.14)]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#2478FF]/20 blur-3xl"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#F5C842]/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative grid gap-8 p-6 md:grid-cols-[0.9fr_1.1fr] md:p-8 lg:p-10">
            <div className="flex flex-col justify-between">
              <div>
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 3v14M3 10h14"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F5C842]">
                  New client portfolio
                </p>

                <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-[-0.04em] text-white">
                  Give another client their own home on the web.
                </h2>

                <p className="mt-3 max-w-md text-sm leading-6 text-white/50">
                  Create a dedicated portfolio, collect their payment, and
                  keep adding work to it whenever they have something new to
                  show.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["01", "Permanent link"],
                  ["02", "Unlimited updates"],
                  ["03", "Client-ready"],
                ].map(([number, label]) => (
                  <div
                    key={number}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <p className="text-[10px] font-bold text-white/30">
                      {number}
                    </p>
                    <p className="mt-2 text-xs font-medium text-white/75">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur md:p-6">
              <p className="text-sm font-semibold text-white">
                Create a portfolio for a client
              </p>

              <p className="mt-1 text-xs leading-5 text-white/45">
                ₦5,000/year, billed automatically to a saved card. No
                separate setup fee.
              </p>

              <div className="mt-6">
                <label
                  htmlFor="agency-client-name"
                  className="mb-2 block text-[10px] font-bold uppercase tracking-[0.13em] text-white/40"
                >
                  Client or brand name
                </label>

                <input
                  id="agency-client-name"
                  type="text"
                  value={clientName}
                  onChange={(event) =>
                    setClientName(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreate();
                    }
                  }}
                  placeholder="e.g. Aster Creative Studio"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#2478FF] focus:ring-4 focus:ring-blue-500/10"
                  style={{ fontSize: "16px" }}
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={creating}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-[#2478FF] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeOpacity="0.2"
                        strokeWidth="2"
                      />
                      <path
                        d="M21 12a9 9 0 0 0-9-9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    Starting secure payment…
                  </>
                ) : (
                  <>
                    Create & pay ₦5,000/year
                    <ArrowIcon />
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[10px] leading-4 text-white/30">
                You&apos;ll be taken to secure payment to activate the
                portfolio.
              </p>
            </div>
          </div>
        </section>

        <footer className="py-8 text-center">
          <p className="text-[11px] text-slate-400">
            Portfolio Studio · Showwork
          </p>
        </footer>
      </div>
    </main>
  );
}
