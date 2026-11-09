import { createClient } from '@libsql/client';
import { setupDatabase } from './setup.js';

let client;
let ready;

function raw() {
  if (!client) {
    client = createClient({
      url: process.env.DATABASE_URL || 'file:local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    });
  }
  return client;
}

/**
 * Database client, with tables created and seeded on first use.
 * Local development uses a SQLite file; production uses Turso (libsql://).
 */
export async function conn() {
  if (!ready) {
    ready = setupDatabase(raw()).catch((err) => {
      ready = undefined; // try again on the next request
      throw err;
    });
  }
  await ready;
  return raw();
}

/** Turn a libsql result into plain objects keyed by column name. */
export function rows(result) {
  return result.rows.map((row) => Object.fromEntries(result.columns.map((col, i) => [col, row[i]])));
}
