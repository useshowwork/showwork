"use client";

import { useEffect } from "react";

const targets = [
  "[data-marketing-motion] h2",
  "[data-marketing-motion] h2 + p",
  "[data-marketing-motion] [data-marketing-reveal]",
  "[data-marketing-motion] [data-marketing-photo]",
  "[data-marketing-motion] [data-marketing-card]",
  "[data-marketing-motion] [data-marketing-footer-content]",
].join(",");

export function useMarketingReveals(path?: string) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;

    const elements = document.querySelectorAll<HTMLElement>(targets);
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-marketing-visible", "");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -18px 0px", threshold: 0.05 });

    for (const element of elements) observer.observe(element);

    function stopForReducedMotion() {
      if (!preference.matches) return;
      observer.disconnect();
      for (const element of elements) element.removeAttribute("data-marketing-visible");
    }

    preference.addEventListener("change", stopForReducedMotion);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", stopForReducedMotion);
      for (const element of elements) element.removeAttribute("data-marketing-visible");
    };
  }, [path]);
}
