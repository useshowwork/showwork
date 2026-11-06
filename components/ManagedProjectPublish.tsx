"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const COLOR = { blue: "#2478FF", gradient: "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)" };

// A soft glowing send-icon badge, the same "glow" visual language
// used elsewhere in this app for icon treatments — gives the modal a
// real focal point instead of opening straight into a wall of text.
function PublishIcon() {
  return (
    <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: COLOR.blue, opacity: 0.18, filter: "blur(14px)" }}
        aria-hidden
      />
      <div
        className="relative flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "rgba(36,120,255,0.12)", border: "1px solid rgba(36,120,255,0.3)" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M20.5 3.5L10 13.5M20.5 3.5L14 20.5l-4-7-7-4 17.5-6Z" stroke={COLOR.blue} strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" className="mt-0.5 flex-shrink-0">
      <circle cx="7" cy="7" r="6.5" stroke="#2478FF" strokeWidth="1.3" />
      <path d="M4.5 7.2l1.7 1.7L9.7 5" stroke="#2478FF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Owner-only: publish approved task work to the client portal. Every
// managed project already has its own delivery from the moment it
// was created — there's no linking step anymore, just publish.
export default function ManagedProjectPublish({
  managedProjectId,
  publishedAt,
}: {
  managedProjectId: string;
  publishedAt: string | null;
}) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  const publish = async () => {
    setPublishing(true);
    setError(null);
    setPublishResult(null);
    try {
      const res = await fetch(`/api/managed-projects/${managedProjectId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to publish");
      setPublishResult(`Published ${data.publishedCount} file${data.publishedCount === 1 ? "" : "s"} to the client.`);
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--managed-surface, #1A1A1A)" }}>
      <p className="mb-4 text-sm font-semibold text-white">Publish to client</p>

      <div className="flex flex-col gap-4">
        {publishedAt ? (
          <p className="text-xs" style={{ color: "var(--managed-success, #4ade80)" }}>
            Published {new Date(publishedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} —
            the client portal now shows the finished files.
          </p>
        ) : (
          <p className="text-xs text-white/40">
            Before publishing, the client portal shows task progress. Once you publish, it switches to showing
            every approved file.
          </p>
        )}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={publishing}
          className="w-fit rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
          style={{ background: COLOR.gradient }}
        >
          {publishedAt ? "Publish new approved work" : "Publish to client"}
        </button>
        <p className="text-xs text-white/30">
          Publishing gives your client access to the approved files immediately.
        </p>
        {publishResult && <p className="text-xs" style={{ color: "var(--managed-success, #4ade80)" }}>{publishResult}</p>}
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      {/* A proper modal instead of a browser confirm() — a real focal
          icon, clear visual hierarchy between the primary and
          secondary action, and copy that's explicit about the two
          things that actually matter here: the client gets real
          access the moment this is confirmed, and clicking it is a
          statement that the work is done. Cancel is styled as a
          genuine, easy option, not an afterthought — someone who
          isn't actually finished should feel just as comfortable
          choosing it as publishing. */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-6 backdrop-blur-sm"
            onClick={() => !publishing && setShowConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-2xl"
              style={{ background: "var(--managed-surface, #161616)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
            >
              <div className="px-7 pt-8 text-center">
                <PublishIcon />
                <p className="mb-2 text-xs font-semibold uppercase" style={{ color: COLOR.blue, letterSpacing: "0.12em" }}>
                  {publishedAt ? "Publish new work" : "Before you publish"}
                </p>
                <h2 className="mb-6 text-xl font-bold leading-snug text-white">
                  {publishedAt ? "Send this new approved work to your client" : "Your client gets access the moment you confirm"}
                </h2>
              </div>

              <div className="px-7">
                <div className="flex flex-col gap-3.5 rounded-xl p-4" style={{ background: "var(--managed-soft, rgba(255,255,255,0.03))" }}>
                  <div className="flex items-start gap-2.5">
                    <CheckIcon />
                    <p className="text-sm leading-relaxed text-white/70">
                      Your client will be able to <strong className="text-white">open and view every approved file</strong> immediately — this replaces the progress view they&apos;ve been looking at.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckIcon />
                    <p className="text-sm leading-relaxed text-white/70">
                      Publishing is how you tell your client <strong className="text-white">the project is complete</strong>. If it isn&apos;t finished yet, select Cancel below and keep working on it — you can publish whenever you&apos;re actually ready.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckIcon />
                    <p className="text-sm leading-relaxed text-white/70">
                      Files are organized by task — each task&apos;s title becomes a section your client sees on their page.
                    </p>
                  </div>
                </div>

                {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
              </div>

              <div className="mt-7 flex flex-col gap-2.5 border-t border-white/10 p-5">
                <button
                  onClick={publish}
                  disabled={publishing}
                  className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-50"
                  style={{ background: COLOR.gradient }}
                >
                  {publishing ? "Publishing..." : "Yes — the project is complete, publish it"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={publishing}
                  className="w-full rounded-lg py-3 text-sm font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                >
                  Not yet — keep managing this project
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}