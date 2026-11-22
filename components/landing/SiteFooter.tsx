import ShowworkLogo from "@/components/brand/ShowworkLogo";
import Image from "next/image";
import Link from "next/link";
import { productNavigation } from "@/lib/productPages";
import { solutionNavigation } from "@/lib/solutionNavigation";
import { ArrowUpRight, MessageCircle } from "lucide-react";

const socials = [
  { name: "X", slug: "x", handle: "useshowwork", href: "https://x.com/useshowwork" },
  { name: "Instagram", slug: "instagram", handle: "useshowworkofficial", href: "https://instagram.com/useshowworkofficial" },
  { name: "LinkedIn", slug: "linkedin", handle: "useshowwork", href: "https://linkedin.com/company/useshowwork" },
  { name: "TikTok", slug: "tiktok", handle: "useshowwork", href: "https://tiktok.com/@useshowwork" },
  { name: "Facebook", slug: "facebook", handle: "useshowwork", href: "https://facebook.com/useshowwork" },
  { name: "YouTube", slug: "youtube", handle: "useshowwork", href: "https://www.youtube.com/@useshowwork" },
];

const navigation = [
  { title: "Products", links: productNavigation.map(({ name: label, href }) => ({ label, href })) },
  { title: "Your community", links: [
    { label: "Creativo", href: "/creativo" },
    { label: "Blog", href: "/blog" },
    { label: "Webinars", href: "/webinars" },
    { label: "Creator spotlight", href: "/spotlight" },
  ] },
  { title: "Let’s connect", links: [
    { label: "Create an account", href: "/signup" },
    { label: "Log in", href: "/login" },
    { label: "Help & guides", href: "/help/workspace" },
    { label: "Contact us", href: "/contact" },
  ] },
];

const homepageNavigation = [
  navigation[0],
  { title: "Solutions", links: solutionNavigation },
  { title: "Company", links: [
    { label: "About Showwork", href: "/#company" },
    { label: "Resources", href: "/blog" },
    { label: "Help & guides", href: "/help/workspace" },
    { label: "Contact", href: "/contact" },
  ] },
];

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4D9EFF]";

export default function SiteFooter({ homepage = false, compact = false }: { homepage?: boolean; compact?: boolean }) {
  return (
    <footer
      data-marketing-motion
      className="relative z-10 isolate overflow-hidden border-t border-white/10 bg-[#07080A] px-5 text-white sm:px-8 lg:px-16"
      style={{ fontFamily: "var(--font-sans), sans-serif" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-48 -top-48 h-[600px] w-[600px] rounded-full bg-[#2478FF]/10 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl" data-marketing-footer-content>
        <div className={homepage || compact ? "hidden" : "flex flex-col gap-8 border-b border-white/10 py-12 sm:py-16 md:flex-row md:items-end md:justify-between"}>
          <div>
            <p className="mb-5 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4D9EFF]" aria-hidden="true" />
              {homepage ? "Connected marketing operations" : "Built for people who make things"}
            </p>
            <h2 className="text-[clamp(2.5rem,6vw,5rem)] font-medium leading-[1.05] tracking-[-0.055em]">
              Your work.<br />
              <span className="text-white/50">In good company.</span>
            </h2>
          </div>
          <Link
            href="/signup"
            className={`group inline-flex w-fit items-center gap-6 rounded-full bg-[#2478FF] py-4 pl-6 pr-4 text-sm font-semibold transition-colors hover:bg-[#4D9EFF] ${focus}`}
          >
            Get started with Showwork
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              <ArrowUpRight size={18} aria-hidden="true" className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </span>
          </Link>
        </div>

        <div className={homepage ? "grid gap-9 py-9 lg:grid-cols-[1.2fr_2fr] lg:gap-16" : "grid gap-12 py-12 sm:py-16 lg:grid-cols-[1.2fr_2fr] lg:gap-20"}>
          <div>
            <Link href="/" aria-label="Showwork home" className={`inline-block rounded-sm ${focus}`}>
              <ShowworkLogo tone="white" width={136}/>
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-7 text-slate-400">
              {homepage ? "Intelligent systems for how modern marketing and creative work gets done." : "Tools for portfolios, project delivery, marketing operations and customer conversations."}
            </p>
            <a
              href="https://wa.me/2347018819588"
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-6 inline-flex items-center gap-2.5 rounded-sm text-sm text-slate-300 transition-colors hover:text-white ${focus}`}
            >
              <MessageCircle size={16} aria-hidden="true" className="text-blue-300" />
              Talk to Showwork
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {(homepage ? homepageNavigation : navigation).map(({ title, links }) => (
              <div key={title}>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
                <ul className="mt-5 space-y-4">
                  {links.map(({ label, href }) => (
                    <li key={href}>
                      <Link href={href} className={`rounded-sm text-sm text-slate-300 transition-colors hover:text-blue-300 ${focus}`}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <nav aria-label="Showwork social media" className={homepage ? "border-y border-white/10 py-4" : "border-y border-white/10 py-6"}>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Find us in your feed</p>
          <ul className={homepage ? "flex flex-wrap gap-x-6 gap-y-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"}>
            {socials.map(({ name, slug, handle, href }) => (
              <li key={slug}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Showwork on ${name}, @${handle} (opens in a new tab)`}
                  className={homepage ? `inline-flex min-h-11 items-center gap-2 text-sm text-slate-300 hover:text-white ${focus}` : `group flex h-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-4 transition-colors hover:border-blue-400/40 hover:bg-blue-500/10 sm:px-4 ${focus}`}
                >
                  <Image src={`/images/integrations/${slug}.svg`} alt="" width={20} height={20} aria-hidden="true" className="shrink-0 brightness-0 invert" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-slate-200">{name}</span>
                    {!homepage && <span className="mt-1 block break-all text-[10px] text-slate-400">@{handle}</span>}
                  </div>
                  <ArrowUpRight size={13} aria-hidden="true" className="shrink-0 text-slate-500 transition-colors group-hover:text-blue-300" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 py-7 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-lime-200/25 bg-lime-200/10 py-1.5 pl-2.5 pr-3.5 text-xs font-semibold text-[#d8f3a5]">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" focusable="false">
                <path d="m10 2 5-1 4 3 3 1 2 5 4 3 3-1-2 4-4 4-1 5-4 5-3 1-2-3-1-5-2-3v-4l-4-1-4 1-3-4 1-4 4-5zM29 22l1 3-2 4-2-1 1-4z" />
              </svg>
              Made in Africa
            </p>
            <p>© {new Date().getFullYear()} Showwork. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/privacy" className={`rounded-sm transition-colors hover:text-white ${focus}`}>Privacy</Link>
            <Link href="/terms" className={`rounded-sm transition-colors hover:text-white ${focus}`}>Terms</Link>
            <Link href="/contact" className={`rounded-sm transition-colors hover:text-white ${focus}`}>Contact</Link>
          </div>
        </div>
        {homepage && <p className="border-t border-white/10 py-7 text-sm text-slate-300">Great creative work deserves a better system.</p>}
        <div hidden={homepage || compact} aria-hidden="true" className="pointer-events-none select-none overflow-hidden border-t border-white/[0.06] pt-4 text-center text-[clamp(4rem,17vw,14rem)] font-semibold leading-[0.85] tracking-[-0.07em] text-white/[0.045]">
          showwork
        </div>
      </div>
    </footer>
  );
}
