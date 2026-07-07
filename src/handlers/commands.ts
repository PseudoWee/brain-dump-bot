import { and, desc, eq, gte } from "drizzle-orm";
import { InputFile } from "grammy";
import type { CommandContext, Context } from "grammy";
import { db } from "../db/client.js";
import { notes, reminders } from "../db/schema.js";
import { getOrCreateUser } from "../lib/users.js";
import { env } from "../env.js";

export async function handleStart(ctx: Context) {
  await getOrCreateUser(ctx);
  await ctx.reply(
    "Brain Dump bot is ready.\n\n" +
      "Send me any text and I'll save it as a note.\n\n" +
      "Commands:\n" +
      "/notes [n] - show your last n notes (default 10)\n" +
      "/remind <when> - reply to a saved-note confirmation to set a reminder\n" +
      "/reminders - list your upcoming reminders\n" +
      "/cancel <reminder_id> - cancel a reminder\n" +
      "/delete <note_id> - delete a note\n" +
      "/export [days] - export your notes as a markdown file (all notes if omitted)\n" +
      "/help - show this message",
  );
}

export const handleHelp = handleStart;

export async function handleListNotes(ctx: CommandContext<Context>) {
  const user = await getOrCreateUser(ctx);
  const arg = Number(ctx.match?.toString().trim());
  const limit = Number.isFinite(arg) && arg > 0 ? Math.min(arg, 50) : 10;

  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, user.id))
    .orderBy(desc(notes.createdAt))
    .limit(limit);

  if (rows.length === 0) {
    await ctx.reply("You don't have any notes yet. Just send me a message to save one.");
    return;
  }

  const lines = rows.map((n) => {
    const when = n.createdAt.toLocaleString("en-US", { timeZone: env.TZ, dateStyle: "medium", timeStyle: "short" });
    const preview = n.content.length > 120 ? `${n.content.slice(0, 117)}...` : n.content;
    return `#${n.id} (${when})\n${preview}`;
  });

  await ctx.reply(lines.join("\n\n"));
}

export async function handleDelete(ctx: CommandContext<Context>) {
  const user = await getOrCreateUser(ctx);
  const noteId = Number(ctx.match?.toString().trim());

  if (!Number.isFinite(noteId)) {
    await ctx.reply("Usage: /delete <note_id>");
    return;
  }

  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, user.id)))
    .returning();

  if (deleted.length === 0) {
    await ctx.reply(`I couldn't find note #${noteId} for you.`);
    return;
  }

  await ctx.reply(`Deleted note #${noteId} (and any reminders on it).`);
}

export async function handleListReminders(ctx: Context) {
  const user = await getOrCreateUser(ctx);

  const rows = await db
    .select({
      reminderId: reminders.id,
      remindAt: reminders.remindAt,
      noteId: notes.id,
      noteContent: notes.content,
    })
    .from(reminders)
    .innerJoin(notes, eq(reminders.noteId, notes.id))
    .where(and(eq(reminders.userId, user.id), eq(reminders.sent, false)))
    .orderBy(reminders.remindAt);

  if (rows.length === 0) {
    await ctx.reply("You have no upcoming reminders.");
    return;
  }

  const lines = rows.map((r) => {
    const when = r.remindAt.toLocaleString("en-US", { timeZone: env.TZ, dateStyle: "medium", timeStyle: "short" });
    const preview = r.noteContent.length > 80 ? `${r.noteContent.slice(0, 77)}...` : r.noteContent;
    return `#${r.reminderId} at ${when} - note #${r.noteId}: ${preview}`;
  });

  await ctx.reply(lines.join("\n\n"));
}

export async function handleCancelReminder(ctx: CommandContext<Context>) {
  const user = await getOrCreateUser(ctx);
  const reminderId = Number(ctx.match?.toString().trim());

  if (!Number.isFinite(reminderId)) {
    await ctx.reply("Usage: /cancel <reminder_id>");
    return;
  }

  const deleted = await db
    .delete(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, user.id)))
    .returning();

  if (deleted.length === 0) {
    await ctx.reply(`I couldn't find reminder #${reminderId} for you.`);
    return;
  }

  await ctx.reply(`Cancelled reminder #${reminderId}.`);
}

export async function handleExport(ctx: CommandContext<Context>) {
  const user = await getOrCreateUser(ctx);
  const daysArg = Number(ctx.match?.toString().trim());

  const conditions = [eq(notes.userId, user.id)];
  let label = "all-time";
  if (Number.isFinite(daysArg) && daysArg > 0) {
    const since = new Date(Date.now() - daysArg * 24 * 60 * 60 * 1000);
    conditions.push(gte(notes.createdAt, since));
    label = `last-${daysArg}-days`;
  }

  const rows = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(notes.createdAt);

  if (rows.length === 0) {
    await ctx.reply("No notes to export for that range.");
    return;
  }

  const header = `# Brain Dump export (${label})\n\nGenerated ${new Date().toISOString()}\n${rows.length} notes\n\n---\n\n`;
  const body = rows
    .map((n) => {
      const when = n.createdAt.toLocaleString("en-US", { timeZone: env.TZ, dateStyle: "medium", timeStyle: "short" });
      return `## #${n.id} - ${when}\n\n${n.content}`;
    })
    .join("\n\n---\n\n");

  const buffer = Buffer.from(header + body, "utf-8");
  await ctx.replyWithDocument(new InputFile(buffer, `brain-dump-${label}.md`));
}
