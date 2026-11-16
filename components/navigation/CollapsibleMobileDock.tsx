"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import styles from "./CollapsibleMobileDock.module.css";

export default function CollapsibleMobileDock({ children, hidden = false }: { children: ReactNode; hidden?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  return (
    <div className={styles.root} data-collapsed={collapsed} hidden={hidden}>
      <div className={styles.menu} hidden={collapsed}>{children}</div>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-label={collapsed ? "Show bottom navigation" : "Hide bottom navigation"}
        aria-expanded={!collapsed}
        title={collapsed ? "Show menu" : "Hide menu"}
        onClick={() => { setCollapsed(value => !value); toggleRef.current?.focus(); }}
      >
        {collapsed ? <ChevronUp size={12} aria-hidden="true" /> : <span className={styles.grip} aria-hidden="true" />}
      </button>
    </div>
  );
}
