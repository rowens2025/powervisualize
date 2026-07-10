import { Pool } from 'pg';

/**
 * Connection to the separate Fannie Mae mortgage warehouse (fanniemae-db).
 * Unlike the portfolio DB (_db.ts), this is optional — if the env var is unset
 * the viz endpoint degrades gracefully instead of crashing the whole function.
 */
const connectionString = process.env.FANNIE_DATABASE_URL;

export const fanniePool: Pool | null = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      // Neon scales suspended computes to zero; first connect can be slow while
      // the fanniemae-db compute wakes. Allow headroom so a cold start doesn't 500.
      connectionTimeoutMillis: 20_000,
    })
  : null;

export const MORTGAGE_SCHEMA = 'analytics_mart_mortgage';
