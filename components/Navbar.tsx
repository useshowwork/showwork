"use client";
import ShowworkLogo from "@/components/brand/ShowworkLogo";

import {
  useEffect,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Menu,
  X,
  UsersRound,
  LogIn,
  Sparkles,
  Newspaper,
  Trophy,
  Star,
  BriefcaseBusiness,
  Layers3,
  Workflow,
  ChevronDown,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                               BRAND SYSTEM                                 */
/* -------------------------------------------------------------------------- */

const COLOR = {
  ink: "#0B0D10",
  black: "#080808",
  muted: "#667085",
  blue: "#2478FF",
  blueDark: "#0052FF",
  blueSoft: "#DCE9FF",
  bluePale: "#F1F6FF",
  line: "rgba(11,13,16,0.09)",
  paper: "#F8FAFD",
  white: "#FFFFFF",
} as const;

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type SolutionType = "portfolio" | "delivery" | "workspace";

type Solution = {
  label: string;
  eyebrow: string;
  description: string;
  href: string;
  icon: ElementType;
  number: string;
  accent: string;
  visual: SolutionType;
};

type NavLinkItem = {
  label: string;
  href: string;
  icon: ElementType;
  badge?: string;
};

/* -------------------------------------------------------------------------- */
/*                                   LOGO                                     */
/* -------------------------------------------------------------------------- */

function Logo() {
  return (
    <Link
      href="/"
      aria-label="Showwork home"
      className="group relative flex shrink-0 items-center"
    >
      <ShowworkLogo width={112}/>


      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#2478FF] transition-[width] duration-200 ease-out group-hover:w-full"
      />
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*                              SOLUTIONS DATA                                */
/* -------------------------------------------------------------------------- */

const SOLUTIONS: Solution[] = [
  {
    label: "Portfolio",
    eyebrow: "PRESENT YOUR WORK",
    description:
      "Create a portfolio that makes your work easier to discover, understand and remember.",
    href: "/portfolio",
    icon: BriefcaseBusiness,
    number: "01",
    accent: "#2478FF",
    visual: "portfolio",
  },
  {
    label: "Project Delivery",
    eyebrow: "DELIVER THE WORK",
    description:
      "Present projects, collect feedback, get approvals and move work to completion.",
    href: "/delivery",
    icon: Workflow,
    number: "02",
    accent: "#0052FF",
    visual: "delivery",
  },
  {
    label: "Marketing Workspace",
    eyebrow: "MANAGE THE WORK",
    description:
      "Manage client content, approvals, conversations, leads and analytics in one workspace.",
    href: "/content-workspace",
    icon: Layers3,
    number: "03",
    accent: "#2478FF",
    visual: "workspace",
  },
];

/* -------------------------------------------------------------------------- */
/*                                NAVIGATION                                  */
/* -------------------------------------------------------------------------- */

const NAV_LINKS: NavLinkItem[] = [
  {
    label: "Creativo",
    href: "/creativo",
    icon: UsersRound,
    badge: "COMMUNITY",
  },
  {
    label: "Spotlight",
    href: "/spotlight",
    icon: Star,
  },
  {
    label: "Webinars",
    href: "/webinars",
    icon: Star,
  },
  {
    label: "Leaderboard",
    href: "/leaderboard",
    icon: Trophy,
  },
  {
    label: "Blog",
    href: "/blog",
    icon: Newspaper,
  },
];

/* -------------------------------------------------------------------------- */
/*                              SOLUTION VISUAL                               */
/* -------------------------------------------------------------------------- */

function SolutionVisual({ type }: { type: SolutionType }) {
  if (type === "portfolio") {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[#F2F6FC]">
        <div
          className="absolute -right-8 -top-10 h-32 w-32 rounded-full blur-2xl"
          style={{
            background: "rgba(36,120,255,0.16)",
          }}
        />

        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(11,13,16,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,16,0.055) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />

        <div className="absolute left-5 top-5 w-[78%] rounded-xl border border-black/[0.08] bg-white p-3 shadow-[0_16px_40px_-20px_rgba(11,13,16,0.28)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-1.5 w-14 rounded-full bg-black/80" />
              <div className="mt-1.5 h-1 w-9 rounded-full bg-black/10" />
            </div>

            <div className="h-5 w-5 rounded-full bg-[#DCE9FF]" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1.5">
            <div className="aspect-square rounded-md bg-[#DCE9FF]" />
            <div className="aspect-square rounded-md bg-[#E9EDF3]" />
            <div className="aspect-square rounded-md bg-[#C8D8F5]" />
          </div>
        </div>

        <div className="absolute bottom-4 right-4 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2478FF]" />

            <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-black/45">
              Live portfolio
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "delivery") {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[#0B0D10]">
        <div
          className="absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl"
          style={{
            background: "rgba(36,120,255,0.24)",
          }}
        />

        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="absolute left-5 right-5 top-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-1.5 w-20 rounded-full bg-white/85" />
              <div className="mt-1.5 h-1 w-12 rounded-full bg-white/20" />
            </div>

            <div className="rounded-full bg-[#2478FF] px-2 py-1">
              <span className="text-[6px] font-bold uppercase tracking-[0.1em] text-white">
                Review
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] p-3">
            <div className="h-2 w-[72%] rounded-full bg-white/15" />

            <div className="mt-4 grid grid-cols-4 gap-1">
              <div className="h-1.5 rounded-full bg-[#2478FF]" />
              <div className="h-1.5 rounded-full bg-white/15" />
              <div className="h-1.5 rounded-full bg-white/15" />
              <div className="h-1.5 rounded-full bg-white/15" />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="h-1 w-14 rounded-full bg-white/15" />
              <div className="h-5 w-14 rounded-full bg-white/90" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-5">
          <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-white/35">
            Project delivery
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[#EFF5FF]">
      <div
        className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{
          background: "rgba(36,120,255,0.13)",
        }}
      />

      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(11,13,16,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,16,0.045) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />

      <div className="absolute left-5 right-5 top-5">
        <div className="rounded-xl border border-black/[0.08] bg-white p-3 shadow-[0_16px_40px_-24px_rgba(11,13,16,0.25)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-1.5 w-20 rounded-full bg-black/75" />
              <div className="mt-1.5 h-1 w-12 rounded-full bg-black/10" />
            </div>

            <div className="flex -space-x-1">
              <span className="h-5 w-5 rounded-full border-2 border-white bg-[#DCE9FF]" />
              <span className="h-5 w-5 rounded-full border-2 border-white bg-[#B7CFFF]" />
              <span className="h-5 w-5 rounded-full border-2 border-white bg-[#2478FF]" />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2478FF]" />
              <span className="h-1.5 w-24 rounded-full bg-black/10" />
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#AFC8F8]" />
              <span className="h-1.5 w-20 rounded-full bg-black/10" />
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-black/10" />
              <span className="h-1.5 w-28 rounded-full bg-black/10" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 rounded-full border border-black/[0.07] bg-white px-3 py-1.5 shadow-sm">
        <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#2478FF]">
          Marketing workspace
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            SOLUTIONS DROPDOWN                              */
/* -------------------------------------------------------------------------- */

function SolutionsDropdown({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <>
      {/* Desktop backdrop */}
      <button
        type="button"
        aria-label="Close solutions menu"
        className="fixed inset-0 z-[105] hidden cursor-default bg-black/[0.025] lg:block"
        onClick={onClose}
      />

      {/* Desktop dropdown */}
      <div
        className="fixed left-1/2 top-[76px] z-[110] hidden w-[min(900px,calc(100vw-40px))] -translate-x-1/2 lg:block"
        role="dialog"
        aria-label="Showwork solutions"
      >
        <div className="overflow-hidden rounded-[26px] border border-black/[0.09] bg-white shadow-[0_30px_80px_-35px_rgba(11,13,16,0.32)]">
          {/* Background architecture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.32]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(11,13,16,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,16,0.035) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          <div
            className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full blur-2xl"
            style={{
              background: "rgba(36,120,255,0.08)",
            }}
          />

          {/* Header */}
          <div className="relative flex items-end justify-between px-6 pb-4 pt-5">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: COLOR.blue,
                  }}
                />

                <span
                  className="text-[9px] font-bold uppercase text-[#2478FF]"
                  style={{
                    letterSpacing: "0.18em",
                  }}
                >
                  Solutions
                </span>
              </div>

              <h3 className="max-w-[600px] text-[20px] font-semibold tracking-[-0.045em] text-[#0B0D10]">
                Everything you need to move creative work forward.
              </h3>
            </div>

            <div className="hidden text-right md:block">
              <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-black/25">
                Showwork
              </p>

              <p className="mt-1 text-[9px] text-black/35">
                One platform. Three ways to work.
              </p>
            </div>
          </div>

          {/* Solution cards */}
          <div className="relative grid gap-3 px-4 pb-4 md:grid-cols-3">
            {SOLUTIONS.map((solution) => {
              const Icon = solution.icon;

              return (
                <Link
                  key={solution.href}
                  href={solution.href}
                  onClick={onClose}
                  className="group relative overflow-hidden rounded-[20px] border border-black/[0.07] bg-white transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-black/[0.12] hover:shadow-[0_20px_45px_-28px_rgba(11,13,16,0.35)]"
                >
                  {/* Hover glow */}
                  <div
                    className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-200 group-hover:opacity-100"
                    style={{
                      background: `${solution.accent}22`,
                    }}
                  />

                  {/* Visual */}
                  <div className="relative p-2">
                    <div className="h-[138px]">
                      <SolutionVisual type={solution.visual} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative px-5 pb-5 pt-3">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{
                          background: `${solution.accent}10`,
                          border: `1px solid ${solution.accent}18`,
                        }}
                      >
                        <Icon
                          size={14}
                          strokeWidth={2}
                          style={{
                            color: solution.accent,
                          }}
                        />
                      </div>

                      <span className="text-[9px] font-bold tracking-[0.08em] text-black/20">
                        {solution.number}
                      </span>
                    </div>

                    <p
                      className="mt-4 text-[8px] font-bold uppercase"
                      style={{
                        color: solution.accent,
                        letterSpacing: "0.14em",
                      }}
                    >
                      {solution.eyebrow}
                    </p>

                    <h4 className="mt-1.5 text-[17px] font-semibold tracking-[-0.04em] text-[#0B0D10]">
                      {solution.label}
                    </h4>

                    <p className="mt-2 min-h-[48px] text-[11px] leading-[1.6] text-black/45">
                      {solution.description}
                    </p>

                    <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-[#0B0D10] transition-colors duration-150 group-hover:text-[#2478FF]">
                      Explore

                      <ArrowUpRight
                        size={12}
                        strokeWidth={2.5}
                        className="transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Bottom line */}
          <div className="relative mx-4 mb-4 flex items-center justify-between rounded-[18px] bg-[#F7F9FC] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-1.5">
                <span className="h-5 w-5 rounded-full border-2 border-[#F7F9FC] bg-[#DCE9FF]" />
                <span className="h-5 w-5 rounded-full border-2 border-[#F7F9FC] bg-[#AFC8F8]" />
                <span className="h-5 w-5 rounded-full border-2 border-[#F7F9FC] bg-[#2478FF]" />
              </div>

              <span className="text-[9px] font-medium text-black/40">
                Built for people who make things.
              </span>
            </div>

            <Link
              href="/signup"
              onClick={onClose}
              className="group flex items-center gap-1.5 text-[10px] font-bold text-[#2478FF]"
            >
              Get started

              <ArrowUpRight
                size={12}
                strokeWidth={2.5}
                className="transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                NAV LINK                                    */
/* -------------------------------------------------------------------------- */

function NavLink({
  label,
  href,
  icon: Icon,
  badge,
}: {
  label: string;
  href: string;
  icon: ElementType;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-2 py-2 text-[12px] font-semibold tracking-[-0.01em] text-black/65 transition-colors duration-150 hover:text-black"
    >
      <Icon
        size={13}
        strokeWidth={2}
        className="transition-transform duration-150 group-hover:-translate-y-px"
        style={{
          color: badge ? COLOR.blue : COLOR.muted,
        }}
      />

      <span>{label}</span>

      {badge && (
        <span
          className="rounded-full px-1.5 py-[2px] text-[7px] font-bold"
          style={{
            background: COLOR.blueSoft,
            color: COLOR.blueDark,
            letterSpacing: "0.08em",
          }}
        >
          {badge}
        </span>
      )}

      <span
        aria-hidden="true"
        className="absolute -bottom-1 left-0 h-[1.5px] w-0 rounded-full bg-[#2478FF] transition-[width] duration-150 group-hover:w-full"
      />
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*                              PRIMARY BUTTON                                */
/* -------------------------------------------------------------------------- */

function PrimaryButton({
  href,
  children,
  onClick,
}: {
  href: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group relative overflow-hidden rounded-full"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 rounded-full bg-[#2478FF]/20 opacity-0 blur-lg transition-opacity duration-200 group-hover:opacity-70"
      />

      <span
        className="relative flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold text-white transition-transform duration-150 group-hover:-translate-y-px"
        style={{
          background:
            "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)",
          boxShadow:
            "0 10px 26px -14px rgba(36,120,255,0.7)",
        }}
      >
        {children}

        <ArrowUpRight
          size={14}
          strokeWidth={2.5}
          className="transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  NAVBAR                                    */
/* -------------------------------------------------------------------------- */

export default function Navbar({
  isLoggedIn = false,
}: {
  isLoggedIn?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  /* ------------------------------------------------------------------------ */
  /*                           SCROLL PERFORMANCE                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let frameId: number | null = null;

    const update = () => {
      const next = window.scrollY > 24;

      setScrolled((current) => {
        if (current === next) {
          return current;
        }

        return next;
      });

      frameId = null;
    };

    const onScroll = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(update);
    };

    update();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", onScroll);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                          MOBILE BODY LOCK                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  /* ------------------------------------------------------------------------ */
  /*                            KEYBOARD CONTROL                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (solutionsOpen) {
        setSolutionsOpen(false);
      }

      if (mobileOpen) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [solutionsOpen, mobileOpen]);

  /* ------------------------------------------------------------------------ */
  /*                           MOBILE MENU HELPERS                             */
  /* ------------------------------------------------------------------------ */

  const closeMobileMenu = () => {
    setSolutionsOpen(false);
    setMobileOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileOpen((current) => {
      const next = !current;

      if (!next) {
        setSolutionsOpen(false);
      }

      return next;
    });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-[100] px-3 pt-3 sm:px-5 sm:pt-5">
      <div
        className="relative mx-auto max-w-[1480px]"
        style={{
          borderRadius: mobileOpen
            ? "26px"
            : scrolled
              ? "999px"
              : "24px",

          background: mobileOpen
            ? "rgba(255,255,255,0.98)"
            : scrolled
              ? "rgba(255,255,255,0.94)"
              : "rgba(255,255,255,0.72)",

          border: `1px solid ${
            scrolled || mobileOpen
              ? "rgba(11,13,16,0.10)"
              : "rgba(11,13,16,0.07)"
          }`,

          boxShadow:
            scrolled || mobileOpen
              ? "0 18px 55px -30px rgba(11,13,16,0.20)"
              : "0 10px 35px -30px rgba(11,13,16,0.10)",

          backdropFilter: "blur(10px)",
WebkitBackdropFilter: "blur(10px)",
        }}
      >
        {/* ------------------------------------------------------------------ */}
        {/*                               NAV                                  */}
        {/* ------------------------------------------------------------------ */}

        <nav className="relative z-20 flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 md:px-7 md:py-3.5">
          {/* Logo + desktop navigation */}
          <div className="flex min-w-0 items-center gap-12">
            <Logo />

            <div className="hidden items-center gap-7 lg:flex">
              {/* ------------------------------------------------------------ */}
              {/*                         SOLUTIONS                             */}
              {/* ------------------------------------------------------------ */}

              <div className="relative z-[115]">
                <button
                  type="button"
                  onClick={() =>
                    setSolutionsOpen((current) => !current)
                  }
                  aria-expanded={solutionsOpen}
                  aria-haspopup="dialog"
                  className="group relative flex items-center gap-1.5 py-2 text-[12px] font-semibold tracking-[-0.01em] text-black/55 transition-colors duration-150 hover:text-black"
                >
                  <Layers3
                    size={13}
                    strokeWidth={2}
                    className="transition-transform duration-150 group-hover:-translate-y-px"
                    style={{
                      color: COLOR.blue,
                    }}
                  />

                  <span>Solutions</span>

                  <ChevronDown
                    size={12}
                    strokeWidth={2}
                    className={`transition-transform duration-150 ${
                      solutionsOpen ? "rotate-180" : ""
                    }`}
                    style={{
                      color: COLOR.muted,
                    }}
                  />

                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-1 left-0 h-[1.5px] rounded-full bg-[#2478FF] transition-[width] duration-150 ${
                      solutionsOpen ? "w-full" : "w-0"
                    }`}
                  />
                </button>

                <SolutionsDropdown
                  open={solutionsOpen}
                  onClose={() => setSolutionsOpen(false)}
                />
              </div>

              {/* Main navigation */}
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.href}
                  label={link.label}
                  href={link.href}
                  icon={link.icon}
                  badge={link.badge}
                />
              ))}
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/*                         DESKTOP ACTIONS                           */}
          {/* ---------------------------------------------------------------- */}

          <div className="hidden items-center gap-5 sm:flex">
            {isLoggedIn ? (
              <PrimaryButton href="/dashboard">
                Go to dashboard
              </PrimaryButton>
            ) : (
              <>
                <Link
                  href="/login"
                  className="group flex items-center gap-2 text-[12px] font-semibold text-black/55 transition-colors duration-150 hover:text-black"
                >
                  <LogIn
                    size={14}
                    strokeWidth={2}
                    className="transition-transform duration-150 group-hover:-translate-x-0.5"
                  />

                  <span>Log in</span>
                </Link>

                <PrimaryButton href="/signup">
                  Get started
                </PrimaryButton>
              </>
            )}
          </div>

          {/* ---------------------------------------------------------------- */}
          {/*                           MOBILE BUTTON                           */}
          {/* ---------------------------------------------------------------- */}

          <button
            type="button"
            onClick={toggleMobileMenu}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-150 sm:hidden"
            style={{
              borderColor: mobileOpen
                ? "rgba(36,120,255,0.22)"
                : "rgba(11,13,16,0.10)",

              background: mobileOpen
                ? "rgba(36,120,255,0.08)"
                : "rgba(255,255,255,0.7)",
            }}
          >
            {mobileOpen ? (
              <X
                size={18}
                strokeWidth={2}
                style={{
                  color: COLOR.blue,
                }}
              />
            ) : (
              <Menu
                size={19}
                strokeWidth={2}
                style={{
                  color: COLOR.ink,
                }}
              />
            )}
          </button>
        </nav>

        {/* ------------------------------------------------------------------ */}
        {/*                          MOBILE MENU                               */}
        {/* ------------------------------------------------------------------ */}

        {mobileOpen && (
          <div className="relative z-10 lg:hidden">
            <div
              className="border-t px-4 pb-4 pt-4 sm:px-5 sm:pb-5"
              style={{
                borderColor: COLOR.line,
              }}
            >
              {/* ------------------------------------------------------------ */}
              {/*                         SOLUTIONS                             */}
              {/* ------------------------------------------------------------ */}

              <div>
                <button
                  type="button"
                  onClick={() =>
                    setSolutionsOpen((current) => !current)
                  }
                  aria-expanded={solutionsOpen}
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-3.5 text-left transition-colors duration-150 hover:bg-black/[0.035]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{
                        background: "rgba(36,120,255,0.08)",
                        border: "1px solid rgba(36,120,255,0.12)",
                      }}
                    >
                      <Layers3
                        size={15}
                        strokeWidth={2}
                        style={{
                          color: COLOR.blue,
                        }}
                      />
                    </div>

                    <div>
                      <span className="block text-[13px] font-semibold text-black">
                        Solutions
                      </span>

                      <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.13em] text-[#2478FF]">
                        Explore Showwork
                      </span>
                    </div>
                  </div>

                  <ChevronDown
                    size={17}
                    strokeWidth={2}
                    className={`transition-transform duration-150 ${
                      solutionsOpen ? "rotate-180" : ""
                    }`}
                    style={{
                      color: COLOR.muted,
                    }}
                  />
                </button>

                {solutionsOpen && (
                  <div className="overflow-hidden">
                    <div className="ml-3 space-y-1 border-l border-black/[0.08] pb-2 pl-3">
                      {SOLUTIONS.map((solution) => {
                        const Icon = solution.icon;

                        return (
                          <Link
                            key={solution.href}
                            href={solution.href}
                            onClick={closeMobileMenu}
                            className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors duration-150 hover:bg-black/[0.035]"
                          >
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                              style={{
                                background: `${solution.accent}0D`,
                                border: `1px solid ${solution.accent}16`,
                              }}
                            >
                              <Icon
                                size={14}
                                strokeWidth={2}
                                style={{
                                  color: solution.accent,
                                }}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-black">
                                  {solution.label}
                                </span>

                                <span className="text-[7px] font-bold tracking-[0.08em] text-black/20">
                                  {solution.number}
                                </span>
                              </div>

                              <p className="mt-0.5 truncate text-[9px] text-black/40">
                                {solution.description}
                              </p>
                            </div>

                            <ArrowUpRight
                              size={14}
                              strokeWidth={2}
                              className="shrink-0 text-black/25 transition-[transform,color] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#2478FF]"
                            />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------ */}
              {/*                      MAIN NAVIGATION                          */}
              {/* ------------------------------------------------------------ */}

              <div className="mt-2 grid gap-1">
                {NAV_LINKS.map((link) => {
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className="group flex items-center justify-between rounded-2xl px-3 py-3.5 transition-colors duration-150 hover:bg-black/[0.035]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{
                            background: link.badge
                              ? "rgba(36,120,255,0.08)"
                              : "rgba(11,13,16,0.045)",

                            border: `1px solid ${
                              link.badge
                                ? "rgba(36,120,255,0.12)"
                                : "rgba(11,13,16,0.07)"
                            }`,
                          }}
                        >
                          <Icon
                            size={15}
                            strokeWidth={2}
                            style={{
                              color: link.badge
                                ? COLOR.blue
                                : COLOR.ink,
                            }}
                          />
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-black">
                            {link.label}
                          </span>

                          {link.badge && (
                            <span
                              className="mt-0.5 text-[7px] font-bold uppercase"
                              style={{
                                color: COLOR.blue,
                                letterSpacing: "0.13em",
                              }}
                            >
                              {link.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      <ArrowUpRight
                        size={16}
                        strokeWidth={2}
                        className="transition-[transform,color] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        style={{
                          color: COLOR.muted,
                        }}
                      />
                    </Link>
                  );
                })}
              </div>

              {/* ------------------------------------------------------------ */}
              {/*                       ACCOUNT ACTIONS                        */}
              {/* ------------------------------------------------------------ */}

              <div
                className="mt-4 grid gap-2.5 border-t pt-4"
                style={{
                  borderColor: COLOR.line,
                }}
              >
                {isLoggedIn ? (
                  <PrimaryButton
                    href="/dashboard"
                    onClick={closeMobileMenu}
                  >
                    Go to dashboard
                  </PrimaryButton>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={closeMobileMenu}
                      className="flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-center text-[12px] font-bold text-black/65 transition-colors duration-150 hover:bg-black/[0.035] hover:text-black"
                      style={{
                        borderColor: "rgba(11,13,16,0.10)",
                      }}
                    >
                      <LogIn size={14} strokeWidth={2} />

                      Log in
                    </Link>

                    <Link
                      href="/signup"
                      onClick={closeMobileMenu}
                      className="group relative overflow-hidden rounded-full px-5 py-3.5 text-center text-[12px] font-bold text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)",
                        boxShadow:
                          "0 12px 30px -15px rgba(36,120,255,0.65)",
                      }}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <Sparkles
                          size={14}
                          strokeWidth={2.2}
                        />

                        Start creating

                        <ArrowUpRight
                          size={14}
                          strokeWidth={2.5}
                          className="transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        />
                      </span>
                    </Link>
                  </>
                )}
              </div>

              {/* ------------------------------------------------------------ */}
              {/*                         BRAND SIGNATURE                       */}
              {/* ------------------------------------------------------------ */}

              <div className="mt-5 flex items-center gap-3 px-1">
                <div
                  className="h-px flex-1"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(36,120,255,0.65), rgba(36,120,255,0.05))",
                  }}
                />

                <span
                  className="whitespace-nowrap text-[7px] font-bold uppercase text-black/20"
                  style={{
                    letterSpacing: "0.17em",
                  }}
                >
                  SHOW YOUR WORK
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}