"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/profile";

export function ProfileSettings({ initialDisplayName }: { initialDisplayName: string | null }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not update your profile.");
        return;
      }
      setDisplayName(data.displayName || "");
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <div className="field">
        <label htmlFor="displayName">Display name</label>
        <input
          id="displayName"
          name="displayName"
          value={displayName}
          autoComplete="nickname"
          placeholder="How you appear on leaderboards"
          onChange={(e) => {
            setDisplayName(e.target.value);
            setSaved(false);
          }}
        />
        <div className="muted-sm">
          Up to {DISPLAY_NAME_MAX_LENGTH} characters. Leave blank to use the default “Player” name.
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      {saved && <div className="form-ok">Display name saved.</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save display name"}
      </button>
    </form>
  );
}
