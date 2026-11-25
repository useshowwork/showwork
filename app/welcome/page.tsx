import ShowworkLogo from "@/components/brand/ShowworkLogo";
import { TOOL_COPY } from "@/components/dashboard/toolCopy";
import WorkspaceCard from "@/components/dashboard/WorkspaceCard";
import workspaceStyles from "@/components/dashboard/WorkspaceCard.module.css";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Camera, MessagesSquare, WandSparkles } from "lucide-react";

const ROUTES = [
  {
    ...TOOL_COPY.workspace,
    variant: "workspace" as const,
    href: "/dashboard/calendars",
    icon: WandSparkles,
    action: TOOL_COPY.workspace.createAction,
  },
  {
    ...TOOL_COPY.engage,
    variant: "engage" as const,
    href: "/dashboard/engage",
    icon: MessagesSquare,
    action: TOOL_COPY.engage.createAction,
  },
  {
    ...TOOL_COPY.delivery,
    variant: "delivery" as const,
    href: "/dashboard/start",
    icon: BriefcaseBusiness,
    action: TOOL_COPY.delivery.createAction,
  },
];

export default function WelcomePage() {
  return (
    <main className={`${workspaceStyles.page} min-h-screen text-[#101828]`}>
      <header className="border-b border-[#E4E7EC] bg-white">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/dashboard" aria-label="Showwork dashboard" className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#175CD3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <ShowworkLogo width={117}/>
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
        <section aria-label="Choose a Showwork tool" className="mt-8">
          <div className={workspaceStyles.grid}>
            {ROUTES.map(({ description, href, icon: Icon, product, action, variant }) => (
              <WorkspaceCard key={href} variant={variant} product={product} description={description} href={href} action={action} icon={<Icon size={22} aria-hidden="true" />} />
            ))}
          </div>
          <Link href="/dashboard/portfolio" className={workspaceStyles.portfolioStrip}>
            <span className={workspaceStyles.stripIcon} aria-hidden="true"><Camera size={20} /></span>
            <span className={workspaceStyles.stripCopy}><strong>{TOOL_COPY.portfolio.product}</strong><span>{TOOL_COPY.portfolio.description}</span></span>
            <span className={workspaceStyles.stripAction}>{TOOL_COPY.portfolio.createAction}<ArrowUpRight aria-hidden="true" /></span>
          </Link>
        </section>
        <footer className="mt-8 border-t border-[#DCE2EA] pt-5 text-sm text-[#475467]">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#175CD3] underline underline-offset-4">Go to dashboard <ArrowRight size={16} aria-hidden="true" /></Link>
        </footer>
      </div>
    </main>
  );
}
