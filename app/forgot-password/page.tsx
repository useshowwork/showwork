"use client";
import ShowworkLogo from "@/components/brand/ShowworkLogo";

import { useState } from "react";
import Link from "next/link";

const COLOR = {
  black: "#0A0A0A",
  gold: "#F5C842",
  orange: "#E8881A",
  midGray: "#888786",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12"
      style={{ background: COLOR.black }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/hero1.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0.4 }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.5) 40%, rgba(10,10,10,0.95) 100%)",
        }}
      />

      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-8 md:px-14">
        <Link href="/" aria-label="Showwork home" className="inline-flex items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <ShowworkLogo tone="white" width={117}/>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-semibold uppercase" style={{ color: COLOR.gold, letterSpacing: "0.1em" }}>
            Password reset
          </p>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Forgot your password?</h1>
          <p className="mt-2 text-sm font-normal text-white/50">
            We'll send a reset link to your email.
          </p>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{ background: "rgba(26,26,26,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(248,247,244,0.08)" }}
        >
          <div className="mb-4 h-[3px] w-8" style={{ background: COLOR.orange }} aria-hidden />

          {submitted ? (
            <>
              <p className="text-sm text-white/70">
                If an account exists for <span className="text-white">{email}</span>, a reset link is on its way. Check your inbox (and spam folder).
              </p>
              <Link
                href="/login"
                className="mt-6 flex justify-center rounded-lg py-3 text-sm font-semibold"
                style={{ background: COLOR.gold, color: COLOR.black }}
              >
                Back to login
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                  style={{ fontSize: "16px" }}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-lg py-3.5 text-sm font-semibold transition-transform hover:scale-[1.01] disabled:opacity-50"
                style={{ background: COLOR.gold, color: COLOR.black }}
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>

              <p className="text-center text-xs" style={{ color: COLOR.midGray }}>
                <Link href="/login" className="font-medium text-white/70 underline transition-colors hover:text-white">
                  Back to login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}