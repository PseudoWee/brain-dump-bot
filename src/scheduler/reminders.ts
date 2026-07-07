import { and, eq, lte } from "drizzle-orm";
import type { Bot } from "grammy";
import { db } from "../db/client.js";
import { notes, reminders } from "../db/schema.js";

const POLL_INTERVAL_MS = 30_000;

async function sendDueReminders(bot: Bot) {
  const due = await db
    .select({
      reminderId: reminders.id,
      chatId: reminders.chatId,
      noteContent: notes.content,
      noteId: notes.id,
    })
    .from(reminders)
    .innerJoin(notes, eq(reminders.noteId, notes.id))
    .where(and(eq(reminders.sent, false), lte(reminders.remindAt, new Date())));

  for (const row of due) {
    try {
      await bot.api.sendMessage(row.chatId, `Reminder about note #${row.noteId}:\n\n${row.noteContent}`);
    } catch (err) {
      console.error(`Failed to send reminder #${row.reminderId}:`, err);
    } finally {
      await db.update(reminders).set({ sent: true }).where(eq(reminders.id, row.reminderId));
    }
  }
}

export function startReminderScheduler(bot: Bot) {
  const timer = setInterval(() => {
    sendDueReminders(bot).catch((err) => console.error("Reminder scheduler error:", err));
  }, POLL_INTERVAL_MS);

  return () => clearInterval(timer);
}
