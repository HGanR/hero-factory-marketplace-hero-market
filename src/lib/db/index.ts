// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { mysql2ConnectionOptionsFromUrl } from "@/lib/db/mysql2-connection-options";

// For serverless environments (Vercel), we need to create a new connection for each request
// Connection pooling doesn't work well in serverless functions
let cachedConnection: mysql.Connection | null = null;

const getConnection = async () => {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in environment variables");
    throw new Error("DATABASE_URL environment variable is not set. Please add it in Vercel Dashboard → Settings → Environment Variables");
  }
  
  // In serverless, reuse connection if it exists and is still valid
  if (cachedConnection) {
    try {
      // Test if connection is still alive
      await cachedConnection.ping();
      return cachedConnection;
    } catch {
      // Connection is dead, create a new one
      cachedConnection = null;
    }
  }
  
  try {
    const connection = await mysql.createConnection(
      mysql2ConnectionOptionsFromUrl(process.env.DATABASE_URL),
    );
    cachedConnection = connection;
    return connection;
  } catch (error) {
    console.error("Database connection error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide specific error messages
    if (errorMessage.includes("Access denied")) {
      throw new Error("Database authentication failed. Check your DATABASE_URL password in Vercel Dashboard.");
    } else if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
      throw new Error("Cannot reach database server. Check your DATABASE_URL host in Vercel Dashboard.");
    } else {
      throw new Error(`Database connection failed: ${errorMessage}. Verify DATABASE_URL is set correctly in Vercel Dashboard → Settings → Environment Variables.`);
    }
  }
};

export { getConnection };

export const getDb = async () => {
  const conn = await getConnection();
  return drizzle(conn);
};

export { withDbTimeout } from "@/lib/db/db-timeout";

