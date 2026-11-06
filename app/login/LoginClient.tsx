"use client";
import { readProductJourney } from "@/lib/productJourney";
import ShowworkLogo from "@/components/brand/ShowworkLogo";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2,
  Eye, EyeOff, Layers3, Loader2, LockKeyhole,
  ShieldCheck, Sparkles,
} from "lucide-react";

const inputClass =
  "block w-full rounded-2xl border border-[#DFE8E0] bg-[#FAFCF9] px-4 py-3.5 text-[16px] text-[#102A29] outline-none transition placeholder:text-[#A0ADA3] hover:border-[#BACDBE] focus:border-[#155FC7] focus:bg-white focus:ring-4 focus:ring-[#155FC7]/[0.08] disabled:opacity-50";

function Brand() {
  return (
    <Link href="/" aria-label="Showwork home" className="inline-flex items-center rounded-md text-[25px] font-extrabold tracking-[-0.075em] text-[#102A29] outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#155FC7]">
      <ShowworkLogo width={117}/>
    </Link>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const journey = readProductJourney(searchParams);
  const next = journey.destination;
  const signupQuery = new URLSearchParams(next ? { next } : {});
  if (searchParams.get("ref")) signupQuery.set("ref", searchParams.get("ref")!);
  const signupHref = `/signup${signupQuery.size ? `?${signupQuery}` : ""}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (response.ok) {
        router.push(next || "/dashboard");
        return;
      }

      let message = "Invalid email or password";
      try {
        const data = await response.json();
        if (typeof data?.error === "string") message = data.error;
      } catch {
        // A non-JSON server response should not break the login page.
      }
      setError(message);
    } catch {
      setError("We couldn't connect to Showwork. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8FAF5] text-[#102A29] [font-family:var(--font-jakarta,'Plus_Jakarta_Sans',Arial,sans-serif)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-48 h-[620px] w-[620px] rounded-full bg-[#E2EDFF]/65 blur-[110px]" />
        <div className="absolute -bottom-60 -left-40 h-[560px] w-[560px] rounded-full bg-[#D8F3A5]/35 blur-[110px]" />
      </div>

      <header className="relative z-20 border-b border-[#102A29]/[0.07] bg-[#F8FAF5]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[82px] max-w-[1320px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-14">
          <Brand />
          <Link href="/" className="group inline-flex items-center gap-2 text-[12px] font-semibold text-[#607467] transition hover:text-[#155FC7] focus-visible:outline-2 focus-visible:outline-[#155FC7] sm:text-sm">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            Back to Showwork
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1320px] items-center gap-8 px-4 pb-12 pt-6 sm:gap-12 sm:px-8 sm:pb-20 sm:pt-12 lg:min-h-[calc(100vh-82px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-14 lg:px-14 lg:py-16 xl:gap-24">
        <section className="order-2 min-w-0 lg:order-1">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-[#D4E7D9] bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#256B47] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#16834B]" />
              Your creative workspace
            </span>
            <h1 className="mt-6 max-w-[680px] text-[clamp(3.1rem,5.2vw,5.5rem)] font-semibold leading-[1.04] tracking-[-0.07em]">
              Pick up where<br />
              <span className="text-[#155FC7]">you left off.</span>
            </h1>
            <p className="mt-5 max-w-[530px] text-base leading-8 text-[#64766B] sm:text-lg">
              Your portfolio, deliveries and marketing workspaces — with content, conversations, leads and reports in one place.
            </p>
          </motion.div>

          <div className="mt-7 grid gap-3 sm:mt-11 sm:grid-cols-2">
            {[
              { number: "01", title: "Create & deliver", description: "Keep your creative work moving.", icon: Sparkles },
              { number: "02", title: "Built for your work", description: "Everything organised in one place.", icon: ShieldCheck },
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
            Creative work, presented better.
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

        <section className="order-1 min-w-0 w-full lg:order-2" aria-label="Log in to Showwork">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.12 }} className="rounded-[24px] border border-[#DFE8E0] bg-white p-5 shadow-[0_25px_85px_rgba(16,42,41,0.07)] sm:p-9 lg:p-10">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#155FC7]"><LockKeyhole size={22} /></span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F8F1] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#58715E]"><ShieldCheck size={13} /> Secure access</span>
            </div>
            <p className="mt-6 text-[11px] sm:mt-8 font-bold uppercase tracking-[0.16em] text-[#16834B]">Welcome back</p>
            <h2 className="mt-3 text-[27px] leading-tight sm:text-[30px] font-semibold tracking-[-0.05em] lg:text-[34px]">Log in to Showwork.</h2>
            <p className="mt-2 text-sm leading-6 text-[#738278]">Pick up right where you left off.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-semibold text-[#30483C]">Email address</label>
                <input id="email" type="email" inputMode="email" autoComplete="email" required placeholder="you@studio.com" value={email} onChange={(event) => { setEmail(event.target.value); if (error) setError(null); }} className={inputClass} />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="password" className="text-xs font-semibold text-[#30483C]">Password</label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-[#155FC7] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#155FC7]">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input id="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={(event) => { setPassword(event.target.value); if (error) setError(null); }} className={`${inputClass} pr-14`} />
                  <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#819187] transition hover:bg-[#EAF2FF] hover:text-[#155FC7] focus-visible:outline-2 focus-visible:outline-[#155FC7]">
                    {passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}

              <button type="submit" disabled={loading} className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#155FC7] px-6 py-4 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(21,95,199,0.18)] transition hover:-translate-y-0.5 hover:bg-[#104CA1] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155FC7]">
                {loading ? <><Loader2 size={18} className="animate-spin" />Signing you in...</> : <>Log in <ArrowRight size={18} className="transition group-hover:translate-x-1" /></>}
              </button>

              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-[#E5EDE6]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9AA99E]">or</span>
                <span className="h-px flex-1 bg-[#E5EDE6]" />
              </div>
              <p className="text-center text-sm text-[#738278]">
                New to Showwork?{" "}
                <Link href={signupHref} className="inline-flex items-center gap-1 font-semibold text-[#155FC7] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#155FC7]">Create an account <ArrowUpRight size={14} /></Link>
              </p>
            </form>
          </motion.div>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8A9B8D]">
            <ShieldCheck size={14} className="text-[#16834B]" /> Secure sign in <span className="h-1.5 w-1.5 rounded-full bg-[#B8D0BE]" /> Showwork
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
