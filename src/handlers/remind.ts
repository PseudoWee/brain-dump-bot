import { and, eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../db/client.js";
import { notes, reminders } from "../db/schema.js";
import { parseWhen } from "../lib/dateParser.js";
import { getOrCreateUser } from "../lib/users.js";
import { env } from "../env.js";

export const SAVED_NOTE_PATTERN = /Saved as note #(\d+)/;

export async function handleRemind(ctx: CommandContext<Context>) {
  const user = await getOrCreateUser(ctx);
  const rawArgs = ctx.match?.toString().trim() ?? "";
  if (!rawArgs) {
    await ctx.reply(
      "Usage: reply to a \"Saved as note #N\" confirmation with /remind <when>, " +
        "or use /remind <note_id> <when>, e.g. /remind 12 tomorrow 9am",
    );
    return;
  }

  const repliedText = ctx.message?.reply_to_message?.text;
  const repliedMatch = repliedText?.match(SAVED_NOTE_PATTERN);

  let noteId: number | null = null;
  let whenText = rawArgs;

  if (repliedMatch) {
    noteId = Number(repliedMatch[1]);
  } else {
    const firstToken = rawArgs.split(/\s+/, 1)[0];
    if (/^\d+$/.test(firstToken)) {
      noteId = Number(firstToken);
      whenText = rawArgs.slice(firstToken.length).trim();
    }
  }

  if (noteId === null || !whenText) {
    await ctx.reply(
      "I couldn't tell which note to remind you about. Reply to its \"Saved as note #N\" " +
        "message with /remind <when>, or use /remind <note_id> <when>.",
    );
    return;
  }

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, user.id)))
    .limit(1);

  if (!note) {
    await ctx.reply(`I couldn't find note #${noteId} for you.`);
    return;
  }

  const remindAt = parseWhen(whenText, env.TZ);
  if (!remindAt) {
    await ctx.reply(`I couldn't understand the time "${whenText}". Try something like "tomorrow 9am" or "in 2 hours".`);
    return;
  }

  if (remindAt.getTime() <= Date.now()) {
    await ctx.reply("That time is in the past. Try a future time.");
    return;
  }

  const [reminder] = await db
    .insert(reminders)
    .values({
      noteId: note.id,
      userId: user.id,
      chatId: user.chatId,
      remindAt,
    })
    .returning();

  await ctx.reply(
    `Reminder #${reminder.id} set for ${remindAt.toLocaleString("en-US", { timeZone: env.TZ, dateStyle: "medium", timeStyle: "short" })} ` +
      `(${env.TZ}) about note #${note.id}.`,
  );
}
