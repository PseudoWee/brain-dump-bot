import { Bot } from "grammy";
import { env } from "./env.js";
import { handleCapture } from "./handlers/capture.js";
import {
  handleCancelReminder,
  handleDelete,
  handleExport,
  handleHelp,
  handleListNotes,
  handleListReminders,
  handleStart,
} from "./handlers/commands.js";
import { handleRemind } from "./handlers/remind.js";
import { handleSummary } from "./handlers/summary.js";
import { startReminderScheduler } from "./scheduler/reminders.js";

const bot = new Bot(env.BOT_TOKEN);

if (env.ALLOWED_USER_IDS.length > 0) {
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId && env.ALLOWED_USER_IDS.includes(userId)) {
      await next();
    }
  });
}

bot.command("start", handleStart);
bot.command("help", handleHelp);
bot.command("notes", handleListNotes);
bot.command("remind", handleRemind);
bot.command("reminders", handleListReminders);
bot.command("cancel", handleCancelReminder);
bot.command("delete", handleDelete);
bot.command("export", handleExport);
bot.command("summary", handleSummary);

bot.on("message:text").filter((ctx) => !ctx.message.text.startsWith("/"), handleCapture);

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

await bot.api.setMyCommands([
  { command: "notes", description: "Show your recent notes" },
  { command: "remind", description: "Set a reminder (reply to a saved note)" },
  { command: "reminders", description: "List upcoming reminders" },
  { command: "cancel", description: "Cancel a reminder by id" },
  { command: "delete", description: "Delete a note by id" },
  { command: "export", description: "Export notes as a markdown file" },
  { command: "summary", description: "Get an AI summary of your notes" },
  { command: "help", description: "Show help" },
]);

const stopScheduler = startReminderScheduler(bot);

function shutdown() {
  console.log("Shutting down...");
  stopScheduler();
  bot.stop();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

// Blocks (long polling) until bot.stop() is called by shutdown().
await bot.start({
  drop_pending_updates: true,
  onStart: () => console.log("Brain Dump bot is running."),
});
