"use client";
import { readProductJourney } from "@/lib/productJourney";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import authStyles from "@/components/auth/AuthSplitLayout.module.css";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

const inputClass =
  "block w-full rounded-2xl border border-[#DFE8E0] bg-[#FAFCF9] px-4 py-3.5 text-[16px] text-[#102A29] outline-none transition placeholder:text-[#A0ADA3] hover:border-[#BACDBE] focus:border-[#155FC7] focus:bg-white focus:ring-4 focus:ring-[#155FC7]/[0.08] disabled:opacity-50";

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
      setError(
        "We couldn't connect to Showwork. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout>
      <h1>Welcome back</h1>
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 sm:mt-8 sm:space-y-5"
      >
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-xs font-semibold text-[#30483C]"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@studio.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            className={inputClass}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-[#30483C]"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#155FC7] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#155FC7]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
              className={`${inputClass} pr-14`}
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((visible) => !visible)}
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#819187] transition hover:bg-[#EAF2FF] hover:text-[#155FC7] focus-visible:outline-2 focus-visible:outline-[#155FC7]"
            >
              {passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

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
              Signing you in...
            </>
          ) : (
            <>
              Log in{" "}
              <ArrowRight
                size={18}
                className="transition group-hover:translate-x-1"
              />
            </>
          )}
        </button>
      </form>
      <p className={authStyles.switch}>
        New to Showwork?<Link href={signupHref}>Create an account</Link>
      </p>
    </AuthSplitLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
