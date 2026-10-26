"use client";

import { useState } from "react";
import { ProfileFields } from "@profullstack/profile/react";

/** The shared profile fields (@profullstack/profile), minus the account email shown above. */
const FIELDS = ["first_name", "last_name", "company_domain", "job_title", "linkedin_url"] as const;

export function ContactSettings({ initial }: { initial: Record<string, string | null> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/v1/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(FIELDS.map((name) => [name, fd.get(name) || null]))),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save your details.");
        if (data.errors) setErrors(data.errors);
        return;
      }
      setSaved(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <ProfileFields fields={FIELDS} defaultValues={initial} errors={errors} idPrefix="settings-" />
      <div className="muted-sm">Private to your account; never shown on leaderboards.</div>
      {error && <div className="form-error">{error}</div>}
      {saved && <div className="form-ok">Details saved.</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
