import * as chrono from "chrono-node";

export function parseWhen(text: string, timezone: string): Date | null {
  const results = chrono.parse(text, { instant: new Date(), timezone });
  if (results.length === 0) return null;
  return results[0].start.date();
}
