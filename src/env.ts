import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAllowedUserIds(raw: string): number[] {
  const ids: number[] = [];
  for (const token of raw.split(",").map((id) => id.trim()).filter(Boolean)) {
    const id = Number(token);
    if (!Number.isInteger(id)) {
      throw new Error(
        `ALLOWED_USER_IDS contains "${token}", which is not a numeric Telegram user id. ` +
          `Message @userinfobot on Telegram to get your numeric id (usernames like "@name" won't work).`,
      );
    }
    ids.push(id);
  }
  return ids;
}

export const env = {
  BOT_TOKEN: required("BOT_TOKEN"),
  DATABASE_URL: required("DATABASE_URL"),
  TZ: process.env.TZ || "UTC",
  ALLOWED_USER_IDS: parseAllowedUserIds(process.env.ALLOWED_USER_IDS || ""),
  OPENROUTER_API_KEY: required("OPENROUTER_API_KEY"),
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "openrouter/free",
};
