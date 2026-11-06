"use client";

import styles from "./projects/ProjectDeliveryDashboard.module.css";
import UiSymbol from "@/components/ui/UiSymbol";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import DeleteProjectButton from "@/components/DeleteProjectButton";

const COLOR = {
  blue: "#2478FF",
  accent: "var(--pd-accent, #FFCC00)",
  charcoal: "var(--pd-surface, #1A1A1A)",
  midGray: "var(--pd-subtle, #888786)",
};

interface OwnedProject {
  id: string;
  clientName: string;
  slug: string;
  createdAt: string;
  viewCount: number;
  _count: { media: number; viewerEmails: number };
}

interface SharedProject {
  id: string;
  clientName: string;
  createdAt: string;
  creator: { name: string | null; email: string };
  _count: { media: number };
}

interface DashboardData {
  ownedProjects: OwnedProject[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  sharedProjects: SharedProject[];
  hasMoreShared: boolean;
}

function IconSearch({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function relativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
}

// Live, as-you-type project search — the server component still
// renders the very first paint (passed in as initialData, so there's
// no loading flash on page load), but every search keystroke and
// every pagination click after that happens here, client-side,
// against /api/dashboard/projects, without a full page reload.
export default function DashboardProjectList({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);

  const fetchData = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/projects?q=${encodeURIComponent(q)}&page=${p}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced on every query change — 300ms after typing stops, not
  // on every keystroke. Skips the very first render entirely, since
  // that data already arrived as initialData from the server.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1); // a new search term always starts back at page 1
      fetchData(query, 1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const goToPage = (p: number) => {
    setPage(p);
    fetchData(query, p);
  };

  const { ownedProjects, totalCount, totalPages, currentPage, sharedProjects, hasMoreShared } = data;

  return (
    <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.15s ease" }}>
      {/* SEARCH */}
      <div className="relative mb-6 max-w-md">
        <IconSearch
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--pd-subtle)" }}
        />
        <input
          type="search"
          aria-label="Search projects by client name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your projects by client name"
          className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm text-[var(--pd-text)] outline-none transition-colors placeholder:text-[var(--pd-faint)] focus:border-[#2478FF]"
          style={{ background: COLOR.charcoal, border: "1px solid var(--pd-border)" }}
        />
      </div>

      {totalCount === 0 && sharedProjects.length === 0 && !query ? (
        <div className="flex flex-col items-center gap-4 rounded-xl px-8 py-20 text-center" style={{ background: COLOR.charcoal }}>
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(36,120,255,0.12)", border: "1px solid rgba(36,120,255,0.3)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke={COLOR.blue} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--pd-text)]">No projects yet</p>
            <p className="mt-1 max-w-xs text-sm font-normal text-[var(--pd-muted)]">
              Every client delivery you create will show up here, ready to send.
            </p>
          </div>
          <Link
            href="/dashboard/start"
            className="mt-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)" }}
          >
            Create your first project
          </Link>
        </div>
      ) : totalCount === 0 && sharedProjects.length === 0 && query ? (
        <div className="rounded-xl p-10 text-center text-sm text-[var(--pd-subtle)]" style={{ background: COLOR.charcoal }}>
          No projects match &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <>
          {totalCount > 0 && (
            <>
              <div className="mb-5 flex flex-col gap-2">
                <div className="flex items-center gap-3">

                  <h2 className="text-lg font-semibold text-[var(--pd-text)]">Your projects</h2>
                </div>
                <p className="text-sm text-[var(--pd-subtle)]">
                  Choose a project to continue.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ownedProjects.map((project) => (
                  <article
                    key={project.id}
                    className={`${styles.projectCard} group relative flex flex-col gap-4 rounded-xl p-6 transition-all duration-300 hover:-translate-y-0.5`}
                    style={{ background: COLOR.charcoal, boxShadow: "0 0 0 1px var(--pd-border)" }}
                  >
                    <Link href={`/dashboard/${project.id}`} aria-label={`Open ${project.clientName}`} className={styles.projectCardLink} />
                    <DeleteProjectButton projectId={project.id} clientName={project.clientName} />

                    <div className="flex items-start justify-between">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ background: "rgba(36,120,255,0.15)", color: COLOR.blue }}
                      >
                        Delivery
                      </span>
                    </div>

                    <div>
                      <p className="text-lg font-semibold text-[var(--pd-text)]">{project.clientName}</p>
                      <p className="mt-0.5 text-xs font-normal" style={{ color: COLOR.midGray }}>
                        /{project.slug}
                      </p>
                    </div>

                    <div
                      className="flex items-center justify-between pt-3 text-xs font-normal"
                      style={{ borderTop: "1px solid var(--pd-border)", color: COLOR.midGray }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <rect x="1.5" y="2" width="9" height="8" rx="1" stroke={COLOR.midGray} strokeWidth="1" />
                            <path d="M1.5 7.5L4 5l2 2 2.5-2.5L10.5 7" stroke={COLOR.midGray} strokeWidth="1" />
                          </svg>
                          {project._count.media}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M1 6s1.8-3.5 5-3.5S11 6 11 6s-1.8 3.5-5 3.5S1 6 1 6z" stroke={COLOR.midGray} strokeWidth="1" />
                            <circle cx="6" cy="6" r="1.4" stroke={COLOR.midGray} strokeWidth="1" />
                          </svg>
                          {project.viewCount}
                        </span>
                      </div>
                      <span>{relativeTime(project.createdAt)}</span>
                    </div>

                    <div
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold"
                      style={{ background: "rgba(36,120,255,0.1)", color: COLOR.blue }}
                    >
                      Open project
                      <span className="transition-transform group-hover:translate-x-0.5" aria-hidden><><UiSymbol name="right" /></></span>
                    </div>
                  </article>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-between">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                    style={
                      currentPage <= 1
                        ? { background: "var(--pd-soft)", color: "var(--pd-faint)" }
                        : { background: COLOR.charcoal, color: "var(--pd-text)" }
                    }
                  ><>{" "}<UiSymbol name="left" />{" Previous "}</></button>

                  <span className="text-sm text-[var(--pd-subtle)]">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                    style={
                      currentPage >= totalPages
                        ? { background: "var(--pd-soft)", color: "var(--pd-faint)" }
                        : { background: COLOR.charcoal, color: "var(--pd-text)" }
                    }
                  ><>{" Next "}<UiSymbol name="right" />{" "}</></button>
                </div>
              )}
            </>
          )}

          {sharedProjects.length > 0 && (
            <div className={totalCount > 0 ? "mt-14" : ""}>
              <div className="mb-5 flex flex-col gap-2">
                <div className="flex items-center gap-3">

                  <h2 className="text-lg font-semibold text-[var(--pd-text)]">Shared with you</h2>
                </div>
                <p className="text-sm text-[var(--pd-subtle)]">
                  Projects other creators have invited you to collaborate on.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sharedProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/${project.id}`}
                    className="group relative flex flex-col gap-4 rounded-xl p-6 transition-all duration-300 hover:-translate-y-0.5"
                    style={{ background: COLOR.charcoal, boxShadow: "0 0 0 1px rgba(36,120,255,0.1)" }}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ background: "rgba(255,204,0,0.12)", color: COLOR.accent }}
                      >
                        Collaborator
                      </span>
                    </div>

                    <div>
                      <p className="text-lg font-semibold text-[var(--pd-text)]">{project.clientName}</p>
                      <p className="mt-0.5 text-xs font-normal" style={{ color: COLOR.midGray }}>
                        Owned by {project.creator.name || project.creator.email}
                      </p>
                    </div>

                    <div
                      className="flex items-center justify-between pt-3 text-xs font-normal"
                      style={{ borderTop: "1px solid var(--pd-border)", color: COLOR.midGray }}
                    >
                      <span className="flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <rect x="1.5" y="2" width="9" height="8" rx="1" stroke={COLOR.midGray} strokeWidth="1" />
                          <path d="M1.5 7.5L4 5l2 2 2.5-2.5L10.5 7" stroke={COLOR.midGray} strokeWidth="1" />
                        </svg>
                        {project._count.media}
                      </span>
                      <span>{relativeTime(project.createdAt)}</span>
                    </div>

                    <div
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold"
                      style={{ background: "rgba(36,120,255,0.1)", color: COLOR.blue }}
                    >
                      Open project
                      <span className="transition-transform group-hover:translate-x-0.5" aria-hidden><><UiSymbol name="right" /></></span>
                    </div>
                  </Link>
                ))}
              </div>

              {hasMoreShared && (
                <p className="mt-4 text-xs text-[var(--pd-subtle)]">
                  Showing the most recent — you&apos;re on more than that.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
