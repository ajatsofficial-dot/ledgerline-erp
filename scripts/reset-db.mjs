// Wipe the database and seed it again. The app also sets itself up on first request.
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { setupDatabase } from '../lib/setup.js';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const client = createClient({ url: process.env.DATABASE_URL || 'file:local.db', authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
console.log(await setupDatabase(client, { reset: true }));
