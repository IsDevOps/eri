/** Minimal OpenAI client (no SDK): chat completions in JSON mode, with optional image input. Used when only OPENAI_API_KEY is set. */
export const openaiEnabled = (): boolean => Boolean(process.env.OPENAI_API_KEY);
const model = () => process.env.OPENAI_MODEL || "gpt-4o";
/** Overridable so a compatible gateway (or a local test double) can stand in for api.openai.com. */
export const openaiUrl = (path: string): string => `${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}${path}`;

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export async function openaiJson(system: string, user: string | Part[], maxTokens = 1200): Promise<unknown> {
  const res = await fetch(openaiUrl("/chat/completions"), {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: model(),
      max_tokens: maxTokens,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    console.error(`OpenAI request failed: ${res.status}`);
    throw new Error("The reading service is unavailable right now. Please try again, or enter the figures by hand.");
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
}
