"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import BookDemoModal from "@/components/landing/BookDemoModal";
import ProductsMenu from "@/components/landing/ProductsMenu";
import { productNavigation } from "@/lib/productPages";
import { solutionNavigation } from "@/lib/solutionNavigation";
import styles from "@/app/HomePage.module.css";
import { useMarketingReveals } from "./useMarketingReveals";

export default function MarketingHeader({ isLoggedIn, currentPath, activeSection, onBookDemo, pricingHref = "#pricing" }: {
  isLoggedIn: boolean;
  currentPath?: string;
  pricingHref?: string;
  activeSection?: string;
  onBookDemo?: () => void;
}) {
  useMarketingReveals(currentPath);
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const homePrefix = currentPath ? "/" : "";
  const accountHref = isLoggedIn ? "/dashboard" : "/login";
  const accountLabel = isLoggedIn ? "Dashboard" : "Log in";
  useEffect(() => {
    const closeMenus = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const open = header.current?.querySelector<HTMLDetailsElement>("details[open]");
      if (open) { open.open = false; open.querySelector("summary")?.focus(); }
      if (menuOpen) { setMenuOpen(false); document.getElementById("home-menu-toggle")?.focus(); }
    };
    const outside = (event: MouseEvent) => { if (!header.current?.contains(event.target as Node)) { header.current?.querySelectorAll("details[open]").forEach(el => el.removeAttribute("open")); setMenuOpen(false); } };
    const resize = () => { if (window.innerWidth >= 1000) setMenuOpen(false); };
    document.addEventListener("keydown", closeMenus); document.addEventListener("click", outside); window.addEventListener("resize", resize);
    return () => { document.removeEventListener("keydown", closeMenus); document.removeEventListener("click", outside); window.removeEventListener("resize", resize); };
  }, [menuOpen]);
  function closeNavigation() { setMenuOpen(false); header.current?.querySelectorAll("details[open]").forEach(el => el.removeAttribute("open")); }
  function demo() {
    closeNavigation();
    if (onBookDemo) onBookDemo();
    else setDemoOpen(true);
  }

  return (
    <>
      <header data-home-header ref={header} className={styles.header}>
        <div className={styles.navInner}>
          <Link href="/" aria-label="Showwork home"><ShowworkLogo width={124} /></Link>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <ProductsMenu currentPath={currentPath} />
            <details className={styles.dropdown}>
              <summary aria-current={activeSection === "solutions" ? "location" : undefined}>Solutions<ChevronDown size={14} /></summary>
              <div>
                {solutionNavigation.map(solution => (
                  <Link key={solution.href} href={solution.href} aria-current={currentPath === solution.href ? "page" : undefined} onClick={closeNavigation}>
                    {solution.menuLabel}<ArrowUpRight size={15} />
                  </Link>
                ))}
              </div>
            </details>
            <a href={pricingHref} aria-current={activeSection === "pricing" ? "location" : undefined}>Pricing</a>
            <details className={styles.dropdown}>
              <summary aria-current={activeSection === "resources" ? "location" : undefined}>Resources<ChevronDown size={14} /></summary>
              <div>
                <Link href="/help/workspace">Help & guides<ArrowUpRight size={15} /></Link>
                <Link href="/blog">The Showwork blog<ArrowUpRight size={15} /></Link>
                <a href={`${homePrefix}#how-it-works`} onClick={closeNavigation}>How it works<ArrowUpRight size={15} /></a>
              </div>
            </details>
            <Link href="/contact" aria-current={currentPath === "/contact" ? "page" : undefined}>Contact Us</Link>
          </nav>
          <div className={styles.navActions}>
            <Link className={`${styles.login} ${isLoggedIn ? styles.dashboardButton : ""}`} href={accountHref}>{accountLabel}</Link>
            <button className={styles.navCta} type="button" onClick={demo}>Book a demo<ArrowUpRight size={16} /></button>
            <button
              id="home-menu-toggle"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="home-mobile-menu"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              className={styles.menuToggle}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="home-mobile-menu" aria-label="Mobile navigation" className={styles.mobileNav}>
            {productNavigation.map(product => (
              <Link key={product.href} href={product.href} aria-current={currentPath === product.href ? "page" : undefined} onClick={closeNavigation}>
                {product.name}
              </Link>
            ))}
            <details className={styles.mobileSolutions}>
              <summary>Solutions<ChevronDown size={17} /></summary>
              <ul>
                {solutionNavigation.map(solution => (
                  <li key={solution.href}>
                    <Link href={solution.href} aria-current={currentPath === solution.href ? "page" : undefined} onClick={closeNavigation}>{solution.menuLabel}</Link>
                  </li>
                ))}
              </ul>
            </details>
            <a href={pricingHref} onClick={closeNavigation}>Pricing<ArrowUpRight size={17} /></a>
            <Link href="/help/workspace">Resources & guides<ArrowUpRight size={17} /></Link>
            <Link href="/contact" aria-current={currentPath === "/contact" ? "page" : undefined} onClick={closeNavigation}>Contact Us</Link>
            <Link className={isLoggedIn ? styles.dashboardButton : undefined} href={accountHref}>{accountLabel}<ArrowUpRight size={17} /></Link>
            <button type="button" onClick={demo}>Book a demo<ArrowRight size={17} /></button>
          </nav>
        )}
      </header>
      {!onBookDemo && <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />}
    </>
  );
}
