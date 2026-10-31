"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProfileFields } from "@profullstack/profile/react";
import { internalReturnPath } from "@/lib/internal-return-path";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/profile";
import { looksLikeInvite } from "@/lib/invite-code";

/** The shared profile fields beside the form's own email box (@profullstack/profile). */
const SIGNUP_PROFILE_FIELDS = ["first_name", "last_name", "company_domain", "job_title", "linkedin_url"] as const;

/** What the CoinPay callback's ?coinpay_error= codes mean, said to a person. */
export const COINPAY_ERRORS: Record<string, string> = {
  not_configured: "Sign in with CoinPay is not available right now.",
  rate_limited: "Too many attempts. Try again in a few minutes.",
  sign_in_first: "Sign in to this account first, then connect CoinPay from Settings.",
  bad_state: "That CoinPay sign-in expired or did not start here. Try again.",
  denied: "CoinPay sign-in was cancelled.",
  bad_request: "CoinPay sign-in failed. Try again.",
  exchange_failed: "CoinPay sign-in failed. Try again.",
  linked_elsewhere: "That CoinPay account is already connected to another AIorNot account.",
  already_linked: "This account already has a CoinPay account connected. Disconnect it first.",
  unavailable: "This account is not available.",
};

/**
 * Sign in with CoinPay: first on sign-in and sign-up. One CoinPay account signs
 * in across every Profullstack site; it binds to the CoinPay account itself,
 * never to an email address.
 */
export function CoinPayButton() {
  const searchParams = useSearchParams();
  const code = searchParams.get("coinpay_error");
  return (
    <div style={{ marginBottom: 16 }}>
      <a className="btn btn-primary" href="/api/v1/coinpay/oauth/start" style={{ display: "block", textAlign: "center" }}>
        Sign in with CoinPay
      </a>
      {code && <div className="form-error" style={{ marginTop: 8 }}>{COINPAY_ERRORS[code] ?? "CoinPay sign-in failed. Try again."}</div>}
      <p className="muted-sm" style={{ textAlign: "center", margin: "12px 0 0" }}>or use your email</p>
    </div>
  );
}

export function SignupForm({ coinpay = false }: { coinpay?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = (searchParams.get("ref") || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
  // An invite from /i/<code>; also kept in a cookie, and held on the account
  // server side so the verification link counts in any browser.
  const rawInvite = (searchParams.get("invite") || "").slice(0, 24);
  const invite = looksLikeInvite(rawInvite) ? rawInvite : "";
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          password: fd.get("password"),
          displayName: fd.get("displayName"),
          ...Object.fromEntries(SIGNUP_PROFILE_FIELDS.map((name) => [name, fd.get(name)])),
          ref: ref || undefined,
          invite: invite || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Could not create account.");
        if (data.errors) setFieldErrors(data.errors);
        return;
      }
      router.push("/account?welcome=1");
      router.refresh();
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card container-narrow">
      <h1>Create your account</h1>
      <p className="muted">Verify your email to guess, upload, and appear on the leaderboard.</p>
      {invite && (
        <div className="form-ok" style={{ marginBottom: 12 }}>
          🎟️ You&apos;re signing up on an invite. Verify your email and you both get days of the photo library.
        </div>
      )}
      {ref && !invite && (
        <div className="form-ok" style={{ marginBottom: 12 }}>
          🎁 A friend invited you! Verify your email after signing up and they&apos;ll earn a prize.
        </div>
      )}
      {coinpay && <CoinPayButton />}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            name="displayName"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            placeholder="How you appear on leaderboards"
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <ProfileFields fields={SIGNUP_PROFILE_FIELDS} errors={fieldErrors} />
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="muted-sm" style={{ marginTop: 16 }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}

function CoinPayAccountChooser() {
  const router = useRouter();
  const [choices, setChoices] = useState<Array<{ userId: string; label: string }>>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/coinpay/oauth/choices", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error("That account choice expired. Sign in with CoinPay again.");
        setChoices(data.choices);
      })
      .catch((error) => setErr(error instanceof Error ? error.message : "Could not load your accounts."));
  }, []);

  async function choose(userId: string) {
    setBusyId(userId);
    setErr(null);
    try {
      const res = await fetch("/api/v1/coinpay/oauth/choices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error === "choice_expired" ? "That account choice expired. Sign in with CoinPay again." : "Could not sign in to that account.");
      router.push("/account");
      router.refresh();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Network error — please try again.");
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Choose your account</h1>
      <p className="muted">This CoinPay account is connected to more than one AIorNot account.</p>
      {choices.map((choice) => (
        <button key={choice.userId} className="btn btn-primary" type="button" onClick={() => choose(choice.userId)} disabled={busyId !== null} style={{ display: "block", width: "100%", marginTop: 10 }}>
          {busyId === choice.userId ? "Signing in…" : choice.label}
        </button>
      ))}
      {err && <div className="form-error" style={{ marginTop: 12 }}>{err}</div>}
      <p className="muted-sm" style={{ marginTop: 16 }}><Link href="/login">Use email and password</Link></p>
    </div>
  );
}

export function LoginForm({ coinpay = false, coinpayChoose = false }: { coinpay?: boolean; coinpayChoose?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = internalReturnPath(searchParams.get("next"));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Could not sign in.");
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card container-narrow">
      {coinpayChoose ? <CoinPayAccountChooser /> : <>
      <h1>Sign in</h1>
      {coinpay && <CoinPayButton />}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="muted-sm" style={{ marginTop: 16 }}>
        New here? <Link href="/signup">Create an account</Link>
        {" · "}
        <Link href="/forgot-password">Forgot password?</Link>
      </p>
      </>}
    </div>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email") }),
      });
      setSent(true);
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card container-narrow">
      <h1>Reset your password</h1>
      {sent ? (
        <>
          <div className="form-ok">
            If an account exists for that email, a reset link is on its way. Check your inbox and spam.
          </div>
          <p className="muted-sm" style={{ marginTop: 16 }}>
            <Link href="/login">Back to sign in</Link>
          </p>
        </>
      ) : (
        <>
          <p className="muted">Enter your email and we&apos;ll send a link to set a new password.</p>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            {err && <div className="form-error">{err}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
          <p className="muted-sm" style={{ marginTop: 16 }}>
            Remembered it? <Link href="/login">Sign in</Link>
          </p>
        </>
      )}
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    if (password !== String(fd.get("confirm") || "")) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Could not reset password.");
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card container-narrow">
      <h1>Choose a new password</h1>
      {!token ? (
        <div className="form-error">
          Missing reset token. Request a new link from <Link href="/forgot-password">forgot password</Link>.
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          {err && <div className="form-error">{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Set new password"}
          </button>
        </form>
      )}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

/** Settings: Connect / Disconnect CoinPay. */
export function CoinPaySettings({ linked, hasPassword }: { linked: boolean; hasPassword: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("coinpay_error");
  const [err, setErr] = useState<string | null>(code ? (COINPAY_ERRORS[code] ?? "CoinPay failed. Try again.") : null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="field">
      <label>CoinPay</label>
      {searchParams.get("coinpay") === "linked" && (
        <div className="form-ok" style={{ marginBottom: 8 }}>CoinPay connected. You can sign in with it from now on.</div>
      )}
      {linked ? (
        hasPassword ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="muted-sm">Connected: you can sign in here with CoinPay.</span>
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                const res = await fetch("/api/v1/coinpay/disconnect", { method: "POST" });
                const data = await res.json().catch(() => ({}));
                setBusy(false);
                if (!res.ok || !data.ok) setErr(data.error || "Could not disconnect.");
                else router.refresh();
              }}
            >
              Disconnect CoinPay
            </button>
          </div>
        ) : (
          <div className="muted-sm">
            This account was made with CoinPay, which is its only way in, so it cannot be disconnected.
          </div>
        )
      ) : (
        <a className="btn btn-sm" href="/api/v1/coinpay/oauth/start?mode=link">
          Connect CoinPay
        </a>
      )}
      {err && <div className="form-error" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

export function ResendVerification() {
  const [sent, setSent] = useState(false);
  return (
    <button
      className="btn btn-sm"
      disabled={sent}
      onClick={async () => {
        await fetch("/api/auth/resend-verification", { method: "POST" });
        setSent(true);
      }}
    >
      {sent ? "Verification sent ✓" : "Resend verification email"}
    </button>
  );
}
