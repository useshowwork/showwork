"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, ArrowUpRight, MessageCircle, X } from 'lucide-react';
import RandyAvatar from './RandyAvatar';
import styles from './SupportLauncher.module.css';

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20.52 3.449A11.86 11.86 0 0 0 12.058 0C5.5 0 .164 5.337.162 11.895c0 2.097.547 4.144 1.587 5.948L.06 24l6.3-1.653a11.86 11.86 0 0 0 5.692 1.45h.005c6.557 0 11.893-5.337 11.895-11.895a11.85 11.85 0 0 0-3.432-8.453Zm-8.462 18.277h-.004a9.84 9.84 0 0 1-5.015-1.372l-.36-.214-3.74.981.998-3.646-.234-.374a9.86 9.86 0 0 1-1.512-5.205C2.193 6.46 6.61 2.043 12.063 2.043a9.82 9.82 0 0 1 6.987 2.897 9.82 9.82 0 0 1 2.892 6.992c-.002 5.454-4.419 9.794-9.884 9.794Zm5.407-7.349c-.296-.148-1.753-.865-2.025-.964-.272-.099-.47-.148-.667.149-.198.296-.766.964-.939 1.162-.173.198-.346.223-.642.074-.296-.148-1.252-.462-2.385-1.473-.882-.787-1.477-1.758-1.65-2.054-.173-.296-.018-.456.13-.604.134-.133.296-.346.445-.519.148-.173.198-.297.297-.495.099-.198.05-.371-.025-.519-.074-.148-.667-1.607-.914-2.202-.241-.579-.486-.5-.667-.509-.173-.009-.371-.01-.568-.01-.198 0-.519.074-.791.371-.272.296-1.038 1.014-1.038 2.473s1.063 2.869 1.211 3.067c.148.198 2.092 3.194 5.071 4.481.709.306 1.262.489 1.693.626.712.226 1.36.194 1.872.118.571-.085 1.753-.717 2.001-1.41.247-.692.247-1.285.173-1.409-.074-.123-.272-.197-.568-.346Z"
        fill="currentColor"
      />
    </svg>
  );
}


/** One shared entry point for AI help and the Showwork support team. */
export default function WhatsAppSupport({ enableRandy = false }: { enableRandy?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('showwork-randy-open', close);
    return () => window.removeEventListener('showwork-randy-open', close);
  }, []);
  useEffect(() => {
    if (!open) return;
    (firstChoice.current ?? root.current?.querySelector<HTMLAnchorElement>('a'))?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); launcher.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (!mounted || !pathname || /^\/(?:login|signup|register|forgot-password|reset-password|verify|auth)(?:\/|$)/.test(pathname)) return null;
  const whatsappUrl = `https://wa.me/2347018819588?text=${encodeURIComponent("Hi Showwork team! I’d appreciate some help with Showwork. Here’s what I’m trying to do:")}`;
  return <div ref={root} className={styles.root} data-showwork-support="true">
    {open && <section id="showwork-support-options" aria-labelledby="showwork-support-title" className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>SHOWWORK SUPPORT</span>
        <button type="button" className={styles.close} aria-label="Close support options" onClick={() => { setOpen(false); launcher.current?.focus(); }}><X size={17} /></button>
        <h2 id="showwork-support-title">A little help, whenever you need it.</h2>
        <p>{enableRandy ? 'Get guidance from Randy or talk things through with our team. Choose what works for you.' : 'Have a question? Our team is here to help you find your next step.'}</p>
      </header>
      <div className={styles.choices}>
        {enableRandy && <button ref={firstChoice} type="button" className={styles.choice} onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('showwork-randy-open')); }}>
          <RandyAvatar size={42} />
          <span className={styles.choiceCopy}><span className={styles.choiceTitle}>Ask Randy <small>AI assistant</small></span><span className={styles.description}>Step-by-step guidance for getting things done in Showwork.</span><span className={styles.action}>Start a conversation <ArrowRight size={13} /></span></span>
          <ArrowRight size={17} className={styles.arrow} />
        </button>}
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${styles.choice} ${styles.whatsapp}`} onClick={() => { setOpen(false); launcher.current?.focus(); }}>
          <span className={styles.whatsappIcon}><WhatsAppIcon /></span>
          <span className={styles.choiceCopy}><span className={styles.choiceTitle}>Chat with our team <small>WhatsApp</small></span><span className={styles.description}>For account questions, troubleshooting, or a human helping hand.</span><span className={styles.action}>Continue on WhatsApp <ArrowUpRight size={13} /></span></span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <footer className={styles.footer}>You’re in the right place. Let’s take the next step together.</footer>
    </section>}
    <button ref={launcher} data-showwork-chat-launcher type="button" className={styles.launcher} aria-label={open ? 'Close Showwork chat options' : 'Open Showwork chat options'} aria-expanded={open} aria-controls={open ? 'showwork-support-options' : undefined} onClick={() => setOpen(value => !value)}>
      {open ? <X size={20} /> : <MessageCircle size={21} />}
    </button>
  </div>;
}
