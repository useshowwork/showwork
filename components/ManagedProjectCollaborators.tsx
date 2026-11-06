"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const COLOR = { blue: "#2478FF", gradient: "linear-gradient(135deg, #2478FF 0%, #0052FF 100%)" };

interface SearchResult {
  id: string;
  name: string | null;
  email: string;
  companyName: string | null;
  avatarUrl: string | null;
}
interface CollaboratorRow {
  id: string;
  creator: { id: string; name: string | null; email: string; avatarUrl: string | null };
}
interface InviteRow {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
}
// A person queued up to be added, before the actual "Add" button is
// pressed — either an existing account (has a real creatorId) or a
// raw email with no account yet (will be sent an invite instead of
// added directly).
interface PendingSelection {
  key: string; // creatorId, or the email itself for a no-account entry
  label: string;
  sublabel: string;
  kind: "existing" | "email";
  creatorId?: string;
  email?: string;
}

export default function ManagedProjectCollaborators({
  managedProjectId,
  isOwner,
}: {
  managedProjectId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selection, setSelection] = useState<PendingSelection[]>([]);
  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const [collabRes, inviteRes] = await Promise.all([
        fetch(`/api/managed-projects/${managedProjectId}/collaborators`),
        fetch(`/api/managed-projects/${managedProjectId}/invites`),
      ]);
      if (collabRes.ok) setCollaborators((await collabRes.json()).collaborators);
      if (inviteRes.ok) setInvites((await inviteRes.json()).invites);
    } finally {
      setLoadingList(false);
    }
  }, [managedProjectId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/creators/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const alreadySelected = (key: string) => selection.some((s) => s.key === key);
  const alreadyOn = (email: string) =>
    collaborators.some((c) => c.creator.email.toLowerCase() === email.toLowerCase()) ||
    invites.some((i) => i.status === "PENDING" && i.email.toLowerCase() === email.toLowerCase());

  const addToSelection = (item: PendingSelection) => {
    if (alreadySelected(item.key) || alreadyOn(item.email || item.sublabel)) return;
    setSelection((prev) => [...prev, item]);
    setQuery("");
    setResults([]);
  };

  const removeFromSelection = (key: string) => {
    setSelection((prev) => prev.filter((s) => s.key !== key));
  };

  const confirmAdd = async () => {
    if (selection.length === 0) return;
    setAdding(true);
    setError(null);
    setSuccess(null);
    let addedCount = 0;
    let invitedCount = 0;
    const failures: string[] = [];

    for (const item of selection) {
      try {
        if (item.kind === "existing") {
          const res = await fetch(`/api/managed-projects/${managedProjectId}/collaborators`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatorId: item.creatorId }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
          addedCount++;
        } else {
          const res = await fetch(`/api/managed-projects/${managedProjectId}/invites`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: item.email }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
          invitedCount++;
        }
      } catch (err) {
        failures.push(item.label);
      }
    }

    const parts: string[] = [];
    if (addedCount > 0) parts.push(`${addedCount} added`);
    if (invitedCount > 0) parts.push(`${invitedCount} invited`);
    if (parts.length > 0) setSuccess(parts.join(", "));
    if (failures.length > 0) setError(`Failed for: ${failures.join(", ")}`);

    setSelection([]);
    setAdding(false);
    loadList();
    router.refresh();
  };

  const cancelInvite = async (inviteId: string) => {
    const res = await fetch(`/api/managed-projects/${managedProjectId}/invites/${inviteId}`, { method: "DELETE" });
    if (res.ok) loadList();
  };

  const removeCollaborator = async (collaboratorId: string) => {
    if (!window.confirm("Remove this person from the project? Tasks already assigned to them stay assigned.")) return;
    const res = await fetch(`/api/managed-projects/${managedProjectId}/collaborators/${collaboratorId}`, { method: "DELETE" });
    if (res.ok) {
      loadList();
      router.refresh();
    }
  };

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());
  const queryMatchesAResult = results.some((r) => r.email.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--managed-surface, #1A1A1A)" }}>
      <p className="mb-1 text-sm font-semibold text-white">Collaborators</p>
      <p className="mb-4 text-xs text-white/40">
        Search for people already on Showwork, or type an email to invite someone new — select as many as
        you need, then add them all at once.
      </p>

      {isOwner && (
        <>
          <div className="relative mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email, or type an email to invite"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/25"
            />

            {(results.length > 0 || (looksLikeEmail && query.trim().length > 2)) && (
              <div
                className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-white/10"
                style={{ background: "var(--managed-soft, #141414)" }}
              >
                {results.map((r) => {
                  const disabled = alreadySelected(r.id) || alreadyOn(r.email);
                  return (
                    <button
                      key={r.id}
                      onClick={() =>
                        addToSelection({
                          key: r.id,
                          label: r.name || r.email,
                          sublabel: r.email,
                          kind: "existing",
                          creatorId: r.id,
                        })
                      }
                      disabled={disabled}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 disabled:cursor-default disabled:opacity-40"
                    >
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white"
                        style={{ background: "rgba(36,120,255,0.2)" }}
                      >
                        {r.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (r.name || r.email)[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{r.name || r.email}</p>
                        <p className="truncate text-xs text-white/40">{r.companyName ? `${r.companyName} · ` : ""}{r.email}</p>
                      </div>
                      {disabled && <span className="ml-auto flex-shrink-0 text-[10px] text-white/30">Already added</span>}
                    </button>
                  );
                })}
                {looksLikeEmail && !queryMatchesAResult && (
                  <button
                    onClick={() =>
                      addToSelection({
                        key: query.trim().toLowerCase(),
                        label: query.trim(),
                        sublabel: "will be invited by email",
                        kind: "email",
                        email: query.trim(),
                      })
                    }
                    disabled={alreadySelected(query.trim().toLowerCase()) || alreadyOn(query.trim())}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 disabled:cursor-default disabled:opacity-40"
                    style={{ borderTop: results.length > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined }}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs" style={{ background: "var(--managed-soft, rgba(255,255,255,0.06))" }}>
                      +
                    </div>
                    <p className="text-sm text-white/80">
                      Invite <strong className="text-white">{query.trim()}</strong> — no account yet
                    </p>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Selected, not-yet-added people — removable chips */}
          {selection.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selection.map((s) => (
                <span
                  key={s.key}
                  className="flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-xs font-medium text-white"
                  style={{ background: s.kind === "email" ? "rgba(255,204,0,0.12)" : "rgba(36,120,255,0.15)" }}
                >
                  {s.label}
                  {s.kind === "email" && <span className="text-[10px] text-white/40">(invite)</span>}
                  <button
                    onClick={() => removeFromSelection(s.key)}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
                    aria-label={`Remove ${s.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {selection.length > 0 && (
            <button
              onClick={confirmAdd}
              disabled={adding}
              className="mb-4 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: COLOR.gradient }}
            >
              {adding ? "Adding..." : `Add ${selection.length} collaborator${selection.length === 1 ? "" : "s"}`}
            </button>
          )}

          {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
          {success && <p className="mb-3 text-xs" style={{ color: "var(--managed-success, #4ade80)" }}>{success}</p>}
        </>
      )}

      {loadingList ? (
        <p className="text-xs text-white/30">Loading...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {collaborators.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--managed-soft, rgba(255,255,255,0.04))" }}>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white"
                  style={{ background: "rgba(36,120,255,0.2)" }}
                >
                  {c.creator.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.creator.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (c.creator.name || c.creator.email)[0]?.toUpperCase()
                  )}
                </div>
                <span className="text-sm text-white/80">{c.creator.name || c.creator.email}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(34,197,94,0.15)", color: "var(--managed-success, #4ade80)" }}>
                  Active
                </span>
              </div>
              {isOwner && (
                <button onClick={() => removeCollaborator(c.id)} className="text-xs text-white/30 transition-colors hover:text-red-400">
                  Remove
                </button>
              )}
            </div>
          ))}
          {invites.filter((i) => i.status === "PENDING").map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--managed-soft, rgba(255,255,255,0.04))" }}>
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-white/60">{i.email}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842" }}>
                  Pending
                </span>
              </div>
              {isOwner && (
                <button onClick={() => cancelInvite(i.id)} className="text-xs text-white/30 transition-colors hover:text-red-400">
                  Cancel
                </button>
              )}
            </div>
          ))}
          {collaborators.length === 0 && invites.filter((i) => i.status === "PENDING").length === 0 && (
            <p className="text-xs text-white/30">No collaborators yet — search or invite someone above.</p>
          )}
        </div>
      )}
    </div>
  );
}