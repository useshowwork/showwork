"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import styles from "./ProjectDashboardTheme.module.css";

export type ProjectTheme = "light" | "dark";
export const PROJECT_THEME_COOKIE = "showwork-projects-theme";
const ThemeContext = createContext<{ theme: ProjectTheme; toggle: () => void } | null>(null);
export function useProjectDashboardTheme() { return useContext(ThemeContext); }
export default function ProjectDashboardTheme({ children, initialTheme = "light" }: { children: ReactNode; initialTheme?: ProjectTheme }) {
  const [theme, setTheme] = useState<ProjectTheme>(initialTheme);
  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try { document.cookie = `${PROJECT_THEME_COOKIE}=${next}; Path=/dashboard/projects; Max-Age=31536000; SameSite=Lax`; }
    catch { /* Theme switching still works when preference storage is blocked. */ }
  }
  return <ThemeContext.Provider value={{ theme, toggle }}>
    <main data-project-theme={theme} className={`${styles.theme} min-h-screen overflow-x-clip bg-[var(--pd-page)] text-[var(--pd-text)]`}>{children}</main>
  </ThemeContext.Provider>;
}
export function ProjectThemeToggle() {
  const context = useProjectDashboardTheme();
  if (!context) return null;
  const dark = context.theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = dark ? Sun : Moon;
  return <button type="button" onClick={context.toggle} aria-label={label} title={label} aria-pressed={dark}
    className="inline-flex h-9 w-9 shrink-0 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-[var(--pd-border)] bg-[var(--pd-surface)] text-[var(--pd-text)] transition hover:bg-[var(--pd-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2478FF]">
    <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
  </button>;
}
