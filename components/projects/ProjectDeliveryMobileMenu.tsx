"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import ShowworkLogo from "@/components/brand/ShowworkLogo";
import styles from "./ProjectDeliveryDashboard.module.css";

/** Native modal supplies focus trapping, Escape handling and an inert page. */
export default function ProjectDeliveryMobileMenu({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      desktop.removeEventListener("change", closeOnDesktop);
      trigger.current?.focus();
    };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className={styles.menuTrigger} onClick={() => setOpen(true)} aria-label="Open Project Delivery navigation" aria-haspopup="dialog" aria-expanded={open} aria-controls="delivery-mobile-navigation"><Menu size={19} aria-hidden="true" /></button>
    {mounted && createPortal(<dialog ref={dialog} id="delivery-mobile-navigation" className={styles.mobileDrawer} aria-labelledby="delivery-navigation-title" onClose={() => { if (!dialog.current?.open) setOpen(false); }} onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className={styles.drawerInner}>
        <header className={styles.drawerHeader}><ShowworkLogo tone="white" width={120}/><button type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20}/></button></header>
        <h2 id="delivery-navigation-title">Project Delivery</h2>
        <nav aria-label="Project Delivery navigation" onClick={event => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>{children}</nav>
      </div>
    </dialog>, document.body)}
  </>;
}
