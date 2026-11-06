"use client";

import { productEntryHref } from "@/lib/productJourney";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Layers3,
  Play,
  Sparkles,
} from "lucide-react";
import { useRef } from "react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/landing/SiteFooter";

/* -------------------------------------------------------------------------- */
/*                               BRAND SYSTEM                                 */
/* -------------------------------------------------------------------------- */

const BLUE = "#2478FF";
const BLUE_DARK = "#0052FF";
const INK = "#090B0F";
const MUTED = "#667085";
const PAPER = "#F7F9FC";

/* -------------------------------------------------------------------------- */
/*                             PORTFOLIO VISUAL                               */
/* -------------------------------------------------------------------------- */

function PortfolioWindow({
  large = false,
}: {
  large?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-black/[0.08] bg-white shadow-[0_40px_100px_-45px_rgba(11,13,16,0.3)] ${
        large ? "h-[560px]" : "h-[430px]"
      }`}
    >
      {/* Browser bar */}

      <div className="relative z-20 flex h-12 items-center justify-between border-b border-black/[0.06] bg-white px-5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
        </div>

        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/[0.035] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2478FF]" />
          <span className="text-[8px] font-semibold text-black/35">
            showwork.co
          </span>
        </div>

        <div className="h-5 w-5 rounded-full bg-[#EAF1FF]" />
      </div>

      {/* Page */}

      <div className="relative h-[calc(100%-48px)] overflow-hidden bg-[#F9FAFC]">
        {/* Architectural background */}

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(11,13,16,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,16,0.035) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl"
          style={{
            background: "rgba(36,120,255,0.12)",
          }}
        />

        {/* Portfolio navigation */}

        <div className="relative z-10 flex items-center justify-between px-7 py-5">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-[#0B0D10]" />

            <div className="h-1.5 w-16 rounded-full bg-black/70" />
          </div>

          <div className="hidden items-center gap-5 sm:flex">
            <span className="text-[7px] font-semibold text-black/30">
              Work
            </span>
            <span className="text-[7px] font-semibold text-black/30">
              About
            </span>
            <span className="text-[7px] font-semibold text-black/30">
              Contact
            </span>
          </div>
        </div>

        {/* Hero */}

        <div className="relative z-10 px-7 pt-5 sm:pt-10">
          <div className="max-w-[430px]">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1 w-5 rounded-full bg-[#2478FF]" />
              <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-[#2478FF]">
                Selected work
              </span>
            </div>

            <div className="h-5 w-[75%] rounded-full bg-black/85 sm:h-7" />

            <div className="mt-2 h-5 w-[52%] rounded-full bg-black/85 sm:h-7" />

            <div className="mt-4 h-1.5 w-[70%] rounded-full bg-black/10" />

            <div className="mt-1.5 h-1.5 w-[50%] rounded-full bg-black/[0.06]" />
          </div>

          {/* Work grid */}

          <div className="mt-9 grid grid-cols-2 gap-3 sm:mt-12 sm:grid-cols-3">
            <div className="group relative aspect-[1.2] overflow-hidden rounded-xl bg-[#D9E5F8]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#BBD2F5] to-[#E8EEF8]" />

              <div className="absolute bottom-3 left-3">
                <div className="h-1 w-12 rounded-full bg-black/30" />
                <div className="mt-1 h-1 w-8 rounded-full bg-black/10" />
              </div>
            </div>

            <div className="relative aspect-[1.2] overflow-hidden rounded-xl bg-[#E7E9ED]">
              <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/10" />
              <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/10" />
            </div>

            <div className="relative col-span-2 aspect-[2.4] overflow-hidden rounded-xl bg-[#0B0D10] sm:col-span-1 sm:aspect-[1.2]">
              <div
                className="absolute -right-5 -top-5 h-24 w-24 rounded-full blur-2xl"
                style={{
                  background: "rgba(36,120,255,0.35)",
                }}
              />

              <div className="absolute bottom-3 left-3">
                <div className="h-1 w-14 rounded-full bg-white/35" />
                <div className="mt-1 h-1 w-9 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>

        {/* Floating live badge */}

        <div className="absolute bottom-6 right-6 z-20 rounded-full border border-black/[0.07] bg-white/95 px-4 py-2 shadow-[0_15px_30px_-20px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2478FF]" />

            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/45">
              Live portfolio
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           FLOATING MINI CARD                               */
/* -------------------------------------------------------------------------- */

function FloatingCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      animate={{
        y: [0, -8, 0],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={`absolute rounded-2xl border border-black/[0.08] bg-white/90 shadow-[0_25px_60px_-30px_rgba(11,13,16,0.35)] backdrop-blur-xl ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  HERO                                      */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-white">
      {/* Atmospheric background */}

      <div
        className="pointer-events-none absolute left-1/2 top-[18%] h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{
          background: "rgba(36,120,255,0.09)",
        }}
      />

      <div
        className="pointer-events-none absolute right-[-120px] top-[20%] h-[400px] w-[400px] rounded-full blur-[120px]"
        style={{
          background: "rgba(115,153,255,0.08)",
        }}
      />

      {/* Fine grid */}

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.42]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(11,13,16,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,16,0.035) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 50%, transparent 100%)",
        }}
      />

      <Navbar />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1440px] flex-col items-center px-5 pb-16 pt-32 sm:px-8 sm:pt-36 lg:px-12">
        {/* Eyebrow */}

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.15,
          }}
          className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/75 px-3.5 py-2 backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#2478FF]" />

          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-black/45">
            Showwork Portfolio
          </span>
        </motion.div>

        {/* Headline */}

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.9,
            delay: 0.25,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mt-7 max-w-[920px] text-center"
        >
          <h1 className="text-[clamp(3.4rem,8vw,7.5rem)] font-semibold leading-[0.9] tracking-[-0.075em] text-[#090B0F]">
            Your work
            <br />
            deserves{" "}
            <span className="relative inline-block text-[#2478FF]">
              better.
              <span className="absolute -bottom-2 left-0 h-1 w-[65%] rounded-full bg-[#2478FF]/20 sm:-bottom-3" />
            </span>
          </h1>
        </motion.div>

        {/* Description */}

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.42,
          }}
          className="mt-7 max-w-[560px] text-center text-[15px] leading-7 text-black/45 sm:text-[17px]"
        >
          Show your projects, services and testimonials in a professional
          portfolio. Share one link so potential clients can see your
          work and contact you.
        </motion.p>

        {/* CTA */}

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.52,
          }}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            href={productEntryHref("portfolio")}
            className="group relative overflow-hidden rounded-full"
          >
            <span className="absolute -inset-2 rounded-full bg-[#2478FF]/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

            <span className="relative flex items-center gap-2 rounded-full bg-[#2478FF] px-7 py-3.5 text-[13px] font-bold text-white shadow-[0_18px_40px_-18px_rgba(36,120,255,0.7)] transition-transform duration-300 group-hover:-translate-y-0.5">
              Create your portfolio

              <ArrowUpRight
                size={15}
                strokeWidth={2.5}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </span>
          </Link>

          <a
            href="#experience"
            className="group flex items-center gap-2 rounded-full px-5 py-3.5 text-[13px] font-semibold text-black/50 transition-colors duration-300 hover:text-black"
          >
            See how it works

            <ArrowRight
              size={14}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </a>
        </motion.div>

        {/* Product visual */}

        <motion.div
          initial={{
            opacity: 0,
            y: 50,
            scale: 0.97,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          transition={{
            duration: 1,
            delay: 0.65,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative mt-20 w-full max-w-[1050px] sm:mt-24"
        >
          {/* Orbit */}

          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[115%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#2478FF]/10" />

          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-black/[0.035]" />

          <PortfolioWindow large />

          {/* Floating interface cards */}

          <FloatingCard className="-left-5 top-[18%] hidden w-[175px] p-4 lg:block">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-black/35">
                Portfolio
              </span>

              <span className="text-[8px] text-[#2478FF]">Live</span>
            </div>

            <div className="mt-3 h-1.5 w-20 rounded-full bg-black/75" />

            <div className="mt-2 h-1 w-14 rounded-full bg-black/10" />

            <div className="mt-4 grid grid-cols-3 gap-1">
              <div className="aspect-square rounded bg-[#DCE9FF]" />
              <div className="aspect-square rounded bg-[#E9EDF3]" />
              <div className="aspect-square rounded bg-[#BFD2F3]" />
            </div>
          </FloatingCard>

          <FloatingCard className="-right-5 bottom-[16%] hidden w-[190px] p-4 lg:block">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF1FF]">
                <Check
                  size={13}
                  strokeWidth={2.5}
                  className="text-[#2478FF]"
                />
              </div>

              <div>
                <p className="text-[9px] font-bold text-black/75">
                  Client approved
                </p>
                <p className="mt-0.5 text-[7px] text-black/30">
                  Your latest project
                </p>
              </div>
            </div>
          </FloatingCard>
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                             INTRO SECTION                                  */
/* -------------------------------------------------------------------------- */

function Intro() {
  return (
    <section
      id="experience"
      className="relative overflow-hidden bg-[#090B0F] px-5 py-28 sm:px-8 sm:py-36 lg:px-12"
    >
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full blur-[120px]"
        style={{
          background: "rgba(36,120,255,0.16)",
        }}
      />

      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-[40%] opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage:
            "linear-gradient(to left, black, transparent)",
        }}
      />

      <div className="relative mx-auto max-w-[1250px]">
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#68B2FF]">
              A better way to present
            </span>

            <h2 className="mt-5 max-w-[520px] text-[clamp(2.6rem,5vw,5rem)] font-semibold leading-[0.94] tracking-[-0.065em] text-white">
              Stop sending
              <br />
              people{" "}
              <span className="text-white/30">folders.</span>
            </h2>
          </div>

          <div>
            <p className="max-w-[570px] text-[18px] leading-8 text-white/50">
              Your portfolio is often the first place someone experiences
              your work. Showwork gives it the attention that first
              impression deserves.
            </p>

            <div className="mt-9 flex items-center gap-4">
              <div className="h-px w-16 bg-[#2478FF]" />

              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
                One link. Your work.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                             FEATURE SECTION                                */
/* -------------------------------------------------------------------------- */

const FEATURES = [
  {
    number: "01",
    title: "Show it beautifully.",
    description:
      "Bring photography, video, documents and case studies together in a portfolio that feels like you.",
  },
  {
    number: "02",
    title: "Make it yours.",
    description:
      "Your work should live inside an experience that reflects the quality of what you create.",
  },
  {
    number: "03",
    title: "Share one link.",
    description:
      "Send clients, collaborators and prospects straight to your work without explaining where to look.",
  },
];

function Features() {
  return (
    <section className="relative overflow-hidden bg-white px-5 py-28 sm:px-8 sm:py-36 lg:px-12">
      <div className="mx-auto max-w-[1250px]">
        <div className="grid gap-16 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#2478FF]">
              Built around your work
            </span>

            <h2 className="mt-5 max-w-[430px] text-[clamp(2.7rem,5vw,5rem)] font-semibold leading-[0.94] tracking-[-0.065em] text-[#090B0F]">
              Simple to build.
              <br />
              Hard to forget.
            </h2>
          </div>

          <div className="divide-y divide-black/[0.08]">
            {FEATURES.map((feature) => (
              <div
                key={feature.number}
                className="group grid gap-5 py-8 sm:grid-cols-[70px_1fr] sm:py-10"
              >
                <span className="text-[10px] font-bold tracking-[0.12em] text-black/20">
                  {feature.number}
                </span>

                <div>
                  <h3 className="text-[24px] font-semibold tracking-[-0.04em] text-[#090B0F] transition-colors duration-300 group-hover:text-[#2478FF] sm:text-[30px]">
                    {feature.title}
                  </h3>

                  <p className="mt-3 max-w-[520px] text-[14px] leading-7 text-black/45 sm:text-[15px]">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                           PORTFOLIO EXPERIENCE                             */
/* -------------------------------------------------------------------------- */

function Experience() {
  return (
    <section className="relative overflow-hidden bg-[#F3F6FA] px-5 py-28 sm:px-8 sm:py-36 lg:px-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(11,13,16,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,16,0.035) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-[1250px]">
        <div className="max-w-[700px]">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#2478FF]">
            Your work, your way
          </span>

          <h2 className="mt-5 text-[clamp(2.8rem,5vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.07em] text-[#090B0F]">
            From first impression
            <br />
            to{" "}
            <span className="text-[#2478FF]">
              let's work together.
            </span>
          </h2>

          <p className="mt-7 max-w-[560px] text-[15px] leading-7 text-black/45">
            A good portfolio doesn't just show what you've made. It gives
            people a reason to believe you can make something for them.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          <div className="rounded-[28px] border border-black/[0.07] bg-white p-6 shadow-[0_25px_70px_-45px_rgba(11,13,16,0.25)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF1FF]">
              <Layers3
                size={19}
                strokeWidth={2}
                className="text-[#2478FF]"
              />
            </div>

            <h3 className="mt-8 text-[18px] font-semibold tracking-[-0.03em] text-black">
              Everything together
            </h3>

            <p className="mt-2 text-[12px] leading-6 text-black/40">
              Photos, films, documents and projects in one polished
              experience.
            </p>
          </div>

          <div className="rounded-[28px] border border-black/[0.07] bg-white p-6 shadow-[0_25px_70px_-45px_rgba(11,13,16,0.25)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF1FF]">
              <Sparkles
                size={19}
                strokeWidth={2}
                className="text-[#2478FF]"
              />
            </div>

            <h3 className="mt-8 text-[18px] font-semibold tracking-[-0.03em] text-black">
              Made to be remembered
            </h3>

            <p className="mt-2 text-[12px] leading-6 text-black/40">
              Give your best work the space and presentation it deserves.
            </p>
          </div>

          <div className="rounded-[28px] border border-black/[0.07] bg-white p-6 shadow-[0_25px_70px_-45px_rgba(11,13,16,0.25)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF1FF]">
              <ArrowUpRight
                size={19}
                strokeWidth={2}
                className="text-[#2478FF]"
              />
            </div>

            <h3 className="mt-8 text-[18px] font-semibold tracking-[-0.03em] text-black">
              Ready to share
            </h3>

            <p className="mt-2 text-[12px] leading-6 text-black/40">
              One link you can put anywhere — from your bio to your next
              proposal.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              FINAL CTA                                     */
/* -------------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#090B0F] px-5 py-32 sm:px-8 sm:py-40 lg:px-12">
      {/* Glow */}

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
        style={{
          background: "rgba(36,120,255,0.14)",
        }}
      />

      {/* Rings */}

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[650px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-white/[0.05]" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[750px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#2478FF]/10" />

      <div className="relative mx-auto max-w-[900px] text-center">
        <span className="inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#68B2FF]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2478FF]" />
          Your work starts here
        </span>

        <h2 className="mt-6 text-[clamp(3.2rem,7vw,7rem)] font-semibold leading-[0.9] tracking-[-0.075em] text-white">
          Put your work
          <br />
          <span className="text-[#2478FF]">somewhere worth seeing.</span>
        </h2>

        <p className="mx-auto mt-7 max-w-[500px] text-[15px] leading-7 text-white/40">
          Build your Showwork portfolio and give every project a better
          first impression.
        </p>

        <div className="mt-9 flex justify-center">
          <Link
            href={productEntryHref("portfolio")}
            className="group relative overflow-hidden rounded-full"
          >
            <span className="absolute -inset-3 rounded-full bg-[#2478FF]/30 blur-xl" />

            <span className="relative flex items-center gap-2 rounded-full bg-[#2478FF] px-7 py-3.5 text-[13px] font-bold text-white shadow-[0_20px_45px_-20px_rgba(36,120,255,0.8)] transition-transform duration-300 group-hover:-translate-y-0.5">
              Create your portfolio

              <ArrowUpRight
                size={15}
                strokeWidth={2.5}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                FOOTER                                      */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/*                               PAGE                                         */
/* -------------------------------------------------------------------------- */

export default function PortfolioLandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Hero />
      <Intro />
      <Features />
      <Experience />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}