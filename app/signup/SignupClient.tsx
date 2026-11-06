"use client";
import { readProductJourney } from "@/lib/productJourney";
import ShowworkLogo from "@/components/brand/ShowworkLogo";

import { useState, Suspense, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Check, CheckCircle2, Eye, EyeOff,
  Layers3, UsersRound, UserRound, Mail, LockKeyhole,
  ShieldCheck, Sparkles, ArrowUpRight, Loader2, RotateCcw,
} from "lucide-react";

type AccountType = "CREATOR" | "AGENCY" | "SOCIAL_MEDIA_MANAGER";
type Step = "details" | "verify";

const OPTIONS = [
  {
    type: "CREATOR" as const,
    title: "Creator",
    description: "Build your own creative presence.",
    detail: "One free portfolio for your own work.",
    Icon: UserRound,
    tag: "Free",
  },
  {
    type: "AGENCY" as const,
    title: "Agency",
    description: "Present and manage work for clients.",
    detail: "Branded portfolios for multiple clients, billed per portfolio.",
    Icon: Layers3,
    tag: null,
  },
  {
    type: "SOCIAL_MEDIA_MANAGER" as const,
    title: "Social media manager",
    description: "Manage client content, leads and performance.",
    detail: "Marketing Workspace plans start at ₦4,900/month for up to 5 active marketing workspaces.",
    Icon: UsersRound,
    tag: null,
  },
];

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
          {label}{optional && <span className="ml-1 font-normal text-[#8A9A90]">(optional)</span>}
        </label>
        {hint && <span className="text-[11px] text-[#8A9A90]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" aria-label="Showwork home" className="inline-flex items-center rounded-md text-[25px] font-extrabold tracking-[-0.075em] text-[#102A29] outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#155FC7]">
      <ShowworkLogo width={117}/>
    </Link>
  );
}

function StepProgress({ step }: { step: Step }) {
  return (
    <div className="mb-6 flex items-center gap-2 sm:mb-8 sm:gap-3" aria-label={`Step ${step === "details" ? 1 : 2} of 2`}>
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#155FC7] text-xs font-bold text-white">
          {step === "verify" ? <Check size={16} strokeWidth={3} /> : "1"}
        </span>
        <span className="text-[11px] font-semibold text-[#30483C] sm:text-xs">Your details</span>
      </div>
      <span className={`h-px flex-1 ${step === "verify" ? "bg-[#155FC7]" : "bg-[#DDE8DE]"}`} />
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step === "verify" ? "bg-[#155FC7] text-white" : "border border-[#DDE8DE] bg-[#F7FAF6] text-[#93A299]"}`}>
          2
        </span>
        <span className={`text-[11px] font-semibold sm:text-xs ${step === "verify" ? "text-[#30483C]" : "text-[#93A299]"}`}>
          Verify email
        </span>
      </div>
    </div>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const journey = readProductJourney(searchParams);
  const next = journey.destination;
  const productLabel = journey.product === "workspace" ? "Marketing Workspace" : journey.product === "delivery" ? "Project Delivery" : journey.product === "portfolio" ? "Portfolio" : null;
  const referralCode = searchParams.get("ref");

  const [step, setStep] = useState<Step>("details");
  const [accountType, setAccountType] = useState<AccountType>(() => journey.product === "workspace" ? "SOCIAL_MEDIA_MANAGER" : "CREATOR");
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

  const selectedOption = OPTIONS.find((option) => option.type === accountType)!;

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
        setError(await readError(res, "Something went wrong. Please try again."));
      }
    } catch {
      setError("We couldn't connect to Showwork. Check your connection and try again.");
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
    <main className="relative min-h-screen overflow-hidden bg-[#F8FAF5] text-[#102A29] [font-family:var(--font-jakarta,'Plus_Jakarta_Sans',Arial,sans-serif)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-48 h-[620px] w-[620px] rounded-full bg-[#E2EDFF]/65 blur-[110px]" />
        <div className="absolute -bottom-60 -left-40 h-[560px] w-[560px] rounded-full bg-[#D8F3A5]/35 blur-[110px]" />
      </div>

      <header className="relative z-20 border-b border-[#102A29]/[0.07] bg-[#F8FAF5]/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-[1320px] items-center justify-between gap-3 px-4 py-3 sm:min-h-[82px] sm:px-8 lg:px-14">
          <Brand />
          <p className="text-right text-[11px] leading-5 text-[#697B70] sm:text-sm">
            Already have an account?{" "}
            <Link href={`/login?${new URLSearchParams({ ...(next ? { next } : {}), ...(referralCode ? { ref: referralCode } : {}) })}`} className="font-bold text-[#155FC7] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#155FC7]">
              Log in <ArrowUpRight size={14} className="inline" />
            </Link>
          </p>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1320px] items-start gap-8 px-4 pb-14 pt-5 sm:gap-12 sm:px-8 sm:pb-20 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-14 lg:px-14 lg:pt-20 xl:gap-24">
        <section className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-20">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-[#D4E7D9] bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#256B47] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#16834B]" />
              Creative work, organised
            </span>
            <h1 className="mt-8 max-w-[650px] text-[clamp(3.1rem,5.2vw,5.5rem)] font-semibold leading-[1.04] tracking-[-0.07em]">
              Build the work.<br />
              <span className="text-[#155FC7]">Show it better.</span>
            </h1>
            <p className="mt-7 max-w-[530px] text-base leading-8 text-[#64766B] sm:text-lg">
              Build a portfolio, deliver projects and manage client accounts. Keep content, approvals, conversations, leads and performance together with Showwork.
            </p>
          </motion.div>

          <div className="mt-11 grid gap-3 sm:grid-cols-3">
            {[
              { number: "01", title: "Present", description: "A portfolio clients remember.", icon: Sparkles },
              { number: "02", title: "Deliver", description: "Projects without the chaos.", icon: CheckCircle2 },
              { number: "03", title: "Manage", description: "Content, leads and results.", icon: Layers3 },
            ].map(({ number, title, description, icon: Icon }, index) => (
              <motion.div key={number} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + index * 0.08, duration: 0.55 }} className="rounded-[23px] border border-[#E1EAE3] bg-white/75 p-5 shadow-[0_10px_30px_rgba(16,42,41,0.035)]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#155FC7]">{number}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#155FC7]"><Icon size={18} /></span>
                </div>
                <p className="mt-8 text-base font-semibold tracking-[-0.025em]">{title}</p>
                <p className="mt-2 text-xs leading-5 text-[#738278]">{description}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 text-xs font-medium text-[#738578]">
            <span className="h-px w-8 bg-[#B6CCB9]" />
            Start free. Build from there.
          </div>
          <div className="relative mt-12 hidden overflow-hidden rounded-[30px] border border-[#DDE7DF] bg-[#E8F3EC] p-8 lg:block">
            <div aria-hidden="true" className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#D8F3A5] blur-2xl" />
            <div className="relative flex items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#16834B]">One place for better work</p>
                <p className="mt-3 max-w-[330px] text-xl font-semibold leading-7 tracking-[-0.04em]">Your clients, your content, one system.</p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#102A29] text-[#D8F3A5]"><Layers3 size={26} /></div>
            </div>
          </div>
        </section>

        <section className="order-1 min-w-0 w-full lg:order-2" aria-label="Create your Showwork account">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.12 }} className="rounded-[22px] border border-[#DFE8E0] bg-white p-4 shadow-[0_25px_85px_rgba(16,42,41,0.07)] sm:rounded-[30px] sm:p-9 lg:p-10">
            <StepProgress step={step} />
            <AnimatePresence mode="wait" initial={false}>
              {step === "details" ? (
                <motion.div key="details" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#16834B]">Get started</p>
                  <h2 className="mt-3 text-[27px] font-semibold leading-tight tracking-[-0.05em] sm:text-[34px]">Create your account.</h2>
                  <p className="mt-2 text-sm leading-6 text-[#738278]">{productLabel ? `Continue to ${productLabel} after verifying your email.` : "Choose where to start after creating your account."}</p>

                  <form onSubmit={handleSendCode} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                    {journey.product !== "workspace" && journey.product !== "delivery" && <fieldset>
                      <legend className="mb-3 text-xs font-semibold text-[#30483C]">What best describes you?</legend>
                      <div className="grid gap-2.5">
                        {OPTIONS.map((option) => {
                          const active = accountType === option.type;
                          const Icon = option.Icon;
                          return (
                            <button key={option.type} type="button" aria-pressed={active} onClick={() => setAccountType(option.type)} className={`group flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155FC7] ${active ? "border-[#155FC7] bg-[#EEF5FF] shadow-[0_0_0_3px_rgba(21,95,199,0.06)]" : "border-[#E1EAE3] bg-[#FAFCF9] hover:border-[#B9CFC1] hover:bg-white"}`}>
                              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-[#155FC7] text-white" : "bg-[#E8F0E8] text-[#527364]"}`}><Icon size={20} /></span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#102A29]">
                                  {option.title}
                                  {option.tag && <span className="rounded-full bg-[#D8F3A5] px-2 py-0.5 text-[9px] font-bold uppercase text-[#31533B]">{option.tag}</span>}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-[#75867B]">{option.description}</span>
                              </span>
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-[#155FC7] bg-[#155FC7] text-white" : "border-[#C9D7CC]"}`}>{active && <Check size={13} strokeWidth={3} />}</span>
                            </button>
                          );
                        })}
                      </div>
                      <motion.p key={accountType} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-[#F3F8F1] px-4 py-3 text-xs leading-5 text-[#58715E]">
                        {selectedOption.detail}
                      </motion.p>
                    </fieldset>}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Your name"><input className={inputClass} type="text" placeholder="Ada Obi" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                      <Field label="Company name" optional><input className={inputClass} type="text" placeholder="Ada Obi Studios" autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></Field>
                    </div>
                    <Field label="Email"><input className={inputClass} type="email" placeholder="you@studio.com" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                    <Field label="Phone number" hint="+234 followed by 10 digits"><input className={inputClass} type="tel" placeholder="+2348012345678" required pattern="^\+234[0-9]{10}$" title="Enter a Nigerian number in the format +2348012345678" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
                    <Field label="Password" hint="Minimum 8 characters">
                      <div className="relative">
                        <input className={`${inputClass} pr-12`} type={passwordVisible ? "text" : "password"} placeholder="Create a secure password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <button type="button" aria-label={passwordVisible ? "Hide password" : "Show password"} onClick={() => setPasswordVisible((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#819187] transition hover:text-[#155FC7] focus-visible:outline-2 focus-visible:outline-[#155FC7]">{passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                      </div>
                    </Field>

                    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}
                    <button type="submit" disabled={loading} className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#155FC7] px-6 py-4 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(21,95,199,0.18)] transition hover:-translate-y-0.5 hover:bg-[#104CA1] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155FC7]">
                      {loading ? <><Loader2 size={18} className="animate-spin" />Sending code...</> : <>Continue <ArrowRight size={18} className="transition group-hover:translate-x-1" /></>}
                    </button>
                    <p className="text-center text-[11px] leading-5 text-[#93A198]">By continuing, you agree to use Showwork responsibly and provide accurate account information.</p>
                  </form>
                </motion.div>
              ) : (
                <motion.div key="verify" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#155FC7]"><Mail size={26} /></div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#16834B]">One last step</p>
                  <h2 className="mt-3 text-[27px] font-semibold leading-tight tracking-[-0.05em] sm:text-[34px]">Check your email.</h2>
                  <p className="mt-3 text-sm leading-7 text-[#738278]">We sent a 6-digit verification code to <strong className="break-all font-semibold text-[#102A29]">{email}</strong>.</p>
                  <form onSubmit={handleVerify} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                    <Field label="Verification code">
                      <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus className={`${inputClass} py-5 text-center text-[28px] font-semibold tracking-[0.32em]`} />
                    </Field>
                    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}
                    <button type="submit" disabled={loading || code.length !== 6} className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#155FC7] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#104CA1] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155FC7]">
                      {loading ? <><Loader2 size={18} className="animate-spin" />Verifying...</> : <>Verify and create account <ArrowRight size={18} /></>}
                    </button>
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5EDE6] pt-5 text-xs">
                      <button type="button" onClick={() => { setStep("details"); setError(null); }} className="inline-flex items-center gap-1.5 font-semibold text-[#66796C] hover:text-[#155FC7]"><ArrowLeft size={14} /> Change details</button>
                      <button type="button" disabled={resendStatus === "Sending..."} onClick={handleResend} className="inline-flex items-center gap-1.5 font-semibold text-[#155FC7] disabled:opacity-50"><RotateCcw size={14} /> {resendStatus ?? "Resend code"}</button>
                    </div>
                  </form>
                  <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#E1EAE3] bg-[#F7FAF6] p-4">
                    <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#16834B]" />
                    <p className="text-xs leading-6 text-[#718175]">Your email verification helps keep your Showwork account secure and ensures we can reach you when it matters.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8A9B8D]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#155FC7]" />Your creative workspace<span className="h-1.5 w-1.5 rounded-full bg-[#B8D0BE]" />Built for better work
          </div>
        </section>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F8FAF5]" />}>
      <SignupForm />
    </Suspense>
  );
}
