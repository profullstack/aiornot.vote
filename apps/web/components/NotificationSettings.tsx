"use client";
import { useCallback, useEffect, useState } from "react";
import {
  PushError,
  getSubscription,
  pushSupport,
  subscribe,
  unsubscribe,
} from "@profullstack/notifications/client";

type State = "loading" | "unsupported" | "blocked" | "on" | "off";

export function NotificationSettings() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Why push can't work here, as a sentence to show (not HTTPS, iPhone without
  // the site on the Home Screen, no service workers, ...).
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const support = pushSupport();
    if (support.reason === "denied") return setState("blocked");
    if (!support.supported) {
      setUnsupportedReason(support.message);
      return setState("unsupported");
    }
    try {
      setState((await getSubscription()) ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      // Asks permission, fetches the VAPID key from the server at run time (so
      // a build without it can't break push), registers /sw.js if needed, and
      // replaces a subscription made with an old key.
      await subscribe({
        vapidKeyUrl: "/api/push/vapid-public-key",
        serviceWorkerUrl: "/sw.js",
        save: async (subscription) => {
          const save = await fetch("/api/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription }),
          }).then((r) => r.json());
          if (!save.ok) throw new Error(save.error || "Could not save subscription.");
        },
      });
      setState("on");
      setMsg("Notifications enabled 🎉");
    } catch (err) {
      if (err instanceof PushError && err.reason === "denied") {
        // A dismissed prompt leaves the button; an explicit "Block" is blocked.
        const blocked = Notification.permission === "denied";
        setState(blocked ? "blocked" : "off");
        setMsg(blocked ? "Notifications are blocked in your browser settings." : null);
        return;
      }
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const sub = await getSubscription();
      if (sub) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await unsubscribe();
      }
      setState("off");
      setMsg("Notifications turned off.");
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" }).then((r) => r.json());
      setMsg(res.sent > 0 ? "Test sent — check your notifications." : "No active device to notify — try enabling again.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="field" style={{ marginTop: 4 }}>
      <label>Notifications</label>
      <div className="muted-sm" style={{ marginBottom: 10 }}>
        Get a ping when it&apos;s time to play, your streak is cooling, or fresh rounds drop.
      </div>

      {state === "loading" && <div className="muted-sm">Checking…</div>}

      {state === "unsupported" && (
        <div className="muted-sm">{unsupportedReason ?? "This browser doesn’t support web notifications."}</div>
      )}

      {state === "blocked" && (
        <div className="notice warn" style={{ margin: 0 }}>
          Notifications are blocked. Enable them for aiornot.vote in your browser&apos;s site settings, then reload.
        </div>
      )}

      {(state === "on" || state === "off") && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {state === "on" ? (
            <>
              <span className="badge-featured" style={{ position: "static" }}>On</span>
              <button className="btn btn-sm" disabled={busy} onClick={sendTest}>Send test</button>
              <button className="btn btn-sm" disabled={busy} onClick={disable}>Turn off</button>
            </>
          ) : (
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={enable}>
              {busy ? "…" : "Enable notifications"}
            </button>
          )}
        </div>
      )}

      {msg && <div className="muted-sm" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
