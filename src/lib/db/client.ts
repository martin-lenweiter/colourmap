import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  const client = postgres(connectionString, { max: 10, prepare: false });
  return drizzle(client);
}

let _db: ReturnType<typeof getDb> | undefined;
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    if (!_db) _db = getDb();
    return (_db as never)[prop];
  },
});
