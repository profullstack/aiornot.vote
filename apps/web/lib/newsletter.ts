import "server-only";
import { sqlClient } from "./db";
import { sendEmail } from "./email";

export type GeneratedNewsletter = { subject: string; html: string };

/** Ask OpenAI to draft a newsletter from an admin prompt. Returns subject + HTML body. */
export async function generateNewsletter(prompt: string): Promise<GeneratedNewsletter> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const clean = prompt.trim().slice(0, 2000);
  if (!clean) throw new Error("Enter a prompt.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write email newsletters for AIorNot.vote — a game where people guess whether a photo/video/post is AI-generated or real. " +
            "Voice: sharp, playful, a little irreverent, concise. Return ONLY a JSON object: " +
            '{"subject": string (<=70 chars, no emoji spam), "html": string}. ' +
            "The html is the EMAIL BODY ONLY (no <html>/<head>/<body> tags). Use simple inline-friendly tags: " +
            "<h2>, <p>, <ul><li>, <a href>. Keep it short (120-220 words). Always end with a clear CTA linking to https://aiornot.vote/play .",
        },
        { role: "user", content: clean },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Newsletter generation failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices[0]?.message?.content ?? "{}";
  let parsed: GeneratedNewsletter;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Model returned invalid JSON.");
  }
  if (!parsed.subject || !parsed.html) throw new Error("Model omitted subject or html.");
  return { subject: parsed.subject.slice(0, 120), html: parsed.html };
}

export async function countActiveRecipients(): Promise<number> {
  const r = await sqlClient.execute(
    "SELECT COUNT(*) c FROM users WHERE status = 'active' AND email_verified_at IS NOT NULL",
  );
  return Number(r.rows[0]?.c ?? 0);
}

const FOOTER =
  '<hr style="margin:24px 0;border:none;border-top:1px solid #333"><p style="font-size:12px;color:#888">' +
  'You\'re getting this because you have a verified AIorNot.vote account. ' +
  '<a href="https://aiornot.vote">aiornot.vote</a> · © Profullstack, Inc.</p>';

/**
 * Send the newsletter to every active, verified user. Best-effort with small
 * concurrency; individual failures are counted, not fatal.
 */
export async function sendNewsletterToAll(subject: string, html: string): Promise<{ sent: number; failed: number; total: number }> {
  const r = await sqlClient.execute(
    "SELECT email FROM users WHERE status = 'active' AND email_verified_at IS NOT NULL",
  );
  const emails = r.rows.map((x) => x.email as string).filter(Boolean);
  const body = html + FOOTER;
  let sent = 0;
  let failed = 0;

  const CONCURRENCY = 4;
  for (let i = 0; i < emails.length; i += CONCURRENCY) {
    const chunk = emails.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((to) =>
        sendEmail({ to, subject, html: body, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }),
      ),
    );
    for (const res of results) (res.status === "fulfilled" ? sent++ : failed++);
  }
  return { sent, failed, total: emails.length };
}
