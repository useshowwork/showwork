"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "./SectionTransition.module.css";

/** The content panel itself opens over the previous section as the reader scrolls. */
export default function SectionTransition({ variant, children, className = "" }: {
  variant: "opening" | "process" | "footer" | "replies";
  children: ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = panel.current;
    if (!element || typeof IntersectionObserver === "undefined" || !window.matchMedia) return;
    const backdrop = element.previousElementSibling as HTMLElement | null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let listening = false;
    const clear = () => {
      backdrop?.style.removeProperty("--scene-pin-position");
      backdrop?.style.removeProperty("--scene-sticky-top");
      element.style.removeProperty("--panel-min-height");
      element.style.removeProperty("--panel-inset");
      element.style.removeProperty("--panel-left");
      element.style.removeProperty("--panel-right");
    };
    const update = () => {
      frame = 0;
      const height = window.innerHeight;
      const top = element.getBoundingClientRect().top;
      const headerBottom = document.querySelector("[data-home-header]")?.getBoundingClientRect().bottom ?? 86;
      // A short footer cannot reach the header before the document ends.
      const finish = Math.max(0, headerBottom, variant === "footer" ? height - element.offsetHeight : 0);
      const start = Math.max(finish + 80, height * (variant === "footer" ? .68 : .38));
      // Hold the inset silhouette until the panel is well inside the viewport.
      const progress = Math.max(0, Math.min(1, (start - top) / (start - finish)));
      const eased = progress * progress * (3 - 2 * progress);
      const remaining = 1 - eased;
      const mobile = window.innerWidth <= 760;
      const inset = Math.min(mobile ? 20 : 88, window.innerWidth * (mobile ? .04 : .055));
      const longCorner = Math.min(mobile ? 110 : 230, window.innerWidth * .16);
      const shortCorner = longCorner * .44;
      const backdropHeight = backdrop?.offsetHeight;
      if (backdropHeight) {
        if (variant !== "replies") element.style.setProperty("--panel-min-height", `${backdropHeight}px`);
        // Tall phone sections scroll normally until their lower content is visible, then pin.
        backdrop.style.setProperty("--scene-pin-position", "sticky");
        backdrop.style.setProperty("--scene-sticky-top", `${Math.min(headerBottom, height - backdropHeight)}px`);
      }
      element.style.setProperty("--panel-inset", `${(inset * remaining).toFixed(2)}px`);
      element.style.setProperty("--panel-left", `${((variant === "process" ? shortCorner : longCorner) * remaining).toFixed(2)}px`);
      element.style.setProperty("--panel-right", `${((variant === "process" ? longCorner : shortCorner) * remaining).toFixed(2)}px`);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const stop = () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      listening = false;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const observe = new IntersectionObserver(entries => {
      const visible = entries[0]?.isIntersecting;
      if (visible && !reduced.matches) {
        if (!listening) {
          window.addEventListener("scroll", schedule, { passive: true });
          window.addEventListener("resize", schedule);
          listening = true;
        }
        schedule();
      } else stop();
    }, { rootMargin: "120px 0px" });
    const preference = () => {
      stop();
      if (reduced.matches) clear();
      else { update(); observe.unobserve(element); observe.observe(element); }
    };
    if (!reduced.matches) { update(); observe.observe(element); }
    reduced.addEventListener("change", preference);
    return () => { stop(); observe.disconnect(); reduced.removeEventListener("change", preference); clear(); };
  }, [variant]);
  return <div ref={panel} data-scroll-panel={variant} className={`${styles.panel} ${styles[variant]} ${className}`} style={{ "--panel-inset": "0px", "--panel-left": "0px", "--panel-right": "0px" } as CSSProperties}>{children}</div>;
}
