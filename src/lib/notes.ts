import { and, eq, gte } from "drizzle-orm";
import { db } from "../db/client.js";
import { notes } from "../db/schema.js";

export async function getNotesForRange(userId: number, days: number | null) {
  const conditions = [eq(notes.userId, userId)];
  if (days !== null) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    conditions.push(gte(notes.createdAt, since));
  }
  return db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(notes.createdAt);
}
