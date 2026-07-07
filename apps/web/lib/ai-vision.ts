import "server-only";
import { env } from "./env";

const MODEL = process.env.AI_VISION_MODEL || "gpt-4o-mini";

const PROMPTS = {
  ai_scan:
    "You are helping a player inspect a photo to decide if it's AI-generated or a real photograph. " +
    "Point out 3-5 specific regions or details worth zooming into (hands, teeth, eyes, ears, jewelry, text/signage, reflections, edges, backgrounds, vehicle geometry, textures). " +
    "Describe what would look 'off' if it were AI. DO NOT state a verdict or say whether it is AI or real. Keep it under 90 words, as a short bulleted list.",
  ai_verdict:
    "You are an expert at spotting AI-generated images. Analyze this photo and give your best judgment: is it AI-generated or a real photograph? " +
    "State your verdict clearly, then give 2-4 concise reasons citing specific visual evidence. Note your confidence. Keep it under 110 words.",
} as const;

export type AnalysisKind = "ai_scan" | "ai_verdict";

function absolutize(url: string): string {
  return url.startsWith("/") ? `${env.appUrl}${url}` : url;
}

/** Run an OpenAI vision analysis of an image. Returns markdown-ish text. */
export async function analyzeImage(imageUrl: string, kind: AnalysisKind): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI analysis is not available right now.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: PROMPTS[kind] },
        {
          role: "user",
          content: [
            { type: "text", text: kind === "ai_verdict" ? "Is this AI or a real photo? Give your verdict and reasons." : "What should I look at to judge this?" },
            { type: "image_url", image_url: { url: absolutize(imageUrl) } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`AI analysis failed (${res.status}): ${(await res.text()).slice(0, 120)}`);
  }
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content?.trim() || "No analysis returned.";
}
