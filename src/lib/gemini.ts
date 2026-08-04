import "server-only";

/**
 * Thin Gemini client. Server-only — the key is never exposed to the browser.
 *
 * Uses the `gemini-flash-latest` alias rather than a pinned version: Google
 * retires specific model ids (1.5 Flash now 404s), and a resume-facing app
 * shouldn't break when that happens.
 */
const MODEL = "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export type CoachingBrief = {
  splitName: string;
  goal: string;
  equipment: string;
  daysPerWeek: number;
  weeksTrained: number;
  workoutsLast30: number;
  totalVolume: number;
  unit: string;
  /** Exercises whose top set hasn't moved in several sessions. */
  stalled: string[];
  /** Muscles the current template never trains directly. */
  gaps: string[];
  recentPRs: string[];
};

export type Recommendation = {
  headline: string;
  points: string[];
};

/**
 * Asks Gemini for a short coaching note grounded in the user's own numbers.
 *
 * Everything factual in the prompt is computed by the app, not the model —
 * the model only phrases it. That keeps the advice tied to real logged data
 * instead of inviting it to invent training history.
 */
export async function getRecommendation(
  brief: CoachingBrief,
  signal?: AbortSignal,
): Promise<Recommendation | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const prompt = buildPrompt(brief);

  const res = await fetch(`${ENDPOINT}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            headline: { type: "STRING" },
            points: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["headline", "points"],
        },
      },
    }),
  });

  if (!res.ok) {
    console.error("Gemini request failed", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");

  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as Recommendation;
    if (!parsed.headline || !Array.isArray(parsed.points)) return null;
    // Trim to keep the card readable regardless of what comes back.
    return { headline: parsed.headline, points: parsed.points.slice(0, 4) };
  } catch {
    console.error("Gemini returned unparseable JSON");
    return null;
  }
}

function buildPrompt(b: CoachingBrief): string {
  const facts = [
    `Split: ${b.splitName} (${b.daysPerWeek} days/week)`,
    `Goal: ${b.goal}`,
    `Equipment available: ${b.equipment}`,
    `Weeks training: ${b.weeksTrained}`,
    `Sessions in the last 30 days: ${b.workoutsLast30}`,
    `Total volume logged: ${Math.round(b.totalVolume).toLocaleString()} ${b.unit}`,
    b.recentPRs.length
      ? `Recent personal records: ${b.recentPRs.join(", ")}`
      : "No personal records in the last month",
    b.stalled.length
      ? `Lifts that have stalled: ${b.stalled.join(", ")}`
      : "Nothing has stalled",
    b.gaps.length
      ? `Muscles the routine never trains directly: ${b.gaps.join(", ")}`
      : "The routine covers every muscle it should",
  ].join("\n");

  return `You are an experienced strength coach. Review this lifter's data and
tell them what to actually DO next.

${facts}

Write 3 to 4 points.

What makes a point good:
- It tells them something they could NOT have read off the numbers themselves.
- It names a concrete action: a specific rep range, a percentage to drop to,
  a variation to swap in, a number of sessions, a tempo or rest change.

What makes a point useless — never write these:
- Restating the data back ("You logged 12 sessions", "You have trained 10 weeks").
- Praise or encouragement with no instruction ("Great consistency", "Keep it up").
- "Keep doing what you're doing" or "maintain your current routine" in any form.
- Vague verbs with no method: "modify", "adjust", "optimise", "focus on",
  "consider improving" — say exactly what to change and to what.

Priorities, in order:
1. A stalled lift is the most important thing to address. Give a real tactic —
   for example: drop to roughly 90% of the stalling weight and build back over
   three sessions; move it to the start of the session when fresh; swap to a
   close variation for a block; or add a second lighter exercise for the same
   muscle later in the week. Pick ONE and be specific.
2. A muscle with no direct work needs a named fix, not a note that it's missing.
3. Only then, anything about volume or frequency — and only if you can say
   something non-obvious about it.

Constraints:
- Use ONLY the facts above. Never invent exercises, weights, or sessions that
  are not listed.
- One sentence per point. Direct and warm. No emoji, no hype.
- Headline: at most 8 words, and not a summary of the stats.
- Respond as JSON: {"headline": string, "points": string[]}`;
}
