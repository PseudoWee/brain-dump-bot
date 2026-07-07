import { env } from "../env.js";

export interface Intent {
  command: "capture" | "remind" | "delete" | "cancel" | "notes" | "reminders" | "export" | "summary";
  args: string;
}

const VALID_COMMANDS: Intent["command"][] = [
  "capture",
  "remind",
  "delete",
  "cancel",
  "notes",
  "reminders",
  "export",
  "summary",
];

// Cheap pre-filter so a plain note ("buy milk") never pays for an LLM round trip -
// only messages that plausibly ask the bot to *do* something get classified.
const COMMAND_HINT_PATTERN = /\b(remind|reminder|delete|remove|cancel|summar|export|list|show)\b/i;

export function looksLikeCommand(text: string): boolean {
  return COMMAND_HINT_PATTERN.test(text);
}

const SYSTEM_PROMPT = `You are an intent router for a personal Telegram notes bot. Given the user's \
message, decide which single action they want. Reply with ONLY compact JSON, no prose, no markdown \
fences: {"command": "...", "args": "..."}

Commands:
- capture: they just want this text saved as a new note (default if unsure or if it's not clearly a request).
- remind: set a reminder on an existing note. args = "<note_id> <when>" (e.g. "12 tomorrow 9am"). If \
the message is a reply to a "Saved as note #N" confirmation and no note id is mentioned, omit the id \
and args = "<when>" only.
- delete: delete a note. args = "<note_id>"
- cancel: cancel a reminder. args = "<reminder_id>"
- notes: list recent notes. args = "<n>" or ""
- reminders: list upcoming reminders. args = ""
- export: export notes as a file. args = "<days>" or ""
- summary: get an AI summary of notes. args = "<days>" or ""

If the message doesn't clearly map to remind/delete/cancel/notes/reminders/export/summary, use capture.`;

export async function classifyIntent(text: string, isReplyToSavedNote: boolean): Promise<Intent> {
  const userContent = isReplyToSavedNote
    ? `(This message is a reply to a "Saved as note #N" confirmation.)\n${text}`
    : text;

  try {
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
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) return { command: "capture", args: "" };

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return { command: "capture", args: "" };

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { command: "capture", args: "" };

    const parsed = JSON.parse(jsonMatch[0]) as { command?: unknown; args?: unknown };
    if (typeof parsed.command !== "string" || !VALID_COMMANDS.includes(parsed.command as Intent["command"])) {
      return { command: "capture", args: "" };
    }

    return {
      command: parsed.command as Intent["command"],
      args: typeof parsed.args === "string" ? parsed.args : "",
    };
  } catch (err) {
    console.error("Intent classification failed, defaulting to capture:", err);
    return { command: "capture", args: "" };
  }
}
