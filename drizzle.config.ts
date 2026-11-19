import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:local.db";
const remote = url.startsWith("libsql://") || url.startsWith("https://");

export default remote
  ? defineConfig({
      schema: "./src/lib/db/schema.ts",
      out: "./drizzle",
      dialect: "turso",
      dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN },
    })
  : defineConfig({
      schema: "./src/lib/db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: { url },
    });
