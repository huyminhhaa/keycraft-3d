import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Singleton Database Connection Pool
 * Sử dụng connection pooling để tái sử dụng kết nối trong môi trường Next.js
 */
const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

const isCloudOrSsl =
  Boolean(process.env.DATABASE_URL?.includes('sslmode=require')) ||
  Boolean(process.env.DATABASE_URL?.includes('neon.tech'));

export const pool =
  globalForDb.conn ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://keycraft:keycraft_secret@localhost:5432/keycraft_db',
    ssl: isCloudOrSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = pool;
}

export const db = drizzle(pool, { schema });
export type Database = typeof db;
