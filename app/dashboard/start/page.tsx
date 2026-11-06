import ShowworkLogo from "@/components/brand/ShowworkLogo";
import UiSymbol from "@/components/ui/UiSymbol";
import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getCurrentCreator } from "@/lib/auth";

const COLOR = {
  black: "#07090D",
  blue: "#2478FF",
  blueBright: "#5B9BFF",
  gradient: "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)",
  charcoal: "#11151B",
  charcoalLight: "#151A21",
  midGray: "#8B929D",
};

function IconArrowLeft({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M19 12H5M11 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrowUpRight({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSend({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M20.5 3.5 10 13.5M20.5 3.5 14 20.5l-4-7-7-4 17.5-6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClipboard({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect
        x="5"
        y="4"
        width="14"
        height="17"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M8.5 11h7M8.5 15h5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCheck({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="m5 12 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function StartProjectPage() {
  const creator = await getCurrentCreator();

  if (!creator) {
    redirect("/login");
  }

  return (
    <main
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: COLOR.black }}
    >
      {/* Atmospheric background */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
      >
        <div
          className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full blur-[140px]"
          style={{ background: "rgba(36,120,255,0.13)" }}
        />
        <div
          className="absolute -bottom-52 -right-40 h-[620px] w-[620px] rounded-full blur-[160px]"
          style={{ background: "rgba(0,82,255,0.08)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage:
              "linear-gradient(to bottom, black 0%, transparent 75%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, transparent 75%)",
          }}
        />
      </div>

      {/* Top navigation */}
      <header className="relative z-20 px-5 pt-5 sm:px-8 md:px-12 md:pt-7 lg:px-16">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-2.5 shadow-2xl backdrop-blur-2xl sm:px-4">
          <Link
            href="/dashboard/projects"
            className="group inline-flex items-center gap-2.5 rounded-full px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.06] hover:text-white sm:text-sm"
          >
            <IconArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span>Back to projects</span>
          </Link>

          <div className="hidden items-center gap-2 sm:flex">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: COLOR.blue,
                boxShadow: "0 0 16px rgba(36,120,255,0.9)",
              }}
            />
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
              New project
            </span>
          </div>

          <Link
            href="/dashboard/projects"
            className="hidden sm:block"
            aria-label="Showwork Project Delivery"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <ShowworkLogo tone="white" width={104} className="opacity-80"/>
          </Link>
        </div>
      </header>

      {/* Main */}
      <section className="relative z-10 mx-auto max-w-[1280px] px-5 pb-16 pt-14 sm:px-8 sm:pt-20 md:px-12 md:pb-24 md:pt-24 lg:px-16">
        {/* Intro */}
        <div className="max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <span
              className="h-[2px] w-8"
              style={{ background: COLOR.blue }}
            />
            <p
              className="text-[10px] font-bold uppercase"
              style={{
                color: COLOR.blueBright,
                letterSpacing: "0.18em",
              }}
            >
              Project Delivery
            </p>
          </div>

          <h1
            className="font-semibold tracking-[-0.06em] text-white"
            style={{
              fontSize: "clamp(1.1rem, 3vw, 3.5rem)",
              lineHeight: 0.91,
            }}
          >
            How do you want
            <br />
            <span className="text-white/35">to work?</span>
          </h1>

          <p className="mt-7 max-w-2xl text-sm leading-7 text-white/40 sm:text-base sm:leading-8">
            Choose the workflow that matches the project. One is built for
            delivering finished work. The other is built for managing the work
            before it reaches the client.
          </p>
        </div>

        {/* Choice stage */}
        <div className="relative mt-14 sm:mt-16">
          <div
            className="pointer-events-none absolute -inset-10 rounded-[60px] opacity-60 blur-[80px]"
            style={{
              background:
                "radial-gradient(circle at 25% 40%, rgba(36,120,255,0.10), transparent 32%), radial-gradient(circle at 78% 55%, rgba(0,82,255,0.08), transparent 30%)",
            }}
          />

          <div className="relative grid gap-4 lg:grid-cols-2">
            {/* Delivery */}
            <Link
              href="/dashboard/new"
              className="group relative min-h-[420px] overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#10151C] p-6 shadow-2xl transition-all duration-500 hover:-translate-y-1 hover:border-blue-400/25 sm:p-8 lg:min-h-[480px] lg:p-10"
            >
              <div
                className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full blur-[90px] transition-all duration-700 group-hover:scale-125"
                style={{ background: "rgba(36,120,255,0.16)" }}
              />

              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(36,120,255,0.07), transparent 42%)",
                  }}
                />
              </div>

              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border"
                    style={{
                      background: "rgba(36,120,255,0.10)",
                      borderColor: "rgba(36,120,255,0.18)",
                    }}
                  >
                    <IconSend
                      className="h-6 w-6"
                      style={{ color: COLOR.blueBright }}
                    />
                  </div>

                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/30 transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/[0.07] group-hover:text-white">
                    <IconArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>

                <div className="mt-auto pt-20">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
                    01 · Delivery
                  </p>

                  <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                    The work is ready.
                  </h2>

                  <p className="mt-4 max-w-lg text-sm leading-6 text-white/40">
                    Upload finished work, present it beautifully, collect
                    feedback, approvals and move the project to completion.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-2">
                    {["Upload", "Review", "Approve", "Deliver"].map(
                      (item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/35"
                        >
                          {item}
                        </span>
                      ),
                    )}
                  </div>

                  <div
                    className="mt-8 inline-flex items-center gap-2 text-sm font-bold"
                    style={{ color: COLOR.blueBright }}
                  >
                    Start a delivery
                    <span className="transition-transform duration-300 group-hover:translate-x-1"><UiSymbol name="right" /></span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Managed */}
            <Link
              href="/dashboard/new-managed"
              className="group relative min-h-[420px] overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#10151C] p-6 shadow-2xl transition-all duration-500 hover:-translate-y-1 hover:border-blue-400/25 sm:p-8 lg:min-h-[480px] lg:p-10"
            >
              <div
                className="pointer-events-none absolute -bottom-32 -left-28 h-80 w-80 rounded-full blur-[90px] transition-all duration-700 group-hover:scale-125"
                style={{ background: "rgba(36,120,255,0.11)" }}
              />

              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(315deg, rgba(36,120,255,0.06), transparent 45%)",
                  }}
                />
              </div>

              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border"
                    style={{
                      background: "rgba(36,120,255,0.10)",
                      borderColor: "rgba(36,120,255,0.18)",
                    }}
                  >
                    <IconClipboard
                      className="h-6 w-6"
                      style={{ color: COLOR.blueBright }}
                    />
                  </div>

                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/30 transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/[0.07] group-hover:text-white">
                    <IconArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>

                <div className="mt-auto pt-20">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
                    02 · Managed
                  </p>

                  <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                    The work is still moving.
                  </h2>

                  <p className="mt-4 max-w-lg text-sm leading-6 text-white/40">
                    Build the brief, assign tasks, coordinate your team and
                    review the work internally before the client ever sees it.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-2">
                    {["Brief", "Assign", "Review", "Publish"].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/35"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <div
                    className="mt-8 inline-flex items-center gap-2 text-sm font-bold"
                    style={{ color: COLOR.blueBright }}
                  >
                    Start a managed project
                    <span className="transition-transform duration-300 group-hover:translate-x-1"><UiSymbol name="right" /></span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Workflow strip */}
        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.025]">
          <div className="grid sm:grid-cols-2">
            <div className="border-b border-white/[0.07] px-6 py-5 sm:border-b-0 sm:border-r sm:px-8">
              <div className="flex items-center gap-3">
                <IconCheck
                  className="h-4 w-4"
                  style={{ color: COLOR.blueBright }}
                />
                <p className="text-xs font-semibold text-white/50"><>{" Finished work "}<UiSymbol name="right" />{" client "}</></p>
              </div>
            </div>

            <div className="px-6 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                <IconCheck
                  className="h-4 w-4"
                  style={{ color: COLOR.blueBright }}
                />
                <p className="text-xs font-semibold text-white/50"><>{" Work in progress "}<UiSymbol name="right" />{" team "}<UiSymbol name="right" />{" client "}</></p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">
            Showwork · Project Delivery
          </p>

          <Link
            href="/dashboard/projects"
            className="text-xs font-medium text-white/30 transition hover:text-white/65"
          ><>{" "}<UiSymbol name="left" />{" Return to projects "}</></Link>
        </div>
      </section>
    </main>
  );
}
