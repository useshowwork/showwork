"use client";
import { readProductJourney } from "@/lib/productJourney";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import authStyles from "@/components/auth/AuthSplitLayout.module.css";

import { useState, Suspense, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
} from "lucide-react";

type Step = "details" | "verify";

const inputClass =
  "block w-full rounded-2xl border border-[#DFE8E0] bg-[#FAFCF9] px-4 py-3.5 text-[16px] text-[#102A29] outline-none transition placeholder:text-[#A0ADA3] hover:border-[#BACDBE] focus:border-[#155FC7] focus:bg-white focus:ring-4 focus:ring-[#155FC7]/[0.08] disabled:opacity-50";

function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-[12px] font-semibold text-[#30483C]">
          {label}
          {optional && (
            <span className="ml-1 font-normal text-[#8A9A90]">(optional)</span>
          )}
        </label>
        {hint && <span className="text-[11px] text-[#8A9A90]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const journey = readProductJourney(searchParams);
  const next = journey.destination;
  const productLabel =
    journey.product === "engage"
      ? "Showwork Engage"
      : journey.product === "workspace"
        ? "Marketing Workspace"
        : journey.product === "delivery"
          ? "Project Delivery"
          : journey.product === "portfolio"
            ? "Portfolio"
            : null;
  const referralCode = searchParams.get("ref");

  const [step, setStep] = useState<Step>("details");
  const accountType =
    journey.product === "workspace" ? "SOCIAL_MEDIA_MANAGER" : "CREATOR";
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const signupPayload = () => ({
    email: email.trim(),
    password,
    name: name.trim(),
    phone: phone.trim(),
    companyName: companyName.trim(),
    accountType,
    referralCode,
  });

  async function readError(res: Response, fallback: string) {
    try {
      const data = await res.json();
      return typeof data?.error === "string" ? data.error : fallback;
    } catch {
      return fallback;
    }
  }

  const handleSendCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupPayload()),
      });
      if (res.ok) {
        setStep("verify");
      } else {
        setError(
          await readError(res, "Something went wrong. Please try again."),
        );
      }
    } catch {
      setError(
        "We couldn't connect to Showwork. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      if (res.ok) {
        router.push(next || "/welcome");
        return;
      }
      setError(await readError(res, "Invalid code"));
    } catch {
      setError("We couldn't verify your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading || resendStatus === "Sending...") return;
    setResendStatus("Sending...");
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupPayload()),
      });
      setResendStatus(res.ok ? "New code sent" : "Couldn't resend");
    } catch {
      setResendStatus("Couldn't resend");
    }
  };

  return (
    <AuthSplitLayout>
      <AnimatePresence mode="wait" initial={false}>
        {step === "details" ? (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22 }}
          >
            <h1>Create your account</h1>
            {productLabel && (
              <p className={authStyles.context}>Continue to {productLabel}</p>
            )}

            <form
              onSubmit={handleSendCode}
              className="mt-6 space-y-4 sm:mt-8 sm:space-y-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name">
                  <input
                    className={inputClass}
                    type="text"
                    placeholder="Ada Obi"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Company name" optional>
                  <input
                    className={inputClass}
                    type="text"
                    placeholder="Ada Obi Studios"
                    autoComplete="organization"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Email">
                <input
                  className={inputClass}
                  type="email"
                  placeholder="you@studio.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Phone number" hint="+234 followed by 10 digits">
                <input
                  className={inputClass}
                  type="tel"
                  placeholder="+2348012345678"
                  required
                  pattern="^\+234[0-9]{10}$"
                  title="Enter a Nigerian number in the format +2348012345678"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label="Password" hint="Minimum 8 characters">
                <div className="relative">
                  <input
                    className={`${inputClass} pr-12`}
                    type={passwordVisible ? "text" : "password"}
                    placeholder="Create a secure password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    onClick={() => setPasswordVisible((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#819187] transition hover:text-[#155FC7] focus-visible:outline-2 focus-visible:outline-[#155FC7]"
                  >
                    {passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </Field>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                >
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#155FC7] px-6 py-4 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(21,95,199,0.18)] transition hover:-translate-y-0.5 hover:bg-[#104CA1] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155FC7]"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending code...
                  </>
                ) : (
                  <>
                    Continue{" "}
                    <ArrowRight
                      size={18}
                      className="transition group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22 }}
          >
            <h1>Check your email</h1>
            <p className="mt-3 text-sm leading-7 text-[#738278]">
              We sent a 6-digit verification code to{" "}
              <strong className="break-all font-semibold text-[#102A29]">
                {email}
              </strong>
              .
            </p>
            <form
              onSubmit={handleVerify}
              className="mt-6 space-y-4 sm:mt-8 sm:space-y-5"
            >
              <Field label="Verification code">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  className={`${inputClass} py-5 text-center text-[28px] font-semibold tracking-[0.32em]`}
                />
              </Field>
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                >
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#155FC7] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#104CA1] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155FC7]"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify and create account <ArrowRight size={18} />
                  </>
                )}
              </button>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5EDE6] pt-5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("details");
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#66796C] hover:text-[#155FC7]"
                >
                  <ArrowLeft size={14} /> Change details
                </button>
                <button
                  type="button"
                  disabled={resendStatus === "Sending..."}
                  onClick={handleResend}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#155FC7] disabled:opacity-50"
                >
                  <RotateCcw size={14} /> {resendStatus ?? "Resend code"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      <p className={authStyles.switch}>
        Already have an account?
        <Link
          href={`/login?${new URLSearchParams({ ...(next ? { next } : {}), ...(referralCode ? { ref: referralCode } : {}) })}`}
        >
          Log in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F8FAF5]" />}>
      <SignupForm />
    </Suspense>
  );
}
