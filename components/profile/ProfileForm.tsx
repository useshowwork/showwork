"use client";

import IdentityImageEditor from "@/components/identity/IdentityImageEditor";

import UiSymbol from "@/components/ui/UiSymbol";
import { useState } from "react";
import { useRouter } from "next/navigation";

const COLOR = { gold: "#F5C842", black: "#0A0A0A" };

export default function ProfileForm({
  name,
  phone,
  companyName,
  email,
  emailVerified,
  avatarUrl,
}: {
  name: string | null;
  phone: string | null;
  companyName: string | null;
  email: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  initialsFallback: string;
}) {
  const router = useRouter();
  const [nameInput, setNameInput] = useState(name ?? "");
  const [phoneInput, setPhoneInput] = useState(phone ?? "");
  const [companyNameInput, setCompanyNameInput] = useState(companyName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput, phone: phoneInput, companyName: companyNameInput }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
      setSaving(false);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-white p-4">
        <IdentityImageEditor endpoint="/api/account/avatar" name={nameInput || email} src={avatarUrl} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
          Display name
        </label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          style={{ fontSize: "16px" }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
          Company name <span className="normal-case text-white/25">(optional)</span>
        </label>
        <input
          type="text"
          value={companyNameInput}
          onChange={(e) => setCompanyNameInput(e.target.value)}
          placeholder="e.g. Ada Obi Studios"
          style={{ fontSize: "16px" }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
          Email
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-sm text-white/60">{email}</span>
          {emailVerified && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}><>{" "}<UiSymbol name="check" />{" Verified "}</></span>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-white/40" style={{ letterSpacing: "0.08em" }}>
          Phone number
        </label>
        <input
          type="tel"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          placeholder="+2348012345678"
          style={{ fontSize: "16px" }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-fit rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        style={{ background: COLOR.gold, color: COLOR.black }}
      >
        {saving ? "Saving..." : saved ? <>{"Saved "}<UiSymbol name="check" /></> : "Save changes"}
      </button>
    </div>
  );
}
