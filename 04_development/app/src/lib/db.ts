import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://claudemanager:claudemanager@localhost:5432/claudemanager',
});

export const db = drizzle(pool, { schema });
export { pool };
export default db;
