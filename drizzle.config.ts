// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import { mysql2ConnectionOptionsFromUrl } from "./src/lib/db/mysql2-connection-options";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

function dbCredentialsFromEnv() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const opts = mysql2ConnectionOptionsFromUrl(url);
  if (typeof opts === "string") {
    return { url: opts };
  }
  return {
    host: opts.host!,
    port: opts.port!,
    user: opts.user,
    password: opts.password,
    database: opts.database,
    ssl: opts.ssl,
  };
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: dbCredentialsFromEnv(),
});

