import { eq } from "drizzle-orm";
import type { Context } from "grammy";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

export async function getOrCreateUser(ctx: Context) {
  const from = ctx.from;
  const chatId = ctx.chat?.id;
  if (!from || !chatId) {
    throw new Error("Update has no from/chat, cannot resolve user");
  }

  const [existing] = await db.select().from(users).where(eq(users.telegramId, from.id)).limit(1);

  if (existing) {
    if (existing.chatId !== chatId || existing.username !== from.username) {
      const [updated] = await db
        .update(users)
        .set({ chatId, username: from.username, firstName: from.first_name })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      telegramId: from.id,
      chatId,
      username: from.username,
      firstName: from.first_name,
    })
    .returning();

  return created;
}
