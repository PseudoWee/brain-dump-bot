import type { CommandContext, Context } from "grammy";
import { getNotesForRange } from "../lib/notes.js";
import { summarizeNotes } from "../lib/openrouter.js";
import { getOrCreateUser } from "../lib/users.js";
import { env } from "../env.js";

export async function handleSummary(ctx: CommandContext<Context>) {
  const user = await getOrCreateUser(ctx);
  const daysArg = Number(ctx.match?.toString().trim());
  const days = Number.isFinite(daysArg) && daysArg > 0 ? daysArg : null;

  const rows = await getNotesForRange(user.id, days);

  if (rows.length === 0) {
    await ctx.reply("No notes to summarize for that range.");
    return;
  }

  await ctx.replyWithChatAction("typing");

  const noteLines = rows.map(
    (n) => `[${n.createdAt.toLocaleString("en-US", { timeZone: env.TZ, dateStyle: "medium", timeStyle: "short" })}] ${n.content}`,
  );

  try {
    const summary = await summarizeNotes(noteLines);
    const label = days ? `last ${days} day${days === 1 ? "" : "s"}` : "all notes";
    await ctx.reply(`Summary (${label}, ${rows.length} note${rows.length === 1 ? "" : "s"}):\n\n${summary}`);
  } catch (err) {
    console.error("Summary generation failed:", err);
    await ctx.reply("Sorry, I couldn't generate a summary right now. Try again later.");
  }
}
