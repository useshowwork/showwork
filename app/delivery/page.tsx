"use client";

import { productEntryHref } from "@/lib/productJourney";

import SiteFooter from "@/components/landing/SiteFooter";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  CreditCard,
  FileCheck2,
  FolderOpen,
  MessageSquare,
  Play,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import Navbar from "@/components/Navbar";

const BLUE = "#2478FF";

const workflow = [
  {
    number: "01",
    label: "CREATE",
    title: "Give the project a home.",
    description:
      "Start with one professional space for the project, the files, the people and everything that needs to happen.",
    icon: FolderOpen,
  },
  {
    number: "02",
    label: "PRESENT",
    title: "Put the work in context.",
    description:
      "Present your work beautifully instead of sending clients through scattered folders, links and message threads.",
    icon: Send,
  },
  {
    number: "03",
    label: "REVIEW",
    title: "Make feedback easier.",
    description:
      "Keep conversations attached to the work so clients know exactly what they are reviewing and responding to.",
    icon: MessageSquare,
  },
  {
    number: "04",
    label: "APPROVE",
    title: "Turn feedback into decisions.",
    description:
      "Move projects forward with clear approvals instead of wondering whether a client has actually signed off.",
    icon: FileCheck2,
  },
  {
    number: "05",
    label: "GET PAID",
    title: "Finish the project properly.",
    description:
      "Bring the final step into the same professional experience your client has had from the beginning.",
    icon: CreditCard,
  },
];

const features = [
  {
    eyebrow: "PRESENT",
    title: "Give clients a clear view of every deliverable.",
    description:
      "Create a polished project experience where your client can see exactly what you have created, without the clutter of ordinary file sharing.",
    icon: Sparkles,
    side: "left",
  },
  {
    eyebrow: "FEEDBACK",
    title: "Stop hunting through messages for feedback.",
    description:
      "Keep client conversations connected to the project so decisions, revisions and requests stay easy to find.",
    icon: MessageSquare,
    side: "right",
  },
  {
    eyebrow: "APPROVAL",
    title: "Know when the work is ready to move.",
    description:
      "Make approval a clear part of the workflow instead of relying on a thumbs-up buried somewhere in a chat.",
    icon: CircleCheck,
    side: "left",
  },
  {
    eyebrow: "DELIVERY",
    title: "One project. One place. One experience.",
    description:
      "Keep project files, feedback, approvals and final downloads together in one client delivery page.",
    icon: FolderOpen,
    side: "right",
  },
];

function GridBackground({
  dark = false,
}: {
  dark?: boolean;
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: dark
            ? "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)"
            : "linear-gradient(rgba(17,19,23,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(17,19,23,0.045) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "linear-gradient(to bottom, black, transparent 85%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black, transparent 85%)",
        }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background: dark
            ? "radial-gradient(circle, rgba(36,120,255,0.15), transparent 65%)"
            : "radial-gradient(circle, rgba(36,120,255,0.10), transparent 65%)",
        }}
      />
    </>
  );
}

function StatusPill({
  children,
  blue = false,
}: {
  children: React.ReactNode;
  blue?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
        blue
          ? "border-blue-200 bg-blue-50 text-[#2478FF]"
          : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          blue ? "bg-[#2478FF]" : "bg-emerald-500"
        }`}
      />
      {children}
    </span>
  );
}

function DeliveryDashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[1040px]">
      {/* Ambient shadow */}
      <div className="absolute -inset-8 rounded-[40px] bg-blue-500/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 35, rotateX: 5 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_40px_100px_rgba(15,23,42,0.14)]"
      >
        {/* Browser top */}
        <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            </div>
          </div>

          <div className="hidden rounded-md border border-slate-200 bg-white px-20 py-1.5 text-[9px] text-slate-400 sm:block">
            app.showwork.co/project/aurora
          </div>

          <div className="h-6 w-6 rounded-full bg-slate-200" />
        </div>

        <div className="grid min-h-[540px] grid-cols-1 lg:grid-cols-[210px_1fr]">
          {/* Sidebar */}
          <aside className="hidden border-r border-slate-200 bg-[#FAFBFC] p-5 lg:block">
            <div className="mb-9">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950 text-[10px] font-bold text-white">
                  S
                </div>
                <span className="text-xs font-bold tracking-tight text-slate-950">
                  SHOWWORK
                </span>
              </div>
            </div>

            <div className="space-y-1">
              {[
                ["Overview", true],
                ["Presentation", false],
                ["Files", false],
                ["Feedback", false],
                ["Approval", false],
                ["Payments", false],
              ].map(([label, active]) => (
                <div
                  key={String(label)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[11px] font-medium ${
                    active
                      ? "bg-slate-950 text-white"
                      : "text-slate-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      active ? "bg-blue-400" : "bg-slate-300"
                    }`}
                  />
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-12 border-t border-slate-200 pt-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Client
              </p>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-600">
                  AC
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-800">
                    Aurora Creative
                  </p>
                  <p className="text-[9px] text-slate-400">Client</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="min-w-0 bg-white">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#2478FF]">
                    Project Delivery
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-2xl">
                    Aurora Brand Identity
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Brand identity & digital experience
                  </p>
                </div>

                <StatusPill blue>In progress</StatusPill>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  "Overview",
                  "Presentation",
                  "Files",
                  "Feedback",
                  "Approval",
                ].map((item, index) => (
                  <span
                    key={item}
                    className={`rounded-lg px-3 py-2 text-[10px] font-semibold ${
                      index === 0
                        ? "bg-slate-950 text-white"
                        : "text-slate-400"
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1fr_270px]">
              <div className="space-y-5">
                {/* Presentation card */}
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="relative h-[190px] overflow-hidden bg-slate-950 sm:h-[225px]">
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(circle at 70% 30%, rgba(36,120,255,0.65), transparent 35%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15), transparent 30%), linear-gradient(135deg, #111827, #020617)",
                      }}
                    />

                    <div className="absolute left-7 top-7">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
                        Presentation
                      </p>
                      <p className="mt-3 max-w-[230px] text-2xl font-semibold tracking-[-0.05em] text-white">
                        Built to make brands impossible to ignore.
                      </p>
                    </div>

                    <div className="absolute bottom-5 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-950">
                      <Play size={13} fill="currentColor" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[10px] font-semibold text-slate-600">
                      Brand presentation
                    </span>
                    <span className="text-[9px] text-slate-400">
                      12 screens
                    </span>
                  </div>
                </div>

                {/* Activity */}
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-900">
                      Recent activity
                    </p>
                    <span className="text-[9px] text-slate-400">
                      Updated moments ago
                    </span>
                  </div>

                  <div className="mt-4 space-y-4">
                    {[
                      {
                        icon: CircleCheck,
                        text: "Client approved the homepage direction",
                        time: "2m ago",
                      },
                      {
                        icon: MessageSquare,
                        text: "New feedback added to Brand Guidelines",
                        time: "18m ago",
                      },
                      {
                        icon: Send,
                        text: "Presentation sent to Aurora Creative",
                        time: "1h ago",
                      },
                    ].map((item) => {
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.text}
                          className="flex items-center gap-3"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                            <Icon size={12} className="text-slate-500" />
                          </div>

                          <p className="min-w-0 flex-1 text-[10px] leading-4 text-slate-600">
                            {item.text}
                          </p>

                          <span className="shrink-0 text-[9px] text-slate-400">
                            {item.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right rail */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-slate-900">
                      Project progress
                    </p>
                    <span className="text-[10px] font-bold text-[#2478FF]">
                      78%
                    </span>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: "78%",
                        background: BLUE,
                      }}
                    />
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {[
                      ["Discovery", true],
                      ["Presentation", true],
                      ["Revision", true],
                      ["Approval", false],
                    ].map(([label, done]) => (
                      <div
                        key={String(label)}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[9px] text-slate-500">
                          {label}
                        </span>
                        {done ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <span className="h-3 w-3 rounded-full border border-slate-200" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="flex items-center gap-2">
                    <CircleCheck size={14} className="text-[#2478FF]" />
                    <p className="text-[10px] font-semibold text-slate-900">
                      Client approval
                    </p>
                  </div>

                  <p className="mt-3 text-[10px] leading-4 text-slate-500">
                    Homepage direction has been approved.
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-blue-200" />
                    <span className="text-[9px] font-semibold text-slate-600">
                      Aurora Creative
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-950 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">
                    Project value
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">
                    ₦850,000
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-[9px] text-emerald-400">
                    <CircleCheck size={11} />
                    Payment status: Active
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating status cards */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.7 }}
        className="absolute -left-4 top-[24%] hidden w-[170px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)] xl:block"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50">
            <Check size={13} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Approved
            </p>
            <p className="text-[10px] font-semibold text-slate-800">
              Homepage direction
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.85, duration: 0.7 }}
        className="absolute -right-4 bottom-[18%] hidden w-[175px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)] xl:block"
      >
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="h-7 w-7 rounded-full border-2 border-white bg-blue-200" />
            <div className="h-7 w-7 rounded-full border-2 border-white bg-slate-300" />
            <div className="h-7 w-7 rounded-full border-2 border-white bg-slate-700" />
          </div>

          <div>
            <p className="text-[10px] font-semibold text-slate-800">
              3 collaborators
            </p>
            <p className="text-[9px] text-slate-400">
              Active on project
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function DeliveryPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <Navbar />

      {/* HERO */}
      <section className="relative min-h-[900px] overflow-hidden border-b border-slate-200 bg-[#F8FAFD] pt-28 sm:pt-32">
        <GridBackground />

        {/* Architectural lines */}
        <div className="pointer-events-none absolute left-0 right-0 top-[38%] border-t border-slate-200/70" />
        <div className="pointer-events-none absolute left-0 right-0 top-[78%] border-t border-slate-200/60" />

        <div className="relative mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#2478FF] shadow-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#2478FF]" />
              Showwork Project Delivery
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8 }}
              className="mt-8 text-[clamp(3.4rem,8vw,7rem)] font-semibold leading-[0.9] tracking-[-0.075em] text-slate-950"
            >
              Deliver the work.
              <br />
              <span className="text-[#2478FF]">Without the chaos.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg"
            >
              Give every project a professional home for presentations,
              files, feedback, approvals and payment.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Link
                href={productEntryHref("delivery")}
                className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-slate-950 px-7 text-sm font-semibold text-white shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-[#2478FF]"
              >
                Start a project
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>

              <a
                href="#workflow"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                See how it works
                <ChevronRight size={15} />
              </a>
            </motion.div>
          </div>

          {/* Dashboard visual */}
          <div className="relative mt-20 sm:mt-24">
            <DeliveryDashboardMockup />
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section className="relative overflow-hidden bg-slate-950 py-28 text-white sm:py-36">
        <GridBackground dark />

        <div className="relative mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
                A better way to deliver
              </p>

              <h2 className="mt-6 max-w-xl text-4xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-6xl">
                The work moves.
                <br />
                Your clients should too.
              </h2>
            </div>

            <div>
              <p className="max-w-xl text-lg leading-8 text-white/55">
                Creative work rarely gets stuck because the work is bad. It
                gets stuck because the process around it is messy.
              </p>

              <p className="mt-6 max-w-xl text-lg leading-8 text-white/55">
                Showwork gives you a single professional space where the
                project can move from presentation to feedback, approval and
                delivery — without losing the client along the way.
              </p>
            </div>
          </div>

          <div className="mt-24 grid border-y border-white/10 sm:grid-cols-3">
            {[
              ["01", "One project space", "Everything stays connected."],
              ["02", "One client experience", "No more scattered links."],
              ["03", "One clear workflow", "Everyone knows what happens next."],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="border-b border-white/10 px-0 py-8 sm:border-b-0 sm:border-r sm:px-8 sm:first:pl-0 sm:last:border-r-0"
              >
                <p className="text-[10px] font-bold tracking-[0.15em] text-white/30">
                  {number}
                </p>
                <p className="mt-4 text-sm font-semibold text-white">
                  {title}
                </p>
                <p className="mt-2 text-sm text-white/40">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section
        id="workflow"
        className="relative overflow-hidden bg-white py-28 sm:py-36"
      >
        <div className="pointer-events-none absolute right-[-200px] top-[15%] h-[500px] w-[500px] rounded-full border border-blue-100" />
        <div className="pointer-events-none absolute right-[-140px] top-[22%] h-[380px] w-[380px] rounded-full border border-blue-100" />

        <div className="relative mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2478FF]">
              The workflow
            </p>

            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl">
              From first presentation
              <br />
              to final payment.
            </h2>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-500">
              Every stage has a place. Every person knows where the project
              stands.
            </p>
          </div>

          <div className="mt-20">
            {workflow.map((item, index) => {
              const Icon = item.icon;

              return (
                <motion.div
                  key={item.number}
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ delay: index * 0.05, duration: 0.6 }}
                  className="group grid border-t border-slate-200 py-8 sm:grid-cols-[100px_80px_1fr_1fr] sm:items-center sm:gap-8 sm:py-10"
                >
                  <span className="text-[10px] font-bold tracking-[0.16em] text-slate-300">
                    {item.number}
                  </span>

                  <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 transition group-hover:border-blue-200 group-hover:bg-blue-50 sm:mt-0">
                    <Icon
                      size={19}
                      className="text-slate-500 transition group-hover:text-[#2478FF]"
                    />
                  </div>

                  <div className="mt-6 sm:mt-0">
                    <p className="text-[10px] font-bold tracking-[0.16em] text-[#2478FF]">
                      {item.label}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-2xl">
                      {item.title}
                    </h3>
                  </div>

                  <p className="mt-4 max-w-md text-sm leading-6 text-slate-500 sm:mt-0">
                    {item.description}
                  </p>
                </motion.div>
              );
            })}

            <div className="border-t border-slate-200" />
          </div>
        </div>
      </section>

      {/* FEATURE SECTIONS */}
      <section className="relative overflow-hidden bg-[#F4F6F9] py-28 sm:py-36">
        <div className="relative mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2478FF]">
              Built around the work
            </p>

            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl">
              Everything your client
              <br />
              needs to move forward.
            </h2>
          </div>

          <div className="mt-20 space-y-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.div
                  key={feature.eyebrow}
                  initial={{
                    opacity: 0,
                    x: feature.side === "left" ? -25 : 25,
                  }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7 }}
                  className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white"
                >
                  <div className="grid min-h-[430px] lg:grid-cols-2">
                    <div
                      className={`flex flex-col justify-center p-8 sm:p-12 lg:p-16 ${
                        feature.side === "right"
                          ? "lg:order-2"
                          : "lg:order-1"
                      }`}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <Icon size={19} />
                      </div>

                      <p className="mt-10 text-[10px] font-bold tracking-[0.18em] text-[#2478FF]">
                        {feature.eyebrow}
                      </p>

                      <h3 className="mt-4 max-w-lg text-3xl font-semibold leading-[1.05] tracking-[-0.05em] text-slate-950 sm:text-4xl">
                        {feature.title}
                      </h3>

                      <p className="mt-5 max-w-lg text-base leading-7 text-slate-500">
                        {feature.description}
                      </p>
                    </div>

                    <div
                      className={`relative min-h-[300px] overflow-hidden bg-slate-950 ${
                        feature.side === "right"
                          ? "lg:order-1"
                          : "lg:order-2"
                      }`}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            index === 0
                              ? "radial-gradient(circle at 70% 35%, rgba(36,120,255,0.5), transparent 35%), linear-gradient(135deg, #0f172a, #020617)"
                              : index === 1
                              ? "radial-gradient(circle at 25% 70%, rgba(36,120,255,0.45), transparent 35%), linear-gradient(135deg, #111827, #020617)"
                              : index === 2
                              ? "radial-gradient(circle at 70% 70%, rgba(96,165,250,0.4), transparent 30%), linear-gradient(135deg, #111827, #020617)"
                              : "radial-gradient(circle at 50% 40%, rgba(36,120,255,0.4), transparent 35%), linear-gradient(135deg, #0f172a, #020617)",
                        }}
                      />

                      <div
                        className="absolute inset-0 opacity-30"
                        style={{
                          backgroundImage:
                            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                          backgroundSize: "44px 44px",
                        }}
                      />

                      {index === 0 && (
                        <div className="absolute left-[14%] right-[14%] top-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">
                              Presentation
                            </span>
                            <span className="text-[9px] text-white/40">
                              08 / 12
                            </span>
                          </div>

                          <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white">
                            A better way to show the work.
                          </p>

                          <div className="mt-6 h-1 rounded-full bg-white/10">
                            <div className="h-full w-[72%] rounded-full bg-blue-400" />
                          </div>
                        </div>
                      )}

                      {index === 1 && (
                        <div className="absolute left-[12%] right-[12%] top-1/2 -translate-y-1/2 space-y-3">
                          {[
                            "Love the direction.",
                            "Can we explore one more option?",
                            "The typography is perfect.",
                          ].map((text, i) => (
                            <div
                              key={text}
                              className={`rounded-2xl border border-white/10 p-4 backdrop-blur-xl ${
                                i === 1
                                  ? "ml-8 bg-blue-500/20"
                                  : "bg-white/10"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-7 w-7 rounded-full bg-white/15" />
                                <div>
                                  <p className="text-[9px] font-semibold text-white/80">
                                    Client
                                  </p>
                                  <p className="mt-1 text-[10px] text-white/50">
                                    {text}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {index === 2 && (
                        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                            <Check size={35} className="text-emerald-400" />
                          </div>
                          <p className="mt-5 text-sm font-semibold text-white">
                            Project approved
                          </p>
                          <p className="mt-1 text-[10px] text-white/40">
                            Signed off by Aurora Creative
                          </p>
                        </div>
                      )}

                      {index === 3 && (
                        <div className="absolute left-[15%] right-[15%] top-1/2 -translate-y-1/2">
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              ["Files", "24"],
                              ["Feedback", "08"],
                              ["Approvals", "04"],
                              ["Payments", "02"],
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl"
                              >
                                <p className="text-[9px] uppercase tracking-[0.12em] text-white/35">
                                  {label}
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-white">
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COLLABORATION */}
      <section className="relative overflow-hidden bg-white py-28 sm:py-36">
        <div className="absolute inset-0">
          <div className="absolute left-[10%] top-[15%] h-[300px] w-[300px] rounded-full bg-blue-100/40 blur-3xl" />
          <div className="absolute bottom-[5%] right-[10%] h-[300px] w-[300px] rounded-full bg-indigo-100/30 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2478FF]">
                Made for collaboration
              </p>

              <h2 className="mt-5 text-4xl font-semibold leading-[1] tracking-[-0.06em] text-slate-950 sm:text-6xl">
                Clients shouldn't
                <br />
                need a tutorial.
              </h2>

              <p className="mt-7 max-w-xl text-base leading-7 text-slate-500">
                Showwork is designed so the project feels obvious from the
                moment a client opens it. Clear actions. Clear progress.
                Clear next steps.
              </p>

              <div className="mt-9 space-y-4">
                {[
                  "A professional client-facing experience",
                  "Simple feedback and approval flow",
                  "Project files kept in one place",
                  "A clear view of what happens next",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50">
                      <Check size={12} className="text-[#2478FF]" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-10 rounded-full bg-blue-100/30 blur-3xl" />

              <div className="relative rounded-[32px] border border-slate-200 bg-[#F8FAFD] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)] sm:p-8">
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#2478FF]">
                        Aurora Creative
                      </p>
                      <p className="mt-1 text-lg font-semibold tracking-[-0.04em] text-slate-950">
                        Project review
                      </p>
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
                      <Check size={16} className="text-emerald-500" />
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-slate-950 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/35">
                        Review status
                      </span>
                      <span className="text-[9px] font-semibold text-emerald-400">
                        Ready
                      </span>
                    </div>

                    <div className="mt-6 h-2 rounded-full bg-white/10">
                      <div className="h-full w-full rounded-full bg-emerald-400" />
                    </div>

                    <div className="mt-5 flex items-center justify-between text-[9px] text-white/40">
                      <span>Submitted</span>
                      <span>Reviewed</span>
                      <span className="text-white">Approved</span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                        <FileCheck2
                          size={13}
                          className="text-[#2478FF]"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold text-slate-700">
                          Final presentation
                        </p>
                        <p className="mt-1 text-[9px] text-slate-400">
                          Approved just now
                        </p>
                      </div>
                      <Check size={13} className="text-emerald-500" />
                    </div>

                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                        <Users size={13} className="text-[#2478FF]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold text-slate-700">
                          3 people collaborating
                        </p>
                        <p className="mt-1 text-[9px] text-slate-400">
                          Active on project
                        </p>
                      </div>
                      <Clock3 size={13} className="text-slate-300" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ONE PLACE */}
      <section className="relative overflow-hidden bg-slate-950 py-28 text-white sm:py-36">
        <GridBackground dark />

        <div className="relative mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
              One project. One place.
            </p>

            <h2 className="mt-6 text-5xl font-semibold leading-[0.95] tracking-[-0.07em] sm:text-7xl">
              The less time you spend
              <br />
              managing the process,
              <br />
              <span className="text-blue-400">the more you create.</span>
            </h2>

            <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
              Showwork handles the space around the work, so you can focus on
              making the work itself exceptional.
            </p>
          </div>

          <div className="relative mx-auto mt-20 max-w-4xl">
            <div className="absolute inset-0 rounded-[32px] bg-blue-500/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]">
              <div className="grid divide-y divide-white/10 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                {[
                  ["01", "Present", "Show the work"],
                  ["02", "Review", "Collect feedback"],
                  ["03", "Approve", "Move forward"],
                  ["04", "Deliver", "Finish strong"],
                ].map(([number, title, subtitle]) => (
                  <div key={number} className="p-7 sm:p-8">
                    <span className="text-[9px] font-bold tracking-[0.16em] text-white/25">
                      {number}
                    </span>
                    <p className="mt-8 text-lg font-semibold text-white">
                      {title}
                    </p>
                    <p className="mt-2 text-[10px] text-white/35">
                      {subtitle}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-[#F5F7FA] py-32 sm:py-40">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/50 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-6 text-center sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2478FF]">
            Ready when you are
          </p>

          <h2 className="mt-6 text-5xl font-semibold leading-[0.92] tracking-[-0.075em] text-slate-950 sm:text-7xl">
            Less chasing.
            <br />
            <span className="text-[#2478FF]">More creating.</span>
          </h2>

          <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-slate-500">
            Give your next project the delivery experience your work
            deserves.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={productEntryHref("delivery")}
              className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-slate-950 px-8 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#2478FF]"
            >
              Deliver your next project
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>

            <Link
              href="/"
              className="inline-flex h-14 items-center justify-center rounded-full border border-slate-200 bg-white px-8 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Back to Showwork
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </main>
  );
}