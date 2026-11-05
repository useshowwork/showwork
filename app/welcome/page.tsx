import { TOOL_COPY } from "@/components/dashboard/toolCopy";
import WorkspaceCard from "@/components/dashboard/WorkspaceCard";
import workspaceStyles from "@/components/dashboard/WorkspaceCard.module.css";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Camera, Users, WandSparkles } from "lucide-react";

const ROUTES = [
  {
    ...TOOL_COPY.workspace,
    variant: "workspace" as const,
    href: "/dashboard/calendars",
    icon: WandSparkles,
    action: TOOL_COPY.workspace.createAction,
  },
  {
    ...TOOL_COPY.delivery,
    variant: "delivery" as const,
    href: "/dashboard/start",
    icon: BriefcaseBusiness,
    action: TOOL_COPY.delivery.createAction,
  },
  {
    ...TOOL_COPY.portfolio,
    variant: "portfolio" as const,
    href: "/dashboard/portfolio",
    icon: Camera,
    action: TOOL_COPY.portfolio.createAction,
  },
];

export default function WelcomePage() {
  return (
    <main className={`${workspaceStyles.page} min-h-screen text-[#101828]`}>
      <header className="border-b border-[#E4E7EC] bg-white">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/dashboard" aria-label="Showwork dashboard" className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#175CD3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo/swwhite.svg" alt="Showwork" className="h-7 w-auto brightness-0" />
          </Link>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#DCE2EA] px-4 py-2 text-sm font-semibold text-[#475467] hover:bg-[#F8FAFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#175CD3]">
            Skip for now <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <section className={workspaceStyles.intro}>
          <p className="text-sm font-semibold text-[#175CD3]">Welcome to Showwork</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Choose the right tool for your work</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#475467]">Click a tool to get started.</p>
        </section>
        <section aria-label="Choose a Showwork tool" className={`${workspaceStyles.grid} mt-8`}>
          {ROUTES.map(({ description, href, icon: Icon, product, action, variant }) => (
            <WorkspaceCard key={href} variant={variant} product={product} description={description} href={href} action={action} icon={<Icon size={22} aria-hidden="true" />} />
          ))}
        </section>
        <a href="https://chat.whatsapp.com/GVRHGFaFW5Z0yOOWbWmrn0?mode=gi_t" target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center gap-4 rounded-2xl border border-[#DCE2EA] bg-white p-5 hover:border-[#2478FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#175CD3]">
          <Users size={24} className="shrink-0 text-[#175CD3]" aria-hidden="true" />
          <div><h2 className="text-base font-semibold">Join the WhatsApp community</h2><p className="mt-1 text-sm leading-6 text-[#475467]">Meet other creators in Creativo. Opens WhatsApp in a new tab.</p></div>
        </a>
        <footer className="mt-8 border-t border-[#DCE2EA] pt-5 text-sm text-[#475467]">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#175CD3] underline underline-offset-4">Go to dashboard <ArrowRight size={16} aria-hidden="true" /></Link>
        </footer>
      </div>
    </main>
  );
}
