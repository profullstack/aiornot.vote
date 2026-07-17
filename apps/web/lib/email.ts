import { env } from "./env";

type SendArgs = { to: string; subject: string; html: string; text?: string };

/**
 * Sends an email via Resend when RESEND_API_KEY is set; otherwise logs the
 * message so local dev flows (like email verification) still work.
 */
export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<void> {
  if (!env.resendApiKey) {
    console.log(
      `\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${text ?? html}\n`,
    );
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.emailFrom, to, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px">Reset your AIorNot.vote password</h1>
      <p>Click below to choose a new password. If you didn't request this, you can ignore this email.</p>
      <p><a href="${resetUrl}" style="background:#FF3D8A;color:#08080C;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Reset password →</a></p>
      <p style="color:#888;font-size:13px">Or paste this link: ${resetUrl}</p>
      <p style="color:#888;font-size:13px">This link expires in ${env.verificationTtlMinutes} minutes.</p>
    </div>`;
  await sendEmail({
    to,
    subject: "Reset your password — AIorNot.vote",
    html,
    text: `Reset your password: ${resetUrl} (expires in ${env.verificationTtlMinutes} minutes)`,
  });
}

export async function sendReferralInviteEmail(
  to: string,
  inviterName: string | null,
  link: string,
): Promise<void> {
  const who = inviterName?.trim() ? inviterName.trim() : "A friend";
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px">${who} invited you to AIorNot.vote 👀</h1>
      <p>Can you tell AI-generated images from real ones? Play the daily game, climb the leaderboard, and win real weekly prizes — it's free.</p>
      <p><a href="${link}" style="background:#FF3D8A;color:#08080C;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Join AIorNot.vote →</a></p>
      <p style="color:#888;font-size:13px">Or paste this link: ${link}</p>
      <p style="color:#888;font-size:13px">You're getting this because someone shared their referral link with you. No account is created until you sign up.</p>
    </div>`;
  await sendEmail({
    to,
    subject: `${who} invited you to AIorNot.vote`,
    html,
    text: `${who} invited you to AIorNot.vote — guess AI vs real and win weekly prizes. Join: ${link}`,
  });
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px">Verify your email for AIorNot.vote</h1>
      <p>Confirm your address to start guessing and appear on the leaderboard.</p>
      <p><a href="${verifyUrl}" style="background:#FF3D8A;color:#08080C;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Verify email →</a></p>
      <p style="color:#888;font-size:13px">Or paste this link: ${verifyUrl}</p>
      <p style="color:#888;font-size:13px">This link expires in ${env.verificationTtlMinutes} minutes.</p>
    </div>`;
  await sendEmail({
    to,
    subject: "Verify your email — AIorNot.vote",
    html,
    text: `Verify your email: ${verifyUrl} (expires in ${env.verificationTtlMinutes} minutes)`,
  });
}
