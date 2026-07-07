import { env } from "../env.js";

const MAX_PROMPT_CHARS = 12_000;

export async function summarizeNotes(noteLines: string[]): Promise<string> {
  const included: string[] = [];
  let charCount = 0;
  for (let i = noteLines.length - 1; i >= 0; i--) {
    const line = noteLines[i];
    if (charCount + line.length > MAX_PROMPT_CHARS) break;
    included.unshift(line);
    charCount += line.length;
  }

  const omitted = noteLines.length - included.length;
  const notice = omitted > 0 ? `\n\n(${omitted} older note(s) omitted for length.)` : "";

  const prompt =
    "You are summarizing someone's personal notes/journal dump. Given the following timestamped " +
    "notes, write a concise summary: key themes, anything actionable, and loose ends. Use short " +
    "bullet points.\n\nNotes:\n\n" +
    included.join("\n") +
    notice;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://github.com/brain-dump-bot",
      "X-Title": "Brain Dump Bot",
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned no content");
  }
  return content.trim();
}
