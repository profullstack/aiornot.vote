"use client";
import { useCallback, useEffect, useState } from "react";

function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return buffer;
}

type State = "loading" | "unsupported" | "blocked" | "on" | "off";

export function NotificationSettings() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const refresh = useCallback(async () => {
    if (!supported) return setState("unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setState(sub ? "on" : "off");
    } catch {
      setState("off");
    }
  }, [supported]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "blocked" : "off");
        setMsg(perm === "denied" ? "Notifications are blocked in your browser settings." : null);
        return;
      }
      const keyRes = await fetch("/api/notifications/vapid").then((r) => r.json());
      if (!keyRes.publicKey) throw new Error("Push isn't configured on the server yet.");
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBuffer(keyRes.publicKey),
        });
      }
      const save = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      }).then((r) => r.json());
      if (!save.ok) throw new Error(save.error || "Could not save subscription.");
      setState("on");
      setMsg("Notifications enabled 🎉");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
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
        <div className="muted-sm">This browser doesn&apos;t support web notifications.</div>
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
