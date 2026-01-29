import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Throw early so it's obvious in logs
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString,
  // Neon requires SSL. This setting works for Neon in serverless dev.
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});
