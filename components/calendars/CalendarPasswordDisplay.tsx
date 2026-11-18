"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LockKeyhole } from "lucide-react";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import styles from "./ClientSharingPanel.module.css";

export default function CalendarPasswordDisplay({ calendarId, accessCode, canManage = true, onPasswordChange }: {
  calendarId: string;
  accessCode: string;
  canManage?: boolean;
  onPasswordChange: (password: string) => void;
}) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [showChange, setShowChange] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    setStatus("");
    try {
      await navigator.clipboard.writeText(accessCode);
      setStatus("Password copied");
    } catch {
      input.current?.focus();
      setError("Select the password and copy it manually.");
    }
  }

  async function updatePassword(action: "regenerate_password" | "set_password") {
    if (loading || !canManage) return;
    if (action === "set_password" && !customPassword.trim()) {
      setError("Enter a password first.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("");
    try {
      const response = await calendarMutationFetch(`/api/calendars/${calendarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "set_password" ? { action, password: customPassword } : { action }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.newPassword !== "string") {
        throw new Error(result.error || "Couldn’t update the password. Try again.");
      }
      onPasswordChange(result.newPassword);
      setShowChange(false);
      setCustomPassword("");
      setStatus("Password updated");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t update the password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.credential} data-password-display>
      <label htmlFor={id} className={styles.label}><LockKeyhole size={16} aria-hidden="true" /> Client password</label>
      <div className={styles.field}>
        <input ref={input} id={id} className={styles.password} type="text" readOnly value={accessCode} placeholder="No password set" onFocus={(event) => event.currentTarget.select()} />
        <button type="button" className={styles.copy} data-copied={status === "Password copied"} disabled={!accessCode || loading} onClick={() => void copy()}>
          {status === "Password copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {status === "Password copied" ? "Password copied" : "Copy password"}
        </button>
      </div>
      {canManage && (
        <button type="button" className={styles.change} aria-expanded={showChange} aria-controls={`${id}-change`} disabled={loading}
          onClick={() => { setShowChange((previous) => !previous); setError(""); setStatus(""); }}>
          {showChange ? "Cancel change" : accessCode ? "Change password" : "Set password"}
        </button>
      )}
      {showChange && (
        <div id={`${id}-change`} className={styles.passwordEdit}>
          <div className={styles.field}>
            <input type="text" value={customPassword} onChange={(event) => setCustomPassword(event.target.value)}
              placeholder="New password" aria-label="New client password" autoComplete="new-password" />
            <button type="button" className={styles.copy} disabled={loading} onClick={() => void updatePassword("set_password")}>Save</button>
          </div>
          <button type="button" className={styles.change} disabled={loading} onClick={() => void updatePassword("regenerate_password")}>
            {loading ? "Updating…" : "Generate password"}
          </button>
        </div>
      )}
      <span role="status" className="sr-only">{status}</span>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
  );
}
