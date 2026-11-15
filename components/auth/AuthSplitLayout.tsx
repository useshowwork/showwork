"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowDown, ArrowUpRight } from "lucide-react";
import SiteFooter from "@/components/landing/SiteFooter";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import styles from "./AuthSplitLayout.module.css";

export default function AuthSplitLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const goBack = () => {
    const hasLocalHistory = document.referrer &&
      new URL(document.referrer).origin === window.location.origin &&
      window.history.length > 1;
    if (hasLocalHistory) router.back();
    else router.push("/");
  };
  return (
    <div className={styles.shell} data-showwork-auth>
      <header className={styles.header}>
        <Link href="/" aria-label="Showwork home" className={styles.logo}><ShowworkLogo width={138} /></Link>
        <nav aria-label="Main navigation" className={styles.navigation}>
          <Link href="/" className={styles.homeLink}>Home</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/help/workspace" className={styles.helpLink}>Help & guides <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </nav>
      </header>
      <div className={styles.utility}>
        <button type="button" onClick={goBack} className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
        <a href="#showwork-footer" className={styles.explore}>Explore Showwork <ArrowDown size={14} aria-hidden="true" /></a>
      </div>
      <main className={styles.page}>
        <aside className={styles.photo} aria-label="Team collaboration">
          <img
            src="/images/auth.webp"
            alt="Three colleagues collaborating around a table with laptops"
            width={1448}
            height={1086}
            loading="eager"
            decoding="async"
            className={styles.image}
          />
        </aside>
        <section className={styles.content} aria-label="Your Showwork account">
          <div className={styles.form}>
            {children}
          </div>
        </section>
      </main>
      <div id="showwork-footer" className={styles.footer}><SiteFooter compact /></div>
    </div>
  );
}
