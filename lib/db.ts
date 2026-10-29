import postgres from "postgres";

// Reuse one client across hot reloads in dev.
const g = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql =
  g.sql ??
  (g.sql = postgres(process.env.DATABASE_URL!, {
    // Supabase's pooler (transaction mode) does not support prepared statements.
    prepare: false,
    ssl: process.env.DATABASE_SSL === "1" ? "require" : false,
    max: 5,
  }));
