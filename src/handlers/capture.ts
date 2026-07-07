import type { Context } from "grammy";
import { db } from "../db/client.js";
import { notes } from "../db/schema.js";
import { getOrCreateUser } from "../lib/users.js";

export async function handleCapture(ctx: Context) {
  const text = ctx.message?.text;
  if (!text) return;

  const user = await getOrCreateUser(ctx);

  const [note] = await db
    .insert(notes)
    .values({ userId: user.id, content: text })
    .returning();

  await ctx.reply(
    `Saved as note #${note.id}\n\nReply to this message with /remind <when> to get a nudge later, e.g. /remind tomorrow 9am`,
    { reply_parameters: { message_id: ctx.message!.message_id } },
  );
}
