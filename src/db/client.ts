import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

// prepare: false is required when connecting through Supabase's transaction-mode pooler
// (pgbouncer transaction mode doesn't support prepared statements). Harmless otherwise.
const queryClient = postgres(env.DATABASE_URL, { max: 5, prepare: false });

export const db = drizzle(queryClient, { schema });
