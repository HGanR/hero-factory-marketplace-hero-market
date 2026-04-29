import mysql from "mysql2/promise";

let cachedConnection: mysql.Connection | null = null;

export const getConnection = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }
  if (cachedConnection) {
    try {
      await cachedConnection.ping();
      return cachedConnection;
    } catch {
      cachedConnection = null;
    }
  }
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  cachedConnection = conn;
  return conn;
};









