import type { CommandContext, Context } from "grammy";
import { classifyIntent, looksLikeCommand } from "../lib/intent.js";
import { handleCapture } from "./capture.js";
import {
  handleCancelReminder,
  handleDelete,
  handleExport,
  handleListNotes,
  handleListReminders,
} from "./commands.js";
import { handleRemind, SAVED_NOTE_PATTERN } from "./remind.js";
import { handleSummary } from "./summary.js";

// Routes a plain-text message (not a slash command) to either note capture, or - if it looks like
// a request ("remind me about note 3 tomorrow", "delete note 1") - the matching command handler,
// via a cheap keyword pre-filter plus an LLM classification step for the ambiguous cases.
export async function routeMessage(ctx: Context) {
  const text = ctx.message?.text;
  if (!text) return;

  if (!looksLikeCommand(text)) {
    await handleCapture(ctx);
    return;
  }

  const isReply = SAVED_NOTE_PATTERN.test(ctx.message?.reply_to_message?.text ?? "");
  const intent = await classifyIntent(text, isReply);

  if (intent.command === "capture") {
    await handleCapture(ctx);
    return;
  }

  ctx.match = intent.args;
  const withMatch = ctx as CommandContext<Context>;

  switch (intent.command) {
    case "remind":
      await handleRemind(withMatch);
      break;
    case "delete":
      await handleDelete(withMatch);
      break;
    case "cancel":
      await handleCancelReminder(withMatch);
      break;
    case "notes":
      await handleListNotes(withMatch);
      break;
    case "reminders":
      await handleListReminders(ctx);
      break;
    case "export":
      await handleExport(withMatch);
      break;
    case "summary":
      await handleSummary(withMatch);
      break;
  }
}
