import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, QueryResultRow } from "pg";
import * as schema from "./schema";

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }

    pool = new Pool({ connectionString });
  }

  return pool;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }

  return dbInstance;
}

export const db = getDb();

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  const p = getPool();
  return p.query<T>(text, values);
}
