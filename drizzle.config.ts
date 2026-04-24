import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: false,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});