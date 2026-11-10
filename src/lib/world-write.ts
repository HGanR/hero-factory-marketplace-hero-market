import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

// A dedicated connection prevents overlapping requests from sharing a transaction.
// Locking the world serializes draft saves and publication, including empty worlds.
export async function withWorldWrite<T>(
  worldId: string,
  operation: (tx: Parameters<Parameters<MySql2Database["transaction"]>[0]>[0]) => Promise<T>
): Promise<T> {
  if (!process.env.DATABASE_URL) throw new Error("World storage is unavailable.");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    return await drizzle(connection).transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM worlds WHERE id = ${worldId} FOR UPDATE`);
      return operation(tx);
    });
  } finally {
    await connection.end();
  }
}
